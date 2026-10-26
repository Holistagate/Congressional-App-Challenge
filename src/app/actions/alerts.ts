"use server";

import { revalidatePath } from "next/cache";
import { run, newId, now } from "@/db/index";
import { requireRole } from "@/lib/session";
import { limit, retryMessage } from "@/lib/ratelimit";
import { alertSchema, fieldErrors, formList } from "@/lib/validation";
import { zipExists } from "@/db/queries";

export type AlertState = { ok?: boolean; error?: string; errors?: Record<string, string>; message?: string };

/**
 * Saves a standing alert.
 *
 * This row is the only place MealBridge stores a seeker's ZIP code. That is a
 * deliberate limit, and it is why `deleteAlert` really deletes rather than
 * marking inactive — "delete" has to mean the ZIP is gone, or the promise on
 * the alerts screen is a lie.
 */
export async function saveAlert(_prev: AlertState, data: FormData): Promise<AlertState> {
  const user = await requireRole("seeker");

  const gate = await limit("alertSave", user.id);
  if (!gate.ok) return { error: retryMessage(gate.retryAfterSeconds) };

  const parsed = alertSchema.safeParse({
    zip: data.get("zip"),
    radius_miles: data.get("radius_miles"),
    dietary_filters: formList(data, "dietary_filters"),
    channel: data.get("channel") ?? "push",
    active: data.get("active") !== null,
  });

  if (!parsed.success) {
    return { error: "Check the highlighted fields", errors: fieldErrors(parsed.error) };
  }

  if (!await zipExists(parsed.data.zip)) {
    return { error: "Check the highlighted fields", errors: { zip: "We don't recognise that ZIP code" } };
  }

  const existingId = String(data.get("alert_id") ?? "");

  if (existingId) {
    // Scoped to the owner, so an id from somewhere else updates nothing.
    await run(
      `UPDATE alerts SET zip = ?, radius_miles = ?, dietary_filters = ?, channel = ?, active = ?
       WHERE id = ? AND seeker_id = ?`,
      [
        parsed.data.zip,
        parsed.data.radius_miles,
        JSON.stringify(parsed.data.dietary_filters),
        parsed.data.channel,
        parsed.data.active ? 1 : 0,
        existingId,
        user.id,
      ],
    );
  } else {
    await run(
      `INSERT INTO alerts (id, seeker_id, zip, radius_miles, dietary_filters, channel, active, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        newId("alr"),
        user.id,
        parsed.data.zip,
        parsed.data.radius_miles,
        JSON.stringify(parsed.data.dietary_filters),
        parsed.data.channel,
        parsed.data.active ? 1 : 0,
        now(),
      ],
    );
  }

  revalidatePath("/alerts");
  return { ok: true, message: "Alert saved." };
}

export async function deleteAlert(_prev: AlertState, data: FormData): Promise<AlertState> {
  const user = await requireRole("seeker");
  const id = String(data.get("alert_id") ?? "");

  // A real DELETE. Flagging the row inactive would leave the ZIP behind.
  await run("DELETE FROM alerts WHERE id = ? AND seeker_id = ?", [id, user.id]);

  revalidatePath("/alerts");
  return { ok: true, message: "Alert deleted. Your ZIP code went with it." };
}
