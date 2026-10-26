import "server-only";
import { get, run, newId, now } from "@/db/index";
import { hashPassword } from "./password";

/**
 * Identity.
 *
 * An account is an address plus a password. There is no identity document, no
 * proof of income and no payment method, and browsing food needs no account at
 * all — a person who needs dinner tonight can type a ZIP and go. The password
 * exists for the accounts where impersonation actually costs something: an
 * approved restaurant posting in a stranger's name, and the admin who can
 * approve restaurants.
 *
 * Accounts created before passwords, including every seeded one, have a null
 * password_hash and are asked to choose one the next time they sign in.
 */

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
    // Deliberately permissive. Over-strict syntax rules lock out valid
    // addresses, and the address is a username here, not a delivery route.
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

/* ------------------------------------------------------------------ users - */

export type NewUserInput = {
  role: "seeker" | "provider";
  name?: string;
  language?: "en" | "es";
  password?: string;
};

export type UserAccount = { id: string; role: string; password_hash: string | null };

export async function findUserByIdentifier(id: Identifier): Promise<UserAccount | undefined> {
  const column = id.kind === "email" ? "email" : "phone";
  return await get<UserAccount>(
    `SELECT id, role, password_hash FROM users WHERE ${column} = ?`,
    [id.value],
  );
}

/** Sets or replaces an account's password. */
export async function setPassword(userId: string, password: string): Promise<void> {
  await run("UPDATE users SET password_hash = ? WHERE id = ?", [
    await hashPassword(password),
    userId,
  ]);
}

export async function createUser(id: Identifier, input: NewUserInput): Promise<string> {
  const uid = newId("usr");
  await run(
    "INSERT INTO users (id, role, name, email, phone, language, created_at, password_hash) VALUES (?,?,?,?,?,?,?,?)",
    [
      uid,
      input.role,
      input.name?.slice(0, 120) ?? "",
      id.kind === "email" ? id.value : null,
      id.kind === "phone" ? id.value : null,
      input.language ?? "en",
      now(),
      input.password ? await hashPassword(input.password) : null,
    ],
  );
  return uid;
}

/** Signs in an existing user or creates one. Returns the user id. */
export async function upsertUser(id: Identifier, input: NewUserInput): Promise<string> {
  const existing = await findUserByIdentifier(id);
  return existing?.id ?? await createUser(id, input);
}
