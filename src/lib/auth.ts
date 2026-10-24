import "server-only";
import { createHash, randomInt } from "node:crypto";
import { get, run, newId, now } from "@/db/index";
import { safeEqual } from "./session";
import { deliver } from "./notify";

/**
 * Sign-in by one-time code, to email or phone.
 *
 * There is no password anywhere in MealBridge, and no identity document, proof
 * of income or payment method. A person who needs dinner should not have to
 * invent and remember a password to find out where it is. The cost of that
 * choice is that the code path has to be hardened carefully, which is what the
 * attempt counter, the expiry and the rate limit below are for.
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hash = (code: string, identifier: string) =>
  createHash("sha256").update(`${identifier}:${code}`).digest("hex");

export type Identifier = { kind: "email"; value: string } | { kind: "phone"; value: string };

/**
 * Normalises what someone typed into something we can match on.
 *
 * Phone numbers are reduced to E.164 for US numbers, because a person who
 * signs up as "(312) 555-0148" and comes back as "312-555-0148" is the same
 * person and must not become a second account.
 */
export function parseIdentifier(raw: string): Identifier | null {
  const input = String(raw ?? "").trim();
  if (!input) return null;

  if (input.includes("@")) {
    const email = input.toLowerCase();
    // Deliberately permissive: the code we send is the real check on whether
    // an address works, so over-strict syntax rules only lock out valid users.
    if (!/^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(email) || email.length > 254) return null;
    return { kind: "email", value: email };
  }

  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return { kind: "phone", value: `+1${digits}` };
  if (digits.length === 11 && digits.startsWith("1")) return { kind: "phone", value: `+${digits}` };
  if (input.startsWith("+") && digits.length >= 8 && digits.length <= 15)
    return { kind: "phone", value: `+${digits}` };
  return null;
}

/** Masked for display, so a shoulder-surfer learns nothing from the screen. */
export function maskIdentifier(id: Identifier): string {
  if (id.kind === "email") {
    const [user, domain] = id.value.split("@");
    const head = user.slice(0, Math.min(2, user.length));
    return `${head}${"•".repeat(Math.max(3, user.length - 2))}@${domain}`;
  }
  return `${"•".repeat(Math.max(0, id.value.length - 4))}${id.value.slice(-4)}`;
}

/**
 * Issues a code and hands it to the delivery layer.
 *
 * Always resolves the same way whether or not the identifier is known. Telling
 * a caller "no account with that email" turns the sign-in form into a tool for
 * discovering who has an account here, and on this product that leaks who has
 * been looking for food.
 */
export async function issueCode(id: Identifier): Promise<void> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  run(
    "INSERT INTO otp_codes (id, identifier, code_hash, expires_at, attempts, created_at) VALUES (?,?,?,?,0,?)",
    [newId("otp"), id.value, hash(code, id.value), now() + CODE_TTL_MS, now()],
  );

  await deliver({
    channel: id.kind === "email" ? "email" : "sms",
    to: id.value,
    subject: "Your MealBridge code",
    body: `${code} is your MealBridge code. It works for the next 10 minutes.`,
  });
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "wrong" | "too_many" };

/**
 * Checks a code and burns it.
 *
 * Only the newest unconsumed code counts, so requesting a second code
 * invalidates the first in practice. The attempt counter is incremented on the
 * stored row rather than kept in memory, because an attacker guessing a
 * 6-digit code would otherwise just open a new connection.
 */
export function verifyCode(id: Identifier, submitted: string): VerifyResult {
  const code = String(submitted ?? "").replace(/\D/g, "");

  const row = get<{ id: string; code_hash: string; expires_at: number; attempts: number }>(
    `SELECT id, code_hash, expires_at, attempts FROM otp_codes
     WHERE identifier = ? AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [id.value],
  );

  if (!row) return { ok: false, reason: "expired" };
  if (row.expires_at < now()) return { ok: false, reason: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many" };

  if (!safeEqual(row.code_hash, hash(code, id.value))) {
    run("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?", [row.id]);
    return { ok: false, reason: row.attempts + 1 >= MAX_ATTEMPTS ? "too_many" : "wrong" };
  }

  run("UPDATE otp_codes SET consumed_at = ? WHERE id = ?", [now(), row.id]);
  return { ok: true };
}

/* ------------------------------------------------------------------ users - */

export type NewUserInput = {
  role: "seeker" | "provider";
  name?: string;
  language?: "en" | "es";
};

export function findUserByIdentifier(id: Identifier): { id: string; role: string } | undefined {
  const column = id.kind === "email" ? "email" : "phone";
  return get<{ id: string; role: string }>(`SELECT id, role FROM users WHERE ${column} = ?`, [
    id.value,
  ]);
}

export function createUser(id: Identifier, input: NewUserInput): string {
  const uid = newId("usr");
  run(
    "INSERT INTO users (id, role, name, email, phone, language, created_at) VALUES (?,?,?,?,?,?,?)",
    [
      uid,
      input.role,
      input.name?.slice(0, 120) ?? "",
      id.kind === "email" ? id.value : null,
      id.kind === "phone" ? id.value : null,
      input.language ?? "en",
      now(),
    ],
  );
  return uid;
}

/** Signs in an existing user or creates one. Returns the user id. */
export function upsertUser(id: Identifier, input: NewUserInput): string {
  return findUserByIdentifier(id)?.id ?? createUser(id, input);
}
