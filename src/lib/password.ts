import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Password hashing, using only what Node already has.
 *
 * scrypt rather than bcrypt or argon2 because both of those are native
 * modules, and this project learned the hard way what a per-platform binary
 * does to a serverless deployment. scrypt is in node:crypto, so there is
 * nothing to compile and nothing to bundle.
 *
 * The parameters are stored alongside the hash rather than hard-coded into
 * the verifier. Raising the cost later should not lock out everyone who
 * signed up before.
 */

const N = 16384; // CPU/memory cost. ~100ms on a serverless instance.
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

/** The shortest password we will accept. Length beats character classes. */
export const MIN_PASSWORD = 8;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEYLEN);
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

/**
 * Checks a password against a stored hash.
 *
 * Returns false rather than throwing on a malformed hash: a corrupted row
 * should refuse the sign-in, not crash the sign-in page for everyone.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, , salt, expected] = parts;
  const keylen = Buffer.from(expected, "base64").length;
  if (!Number(n) || !Number(r) || keylen === 0) return false;

  let actual: Buffer;
  try {
    actual = await scryptAsync(password.normalize("NFKC"), Buffer.from(salt, "base64"), keylen);
  } catch {
    return false;
  }

  const expectedBuf = Buffer.from(expected, "base64");
  // Lengths are equal by construction above, but timingSafeEqual throws if
  // they are not, and a throw here would leak the difference as a 500.
  if (actual.length !== expectedBuf.length) return false;
  return timingSafeEqual(actual, expectedBuf);
}
