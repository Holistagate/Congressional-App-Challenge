import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * A throwaway database per test file.
 *
 * Each file gets its own file-backed SQLite database in a temp directory, so
 * tests cannot see each other's rows and none of them can touch the real
 * development data. `DATABASE_PATH` is set before the app's db module is
 * imported, which is how the app picks it up.
 */

const root = path.resolve(import.meta.dirname, "..");

let dir: string | null = null;

export function useTestDatabase(): string {
  dir = mkdtempSync(path.join(tmpdir(), "mealbridge-test-"));
  const dbPath = path.join(dir, "test.db");
  process.env.DATABASE_PATH = dbPath;

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(readFileSync(path.join(root, "src", "db", "schema.sql"), "utf8"));
  db.close();

  return dbPath;
}

export function cleanupTestDatabase(): void {
  if (dir) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows can hold the file briefly after close; a temp dir left behind
      // is not worth failing a test run over.
    }
    dir = null;
  }
}

/* ------------------------------------------------------------- fixtures -- */

/** Real centroids, so distances in tests are checkable against the map. */
export const ZIPS = [
  { zip: "60615", city: "Chicago", state: "IL", lat: 41.80326, lng: -87.59793 },  // Hyde Park
  { zip: "60637", city: "Chicago", state: "IL", lat: 41.78021, lng: -87.6035 },   // Woodlawn
  { zip: "60653", city: "Chicago", state: "IL", lat: 41.8201, lng: -87.6126 },    // Bronzeville
  { zip: "60616", city: "Chicago", state: "IL", lat: 41.84547, lng: -87.6301 },   // Chinatown
  { zip: "60601", city: "Chicago", state: "IL", lat: 41.88609, lng: -87.62242 },  // Loop
  { zip: "90012", city: "Los Angeles", state: "CA", lat: 34.06158, lng: -118.23882 },
];

export type SeedListing = {
  id: string;
  providerId?: string;
  zip: string;
  description?: string;
  portionsTotal?: number;
  portionsRemaining?: number;
  startOffsetMs?: number;
  endOffsetMs?: number;
  status?: string;
  dietary?: string[];
};

/**
 * Builds a minimal but valid world: the ZIP table, one approved provider per
 * ZIP used, and the listings asked for. Offsets are relative to `at`, so a
 * test says "ends in 30 minutes" rather than hard-coding a timestamp.
 */
export function seed(
  dbPath: string,
  listings: SeedListing[],
  at: number = Date.now(),
): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");

  // The app's db module opens one connection for the whole process, so every
  // test file shares a single database file. Clearing first is what keeps one
  // suite's listings out of the next suite's queries. zip_codes is left alone:
  // it is reference data, identical for everyone.
  for (const table of [
    "saved_listings",
    "reports",
    "notifications",
    "alerts",
    "listings",
    "recurring_rules",
    "providers",
    "sessions",
    "users",
  ]) {
    db.exec(`DELETE FROM ${table}`);
  }

  const insertZip = db.prepare(
    "INSERT OR REPLACE INTO zip_codes (zip, city, state, lat, lng) VALUES (?,?,?,?,?)",
  );
  for (const z of ZIPS) insertZip.run(z.zip, z.city, z.state, z.lat, z.lng);

  const providers = new Map<string, string>();

  for (const l of listings) {
    let providerId = l.providerId;

    if (!providerId) {
      providerId = providers.get(l.zip);
      if (!providerId) {
        providerId = `prv_${l.zip}`;
        const userId = `usr_${l.zip}`;
        db.prepare(
          "INSERT INTO users (id, role, name, email, language, created_at) VALUES (?,'provider','Test',?,'en',?)",
        ).run(userId, `${l.zip}@example.com`, at);
        db.prepare(
          `INSERT INTO providers (id, user_id, business_name, street, city, state, zip, status, created_at)
           VALUES (?,?,?,?,?,?,?, 'approved', ?)`,
        ).run(providerId, userId, `Kitchen ${l.zip}`, "1 Test St", "Chicago", "IL", l.zip, at);
        providers.set(l.zip, providerId);
      }
    }

    db.prepare(
      `INSERT INTO listings (id, provider_id, description, categories, dietary_tags, allergen_tags,
         portions_total, portions_remaining, street, city, state, zip,
         pickup_start, pickup_end, notes, status, safety_ack_at, created_at, updated_at)
       VALUES (?,?,?,'[]',?,'[]',?,?,?,?,?,?,?,?,'',?,?,?,?)`,
    ).run(
      l.id,
      providerId,
      l.description ?? `Food at ${l.zip}`,
      JSON.stringify(l.dietary ?? []),
      l.portionsTotal ?? 10,
      l.portionsRemaining ?? l.portionsTotal ?? 10,
      "1 Test St",
      "Chicago",
      "IL",
      l.zip,
      at + (l.startOffsetMs ?? -60 * 60 * 1000),
      at + (l.endOffsetMs ?? 2 * 60 * 60 * 1000),
      l.status ?? "active",
      at,
      at,
      at,
    );
  }

  return db;
}

/** A seeker with a standing alert. */
export function seedAlert(
  db: DatabaseSync,
  opts: { id: string; zip: string; radius: number; dietary?: string[]; active?: boolean },
  at: number = Date.now(),
): void {
  const userId = `usr_seeker_${opts.id}`;
  db.prepare(
    "INSERT INTO users (id, role, name, email, language, created_at) VALUES (?,'seeker','Seeker',?,'en',?)",
  ).run(userId, `${opts.id}@example.com`, at);

  db.prepare(
    `INSERT INTO alerts (id, seeker_id, zip, radius_miles, dietary_filters, channel, active, created_at)
     VALUES (?,?,?,?,?, 'push', ?, ?)`,
  ).run(
    opts.id,
    userId,
    opts.zip,
    opts.radius,
    JSON.stringify(opts.dietary ?? []),
    opts.active === false ? 0 : 1,
    at,
  );
}
