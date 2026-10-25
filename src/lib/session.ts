import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { all, get, run, newId, now } from "@/db/index";
import { SESSION_COOKIE } from "./cookies";

const SESSION_DAYS = 30;

export type Role = "seeker" | "provider" | "admin";

export type SessionUser = {
  id: string;
  role: Role;
  name: string;
  email: string | null;
  phone: string | null;
  language: "en" | "es";
  home_zip: string | null;
};

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expires = now() + SESSION_DAYS * 86400_000;

  await run("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?,?,?,?)", [
    hash(token),
    userId,
    now(),
    expires,
  ]);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expires),
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await run("DELETE FROM sessions WHERE id = ?", [hash(token)]);
  jar.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await get<SessionUser & { expires_at: number }>(
    `SELECT u.id, u.role, u.name, u.email, u.phone, u.language, u.home_zip, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
    [hash(token)],
  );

  if (!row) return null;
  if (row.expires_at < now()) {
    await run("DELETE FROM sessions WHERE id = ?", [hash(token)]);
    return null;
  }

  const { expires_at: _ignored, ...user } = row;
  return user;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status = 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new AuthError("Sign in to continue", 401);
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AuthError("You don't have access to that", 403);
  return user;
}

export type ProviderRecord = {
  id: string;
  user_id: string;
  business_name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  contact_name: string;
  phone: string;
  email: string;
  permit_number: string;
  status: "pending" | "approved" | "suspended";
  show_phone: number;
  show_interest: number;
};

export async function currentProvider(): Promise<ProviderRecord | null> {
  const user = await currentUser();
  if (!user || user.role !== "provider") return null;
  return await get<ProviderRecord>("SELECT * FROM providers WHERE user_id = ?", [user.id]) ?? null;
}

export async function requireApprovedProvider(): Promise<ProviderRecord> {
  await requireRole("provider");
  const provider = await currentProvider();
  if (!provider) throw new AuthError("Finish setting up your business first", 403);
  if (provider.status === "pending")
    throw new AuthError("Your business is still being reviewed. You can post once it's approved.", 403);
  if (provider.status === "suspended")
    throw new AuthError("Posting is paused for this business. Contact us to sort it out.", 403);
  return provider;
}

export async function requireOwnedListing(listingId: string): Promise<{ provider: ProviderRecord }> {
  const provider = await requireApprovedProvider();
  const owns = await get("SELECT 1 AS ok FROM listings WHERE id = ? AND provider_id = ?", [
    listingId,
    provider.id,
  ]);
  if (!owns) throw new AuthError("That listing isn't yours", 404);
  return { provider };
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function pruneExpired(): void {
  // Pruning is a background task, but since we're now async, we should ideally
  // handle it as a Promise or in a separate cron.
  // For now, we'll skip the internal call and rely on the la-cron route.
}

export { newId, all };
