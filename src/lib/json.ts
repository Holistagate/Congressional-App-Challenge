/**
 * Tag lists are stored as JSON text in SQLite, so every read of a listing's
 * dietary or allergen tags goes through here.
 *
 * Pure, and deliberately outside the database module: client components render
 * these tags, and nothing that touches `server-only` can cross that boundary.
 *
 * Never throws. A malformed value yields no tags rather than a 500 — a listing
 * with its allergen list quietly empty is bad, but a listings page that will
 * not render at all is worse, and the sweep surfaces the broken row either way.
 */
export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
