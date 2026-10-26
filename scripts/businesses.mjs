/**
 * Look at, or clear out, the businesses in a database.
 *
 * Exists because the two places that read a provider's status — the admin
 * list and the provider's own dashboard — disagreed on a deployed database,
 * and there was no way to see which was telling the truth without opening a
 * SQL shell. A deployment you cannot inspect is a deployment you cannot
 * debug.
 *
 *   node scripts/businesses.mjs              # list, changes nothing
 *   node scripts/businesses.mjs --reset      # delete every business
 *
 * Reads the same TURSO_* variables as everything else, so with none set it
 * talks to the local development database.
 */

import { createClient } from "@libsql/client";
import { createInterface } from "node:readline/promises";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const url =
  process.env.TURSO_DATABASE_URL ??
  `file:${path.join(process.cwd(), "node_modules", ".cache", "mealbridge", "dev.db")}`;

const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const rows = (r) => r.rows.map((x) => Object.fromEntries(r.columns.map((c, i) => [c, x[i]])));

console.log(`database: ${url}\n`);

const providers = rows(
  await db.execute(`
    SELECT p.id, p.business_name, p.status, p.zip, u.email,
           (SELECT COUNT(*) FROM listings l WHERE l.provider_id = p.id) AS listings
    FROM providers p
    LEFT JOIN users u ON u.id = p.user_id
    ORDER BY p.business_name
  `),
);

if (providers.length === 0) {
  console.log("No businesses.");
} else {
  for (const p of providers) {
    // The status is the whole point of this script, so print it verbatim
    // rather than prettified — a trailing space or odd casing is exactly the
    // kind of thing that makes one page disagree with another.
    console.log(
      `  ${String(p.business_name).padEnd(24)} ${JSON.stringify(p.status).padEnd(13)} ` +
        `${String(p.listings).padStart(3)} listings   ${p.email ?? "(no user)"}`,
    );
  }
  const canPost = providers.filter((p) => p.status === "approved").length;
  console.log(`\n${providers.length} businesses, ${canPost} able to post.`);
}

if (!args.has("--reset")) {
  console.log("\nPass --reset to delete all of them.");
  process.exit(0);
}

if (providers.length > 0 && process.stdin.isTTY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nDelete all ${providers.length} businesses? [y/N] `);
  rl.close();
  if (answer.trim().toLowerCase() !== "y") {
    console.log("Left alone.");
    process.exit(0);
  }
}

// Order matters: children before parents, or the foreign keys refuse.
// Seekers, their alerts and the ZIP table are deliberately untouched — this
// clears businesses, not the whole database.
await db.batch(
  [
    "DELETE FROM saved_listings WHERE listing_id IN (SELECT id FROM listings)",
    "DELETE FROM reports WHERE listing_id IN (SELECT id FROM listings)",
    "DELETE FROM listings",
    "DELETE FROM recurring_rules",
    "DELETE FROM notifications WHERE user_id IN (SELECT user_id FROM providers)",
    "DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM providers)",
    "DELETE FROM admin_actions WHERE target_type = 'provider'",
    "DELETE FROM users WHERE id IN (SELECT user_id FROM providers)",
    "DELETE FROM providers",
  ],
  "write",
);

console.log(`\nDeleted ${providers.length} businesses and everything they posted.`);
console.log("Seekers, alerts, the admin account and the ZIP table are untouched.");
