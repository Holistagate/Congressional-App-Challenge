import "server-only";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * SQLite via node:sqlite, which ships with Node 22.5+ and needs no native
 * build step. That matters more than it sounds: this project has to clone and
 * run on a judge's laptop without a Postgres install or a cloud account.
 *
 * Nothing here is SQLite-specific beyond the driver. The schema is ordinary
 * SQL and the queries avoid SQLite dialect, so moving to Postgres is a driver
 * swap plus the placeholder style. See README "Moving to Postgres".
 */

const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(process.cwd(), "data", "mealbridge.db");

declare global {
  // Next.js reloads modules on every edit in dev. Without a global handle we
  // would leak a file handle per reload until SQLite refuses to open more.
  var __mealbridge_db: DatabaseSync | undefined;
}

function open(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);
  // WAL lets the notification worker read while a provider is mid-post.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalThis.__mealbridge_db) globalThis.__mealbridge_db = open();
  return globalThis.__mealbridge_db;
}

/** Applies schema.sql. Idempotent — every statement is CREATE ... IF NOT EXISTS. */
export function migrate(db: DatabaseSync = getDb()): void {
  const schema = readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf8");
  db.exec(schema);
}

/* ------------------------------------------------------------------ helpers */

type Params = Record<string, string | number | null> | Array<string | number | null>;

/**
 * node:sqlite hands back rows with a null prototype. React refuses to serialise
 * those across the server/client boundary ("Classes or null prototypes are not
 * supported"), which would make every row unusable as a prop. Re-spreading into
 * an ordinary object here means callers never have to think about it.
 */
function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

export function all<T = Record<string, unknown>>(sql: string, params: Params = []): T[] {
  const stmt = getDb().prepare(sql);
  const rows = Array.isArray(params) ? stmt.all(...params) : stmt.all(params);
  return rows.map((r) => plain<T>(r));
}

export function get<T = Record<string, unknown>>(sql: string, params: Params = []): T | undefined {
  const stmt = getDb().prepare(sql);
  const row = Array.isArray(params) ? stmt.get(...params) : stmt.get(params);
  return row === undefined ? undefined : plain<T>(row);
}

export function run(sql: string, params: Params = []) {
  const stmt = getDb().prepare(sql);
  return Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
}

/** Wraps fn in a transaction. node:sqlite has no transaction helper of its own. */
export function tx<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/** Short, URL-safe, collision-resistant enough for row ids. */
export function newId(prefix = ""): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const body = Buffer.from(bytes).toString("base64url");
  return prefix ? `${prefix}_${body}` : body;
}

export const now = () => Date.now();
