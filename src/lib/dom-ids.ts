/**
 * Shared, stable DOM ids.
 *
 * In its own module because both a server component (which renders the
 * address) and a client component (which selects it when the clipboard is
 * unavailable) need the same id, and a function exported from a `"use client"`
 * file cannot be called during server rendering.
 */

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

/** The element holding a listing's pickup address. */
export function addressElementId(address: string): string {
  return `addr-${hash(address)}`;
}
