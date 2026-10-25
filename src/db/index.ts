import "server-only";
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Turso (libSQL) allows us to move the database to the cloud so that
 * registration and ZIP searches work on Vercel.
 */

const TURSO_URL = process.env.TURSO_URL || "libsql://congressionalapp-holistagate.aws-us-east-1.turso.io";
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

declare global {
  var __mealbridge_db: any;
}

function open() {
  return createClient({
    url: TURSO_URL,
    authToken: TURSO_AUTH_TOKEN,
  });
}

export function getDb() {
  if (!globalThis.__mealbridge_db) globalThis.__mealbridge_db = open();
  return globalThis.__mealbridge_db;
}

export async function migrate(): Promise<void> {
  const schema = readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf8");
  await getDb().execute(schema);
}

type Params = Record<string, string | number | null> | Array<string | number | null>;

export async function all<T = Record<string, unknown>>(sql: string, params: Params = []): Promise<T[]> {
  const result = await getDb().execute(sql, { args: params });
  return (result.rows as any[]).map((r) => ({ ...r }));
}

export async function get<T = Record<string, unknown>>(sql: string, params: Params = []): Promise<T | undefined> {
  const result = await getDb().execute(sql, { args: params });
  const row = result.rows[0] as any;
  return row ? { ...row } : undefined;
}

export async function run(sql: string, params: Params = []) {
  return await getDb().execute(sql, { args: params });
}

export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  // Turso handles transactions differently than local SQLite
  // For this implementation, we'll use the basic execute for simple writes
  // and suggest Turso's batch() for complex ones.
  return await fn();
}

export function newId(prefix = ""): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const body = Buffer.from(bytes).toString("base64url");
  return prefix ? `${prefix}_${body}` : body;
}

export const now = () => Date.now();
