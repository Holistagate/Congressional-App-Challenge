"use server";

import { revalidatePath } from "next/cache";
import { run, newId, now } from "@/db/index";
import { requireRole } from "@/lib/session";
import { clean } from "@/lib/validation";
import { enqueue, flushQueue } from "@/lib/notify";
import { get } from "@/db/index";

export type AdminState = { ok?: boolean; error?: string; message?: string };

/**
 * Moderation.
 *
 * Every action here is logged to admin_actions with the admin's id. Suspending
 * a business or pulling a listing affects whether real people eat tonight;
 * those decisions should be attributable, and reversible by someone who can
 * see who made them and why.
 */
function logAction(adminId: string, action: string, targetType: string, targetId: string, note = "") {
  run(
    "INSERT INTO admin_actions (id, admin_id, action, target_type, target_id, note, created_at) VALUES (?,?,?,?,?,?,?)",
    [newId("act"), adminId, action, targetType, targetId, clean(note, 500), now()],
  );
}

export async function setProviderStatus(_prev: AdminState, data: FormData): Promise<AdminState> {
  const admin = await requireRole("admin");

  const providerId = String(data.get("provider_id") ?? "");
  const status = String(data.get("status") ?? "");
  const note = String(data.get("note") ?? "");

  if (!["pending", "approved", "suspended"].includes(status)) {
    return { error: "That isn't a valid status" };
  }

  const provider = get<{ user_id: string; business_name: string }>(
    "SELECT user_id, business_name FROM providers WHERE id = ?",
    [providerId],
  );
  if (!provider) return { error: "No such business" };

  run("UPDATE providers SET status = ?, reviewed_at = ?, review_note = ? WHERE id = ?", [
    status,
    now(),
    clean(note, 500),
    providerId,
  ]);

  logAction(admin.id, `provider:${status}`, "provider", providerId, note);

  // Tell them. A business left guessing why it cannot post stops trying.
  if (status === "approved") {
    enqueue({
      userId: provider.user_id,
      channel: "email",
      title: "You can start posting food",
      body: `${provider.business_name} is approved on MealBridge. Post what you have at closing and people nearby will see it.`,
      url: "/provider/post",
    });
    await flushQueue();
  } else if (status === "suspended") {
    enqueue({
      userId: provider.user_id,
      channel: "email",
      title: "Posting is paused for your business",
      body: note ? `Reason: ${clean(note, 300)}` : "Get in touch and we'll sort it out.",
      url: "/provider",
    });
    await flushQueue();
  }

  revalidatePath("/admin");
  revalidatePath("/food");
  return { ok: true, message: `${provider.business_name} is now ${status}.` };
}

export async function resolveReport(_prev: AdminState, data: FormData): Promise<AdminState> {
  const admin = await requireRole("admin");

  const reportId = String(data.get("report_id") ?? "");
  const outcome = String(data.get("outcome") ?? "");

  if (!["reviewed", "dismissed"].includes(outcome)) return { error: "That isn't a valid outcome" };

  run("UPDATE reports SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?", [
    outcome,
    now(),
    admin.id,
    reportId,
  ]);

  logAction(admin.id, `report:${outcome}`, "report", reportId);

  revalidatePath("/admin");
  return { ok: true, message: outcome === "reviewed" ? "Marked as handled." : "Dismissed." };
}

export async function removeListing(_prev: AdminState, data: FormData): Promise<AdminState> {
  const admin = await requireRole("admin");

  const listingId = String(data.get("listing_id") ?? "");
  const note = String(data.get("note") ?? "");

  run("UPDATE listings SET status = 'cancelled', updated_at = ? WHERE id = ?", [now(), listingId]);
  logAction(admin.id, "listing:removed", "listing", listingId, note);

  revalidatePath("/admin");
  revalidatePath("/food");
  return { ok: true, message: "Listing removed." };
}
