"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { get, run, tx, newId, now } from "@/db/index";
import { currentUser, requireUser, requireApprovedProvider, requireOwnedListing, AuthError } from "@/lib/session";
import { limit, retryMessage } from "@/lib/ratelimit";
import { listingSchema, reportSchema, portionsUpdateSchema, fieldErrors, formList } from "@/lib/validation";
import { zipExists } from "@/db/queries";
import { notifyMatchingSeekers, notifySavers, flushQueue } from "@/lib/notify";

export type ActionState = {
  ok?: boolean;
  error?: string;
  errors?: Record<string, string>;
  message?: string;
};

/* -------------------------------------------------------------- posting -- */

/**
 * Publishes a listing and tells everyone whose alert it answers.
 *
 * Authorisation is re-derived here, not taken from the form: the provider id
 * comes from the session, so a crafted POST cannot post as another business.
 */
export async function postListing(_prev: ActionState, data: FormData): Promise<ActionState> {
  let provider;
  try {
    provider = await requireApprovedProvider();
  } catch (err) {
    return { error: err instanceof AuthError ? err.message : "You can't post right now" };
  }

  const gate = await limit("listingCreate", provider.user_id);
  if (!gate.ok) return { error: retryMessage(gate.retryAfterSeconds) };

  // Times arrive as local datetime-local strings and are stored as instants.
  const parsed = listingSchema.safeParse({
    description: data.get("description"),
    categories: formList(data, "categories"),
    dietary_tags: formList(data, "dietary_tags"),
    allergen_tags: formList(data, "allergen_tags"),
    portions: data.get("portions"),
    street: data.get("street"),
    city: data.get("city"),
    state: data.get("state"),
    zip: data.get("zip"),
    pickup_start: toInstant(data.get("pickup_start")),
    pickup_end: toInstant(data.get("pickup_end")),
    notes: data.get("notes"),
    safety_ack: formList(data, "safety_ack"),
  });

  if (!parsed.success) {
    return { error: "Check the highlighted fields", errors: fieldErrors(parsed.error) };
  }

  if (!zipExists(parsed.data.zip)) {
    return {
      error: "Check the highlighted fields",
      errors: { zip: "We don't recognise that ZIP code" },
    };
  }

  const id = newId("lst");
  const v = parsed.data;

  tx(() => {
    run(
      `INSERT INTO listings (id, provider_id, description, categories, dietary_tags, allergen_tags,
         portions_total, portions_remaining, street, city, state, zip,
         pickup_start, pickup_end, notes, photo_url, status, safety_ack_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,'active',?,?,?)`,
      [
        id,
        provider.id,
        v.description,
        JSON.stringify(v.categories),
        JSON.stringify(v.dietary_tags),
        JSON.stringify(v.allergen_tags),
        v.portions,
        v.portions,
        v.street,
        v.city,
        v.state,
        v.zip,
        v.pickup_start,
        v.pickup_end,
        v.notes,
        now(),
        now(),
        now(),
      ],
    );
  });

  const notified = await notifyMatchingSeekers({
    id,
    zip: v.zip,
    city: v.city,
    state: v.state,
    business_name: provider.business_name,
    dietary_tags: JSON.stringify(v.dietary_tags),
    portions_remaining: v.portions,
  });

  // Send straight away so a listing posted at closing reaches people while
  // they can still act on it. The worker retries anything that fails here.
  await flushQueue();

  revalidatePath("/provider");
  revalidatePath("/food");

  return {
    ok: true,
    message:
      notified === 0
        ? "Posted. Nobody has an alert set for this area yet."
        : notified === 1
          ? "Posted. 1 person nearby was told."
          : `Posted. ${notified} people nearby were told.`,
  };
}

/* ------------------------------------------------------------- portions -- */

/**
 * Updates what's left. Reaching zero closes the listing immediately, because
 * a listing showing "0 portions" is worse than no listing at all.
 */
export async function updatePortions(_prev: ActionState, data: FormData): Promise<ActionState> {
  const parsed = portionsUpdateSchema.safeParse({
    listing_id: data.get("listing_id"),
    remaining: data.get("remaining"),
  });
  if (!parsed.success) return { error: "That isn't a valid number" };

  try {
    await requireOwnedListing(parsed.data.listing_id);
  } catch (err) {
    return { error: err instanceof AuthError ? err.message : "You can't change that" };
  }

  const listing = get<{ portions_total: number; portions_remaining: number }>(
    "SELECT portions_total, portions_remaining FROM listings WHERE id = ?",
    [parsed.data.listing_id],
  );
  if (!listing) return { error: "That listing is gone" };

  const remaining = Math.min(parsed.data.remaining, listing.portions_total);
  const nowGone = remaining <= 0;

  run("UPDATE listings SET portions_remaining = ?, status = ?, updated_at = ? WHERE id = ?", [
    remaining,
    nowGone ? "gone" : "active",
    now(),
    parsed.data.listing_id,
  ]);

  if (nowGone) {
    notifySavers(
      parsed.data.listing_id,
      "That food has gone",
      "The portions you saved have all been collected.",
    );
    await flushQueue();
  }

  revalidatePath("/provider");
  revalidatePath(`/food/${parsed.data.listing_id}`);
  return { ok: true, message: nowGone ? "Marked as all gone." : `Updated to ${remaining}.` };
}

export async function cancelListing(_prev: ActionState, data: FormData): Promise<ActionState> {
  const id = String(data.get("listing_id") ?? "");

  try {
    await requireOwnedListing(id);
  } catch (err) {
    return { error: err instanceof AuthError ? err.message : "You can't change that" };
  }

  run("UPDATE listings SET status = 'cancelled', updated_at = ? WHERE id = ?", [now(), id]);

  notifySavers(id, "A pickup was cancelled", "Food you saved is no longer available.");
  await flushQueue();

  revalidatePath("/provider");
  revalidatePath(`/food/${id}`);
  return { ok: true, message: "Cancelled. Anyone who saved it has been told." };
}

/* ----------------------------------------------------------- saving ------ */

export async function toggleSave(_prev: ActionState, data: FormData): Promise<ActionState> {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const listingId = String(data.get("listing_id") ?? "");
  if (!get("SELECT 1 AS ok FROM listings WHERE id = ?", [listingId])) {
    return { error: "That listing is gone" };
  }

  const existing = get("SELECT 1 AS ok FROM saved_listings WHERE seeker_id = ? AND listing_id = ?", [
    user.id,
    listingId,
  ]);

  if (existing) {
    run("DELETE FROM saved_listings WHERE seeker_id = ? AND listing_id = ?", [user.id, listingId]);
  } else {
    run("INSERT INTO saved_listings (seeker_id, listing_id, created_at) VALUES (?,?,?)", [
      user.id,
      listingId,
      now(),
    ]);
  }

  revalidatePath(`/food/${listingId}`);
  return { ok: true };
}

/* ---------------------------------------------------------- reporting ---- */

/**
 * Reports are open to people with no account — someone who walked to a locked
 * door should be able to warn the next person without signing up first. That
 * makes this the easiest form here to abuse, hence the tighter rate limit.
 */
export async function reportListing(_prev: ActionState, data: FormData): Promise<ActionState> {
  const user = await currentUser();

  const gate = await limit("report", user?.id);
  if (!gate.ok) return { error: retryMessage(gate.retryAfterSeconds) };

  const parsed = reportSchema.safeParse({
    listing_id: data.get("listing_id"),
    reason: data.get("reason"),
    details: data.get("details"),
  });

  if (!parsed.success) {
    return { error: "Pick what went wrong", errors: fieldErrors(parsed.error) };
  }

  if (!get("SELECT 1 AS ok FROM listings WHERE id = ?", [parsed.data.listing_id])) {
    return { error: "That listing is gone" };
  }

  run(
    "INSERT INTO reports (id, listing_id, reporter_id, reason, details, status, created_at) VALUES (?,?,?,?,?,'open',?)",
    [newId("rpt"), parsed.data.listing_id, user?.id ?? null, parsed.data.reason, parsed.data.details, now()],
  );

  // "Food is gone" is the common case and the one that helps immediately:
  // trust it enough to hide the listing, while leaving the report for an admin
  // so a business cannot be knocked offline by one bad actor.
  if (parsed.data.reason === "gone") {
    run(
      "UPDATE listings SET portions_remaining = 0, status = 'gone', updated_at = ? WHERE id = ? AND status = 'active'",
      [now(), parsed.data.listing_id],
    );
    revalidatePath("/food");
  }

  revalidatePath(`/food/${parsed.data.listing_id}`);
  return { ok: true, message: "Report sent. Thank you." };
}

/* ------------------------------------------------------------- helpers --- */

/** `datetime-local` gives a wall-clock string; store the instant it names. */
function toInstant(value: FormDataEntryValue | null): number {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
