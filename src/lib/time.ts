/** Does this string already say which zone it is in? */
const HAS_ZONE = /([zZ]|[+-]\d{2}:?\d{2})$/;

/**
 * Turns a `datetime-local` value into an instant.
 *
 * The input sends wall-clock time with no zone — "2026-10-26T19:15" — and
 * Date.parse resolves that against whatever zone the *runtime* sits in. In
 * development that is the kitchen's own machine, so it is right by accident.
 * On Vercel the runtime is UTC, so a 7:15 PM pickup in Kentucky was read as
 * 7:15 PM UTC, four hours earlier, and rejected as a window that had already
 * closed. The form posts the browser's offset so the conversion happens
 * against the zone the person actually typed in.
 *
 * With JavaScript off there is no offset to post and we fall back to reading
 * it as UTC. That is wrong by up to a day, but it is wrong in the direction
 * of refusing the listing rather than publishing food at the wrong hour.
 */
export function toInstant(value: FormDataEntryValue | null, offsetMinutes: number): number {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  if (HAS_ZONE.test(raw)) {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const asUtc = Date.parse(`${raw}Z`);
  if (!Number.isFinite(asUtc)) return 0;
  // getTimezoneOffset is minutes *behind* UTC, so UTC = local + offset.
  return asUtc + offsetMinutes * 60_000;
}

/**
 * The browser's getTimezoneOffset, if it sent one we believe.
 *
 * Range-checked because it arrives from a form: real offsets run from -14h to
 * +12h, and anything else is either a crafted post or a bug, neither of which
 * should be allowed to move a pickup window by a decade.
 */
export function readOffset(value: FormDataEntryValue | null): number {
  const n = Number(String(value ?? "").trim());
  if (!Number.isFinite(n) || !Number.isInteger(n)) return 0;
  return n >= -840 && n <= 840 ? n : 0;
}
