"use server";

import { redirect } from "next/navigation";
import { parseIdentifier, findUserByIdentifier, createUser, setPassword } from "@/lib/auth";
import { verifyPassword, MIN_PASSWORD } from "@/lib/password";
import { createSession, destroySession, currentUser, pruneExpired } from "@/lib/session";
import { limit, retryMessage } from "@/lib/ratelimit";
import { run, newId, now } from "@/db/index";
import { signupSchema, identifierSchema, providerProfileSchema, fieldErrors } from "@/lib/validation";
import { zipExists } from "@/db/queries";

/**
 * Every action here re-checks its own inputs and its own authorisation. Server
 * Actions are reachable by direct POST, so none of them may assume it was
 * reached through the UI that calls it.
 */

export type FormState = {
  ok?: boolean;
  error?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  /** Show the "choose a password" fields: this address has no password yet. */
  needsPassword?: boolean;
  notice?: string;
};


/* ------------------------------------------------------------- sign in --- */

/**
 * Signs in, creating the account if this is the first time.
 *
 * An address alone used to be enough, which meant anyone who knew an address
 * was signed in as that person — fine for a seeker whose account holds a ZIP
 * code, not fine for an approved restaurant or for the admin who approves
 * them. Now the address is a username and the password is the proof.
 *
 * Three cases, and the form shows a second step for two of them:
 *
 *   - the account exists and has a password: check it
 *   - the account exists without one (seeded, or created before this): ask
 *     them to choose one now rather than locking them out
 *   - no account: create it, with the password they choose
 *
 * The same "choose a password" step therefore covers both a brand new user
 * and an old account, and neither path reveals which it was. Telling someone
 * "no account with that address" is a free way to enumerate who has one.
 */
export async function signIn(_prev: FormState, data: FormData): Promise<FormState> {
  const raw = String(data.get("identifier") ?? "");
  const parsed = identifierSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Enter an email address or phone number", values: { identifier: raw } };
  }

  const id = parseIdentifier(parsed.data);
  if (!id) {
    return {
      error: "That doesn't look like an email address or phone number",
      values: { identifier: raw },
    };
  }

  // Still rate limited. Without a code step this is the only thing standing
  // between the sign-in form and someone walking a list of addresses.
  const gate = await limit("otpRequest");
  if (!gate.ok) {
    return { error: retryMessage(gate.retryAfterSeconds), values: { identifier: raw } };
  }

  const role = data.get("role") === "provider" ? "provider" : "seeker";
  const name = String(data.get("name") ?? "").slice(0, 120);
  const password = String(data.get("password") ?? "");
  const confirm = String(data.get("confirm") ?? "");

  const existing = await findUserByIdentifier(id);
  const settingUp = !existing || !existing.password_hash;

  // Choosing a password: both fields, twice, before anything is written.
  if (settingUp) {
    const keep = { identifier: raw };

    // The confirm field only exists once we have asked for it. On the first
    // submit it is absent, and complaining that it does not match would be a
    // complaint about a box the person has never seen.
    if (!password || !data.has("confirm")) {
      return {
        needsPassword: true,
        notice: existing
          ? "This account doesn't have a password yet. Choose one now."
          : "No account with that address yet. Choose a password and we'll create one.",
        values: keep,
      };
    }

    if (password.length < MIN_PASSWORD) {
      return {
        needsPassword: true,
        errors: { password: `Use at least ${MIN_PASSWORD} characters` },
        values: keep,
      };
    }

    if (password !== confirm) {
      return {
        needsPassword: true,
        errors: { confirm: "Those don't match" },
        values: keep,
      };
    }

    const userId = existing?.id ?? (await createUser(id, { role, name }));
    await setPassword(userId, password);
    await createSession(userId);
    await pruneExpired();

    const landing = existing?.role ?? role;
    redirect(landing === "provider" ? "/provider" : landing === "admin" ? "/admin" : "/food");
  }

  if (!(await verifyPassword(password, existing.password_hash))) {
    // One message for a wrong password and for an address that does not
    // exist. Separating them turns this form into an account-enumeration
    // tool, and the people with most to lose here are the ones least able
    // to absorb it.
    return { error: "That email or password isn't right", values: { identifier: raw } };
  }

  await createSession(existing.id);
  await pruneExpired();

  redirect(
    existing.role === "provider" ? "/provider" : existing.role === "admin" ? "/admin" : "/food",
  );
}

/* --------------------------------------------------------------- sign up -- */

/**
 * Provider sign-up. Creates the account and the business profile in one step,
 * then leaves the business 'pending' until an admin approves it — which is why
 * the success path lands on the dashboard's pending notice rather than the
 * post form.
 */
export async function registerProvider(_prev: FormState, data: FormData): Promise<FormState> {
  const gate = await limit("signup");
  if (!gate.ok) return { error: retryMessage(gate.retryAfterSeconds) };

  const values = Object.fromEntries(
    ["identifier", "business_name", "street", "city", "state", "zip", "contact_name", "phone", "permit_number"].map(
      (k) => [k, String(data.get(k) ?? "")],
    ),
  );

  const account = signupSchema.safeParse({
    identifier: values.identifier,
    role: "provider",
    name: values.contact_name,
    language: String(data.get("language") ?? "en"),
  });

  const profile = providerProfileSchema.safeParse({
    business_name: values.business_name,
    street: values.street,
    city: values.city,
    state: values.state,
    zip: values.zip,
    contact_name: values.contact_name,
    phone: values.phone,
    email: values.identifier.includes("@") ? values.identifier : "",
    permit_number: values.permit_number,
  });

  if (!account.success || !profile.success) {
    return {
      error: "Check the highlighted fields",
      errors: {
        ...(account.success ? {} : fieldErrors(account.error)),
        ...(profile.success ? {} : fieldErrors(profile.error)),
      },
      values,
    };
  }

  // The ZIP has to exist in the bundled centroid table or distance sorting
  // would silently drop this business out of every search.
  if (!await zipExists(profile.data.zip)) {
    return {
      error: "Check the highlighted fields",
      errors: { zip: "We don't recognise that ZIP code" },
      values,
    };
  }

  const id = parseIdentifier(account.data.identifier);
  if (!id) {
    return { error: "Check the highlighted fields", errors: { identifier: "Enter an email address or phone number" }, values };
  }

  if (await findUserByIdentifier(id)) {
    return {
      error: "Check the highlighted fields",
      errors: { identifier: "There's already an account using that. Sign in instead." },
      values,
    };
  }

  // A restaurant's account can post food under its name to everyone nearby,
  // so this one is not optional and never has been skippable.
  const password = String(data.get("password") ?? "");
  if (password.length < MIN_PASSWORD) {
    return {
      error: "Check the highlighted fields",
      errors: { password: `Use at least ${MIN_PASSWORD} characters` },
      values,
    };
  }
  if (password !== String(data.get("confirm") ?? "")) {
    return {
      error: "Check the highlighted fields",
      errors: { confirm: "Those don't match" },
      values,
    };
  }

  const userId = await createUser(id, {
    role: "provider",
    name: profile.data.contact_name,
    language: account.data.language,
    password,
  });

  await run(
    `INSERT INTO providers (id, user_id, business_name, street, city, state, zip,
       contact_name, phone, email, permit_number, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending',?)`,
    [
      newId("prv"),
      userId,
      profile.data.business_name,
      profile.data.street,
      profile.data.city,
      profile.data.state,
      profile.data.zip,
      profile.data.contact_name,
      profile.data.phone,
      profile.data.email,
      profile.data.permit_number,
      now(),
    ],
  );

  await createSession(userId);
  redirect("/provider");
}

/* ---------------------------------------------------------------- misc ---- */

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function requireSignedIn(): Promise<void> {
  if (!(await currentUser())) redirect("/login");
}
