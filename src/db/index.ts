import "server-only";
import type { Client, InValue } from "@libsql/client";
import path from "node:path";

/**
 * SQLite, over libSQL.
 *
 * One driver for both places this runs. Locally it opens a file in data/;
 * in production it talks to Turso over HTTP. Same SQL, same code paths, so
 * nothing can work on a laptop and quietly fail once deployed.
 *
 * This replaced Node's built-in `node:sqlite`, which was the right call while
 * the project only had to run locally and the wrong one the moment it had to
 * run on Vercel: serverless instances get an ephemeral filesystem, so a
 * SQLite file there is empty on a cold start and gone again afterwards.
 *
 * Everything here is async because a network database cannot be anything
 * else. That is the whole reason the data layer reads the way it does.
 *
 * Two entry points, chosen by the URL. `@libsql/client` is the Node build and
 * depends on `libsql`, a native binary compiled per platform — fine on a
 * laptop, fatal in a serverless function, where the bundler tries to pack a
 * .node file built for the wrong operating system. `@libsql/client/web` is
 * the same API over plain fetch with no native dependency, which is what any
 * remote database gets. The native build is only ever reached for a file:
 * URL, which only ever happens in development.
 */

/**
 * Where the local database lives when Turso is not configured.
 *
 * Deliberately inside node_modules/.cache rather than the project tree. Next's
 * file watcher has no ignore list (watchOptions only exposes a poll interval),
 * and SQLite rewrites its -wal and -shm files on every read — so a database
 * kept beside the source puts the dev server in a loop: page load writes the
 * WAL, watcher fires, Fast Refresh reloads the page, which loads again.
 * Watchers universally skip node_modules, which ends it.
 *
 * Mirrored in scripts/db-setup.mjs; change both together.
 */
const DATABASE_URL =
  process.env.TURSO_DATABASE_URL ??
  `file:${path.join(process.cwd(), "node_modules", ".cache", "mealbridge", "dev.db")}`;

declare global {
  // Next.js reloads modules on every edit in dev, and serverless keeps the
  // module between invocations. Either way we want one client, not one per
  // reload or per request.
  var __mealbridge_db: Client | undefined;
}

const options = {
  url: DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
  // Timestamps here are epoch milliseconds — about 1.7e12, comfortably
  // inside a JS number. Without this they arrive as BigInt and every
  // comparison against Date.now() silently becomes a type error.
  intMode: "number" as const,
};

async function open(): Promise<Client> {
  if (DATABASE_URL.startsWith("file:")) {
    // Development only. Pulls in the native binding.
    const { createClient } = await import("@libsql/client");
    return createClient(options);
  }
  const { createClient } = await import("@libsql/client/web");
  return createClient(options);
}

export async function getDb(): Promise<Client> {
  if (!globalThis.__mealbridge_db) globalThis.__mealbridge_db = await open();
  return globalThis.__mealbridge_db;
}

/** True when pointed at Turso rather than a local file. */
export function isRemote(): boolean {
  return !DATABASE_URL.startsWith("file:");
}

/* ------------------------------------------------------------------ types */

export type Params = Record<string, InValue> | InValue[];

type Row = Record<string, unknown>;

/**
 * libSQL hands back rows that are array-like with named accessors. React
 * refuses to serialise those across the server/client boundary, the same way
 * it refused node:sqlite's null-prototype rows, so everything is rebuilt as a
 * plain object before it leaves this module.
 */
function toPlain<T>(columns: string[], values: readonly unknown[]): T {
  const out: Row = {};
  for (let i = 0; i < columns.length; i++) out[columns[i]] = values[i];
  return out as T;
}

/* ---------------------------------------------------------------- queries */

export async function all<T = Row>(sql: string, params: Params = []): Promise<T[]> {
  const result = await (await getDb()).execute({ sql, args: params });
  return result.rows.map((r) => toPlain<T>(result.columns, r as unknown as unknown[]));
}

export async function get<T = Row>(sql: string, params: Params = []): Promise<T | undefined> {
  const result = await (await getDb()).execute({ sql, args: params });
  if (result.rows.length === 0) return undefined;
  return toPlain<T>(result.columns, result.rows[0] as unknown as unknown[]);
}

export async function run(sql: string, params: Params = []): Promise<{ changes: number }> {
  const result = await (await getDb()).execute({ sql, args: params });
  return { changes: Number(result.rowsAffected ?? 0) };
}

/**
 * Several statements, applied together or not at all.
 *
 * libSQL's own batch rather than BEGIN/COMMIT around the helpers above: over
 * a network connection those would be separate round trips with no guarantee
 * they land on the same session, which is a transaction in name only.
 */
export async function batch(statements: { sql: string; args?: Params }[]): Promise<void> {
  await (await getDb()).batch(
    statements.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
    "write",
  );
}

/* ------------------------------------------------------------------ utils */

/** Short, URL-safe, collision-resistant enough for row ids. */
export function newId(prefix = ""): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const body = Buffer.from(bytes).toString("base64url");
  return prefix ? `${prefix}_${body}` : body;
}

export const now = () => Date.now();
