"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeZip } from "@/lib/geo";
import { zipExists } from "@/db/queries";
import { ZIP_COOKIE } from "@/lib/cookies";

/**
 * Remembers a seeker's ZIP on their device.
 *
 * A cookie, not a database row. Someone browsing without an account has told
 * us nothing we need to keep, and a signed-out person's ZIP has no business
 * on our server. For people who do sign in, the only stored copy lives on an
 * alert they created and can delete.
 */
export async function setZip(_prev: { error?: string } | undefined, data: FormData) {
  const zip = normalizeZip(String(data.get("zip") ?? ""));
  if (!zip) return { error: "Enter a 5-digit ZIP code" };
  if (!zipExists(zip)) return { error: "We don't recognise that ZIP code. Check the five digits." };

  const jar = await cookies();
  jar.set(ZIP_COOKIE, zip, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
  });

  redirect("/food");
}

export async function clearZip(): Promise<void> {
  (await cookies()).delete(ZIP_COOKIE);
  redirect("/food");
}

