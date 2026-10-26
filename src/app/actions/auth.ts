"use server";

import { redirect } from "next/navigation";
import { parseIdentifier, findUserByIdentifier, upsertUser } from "@/lib/auth";
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
};


/* ------------------------------------------------------------- sign in --- */

/**
 * Signs in, creating the account if this is the first time.
 *
 * There is no password and no emailed code. The product has to reach people
 * who are trying to find dinner on a borrowed phone, and every step between
 * them and a list of addresses loses some of them; a code is also a step that
 * only works if a mail or SMS provider is configured, which in this
 * deployment it is not.
 *
 * The honest consequence: possession of an email address is not proved, so
 * anyone who types a known address is signed in as that person. That is
 * acceptable for a seeker, whose account holds a ZIP code and a few saved
 * listings, and it is NOT acceptable for an approved provider or an admin.
 * See README "Authentication" — restoring the one-time code is a matter of
 * putting back `issueCode`/`verifyCode`, which are in the git history, and
 * setting RESEND_API_KEY or the Twilio variables.
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

  const existing = await findUserByIdentifier(id);
  const userId = existing?.id ?? (await upsertUser(id, { role, name }));

  await createSession(userId);
  await pruneExpired();

  const landing = existing?.role ?? role;
  redirect(landing === "provider" ? "/provider" : landing === "admin" ? "/admin" : "/food");
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

  const userId = await upsertUser(id, { role: "provider", name: profile.data.contact_name, language: account.data.language });

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
