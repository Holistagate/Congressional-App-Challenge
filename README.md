# MealBridge

Restaurants post food they have to give away. People nearby see what's free, where to collect it, and how long they have.

Built for the Congressional App Challenge.

---

## Run it

Needs **Node 22.5 or newer** (for the built-in `node:sqlite`). Nothing else — no database server, no cloud account, no API keys.

```bash
npm install
npm run db:setup     # creates the database, loads 41,637 ZIP centroids, seeds a demo
npm run dev
```

Open <http://localhost:3000>.

### Signing in to the demo

Sign-in uses a 6-digit code instead of a password. With no email or SMS provider configured, **the code is printed to the terminal running `npm run dev`** — look for a boxed `EMAIL →` line.

| Role | Sign in with |
| --- | --- |
| Someone looking for food | `sam@example.com` |
| An approved restaurant | `60615.harvest-table@example.com` |
| A restaurant awaiting review | `60605.riverside-deli@example.com` |
| Admin | `admin@mealbridge.example` |

You don't need any of these to use the seeker side. Type a ZIP code — try **60615** — and the whole thing works signed out.

### Other commands

```bash
npm test          # 62 tests: distance sorting, alert matching, expiry
npm run typecheck
npm run build     # production build
npm run db:reset  # wipe and re-seed
npm run worker    # expires listings and sends queued alerts (see "Scheduled jobs")
npm run assets    # regenerate images and icons from design/source/
```

---

## No maps, no location

This is the constraint the whole app is shaped around, so it's worth stating plainly: **MealBridge never calls a maps, geocoding or places API, and never asks a browser for its location.**

Instead:

- `data/zip-centroids.csv` ships with the repo: 41,637 US ZIP codes with a latitude and longitude. It's built from the [2024 Census ZCTA Gazetteer](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html) (public domain, authoritative centroids) merged with [GeoNames postal codes](https://download.geonames.org/export/zip/) (CC BY 4.0, for city and state names and for PO-box ZIPs that have no ZCTA). `scripts/build-zip-table.mjs` rebuilds it.
- Distance is the Haversine formula between two ZIP centroids — in SQL for list queries, in TypeScript for single comparisons. See `src/lib/geo.ts` and `DISTANCE_SQL` in `src/db/queries.ts`.
- A seeker types a ZIP. It's remembered in a cookie **on their device**, not stored on the server.
- Addresses render as plain text with a **Copy address** button. There is no "Get directions" link anywhere.
- The app sends `Permissions-Policy: geolocation=()`, so location access is switched off at the HTTP layer and can't be turned on by accident later.

The honest cost: every distance is between the *middle* of two ZIP codes, not between two doorsteps. In a dense city that's accurate to a few blocks; in a rural ZIP it can be several miles off. The UI never hides this — it says "About 2.3 miles away", and "In your ZIP code" rather than a fake "0.0 miles".

---

## How it's built

| | |
| --- | --- |
| **Framework** | Next.js 16.4 (App Router), React 19, TypeScript |
| **Styling** | Tailwind v4 with a small token layer in `src/app/globals.css` |
| **Database** | SQLite via `node:sqlite`, Node's built-in driver |
| **Auth** | One-time codes to email or phone; signed session cookies |
| **Notifications** | Web Push, Twilio SMS, Resend email — each optional |
| **PWA** | `public/manifest.webmanifest` + `public/sw.js` |

### Why SQLite

The brief suggested Supabase or Postgres. SQLite via `node:sqlite` was chosen so the project **clones and runs** — on a judge's laptop, in a lab, offline — with no account, no container and no native build step. The schema is ordinary SQL and the queries avoid SQLite-specific dialect, so moving to Postgres is mostly a driver swap. See **Moving to Postgres** below.

### Layout

```
src/
  app/
    page.tsx              the landing page (opening film + role chooser)
    food/                 seeker: ZIP entry, nearby list, listing detail
    alerts/               seeker: standing alerts
    provider/             restaurant: dashboard, post food
    admin/                moderation: approvals, reports, log
    legal/                terms, privacy, food safety
    actions/              server actions — every mutation lives here
    api/                  push subscription, cron
  components/             UI, split by client/server boundary
  db/
    schema.sql            the whole data model, commented
    queries.ts            distance search, alert matching, the expiry sweep
  lib/
    geo.ts                Haversine, bounding boxes, distance formatting
    domain.ts             listing states, countdowns, tags, safety checklist
    session.ts            sessions and authorisation
    auth.ts               one-time codes
    i18n.ts               English and Spanish dictionaries
    validation.ts         Zod schemas; every form goes through here
data/
  zip-centroids.csv       the bundled centroid table
scripts/                  setup, asset pipeline, worker
tests/                    node:test, run against the real source
design/source/            original artwork, before optimisation
```

---

## Design

The palette and typography are grounded in the project's own material rather than a stock theme.

**Colour** is sampled from the MealBridge logo: `--ink #0B2B1B` (a deep forest green used instead of black for all text), `--pine #14532A` (primary), `--leaf #3FA64B` (the logo's bright green), on white with `--mist #EEF3EC` for recessed surfaces. One rule governs it: **green means available**. Nothing decorative is green, so a green rail or dot always means there is food and you can still get it. `--amber #96640A` marks a window about to close; `--stop #A3231B` marks gone.

**Type** is two families. [Zilla Slab](https://fonts.google.com/specimen/Zilla+Slab) for headlines — blunt slab terminals that read like menu-board lettering. [Public Sans](https://fonts.google.com/specimen/Public+Sans) for everything functional: it's the US Web Design System typeface, which for a civic app about the food safety net is a motivated choice rather than a default, and it has the tabular figures every countdown depends on.

**The inversion that drives the UI:** on every listing the **pickup window is the headline**, not the restaurant name. Someone choosing between free meals tonight isn't picking a brand — they're answering "can I get there before it shuts?". Each listing also carries a vertical rail that drains as its window elapses, so scanning twenty listings shows at a glance which food is about to disappear.

**Motion** is spent in one place: the opening film on the landing page. Everything past that screen moves only in answer to a tap. `prefers-reduced-motion` turns the film into three static panels with the same words.

### The landing page

Three acts over one scroll track, built from the project's own footage and photographs:

1. The camera pushes into a dark shopfront under **"The world starves"**.
2. Everything goes to black for **"We have a solution"**.
3. The shop is lit, the blank sign board in the photograph carries the MealBridge mark, and the door swings open.

Then the two plates in the photograph become the two choices: *I need food* and *I have food to give*. The door is a slice of the photograph itself, hinged on its right stile, so what opens is the real door. A single `--p` scroll-progress variable drives every layer in CSS; one rAF-throttled write per frame, no per-layer JavaScript.

On a metered connection (`Save-Data`, or 2G) the 1.7 MB film is skipped and a 7 KB poster frame stands in.

---

## Privacy and safety

The product promise is that **looking for free food should never create a record that can be used against you**. In practice:

- Seekers need no account. No ID, no proof of income, no payment method, ever.
- A seeker's ZIP lives in a cookie on their device. The only server-side copy is on an alert they created, and deleting the alert **deletes the row** — the ZIP goes with it.
- Restaurants never learn who is interested. A provider sees a count of saves, if enabled, and nothing else.
- Rate-limit counters key on a **hash** of the IP address, never the address.
- Sessions store a SHA-256 of the cookie token, so the database can't be used to sign in as anyone.
- One-time codes are stored hashed, expire in 10 minutes, and lock out after 5 wrong attempts.
- No analytics, no trackers, no third-party embeds.

### Authentication

**Sign-in trusts the address you type.** There is no password and no emailed
code: you enter an email or phone number and you are signed in, creating the
account if it is new.

That is a deliberate trade and it is worth being plain about. For a seeker it
is close to harmless — the account holds a ZIP code and a few saved listings,
and the alternative is a step that loses people who are trying to find dinner
on a borrowed phone. For an approved provider or an admin it is **not**
acceptable in production: anyone who knows the address is in.

The one-time code flow this replaced is in the git history (`issueCode` and
`verifyCode` in `src/lib/auth.ts`). Restoring it means putting those back,
re-adding the two-step form, and setting `RESEND_API_KEY` or the Twilio
variables so the code can actually be delivered — without a provider
configured the code only ever reached the server log, which is why it is gone.

### Authorisation

Every server action re-checks authentication and ownership — `requireApprovedProvider()`, `requireOwnedListing()`, `requireRole()` in `src/lib/session.ts`. Server Actions are reachable by direct POST, so a hidden button is never a control.

This is the project's stand-in for the Row Level Security the brief asks for. SQLite has no RLS; the same predicates live in the data access layer instead. On Postgres they'd move into policies without changing shape — `requireOwnedListing` becomes `USING (provider_id = current_provider_id())`.

### Food safety

Providers confirm a four-point checklist before every post (temperature, packaging, freshness, allergens), and `/legal/food-safety` explains the Bill Emerson Good Samaritan Food Donation Act and the 2022 amendment that extended it to direct-to-individual donations. The app states plainly, in several places, that it facilitates a connection and does not prepare, store, transport or inspect food.

---

## Accessibility

Built to WCAG 2.1 AA, and checked rather than assumed:

- All text passes AA against its background. Measured ratios: ink on white 15.3:1, pine 9.1:1, muted 5.5:1, amber 5.1:1, stop 7.5:1. `--leaf` is 3.1:1, so it is used only for large text, rails and fills — never body copy.
- Colour is never the only signal. A closing-soon listing changes its *words* as well as its hue; allergen chips always carry the allergen's name.
- 44px minimum tap targets. Visible focus ring on everything, including over photography.
- Filters are a plain GET form — they work before JavaScript loads, and every filtered view is a shareable URL.
- Native `<dialog>` for the report sheet, so focus trapping and Escape come from the browser.
- Real labels on every input; no placeholder-as-label.
- English and Spanish throughout, including notification bodies and distance phrasing.

---

## Scheduled jobs

`/api/cron` does three things: expires listings the clock has overtaken, posts any recurring rules that are due, and flushes the notification queue.

```bash
npm run worker              # local: polls /api/cron every 60s
curl -H "Authorization: Bearer $CRON_SECRET" https://yourapp/api/cron
```

On Vercel, add to `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron", "schedule": "* * * * *" }] }
```

**A missed run degrades the data, never the experience.** Every read path derives listing state from the clock, so a seeker is never shown food that expired twenty minutes ago just because the job didn't fire. The sweep only makes the stored `status` column agree with what the UI already knew. There's a test for exactly this (`tests/expiry.test.ts`, "the read path already hid them, sweep or no sweep").

---

## Notifications

Three channels behind one interface in `src/lib/notify.ts`. Each has a real implementation behind an environment variable and prints to the console without it.

Notifications are written to the `notifications` table **before** they're sent, so a crashed process retries instead of silently dropping someone's only dinner notice.

**Web Push is deliberately partial.** Encrypting a payload properly needs ECDH + HKDF, so rather than ship a half-correct implementation, `sendPushToUser` sends a bodiless push when VAPID keys are present and lets the service worker show a generic message. To complete it:

```bash
npm install web-push
```

then replace the body of `sendPushToUser` with a `webpush.sendNotification()` call. That one function is the whole change.

---

## Deploying to Vercel

The app needs a database that survives a cold start. Vercel's filesystem does
not, so a SQLite file there is empty on the first request and gone again after
— that is the whole of "the database fails on Vercel". [Turso](https://turso.tech)
is SQLite over the network, so the schema, the SQL and the ZIP table all carry
across unchanged.

**1. Create the database**

```bash
turso db create mealbridge
turso db show mealbridge --url      # libsql://mealbridge-you.turso.io
turso db tokens create mealbridge   # the auth token
```

**2. Load the schema and the 41,637 ZIP centroids into it**, once, from your
machine:

```bash
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:setup
```

It sends the ZIP table in batches of a thousand and prints its progress; it
takes a minute or two. Add `--no-seed` to skip the demo restaurants and start
with an empty, real database.

The seed includes two **daily recurring rules**, so `/api/cron` posts fresh
listings every day and a deployed demo is never empty. Without them the
one-off seeded listings expire within hours and anyone visiting the next day
finds nothing.

**3. Set the environment variables in Vercel** (Project → Settings →
Environment Variables):

| Variable | Value |
| --- | --- |
| `TURSO_DATABASE_URL` | `libsql://…` from step 1 |
| `TURSO_AUTH_TOKEN` | the token from step 1 |
| `CRON_SECRET` | any random string — `/api/cron` refuses to run in production without it |

Deploy to a region near the database. This one lives in `aws-us-east-1`, so
Vercel's `iad1` keeps the round trip to a few milliseconds; the far side of the
world would add a few hundred to every query.

**4. Deploy.** `vercel.json` already schedules `/api/cron` every five minutes
to expire listings, post recurring rules and flush the notification queue.

Nothing else needs changing: the app reads `TURSO_DATABASE_URL` if it is set
and falls back to a local file if it is not, so the same code runs in both
places.

### Running it anywhere else

On a platform with a persistent disk (Railway, Render, Fly, a VPS), leave the
Turso variables unset and point `TURSO_DATABASE_URL` at a file on a mounted
volume — `file:/data/mealbridge.db`. The driver takes either.

### A note on the local database

The development database lives in `node_modules/.cache/mealbridge/dev.db`,
not in the project tree. SQLite rewrites its `-wal` and `-shm` files on every
read, Next's watcher has no ignore list, and a database beside the source puts
the dev server in a loop: a page load writes the WAL, the watcher fires, Fast
Refresh reloads the page, which loads again. Watchers skip `node_modules`,
which ends it. `npm run db:setup` rebuilds it in seconds if it is ever wiped.


## Onboarding your first restaurants

The hard part isn't the software. A few things that help:

**Who to ask first.** Bakeries and places with a hot bar throw away the most, the most predictably, and already know it bothers them. Start there rather than with fine dining. A manager who closes the till is the right person; a franchise head office is not.

**What to say.** It takes about a minute at closing, there's no cost, and the Good Samaritan Act covers good-faith donations. Lead with the waste they already know about, not with charity.

**What they'll ask.**
- *Are we liable?* → `/legal/food-safety` covers the Act in plain language. Recommend they check local rules too.
- *Will people queue outside?* → They set the pickup window and can write handoff instructions ("knock at the back door, ask for Maria"). Most posts are collected by a handful of people.
- *Do we have to be here?* → Only during the window they chose. "Mark as all gone" closes it in one tap.

**Set them up in person if you can.** Register the business, approve it from `/admin` while you're standing there, and post one real listing together. A restaurant that has posted once will post again; one that only has a login won't.

**Seed the other side first.** Food posted with nobody nearby to collect it is worse than nothing — it teaches a restaurant this doesn't work. Get a handful of alerts set in a neighbourhood before you onboard its restaurants: a food pantry, a campus group, a mutual aid network.

**Recurring posts are the goal.** A bakery that sets "every weekday, 9:30pm" once stops having to decide each night.

---

## Assumptions and decisions

Where the brief left room, these are the calls made and why.

1. **SQLite instead of Supabase/Postgres**, so the project runs with zero setup. Migration path documented above.
2. **Cache Components turned off** (`next.config.ts`). Nearly every route here is request-scoped — a session, a live list, a countdown. Enabling it would mean Suspense boundaries and `use cache: private` everywhere for no user-visible gain.
3. **No photo uploads yet.** The schema carries `photo_url` and the brief lists the field, but accepting arbitrary image uploads needs storage, size and content-type limits, and a moderation path. Posting fast at closing matters more than a photo; this is the clearest next thing to build.
4. **Recurring posts acknowledge the safety checklist once**, when the rule is created, not per generated listing. Convenient, and arguably wrong — flagged here rather than hidden.
5. **A "food is gone" report hides the listing immediately** but still queues for admin review. Trusting the report helps the next person right away; keeping the review means one bad actor can't knock a business offline.
6. **Distances are ZIP-centroid to ZIP-centroid**, and the UI always says "about". See **No maps, no location**.
7. **Seeker ZIP is a cookie, not a user column.** `users.home_zip` exists for a signed-in default, but the browsing path never writes it.
8. **Rate limits are fixed-window**, in the database rather than in memory, so they survive a restart and work across instances. The boundary case (double allowance at a window edge) is harmless here.
9. **Phone numbers normalise to E.164 for US numbers**, so one person can't become two accounts by typing their number differently.
10. **i18n is a dictionary, not a library.** Every string is server-rendered; an i18n runtime's bundle cost would land on exactly the low-end phones this exists for. Adding a language means adding one object in `src/lib/i18n.ts`.

### What I'd build next

- Photo uploads with real limits and moderation.
- Complete the Web Push payload encryption (one function).
- Per-listing saved-count caching — `interestCount` is a query per row on the dashboard, which is fine at this size and won't be at 10,000 listings.
- A provider-side view of *why* a post reached nobody ("no alerts set within 10 miles of 60615 yet"), so a restaurant understands quiet nights.

---

## Credits

ZIP centroids from the [US Census Bureau 2024 Gazetteer](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html) (public domain) and [GeoNames](https://www.geonames.org/) (CC BY 4.0). Typefaces: Zilla Slab and Public Sans, both SIL Open Font License.
