"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  parseIdentifier,
  maskIdentifier,
  issueCode,
  verifyCode,
  findUserByIdentifier,
  upsertUser,
} from "@/lib/auth";
import { createSession, destroySession, currentUser, pruneExpired } from "@/lib/session";
import { limit, retryMessage } from "@/lib/ratelimit";
import { run, newId, now } from "@/db/index";
import { signupSchema, codeSchema, identifierSchema, providerProfileSchema, fieldErrors } from "@/lib/validation";
import { zipExists } from "@/db/queries";
import { PENDING_COOKIE } from "@/lib/cookies";

/**
 * Every action here re-checks its own inputs and its own authorisation. Server
 * Actions are reachable by direct POST, so none of them may assume it was
 * reached through the UI that calls it.
 */

export type FormState = {
  ok?: boolean;
  error?: string;
  errors?: Record<string, string>;
  /** Carried between the two steps of sign-in. */
  identifier?: string;
  masked?: string;
  values?: Record<string, string>;
};


/* ------------------------------------------------------- step 1: request -- */

export async function requestCode(_prev: FormState, data: FormData): Promise<FormState> {
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

  const gate = await limit("otpRequest");
  if (!gate.ok) {
    return { error: retryMessage(gate.retryAfterSeconds), values: { identifier: raw } };
  }

  const role = data.get("role") === "provider" ? "provider" : "seeker";
  const name = String(data.get("name") ?? "");

  // Remember what this sign-in is for, so step two can create the right kind
  // of account without trusting a hidden field the browser could rewrite.
  const jar = await cookies();
  jar.set(
    PENDING_COOKIE,
    JSON.stringify({ identifier: id.value, kind: id.kind, role, name: name.slice(0, 120) }),
    { httpOnly: true, sameSite: "lax", path: "/", maxAge: 900, secure: process.env.NODE_ENV === "production" },
  );

  await issueCode(id);
  // pruneExpired is now a sync function in lib/session that only works locally,
  // for cloud we rely on the cron route.

  return { ok: true, identifier: id.value, masked: maskIdentifier(id) };
}

/* -------------------------------------------------------- step 2: verify -- */

export async function submitCode(_prev: FormState, data: FormData): Promise<FormState> {
  const jar = await cookies();
  const pendingRaw = jar.get(PENDING_COOKIE)?.value;
  if (!pendingRaw) return { error: "That sign-in expired. Ask for a new code." };

  let pending: { identifier: string; kind: "email" | "phone"; role: "seeker" | "provider"; name: string };
  try {
    pending = JSON.parse(pendingRaw);
  } catch {
    return { error: "That sign-in expired. Ask for a new code." };
  }

  const gate = await limit("otpVerify");
  if (!gate.ok) return { error: retryMessage(gate.retryAfterSeconds) };

  const code = codeSchema.safeParse(String(data.get("code") ?? ""));
  if (!code.success) {
    return { error: "Enter the 6-digit code", masked: pending.identifier };
  }

  const id = { kind: pending.kind, value: pending.identifier } as const;
  const result = await verifyCode(id, code.data);

  if (!result.ok) {
    const message =
      result.reason === "expired"
        ? "That code has expired. Ask for a new one."
        : result.reason === "too_many"
          ? "Too many tries. Ask for a new code."
          : "That code isn't right. Check it and try again.";
    return { error: message, masked: pending.identifier };
  }

  const existing = await findUserByIdentifier(id);
  const userId = existing?.id ?? await upsertUser(id, { role: pending.role, name: pending.name });

  await createSession(userId);
  jar.delete(PENDING_COOKIE);

  const role = existing?.role ?? pending.role;
  redirect(role === "provider" ? "/provider" : role === "admin" ? "/admin" : "/food");
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
  if (!(await zipExists(profile.data.zip))) {
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

  const jar = await cookies();
  jar.set(
    PENDING_COOKIE,
    JSON.stringify({ identifier: id.value, kind: id.kind, role: "provider", name: profile.data.contact_name }),
    { httpOnly: true, sameSite: "lax", path: "/", maxAge: 900, secure: process.env.NODE_ENV === "production" },
  );

  await issueCode(id);
  return { ok: true, identifier: id.value, masked: maskIdentifier(id) };
}

/* ---------------------------------------------------------------- misc ---- */

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function requireSignedIn(): Promise<void> {
  if (!(await currentUser())) redirect("/login");
}
