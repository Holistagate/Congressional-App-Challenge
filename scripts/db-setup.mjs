/**
 * Creates the database, loads the bundled ZIP centroid table, and (unless you
 * pass --no-seed) fills it with a demo so the app has something to show the
 * moment it starts.
 *
 *   node scripts/db-setup.mjs            # migrate + zips + seed
 *   node scripts/db-setup.mjs --no-seed  # migrate + zips only
 *   node scripts/db-setup.mjs --reset    # delete the db first
 *
 * Standalone on purpose: no imports from src/, so setup works before anything
 * is built and cannot be broken by an app-side refactor.
 */
import { createClient } from "@libsql/client";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
// Kept out of the project tree: SQLite rewrites its -wal/-shm files on every
// read, and Next's watcher has no ignore list, so a database beside the source
// puts the dev server in a reload loop. Mirrored in src/db/index.ts.
const localDir = path.join(root, "node_modules", ".cache", "mealbridge");
const url = process.env.TURSO_DATABASE_URL ?? `file:${path.join(localDir, "dev.db")}`;
const remote = !url.startsWith("file:");

if (!remote) mkdirSync(localDir, { recursive: true });

const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

/**
 * Who the admin is.
 *
 * Sign-in takes no password and no code, so this address is the entire
 * credential: anyone who can type it can approve restaurants and read every
 * provider's contact details. A literal here would be committed, and a
 * committed admin credential is not one.
 *
 * Locally that does not matter — the app is on your machine — so a fixed
 * address keeps `npm run db:setup` working on a fresh clone. Against a remote
 * database it matters entirely, so there it is required rather than defaulted.
 * The footgun only exists in the case where it would actually go off.
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? (url.startsWith("file:") ? "admin@mealbridge.local" : null);

if (!ADMIN_EMAIL) {
  console.error(`
Refusing to seed a remote database without ADMIN_EMAIL.

Signing in needs only this address, so seeding a known one into a public
deployment hands the admin page to anyone who can guess it. Pick something
only you know — it never has to receive mail — and set it in the same place
as your other variables:

    ADMIN_EMAIL=... npm run db:setup
`);
  process.exit(1);
}

console.log(remote ? `target: ${url.replace(/\/\/.*@/, "//")}` : `target: ${url}`);

/**
 * --reset drops every table rather than deleting a file.
 *
 * It has to work against Turso, where there is no file to delete, and on
 * Windows, where a running `next dev` holds the local one open and unlinking
 * it fails with a baffling EPERM halfway through setup.
 */
if (args.has("--reset")) {
  const { rows } = await db.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  const tables = rows.map((r) => r.name);

  await db.execute("PRAGMA foreign_keys = OFF");
  for (const name of tables) await db.execute(`DROP TABLE IF EXISTS "${name}"`);
  await db.execute("PRAGMA foreign_keys = ON");

  console.log(`reset: dropped ${tables.length} tables`);
}

/* ------------------------------------------------------------- migrate --- */

await db.executeMultiple(readFileSync(path.join(root, "src", "db", "schema.sql"), "utf8"));
console.log("schema applied");

/* ----------------------------------------------------------------- zips --- */

const zipCount = (await db.execute("SELECT COUNT(*) AS n FROM zip_codes")).rows[0].n;
if (Number(zipCount) === 0) {
  const csvPath = path.join(root, "data", "zip-centroids.csv");
  if (!existsSync(csvPath)) {
    console.error(`Missing ${csvPath}. See scripts/build-zip-table.mjs.`);
    process.exit(1);
  }

  const lines = readFileSync(csvPath, "utf8").split("\n");
  const statements = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    // City may be quoted because a few contain commas.
    const m = line.match(/^(\d{5}),("(?:[^"]|"")*"|[^,]*),([^,]*),([^,]*),([^,]*)$/);
    if (!m) continue;
    const city = m[2].startsWith('"') ? m[2].slice(1, -1).replace(/""/g, '"') : m[2];
    statements.push({
      sql: "INSERT OR REPLACE INTO zip_codes (zip, city, state, lat, lng) VALUES (?, ?, ?, ?, ?)",
      args: [m[1], city, m[3], Number(m[4]), Number(m[5])],
    });
  }

  // Sent in chunks. One statement per row would be 41,637 round trips to
  // Turso; one batch of 41,637 would be a request far past what it accepts.
  // A thousand at a time takes well under a minute and stays inside both.
  const CHUNK = 1000;
  for (let i = 0; i < statements.length; i += CHUNK) {
    await db.batch(statements.slice(i, i + CHUNK), "write");
    if (remote) {
      const done = Math.min(i + CHUNK, statements.length);
      process.stdout.write(`
  zip_codes: ${done.toLocaleString()} / ${statements.length.toLocaleString()}`);
    }
  }
  if (remote) process.stdout.write("\n");
  console.log(`zip_codes: loaded ${statements.length.toLocaleString()} centroids`);
} else {
  console.log(`zip_codes: ${Number(zipCount).toLocaleString()} already present, skipping`);
}

/* ----------------------------------------------------------------- seed --- */

if (args.has("--no-seed")) {
  console.log("done (seed skipped)");
  process.exit(0);
}

if (Number((await db.execute("SELECT COUNT(*) AS n FROM users")).rows[0].n) > 0) {
  console.log("seed: users already exist, skipping. Use --reset to rebuild.");
  process.exit(0);
}

const id = (p) => `${p}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
const now = Date.now();

/** Today at a given local hour:minute, offset by whole days. */
function at(hour, minute = 0, dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

/** Minutes from now, for windows that should always be live during a demo. */
const inMin = (m) => now + m * 60000;

const seedStatements = [];

const mkUser = (role, name, email, phone, lang = "en", homeZip = null) => {
  const uid = id("usr");
  seedStatements.push({
    sql: "INSERT INTO users (id, role, name, email, phone, language, created_at, home_zip) VALUES (?,?,?,?,?,?,?,?)",
    args: [uid, role, name, email, phone, lang, now, homeZip],
  });
  return uid;
};

const adminId = mkUser("admin", "Ada Moreno", ADMIN_EMAIL, null);
const seekerId = mkUser("seeker", "Sam Rivera", "sam@example.com", null, "en", "60615");
mkUser("seeker", "Luz Delgado", null, "+13125550148", "es", "60616");

const mkProvider = (biz, street, city, state, zip, phone, status, showPhone) => {
  const uid = mkUser("provider", `${biz} manager`, `${zip}.${slug(biz)}@example.com`, null);
  const pid = id("prv");
  seedStatements.push({
    sql: `INSERT INTO providers (id, user_id, business_name, street, city, state, zip,
            contact_name, phone, email, permit_number, status, show_phone, show_interest,
            created_at, reviewed_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
    args: [
      pid, uid, biz, street, city, state, zip,
      "Manager", phone, `${zip}.${slug(biz)}@example.com`,
      `FP-${zip}-${Math.floor(Math.random() * 900 + 100)}`,
      status, showPhone, now - 86400000 * 14,
      status === "pending" ? null : now - 86400000 * 13,
    ],
  });
  return pid;
};

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// A tight cluster of real Chicago ZIPs, so distance sorting is visible in the
// demo rather than theoretical: 60615 Hyde Park, 60637 Woodlawn, 60653
// Bronzeville, 60616 Chinatown/Bridgeport, 60605 South Loop.
const harvest = mkProvider("Harvest Table", "1455 E 53rd St", "Chicago", "IL", "60615", "+13125550101", "approved", 1);
const masa = mkProvider("Masa Verde", "6300 S Cottage Grove Ave", "Chicago", "IL", "60637", "+13125550112", "approved", 0);
const blueDoor = mkProvider("Blue Door Bakery", "4304 S Cottage Grove Ave", "Chicago", "IL", "60653", "+13125550133", "approved", 1);
const golden = mkProvider("Golden Bowl", "2131 S Archer Ave", "Chicago", "IL", "60616", "+13125550155", "approved", 0);
mkProvider("Riverside Deli", "711 S Dearborn St", "Chicago", "IL", "60605", "+13125550177", "pending", 0);

const mkListing = (providerId, o) => {
  const lid = id("lst");
  seedStatements.push({
    sql: `INSERT INTO listings (id, provider_id, description, categories, dietary_tags, allergen_tags,
            portions_total, portions_remaining, street, city, state, zip,
            pickup_start, pickup_end, notes, photo_url, status, safety_ack_at, created_at, updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      lid, providerId, o.description,
      JSON.stringify(o.categories ?? []), JSON.stringify(o.dietary ?? []), JSON.stringify(o.allergens ?? []),
      o.total, o.remaining ?? o.total,
      o.street, o.city ?? "Chicago", o.state ?? "IL", o.zip,
      o.start, o.end, o.notes ?? "", null, o.status ?? "active",
      now, now - 3600000, now,
    ],
  });
  return lid;
};

// Deliberately spans every state the UI has to render: open now, closing
// inside the 45-minute threshold, opening later today, all gone, and expired.
const liveA = mkListing(harvest, {
  description: "Roast chicken, rice and black beans, and a tray of roasted vegetables from tonight's service.",
  categories: ["hot_meals", "prepared"], dietary: ["gluten_free"], allergens: ["milk"],
  total: 24, remaining: 18, street: "1455 E 53rd St", zip: "60615",
  start: inMin(-60), end: inMin(150),
  notes: "Come to the side door on Harper Ave and ask for Nia.",
});

mkListing(blueDoor, {
  description: "Sourdough loaves, seeded rolls and yesterday's croissants. Still good, just not sellable.",
  categories: ["bakery"], dietary: ["vegetarian"], allergens: ["wheat", "milk", "eggs"],
  total: 40, remaining: 31, street: "4304 S Cottage Grove Ave", zip: "60653",
  start: inMin(-180), end: inMin(35),
  notes: "Front counter. We close at the end of the window, so please don't come after.",
});

mkListing(masa, {
  description: "Vegetarian tamales and a pot of pozole verde. Everything is made fresh this morning.",
  categories: ["hot_meals"], dietary: ["vegetarian", "halal"], allergens: [],
  total: 30, remaining: 30, street: "6300 S Cottage Grove Ave", zip: "60637",
  start: inMin(120), end: inMin(300),
  notes: "Ring the bell at the back. Bring a bag if you have one.",
});

mkListing(golden, {
  description: "Steamed buns, fried rice and a tray of greens.",
  categories: ["hot_meals", "prepared"], dietary: [], allergens: ["soy", "wheat", "sesame"],
  total: 20, remaining: 0, street: "2131 S Archer Ave", zip: "60616",
  start: inMin(-200), end: inMin(60), status: "gone",
});

mkListing(harvest, {
  description: "Soup and bread from the lunch counter.",
  categories: ["hot_meals", "bakery"], dietary: ["vegetarian"], allergens: ["wheat"],
  total: 15, remaining: 4, street: "1455 E 53rd St", zip: "60615",
  start: at(11, 0, -1), end: at(14, 0, -1), status: "expired",
});

// A seeker with a standing alert, so the matching path has something to match.
// Standing schedules, so a deployed demo does not go empty.
//
// The one-off listings above expire within hours of seeding; anyone looking at
// this a day later would find nothing. These rules make /api/cron post a fresh
// listing every day, which is also the only thing that exercises the recurring
// engine in a live deployment.
//
// Times are minutes past midnight in the SERVER's zone, which on Vercel is
// UTC. A 10:00-23:59 UTC window is roughly 05:00-19:00 US Central, so there is
// something live through most of a US day. See the note on recurring_rules
// about per-restaurant timezones.
const mkRule = (providerId, template, startMinutes = 600, endMinutes = 1439) => {
  seedStatements.push({
    sql: `INSERT INTO recurring_rules (id, provider_id, weekdays, start_minutes, end_minutes,
            template, timezone, paused, created_at)
          VALUES (?,?,?,?,?,?,?,0,?)`,
    args: [
      id("rec"), providerId, "1,2,3,4,5,6,7", startMinutes, endMinutes,
      JSON.stringify(template), "UTC", now,
    ],
  });
};

mkRule(harvest, {
  description: "Soup, bread and whatever is left on the hot counter at the end of service.",
  portions: 20,
  categories: ["hot_meals", "bakery"],
  dietary_tags: ["vegetarian"],
  allergen_tags: ["wheat"],
  notes: "Side door on Harper Ave. Ask for whoever is on the pass.",
});

mkRule(blueDoor, {
  description: "Yesterday's loaves and pastries. Still good, just not sellable.",
  portions: 30,
  categories: ["bakery"],
  dietary_tags: ["vegetarian"],
  allergen_tags: ["wheat", "milk", "eggs"],
  notes: "Front counter.",
});

seedStatements.push({
  sql: "INSERT INTO alerts (id, seeker_id, zip, radius_miles, dietary_filters, channel, active, created_at) VALUES (?,?,?,?,?,?,1,?)",
  args: [id("alr"), seekerId, "60615", 10, JSON.stringify([]), "push", now],
});

// One open report, so the admin queue is not empty on first load.
seedStatements.push({
  sql: "INSERT INTO reports (id, listing_id, reporter_id, reason, details, status, created_at) VALUES (?,?,?,?,?,'open',?)",
  args: [id("rpt"), liveA, seekerId, "wrong_info", "The side door was locked when I got there.", now - 1800000],
});

// One batch: users, providers and listings reference each other, so they
// land together or not at all.
await db.batch(seedStatements, "write");

const counts = (
  await Promise.all(
    ["users", "providers", "listings", "alerts", "reports"].map(async (t) => {
      const { rows } = await db.execute(`SELECT COUNT(*) AS n FROM ${t}`);
      return `${t}=${rows[0].n}`;
    }),
  )
).join("  ");

console.log(`seeded: ${counts}`);
console.log(`
Demo sign-ins (no password, no code — see README "Authentication"):
  seeker    sam@example.com
  provider  60615.harvest-table@example.com   (approved)
  provider  60605.riverside-deli@example.com  (pending approval)
  admin     ${ADMIN_EMAIL}
`);
console.log(`database: ${url}`);
