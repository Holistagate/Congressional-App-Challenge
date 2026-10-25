import "server-only";
import { createHash, randomInt } from "node:crypto";
import { get, run, newId, now } from "@/db/index";
import { safeEqual } from "./session";
import { deliver } from "./notify";

/**
 * Sign-in by one-time code, to email or phone.
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hash = (code: string, identifier: string) =>
  createHash("sha256").update(`${identifier}:${code}`).digest("hex");

export type Identifier = { kind: "email"; value: string } | { kind: "phone"; value: string };

export function parseIdentifier(raw: string): Identifier | null {
  const input = String(raw ?? "").trim();
  if (!input) return null;

  if (input.includes("@")) {
    const email = input.toLowerCase();
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

export function maskIdentifier(id: Identifier): string {
  if (id.kind === "email") {
    const [user, domain] = id.value.split("@");
    const head = user.slice(0, Math.min(2, user.length));
    return `${head}${"•".repeat(Math.max(3, user.length - 2))}@${domain}`;
  }
  return `${"•".repeat(Math.max(0, id.value.length - 4))}${id.value.slice(-4)}`;
}

export async function issueCode(id: Identifier): Promise<void> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  await run(
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

export async function verifyCode(id: Identifier, submitted: string): Promise<VerifyResult> {
  const code = String(submitted ?? "").replace(/\D/g, "");

  const row = await get<{ id: string; code_hash: string; expires_at: number; attempts: number }>(
    `SELECT id, code_hash, expires_at, attempts FROM otp_codes
     WHERE identifier = ? AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [id.value],
  );

  if (!row) return { ok: false, reason: "expired" };
  if (row.expires_at < now()) return { ok: false, reason: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many" };

  if (!safeEqual(row.code_hash, hash(code, id.value))) {
    await run("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?", [row.id]);
    return { ok: false, reason: row.attempts + 1 >= MAX_ATTEMPTS ? "too_many" : "wrong" };
  }

  await run("UPDATE otp_codes SET consumed_at = ? WHERE id = ?", [now(), row.id]);
  return { ok: true };
}

export type NewUserInput = {
  role: "seeker" | "provider";
  name?: string;
  language?: "en" | "es";
};

export async function findUserByIdentifier(id: Identifier): Promise<{ id: string; role: string } | undefined> {
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

export async function upsertUser(id: Identifier, input: NewUserInput): Promise<string> {
  const existing = await findUserByIdentifier(id);
  return existing?.id ?? await createUser(id, input);
}
