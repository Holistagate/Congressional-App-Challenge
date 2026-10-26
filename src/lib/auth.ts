import "server-only";
import { get, run, newId, now } from "@/db/index";

/**
 * Identity, such as it is.
 *
 * There is no password anywhere in MealBridge, and no identity document, proof
 * of income or payment method. A person who needs dinner should not have to
 * invent and remember a password to find out where it is.
 *
 * There is also, currently, no one-time code: sign-in trusts the address you
 * type. What remains here is the part that normalises an address into
 * something we can match on, and the account lookup behind it. See the note on
 * `signIn` in app/actions/auth.ts for what that costs.
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

/* ------------------------------------------------------------------ users - */

export type NewUserInput = {
  role: "seeker" | "provider";
  name?: string;
  language?: "en" | "es";
};

export async function findUserByIdentifier(
  id: Identifier,
): Promise<{ id: string; role: string } | undefined> {
  const column = id.kind === "email" ? "email" : "phone";
  return await get<{ id: string; role: string }>(`SELECT id, role FROM users WHERE ${column} = ?`, [
    id.value,
  ]);
}

export async function createUser(id: Identifier, input: NewUserInput): Promise<string> {
  const uid = newId("usr");
  await run(
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
export async function upsertUser(id: Identifier, input: NewUserInput): Promise<string> {
  const existing = await findUserByIdentifier(id);
  return existing?.id ?? await createUser(id, input);
}
