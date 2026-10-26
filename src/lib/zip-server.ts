import "server-only";
import { cookies } from "next/headers";
import { normalizeZip } from "./geo";
import { zipExists } from "@/db/queries";
import { ZIP_COOKIE } from "./cookies";

/**
 * Reads the seeker's remembered ZIP.
 *
 * Kept out of the actions file: everything exported from a `"use server"`
 * module becomes a callable POST endpoint, and a plain cookie read has no
 * business being one.
 *
 * Validated against the bundled table on every read, so a hand-edited cookie
 * cannot push an unknown ZIP into a distance query.
 */
export async function readZip(): Promise<string | null> {
  const raw = (await cookies()).get(ZIP_COOKIE)?.value;
  const zip = raw ? normalizeZip(raw) : null;
  return zip && await zipExists(zip) ? zip : null;
}
