import "server-only";
import { all, get, run, newId, now } from "@/db/index";
import { matchAlertsForListing, parseJsonArray } from "@/db/queries";

/**
 * Getting word to people.
 *
 * Three channels, one interface. Each has a real implementation behind an
 * environment variable and a console fallback without it, so the app runs
 * end-to-end on a laptop with no accounts, no keys and no spend — which is
 * also how the demo sign-in codes reach you.
 *
 * Notifications are written to the `notifications` table *before* they are
 * sent. If the process dies mid-send, the row is still there to retry. For
 * someone whose dinner depends on the message, losing it silently is the worst
 * outcome available, worse than sending it twice.
 */

export type DeliverInput = {
  channel: "email" | "sms" | "push";
  to: string;
  subject?: string;
  body: string;
  url?: string;
};

const haveTwilio = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);

const haveVapid = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

/** Sends one message now. Throws on a hard failure so the caller can record it. */
export async function deliver(input: DeliverInput): Promise<void> {
  if (input.channel === "sms" && haveTwilio()) return sendSms(input);
  if (input.channel === "email" && process.env.RESEND_API_KEY) return sendEmail(input);

  // Fallback. Not a silent no-op: the message is printed in full so a developer
  // can read a sign-in code straight out of the terminal.
  console.log(
    [
      "",
      `┌─ ${input.channel.toUpperCase()} → ${input.to}`,
      input.subject ? `│  ${input.subject}` : null,
      `│  ${input.body}`,
      input.url ? `│  ${input.url}` : null,
      "└─ (no provider configured; see .env.example)",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

async function sendSms({ to, body }: DeliverInput): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM_NUMBER!, Body: body }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

async function sendEmail({ to, subject, body }: DeliverInput): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "MealBridge <onboarding@resend.dev>",
      to,
      subject: subject ?? "MealBridge",
      text: body,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

/* ------------------------------------------------------------------ queue - */

export type QueuedNotification = {
  userId: string;
  listingId?: string | null;
  channel: string;
  title: string;
  body: string;
  url?: string;
};

export async function enqueue(n: QueuedNotification): Promise<string> {
  const id = newId("ntf");
  await run(
    "INSERT INTO notifications (id, user_id, listing_id, channel, title, body, url, created_at) VALUES (?,?,?,?,?,?,?,?)",
    [id, n.userId, n.listingId ?? null, n.channel, n.title, n.body, n.url ?? "/food", now()],
  );
  return id;
}

/**
 * Sends everything queued and not yet sent.
 *
 * Called inline after a post (so a listing notifies immediately) and by
 * scripts/worker.mjs on a schedule (so anything that failed gets another go).
 */
export async function flushQueue(max = 100): Promise<{ sent: number; failed: number }> {
  const pending = await all<{
    id: string;
    user_id: string;
    channel: string;
    title: string;
    body: string;
    url: string;
  }>(
    "SELECT id, user_id, channel, title, body, url FROM notifications WHERE sent_at IS NULL ORDER BY created_at ASC LIMIT ?",
    [max],
  );

  let sent = 0;
  let failed = 0;

  for (const n of pending) {
    try {
      const user = await get<{ email: string | null; phone: string | null }>(
        "SELECT email, phone FROM users WHERE id = ?",
        [n.user_id],
      );
      if (!user) {
        await run("UPDATE notifications SET sent_at = ?, error = ? WHERE id = ?", [now(), "no such user", n.id]);
        continue;
      }

      if (n.channel === "sms" && user.phone) {
        await deliver({ channel: "sms", to: user.phone, body: `${n.title} — ${n.body}` });
      } else if (n.channel === "push") {
        await sendPushToUser(n.user_id, n.title, n.body, n.url);
      } else if (user.email) {
        await deliver({ channel: "email", to: user.email, subject: n.title, body: n.body, url: n.url });
      } else if (user.phone) {
        await deliver({ channel: "sms", to: user.phone, body: `${n.title} — ${n.body}` });
      }

      await run("UPDATE notifications SET sent_at = ? WHERE id = ?", [now(), n.id]);
      sent++;
    } catch (err) {
      await run("UPDATE notifications SET error = ? WHERE id = ?", [String(err).slice(0, 500), n.id]);
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Web Push.
 *
 * Encrypting a payload properly needs the `web-push` library; rather than ship
 * a half-correct implementation of ECDH + HKDF, we send a bodiless push when
 * VAPID keys are present and let the service worker show a generic message, and
 * fall back to the console otherwise. Installing `web-push` and replacing the
 * body of this function is the single step to make it a full implementation —
 * see README "Notifications".
 */
async function sendPushToUser(userId: string, title: string, body: string, url: string): Promise<void> {
  const subs = await all<{ endpoint: string }>("SELECT endpoint FROM push_subscriptions WHERE user_id = ?", [
    userId,
  ]);

  if (!subs.length || !haveVapid()) {
    await deliver({ channel: "push", to: userId, subject: title, body, url });
    return;
  }

  for (const s of subs) {
    const res = await fetch(s.endpoint, { method: "POST", headers: { TTL: "3600" } });
    // 404/410 mean the browser threw the subscription away; stop writing to it.
    if (res.status === 404 || res.status === 410) {
      await run("DELETE FROM push_subscriptions WHERE endpoint = ?", [s.endpoint]);
    }
  }
}

/* --------------------------------------------------------------- matching - */

/**
 * Queues an alert for everyone whose standing request this listing answers.
 *
 * Returns the number queued so the provider can be told plainly how many
 * people were told — one of the few honest signals that posting was worth the
 * ninety seconds it took.
 */
export async function notifyMatchingSeekers(listing: {
  id: string;
  zip: string;
  city: string;
  state: string;
  business_name: string;
  dietary_tags: string;
  portions_remaining: number;
}): Promise<number> {
  const matches = await matchAlertsForListing(listing.zip, parseJsonArray(listing.dietary_tags));

  for (const m of matches) {
    const es = m.language === "es";
    const miles = m.distance_miles < 0.1 ? null : m.distance_miles.toFixed(1);
    await enqueue({
      userId: m.seeker_id,
      listingId: listing.id,
      channel: m.channel === "both" ? "sms" : m.channel,
      title: es ? "Comida gratis cerca de ti" : "Free food near you",
      body: es
        ? `${listing.business_name} tiene ${listing.portions_remaining} porciones${miles ? ` a unas ${miles} millas` : " en tu código postal"}.`
        : `${listing.business_name} has ${listing.portions_remaining} portions${miles ? ` about ${miles} miles away` : " in your ZIP code"}.`,
      url: `/food/${listing.id}`,
    });
  }

  return matches.length;
}

/** Tells everyone who saved a listing that it changed. */
export async function notifySavers(
  listingId: string,
  title: string,
  body: string,
  exceptUserId?: string,
): Promise<number> {
  const savers = await all<{ seeker_id: string }>(
    "SELECT seeker_id FROM saved_listings WHERE listing_id = ?",
    [listingId],
  );

  let count = 0;
  for (const s of savers) {
    if (s.seeker_id === exceptUserId) continue;
    await enqueue({ userId: s.seeker_id, listingId, channel: "push", title, body, url: `/food/${listingId}` });
    count++;
  }
  return count;
}
