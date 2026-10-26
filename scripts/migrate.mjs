/**
 * Brings an existing database up to the current schema.
 *
 * schema.sql is all CREATE TABLE IF NOT EXISTS, which is the right shape for
 * a fresh database and does precisely nothing for one that already has the
 * table — so a column added later never reaches a deployed database, and the
 * first query that mentions it fails in production only.
 *
 *   node scripts/migrate.mjs
 *
 * Every step is written to be safe to run twice.
 */

import { createClient } from "@libsql/client";
import path from "node:path";

const url =
  process.env.TURSO_DATABASE_URL ??
  `file:${path.join(process.cwd(), "node_modules", ".cache", "mealbridge", "dev.db")}`;

const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

console.log(`database: ${url}\n`);

const steps = [
  { name: "users.password_hash", sql: "ALTER TABLE users ADD COLUMN password_hash TEXT" },
];

for (const step of steps) {
  try {
    await db.execute(step.sql);
    console.log(`  applied   ${step.name}`);
  } catch (error) {
    // SQLite has no "ADD COLUMN IF NOT EXISTS", so the only way to know a
    // column is already there is to try adding it and read the complaint.
    const message = String(error?.message ?? error);
    if (/duplicate column|already exists/i.test(message)) {
      console.log(`  already   ${step.name}`);
    } else {
      console.error(`  FAILED    ${step.name}: ${message}`);
      process.exitCode = 1;
    }
  }
}

console.log("\nDone.");
