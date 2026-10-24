import { NextResponse } from "next/server";
import { run, newId, now } from "@/db/index";
import { currentUser } from "@/lib/session";

/**
 * Stores a Web Push subscription for the signed-in user.
 *
 * The endpoint is unique, so re-subscribing on the same browser replaces the
 * row rather than piling up duplicates that would each deliver the same
 * notification.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Incomplete subscription" }, { status: 400 });
  }

  // Only accept push services, never an arbitrary URL we would later POST to.
  let host: string;
  try {
    host = new URL(endpoint).hostname;
  } catch {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
  }

  const allowed = [
    "fcm.googleapis.com",
    "updates.push.services.mozilla.com",
    "push.services.mozilla.com",
    "notify.windows.com",
    "web.push.apple.com",
  ];
  if (!allowed.some((d) => host === d || host.endsWith(`.${d}`))) {
    return NextResponse.json({ error: "Unrecognised push service" }, { status: 400 });
  }

  run(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id,
       p256dh = excluded.p256dh, auth = excluded.auth`,
    [newId("push"), user.id, endpoint, keys.p256dh, keys.auth, now()],
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

  run("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?", [endpoint, user.id]);
  return NextResponse.json({ ok: true });
}
