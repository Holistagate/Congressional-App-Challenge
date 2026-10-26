import { NextResponse } from "next/server";
import { expireStaleListings } from "@/db/queries";
import { flushQueue } from "@/lib/notify";
import { pruneExpired } from "@/lib/session";
import { runDueRecurringRules } from "@/lib/recurring";

export const dynamic = "force-dynamic";

/**
 * Housekeeping, on a schedule.
 *
 * Point a cron at this as often as you can (Vercel Cron, GitHub Actions, or
 * `npm run worker` locally). Everything it does is also done defensively at
 * read time, so a missed run degrades the data rather than the experience —
 * a seeker never sees an expired listing just because this did not fire,
 * because listNearby filters on pickup_end regardless.
 *
 * vercel.json asks for daily, not because daily is right but because Vercel's
 * Hobby plan rejects anything more frequent and a project that will not
 * deploy is worse than one that tidies up slowly. The cost is real and worth
 * knowing: queued alerts go out once a day rather than within minutes. If
 * alerts need to be prompt, point an external scheduler at this URL with the
 * CRON_SECRET as a bearer token — the endpoint does not care who calls it.
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
  await pruneExpired();

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
