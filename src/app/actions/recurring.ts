"use server";

import { revalidatePath } from "next/cache";
import { run, get, newId, now } from "@/db/index";
import { requireApprovedProvider, AuthError } from "@/lib/session";
import { recurringSchema, fieldErrors, formList } from "@/lib/validation";

export type RecurringState = {
  ok?: boolean;
  error?: string;
  errors?: Record<string, string>;
  message?: string;
};

/**
 * Recurring posts.
 *
 * A bakery that gives away the same trays every weeknight should set that up
 * once, not fill in a form every night at closing. The rule holds the schedule
 * and a template; `runDueRecurringRules` (called by /api/cron) turns it into a
 * real listing on each day it applies.
 */
export async function createRecurringRule(
  _prev: RecurringState,
  data: FormData,
): Promise<RecurringState> {
  let provider;
  try {
    provider = await requireApprovedProvider();
  } catch (err) {
    return { error: err instanceof AuthError ? err.message : "You can't do that right now" };
  }

  const parsed = recurringSchema.safeParse({
    weekdays: formList(data, "weekdays"),
    start_minutes: toMinutes(data.get("start_time")),
    end_minutes: toMinutes(data.get("end_time")),
    template: {
      description: data.get("description"),
      portions: data.get("portions"),
      categories: formList(data, "categories"),
      dietary_tags: formList(data, "dietary_tags"),
      allergen_tags: formList(data, "allergen_tags"),
      notes: data.get("notes"),
    },
  });

  if (!parsed.success) {
    return { error: "Check the highlighted fields", errors: fieldErrors(parsed.error) };
  }

  await run(
    `INSERT INTO recurring_rules (id, provider_id, weekdays, start_minutes, end_minutes,
       template, timezone, paused, created_at)
     VALUES (?,?,?,?,?,?,?,0,?)`,
    [
      newId("rec"),
      provider.id,
      parsed.data.weekdays.join(","),
      parsed.data.start_minutes,
      parsed.data.end_minutes,
      JSON.stringify(parsed.data.template),
      // The server's zone. Single-region for now; the column exists so a
      // multi-region deployment can store the restaurant's own zone.
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "America/New_York",
      now(),
    ],
  );

  revalidatePath("/provider");
  return { ok: true, message: "Saved. It'll post automatically on the days you picked." };
}

export async function setRulePaused(_prev: RecurringState, data: FormData): Promise<RecurringState> {
  let provider;
  try {
    provider = await requireApprovedProvider();
  } catch (err) {
    return { error: err instanceof AuthError ? err.message : "You can't do that right now" };
  }

  const id = String(data.get("rule_id") ?? "");
  const paused = String(data.get("paused") ?? "") === "1";

  // Scoped to the owner, so an id from elsewhere changes nothing.
  const owned = await get("SELECT 1 AS ok FROM recurring_rules WHERE id = ? AND provider_id = ?", [
    id,
    provider.id,
  ]);
  if (!owned) return { error: "That schedule isn't yours" };

  await run("UPDATE recurring_rules SET paused = ? WHERE id = ?", [paused ? 1 : 0, id]);

  revalidatePath("/provider");
  return { ok: true, message: paused ? "Paused." : "Running again." };
}

export async function deleteRule(_prev: RecurringState, data: FormData): Promise<RecurringState> {
  let provider;
  try {
    provider = await requireApprovedProvider();
  } catch (err) {
    return { error: err instanceof AuthError ? err.message : "You can't do that right now" };
  }

  const id = String(data.get("rule_id") ?? "");
  await run("DELETE FROM recurring_rules WHERE id = ? AND provider_id = ?", [id, provider.id]);

  revalidatePath("/provider");
  return { ok: true, message: "Schedule removed. Listings already posted are unaffected." };
}

/** "21:30" -> 1290 minutes past local midnight. */
function toMinutes(value: FormDataEntryValue | null): number {
  const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return -1;
  return Number(match[1]) * 60 + Number(match[2]);
}
