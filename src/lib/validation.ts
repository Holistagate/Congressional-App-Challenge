import { z } from "zod";
import { DIETARY_IDS, ALLERGEN_IDS, CATEGORY_IDS, SAFETY_CHECKLIST } from "./domain";
import { normalizeZip, RADIUS_OPTIONS } from "./geo";

/**
 * Every form in the product validates here, on the server, before anything is
 * written. Client-side checks exist too, but only to give someone a faster
 * answer — they are never the thing standing between a POST and the database.
 */

/**
 * Strips control characters and collapses runs of whitespace.
 *
 * Not HTML escaping: React escapes on render, and escaping on the way *in*
 * means a restaurant called "Mom & Pop's" is stored as "Mom &amp; Pop&#39;s"
 * and reads that way forever. What we remove here are the characters that have
 * no business in a form field at all — zero-width spaces and direction
 * overrides used to disguise text, and C0/C1 control codes.
 */
/**
 * Characters that exist only to disguise text: zero-width spaces and joiners,
 * bidirectional overrides, and the byte-order mark. None has any business in a
 * restaurant name or a pickup note, and each can make one string render as
 * another.
 *
 * Built from escape strings rather than written as literal characters, because
 * a source file containing a raw U+2028 is itself a parse hazard.
 */
const INVISIBLE = new RegExp(
  "[" +
    "\u200B-\u200F" + // zero-width space, joiners, LTR/RTL marks
    "\u2028\u2029" + // line and paragraph separators
    "\u202A-\u202E" + // bidi embedding and override
    "\uFEFF" + // byte-order mark
    "]",
  "g",
);

export function clean(input: unknown, maxLength = 2000): string {
  return String(input ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(INVISIBLE, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

const text = (max: number, min = 1) =>
  z
    .string()
    .transform((v) => clean(v, max))
    .pipe(z.string().min(min).max(max));

const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((v) => clean(v ?? "", max));

export const zipSchema = z
  .string()
  .transform((v) => normalizeZip(v))
  .pipe(z.string({ message: "Enter a 5-digit ZIP code" }).regex(/^\d{5}$/));

const tagList = (allowed: readonly string[]) =>
  z
    .array(z.string())
    .default([])
    .transform((list) => [...new Set(list.filter((t) => allowed.includes(t)))]);

/* ------------------------------------------------------------------ auth -- */

export const identifierSchema = text(254).describe("email address or phone number");

export const codeSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(z.string().length(6, "Enter the 6-digit code"));

export const signupSchema = z.object({
  identifier: identifierSchema,
  role: z.enum(["seeker", "provider"]),
  name: optionalText(120),
  language: z.enum(["en", "es"]).default("en"),
});

/* -------------------------------------------------------------- provider -- */

export const providerProfileSchema = z.object({
  business_name: text(140),
  street: text(200),
  city: text(100),
  state: z
    .string()
    .transform((v) => clean(v, 2).toUpperCase())
    .pipe(z.string().length(2, "Use the 2-letter state code")),
  zip: zipSchema,
  contact_name: optionalText(120),
  phone: optionalText(32),
  email: optionalText(254),
  permit_number: optionalText(64),
});

/* --------------------------------------------------------------- listing -- */

const SAFETY_IDS = SAFETY_CHECKLIST.map((c) => c.id);

export const listingSchema = z
  .object({
    description: text(600, 10),
    categories: tagList(CATEGORY_IDS),
    dietary_tags: tagList(DIETARY_IDS),
    allergen_tags: tagList(ALLERGEN_IDS),
    portions: z.coerce
      .number()
      .int("Use a whole number")
      .min(1, "At least 1 portion")
      .max(1000, "That's more than 1000 portions — split it into a few posts"),
    street: text(200),
    city: text(100),
    state: z
      .string()
      .transform((v) => clean(v, 2).toUpperCase())
      .pipe(z.string().length(2)),
    zip: zipSchema,
    pickup_start: z.coerce.number().int().positive(),
    pickup_end: z.coerce.number().int().positive(),
    notes: optionalText(400),
    // Every box on the food-safety checklist, every time. A provider who skips
    // it is not blocked by the UI alone.
    safety_ack: z
      .array(z.string())
      .refine((v) => SAFETY_IDS.every((id) => v.includes(id)), {
        message: "Confirm each food safety point before posting",
      }),
  })
  .refine((v) => v.pickup_end > v.pickup_start, {
    message: "The pickup window has to end after it starts",
    path: ["pickup_end"],
  })
  .refine((v) => v.pickup_end - v.pickup_start >= 10 * 60_000, {
    message: "Give people at least 10 minutes to get there",
    path: ["pickup_end"],
  })
  .refine((v) => v.pickup_end - v.pickup_start <= 24 * 60 * 60_000, {
    message: "A pickup window can't be longer than a day",
    path: ["pickup_end"],
  })
  .refine((v) => v.pickup_end > Date.now(), {
    message: "That window has already closed",
    path: ["pickup_end"],
  });

export const portionsUpdateSchema = z.object({
  listing_id: text(64),
  remaining: z.coerce.number().int().min(0).max(1000),
});

/* ---------------------------------------------------------------- alerts -- */

export const alertSchema = z.object({
  zip: zipSchema,
  radius_miles: z.coerce
    .number()
    .refine((n) => (RADIUS_OPTIONS as readonly number[]).includes(n), "Pick 5, 10 or 25 miles"),
  dietary_filters: tagList(DIETARY_IDS),
  channel: z.enum(["push", "sms", "both"]).default("push"),
  active: z.coerce.boolean().default(true),
});

/* --------------------------------------------------------------- reports -- */

export const reportSchema = z.object({
  listing_id: text(64),
  reason: z.enum(["gone", "closed", "unsafe", "wrong_info", "other"]),
  details: optionalText(600),
});

/* ----------------------------------------------------------------- misc --- */

export const recurringSchema = z.object({
  weekdays: z
    .array(z.coerce.number().int().min(1).max(7))
    .min(1, "Pick at least one day"),
  start_minutes: z.coerce.number().int().min(0).max(1439),
  end_minutes: z.coerce.number().int().min(0).max(1439),
  template: z.object({
    description: text(600, 10),
    portions: z.coerce.number().int().min(1).max(1000),
    categories: tagList(CATEGORY_IDS),
    dietary_tags: tagList(DIETARY_IDS),
    allergen_tags: tagList(ALLERGEN_IDS),
    notes: optionalText(400),
  }),
});

/* ------------------------------------------------------------------ forms - */

/** Collapses a ZodError into { field: message } for rendering next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Reads repeated form fields (checkbox groups) as a string array. */
export function formList(data: FormData, name: string): string[] {
  return data.getAll(name).map((v) => String(v)).filter(Boolean);
}
