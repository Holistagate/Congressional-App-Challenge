import "server-only";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { get, run, now } from "@/db/index";

/**
 * Fixed-window rate limiting, in the database.
 *
 * In the database rather than in memory because this app is expected to run on
 * a platform that may start more than one instance, and a limit that resets
 * when a process restarts is not a limit. Fixed window (not sliding) because
 * the failure mode — twice the allowance at a window boundary — is harmless
 * here, and the implementation stays small enough to reason about.
 */

export type LimitRule = { limit: number; windowMs: number };

export const LIMITS = {
  /** Sending sign-in codes costs real money and reaches a real phone. */
  otpRequest: { limit: 5, windowMs: 15 * 60_000 },
  otpVerify: { limit: 10, windowMs: 15 * 60_000 },
  /** Reports are open to signed-out users, so they are the easiest form to flood. */
  report: { limit: 6, windowMs: 60 * 60_000 },
  listingCreate: { limit: 30, windowMs: 60 * 60_000 },
  signup: { limit: 5, windowMs: 60 * 60_000 },
  alertSave: { limit: 20, windowMs: 60 * 60_000 },
} as const satisfies Record<string, LimitRule>;

export type LimitName = keyof typeof LIMITS;

/**
 * A caller key: the signed-in user if there is one, otherwise the client IP.
 *
 * IPs are hashed before they are stored. This product's whole privacy promise
 * is that we do not build a picture of who is looking for food, and a plain IP
 * column in a rate-limit table would quietly be one.
 */
export async function callerKey(userId?: string | null): Promise<string> {
  if (userId) return `u:${userId}`;
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  return `ip:${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
}

export type LimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export async function checkLimit(name: LimitName, key: string): Promise<LimitResult> {
  const rule = LIMITS[name];
  const bucket = `${name}:${key}`;
  const t = now();
  const windowStart = t - (t % rule.windowMs);

  const row = await get<{ window_start: number; count: number }>(
    "SELECT window_start, count FROM rate_limits WHERE bucket = ?",
    [bucket],
  );

  if (!row || row.window_start !== windowStart) {
    await run(
      `INSERT INTO rate_limits (bucket, window_start, count) VALUES (?,?,1)
       ON CONFLICT (bucket) DO UPDATE SET window_start = excluded.window_start, count = 1`,
      [bucket, windowStart],
    );
    return { ok: true };
  }

  if (row.count >= rule.limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((windowStart + rule.windowMs - t) / 1000) };
  }

  await run("UPDATE rate_limits SET count = count + 1 WHERE bucket = ?", [bucket]);
  return { ok: true };
}

/** Convenience: resolve the key and check in one call. */
export async function limit(name: LimitName, userId?: string | null): Promise<LimitResult> {
  return await checkLimit(name, await callerKey(userId));
}

/** "a few minutes" beats "retry after 847 seconds" for the person reading it. */
export function retryMessage(seconds: number): string {
  if (seconds < 90) return "Try again in a minute.";
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `Try again in about ${mins} minutes.`;
  return "Try again in about an hour.";
}
