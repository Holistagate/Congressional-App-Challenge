/**
 * Shared vocabulary for food, time and status.
 *
 * Every user-facing word in here is deliberate. A seeker never has to explain
 * why they are hungry and never reads the word "charity", "donation",
 * "recipient" or "need". Food is free, it is near them, and it is theirs to
 * collect. See the copy rules in README.
 */

export const DIETARY_TAGS = [
  { id: "vegetarian", en: "Vegetarian", es: "Vegetariano" },
  { id: "vegan", en: "Vegan", es: "Vegano" },
  { id: "halal", en: "Halal", es: "Halal" },
  { id: "kosher", en: "Kosher", es: "Kosher" },
  { id: "gluten_free", en: "Gluten-free", es: "Sin gluten" },
  { id: "nut_free", en: "Nut-free", es: "Sin nueces" },
  { id: "dairy_free", en: "Dairy-free", es: "Sin lácteos" },
] as const;

/**
 * Allergens are listed separately from dietary preferences because they are a
 * different kind of fact. "Vegan" is something a person chooses; "contains
 * peanuts" is something that can put them in hospital. They are never merged
 * into one tag row in the UI, and an allergen chip always carries its word —
 * colour alone is not allowed to be the warning.
 */
export const ALLERGEN_TAGS = [
  { id: "peanuts", en: "Peanuts", es: "Cacahuetes" },
  { id: "tree_nuts", en: "Tree nuts", es: "Frutos secos" },
  { id: "milk", en: "Milk", es: "Leche" },
  { id: "eggs", en: "Eggs", es: "Huevos" },
  { id: "wheat", en: "Wheat", es: "Trigo" },
  { id: "soy", en: "Soy", es: "Soja" },
  { id: "fish", en: "Fish", es: "Pescado" },
  { id: "shellfish", en: "Shellfish", es: "Mariscos" },
  { id: "sesame", en: "Sesame", es: "Sésamo" },
] as const;

export const FOOD_CATEGORIES = [
  { id: "hot_meals", en: "Hot meals", es: "Comidas calientes" },
  { id: "sandwiches", en: "Sandwiches", es: "Sándwiches" },
  { id: "produce", en: "Fresh produce", es: "Frutas y verduras" },
  { id: "bakery", en: "Bakery", es: "Panadería" },
  { id: "pantry", en: "Pantry items", es: "Despensa" },
  { id: "prepared", en: "Prepared trays", es: "Bandejas preparadas" },
  { id: "dairy", en: "Dairy", es: "Lácteos" },
  { id: "drinks", en: "Drinks", es: "Bebidas" },
] as const;

export type DietaryTag = (typeof DIETARY_TAGS)[number]["id"];
export type AllergenTag = (typeof ALLERGEN_TAGS)[number]["id"];
export type FoodCategory = (typeof FOOD_CATEGORIES)[number]["id"];

export const DIETARY_IDS = DIETARY_TAGS.map((t) => t.id) as readonly string[];
export const ALLERGEN_IDS = ALLERGEN_TAGS.map((t) => t.id) as readonly string[];
export const CATEGORY_IDS = FOOD_CATEGORIES.map((t) => t.id) as readonly string[];

export function labelFor(
  set: readonly { id: string; en: string; es: string }[],
  id: string,
  lang: "en" | "es" = "en",
): string {
  return set.find((t) => t.id === id)?.[lang] ?? id;
}

/* ----------------------------------------------------------------- status - */

export type ListingStatus = "active" | "expired" | "cancelled" | "gone";

/**
 * What a listing is *right now*, as opposed to the status column.
 *
 * The stored status lags reality: a window closes at 9pm whether or not a job
 * has run. Every read path derives the live state from the clock so a seeker
 * is never shown food that stopped existing twenty minutes ago, even if the
 * sweep has not fired yet. The sweep (scripts/expire.mjs, or the /api/cron
 * route) then makes the stored column agree.
 */
export type LiveState = "open" | "soon" | "later" | "gone" | "ended" | "cancelled";

export const CLOSING_SOON_MS = 45 * 60 * 1000;

export type WindowInput = {
  status: ListingStatus;
  pickup_start: number;
  pickup_end: number;
  portions_remaining: number;
};

export function liveState(l: WindowInput, at: number = Date.now()): LiveState {
  if (l.status === "cancelled") return "cancelled";
  if (l.status === "gone" || l.portions_remaining <= 0) return "gone";
  if (at >= l.pickup_end || l.status === "expired") return "ended";
  if (at < l.pickup_start) return "later";
  return l.pickup_end - at <= CLOSING_SOON_MS ? "soon" : "open";
}

/** Only these two states are collectable food. */
export function isCollectable(state: LiveState): boolean {
  return state === "open" || state === "soon";
}

/** Still worth showing a seeker: open now, or opening later today. */
export function isListable(state: LiveState): boolean {
  return state === "open" || state === "soon" || state === "later";
}

/**
 * Share of the pickup window still to run, 0..1. Drives the draining rail on
 * each listing — the one piece of ornament in the product that is actually
 * data.
 */
export function windowRemaining(l: WindowInput, at: number = Date.now()): number {
  const span = l.pickup_end - l.pickup_start;
  if (span <= 0) return 0;
  if (at <= l.pickup_start) return 1;
  return Math.max(0, Math.min(1, (l.pickup_end - at) / span));
}

/* ------------------------------------------------------------------- time - */

/**
 * A countdown a person can act on.
 *
 * Rounded up, never down: telling someone they have "1 min" when they have 90
 * seconds is the kind of small lie that ends with them arriving to a locked
 * door. Above an hour we drop to whole hours because the precision stops
 * meaning anything.
 */
export function countdown(msRemaining: number, lang: "en" | "es" = "en"): string {
  const mins = Math.ceil(msRemaining / 60000);
  if (mins <= 0) return lang === "es" ? "Terminado" : "Ended";
  if (mins < 60) {
    return lang === "es" ? `Termina en ${mins} min` : `Ends in ${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) {
    const h = lang === "es" ? `${hours} h` : `${hours} hr`;
    const m = rem ? ` ${rem} min` : "";
    return lang === "es" ? `Termina en ${h}${m}` : `Ends in ${h}${m}`;
  }
  const days = Math.floor(hours / 24);
  return lang === "es" ? `Termina en ${days} días` : `Ends in ${days} days`;
}

/** "5:30 – 9:00 PM". The headline of every listing. */
export function formatWindow(start: number, end: number, lang: "en" | "es" = "en"): string {
  const locale = lang === "es" ? "es-US" : "en-US";
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const s = new Date(start);
  const e = new Date(end);
  const sameMeridiem =
    s.getHours() < 12 === e.getHours() < 12 && s.toDateString() === e.toDateString();

  if (sameMeridiem) {
    // Drop the first AM/PM when both ends share it: "5:30 – 9:00 PM".
    const sStr = s.toLocaleTimeString(locale, opts).replace(/\s?[AP]\.?M\.?/i, "");
    return `${sStr} – ${e.toLocaleTimeString(locale, opts)}`;
  }
  return `${s.toLocaleTimeString(locale, opts)} – ${e.toLocaleTimeString(locale, opts)}`;
}

/** "Today", "Tomorrow", or a weekday + date. */
export function formatDay(ts: number, lang: "en" | "es" = "en", at = Date.now()): string {
  const locale = lang === "es" ? "es-US" : "en-US";
  const d = new Date(ts);
  const today = new Date(at);
  const dayDiff = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86400000,
  );
  if (dayDiff === 0) return lang === "es" ? "Hoy" : "Today";
  if (dayDiff === 1) return lang === "es" ? "Mañana" : "Tomorrow";
  return d.toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric" });
}

/* -------------------------------------------------------------- portions - */

export function portionsLabel(n: number, lang: "en" | "es" = "en"): string {
  if (lang === "es") return n === 1 ? "1 porción" : `${n} porciones`;
  return n === 1 ? "1 portion" : `${n} portions`;
}

/**
 * The food-safety checklist a provider confirms before each post. Not legal
 * advice and not a substitute for it — the wording mirrors the FDA Food Code's
 * ordinary holding rules, and the post form links the Good Samaritan notice.
 */
export const SAFETY_CHECKLIST = [
  {
    id: "temperature",
    en: "Hot food was held at or above 135°F, and cold food at or below 41°F.",
    es: "La comida caliente se mantuvo a 135°F o más, y la fría a 41°F o menos.",
  },
  {
    id: "packaged",
    en: "Everything is packaged in clean, closed containers.",
    es: "Todo está empacado en recipientes limpios y cerrados.",
  },
  {
    id: "fresh",
    en: "It was prepared today, or held safely since it was made.",
    es: "Se preparó hoy, o se ha mantenido de forma segura desde entonces.",
  },
  {
    id: "allergens",
    en: "Allergens are labelled below as accurately as I can.",
    es: "Los alérgenos están indicados abajo con la mayor precisión posible.",
  },
] as const;
