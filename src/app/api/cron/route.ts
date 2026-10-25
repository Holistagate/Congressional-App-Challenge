import { NextResponse } from "next/server";
import { expireStaleListings } from "@/db/queries";
import { flushQueue } from "@/lib/notify";
import { pruneExpired } from "@/lib/session";
import { runDueRecurringRules } from "@/lib/recurring";

export const dynamic = "force-dynamic";

/**
 * Housekeeping, on a schedule.
 *
 * Point a cron at this once a minute (Vercel Cron, GitHub Actions, or
 * `npm run worker` locally). Everything it does is also done defensively at
 * read time, so a missed run degrades the data rather than the experience —
 * a seeker never sees an expired listing just because this did not fire.
 *
 * Protected by a shared secret, because it writes.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Not authorised" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Refuse rather than run unauthenticated in production.
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }

  const expired = await expireStaleListings();
  const posted = await runDueRecurringRules();
  const sent = await flushQueue();
  // pruneExpired is sync but now only for local; for cloud we can just leave it or make it async.
  // Since it's a simple delete, it's fine to leave as is or wrap in async.
  pruneExpired();

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    expired: expired.expired,
    markedGone: expired.gone,
    recurringPosted: posted,
    notificationsSent: sent.sent,
    notificationsFailed: sent.failed,
  });
}
