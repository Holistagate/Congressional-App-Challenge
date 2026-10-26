import { NextResponse } from "next/server";
import { all, get, isRemote } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Is the database actually wired up?
 *
 * Exists because the failure it diagnoses is invisible from the outside. With
 * TURSO_DATABASE_URL unset the app falls back to a local SQLite file, which on
 * a serverless instance is an empty read-only filesystem — so every page that
 * does not query renders perfectly and every page that does returns an opaque
 * "a server error occurred". This endpoint is the difference between that and
 * a sentence saying which variable is missing.
 *
 * Deliberately says nothing secret: whether a variable is set, never its
 * value, and counts only of zip_codes, which is public reference data. No user
 * or listing figures, so this is safe to leave reachable.
 */
export async function GET() {
  const configured = Boolean(process.env.TURSO_DATABASE_URL);

  const report: Record<string, unknown> = {
    databaseUrlSet: configured,
    authTokenSet: Boolean(process.env.TURSO_AUTH_TOKEN),
    cronSecretSet: Boolean(process.env.CRON_SECRET),
    client: isRemote() ? "@libsql/client/web (remote)" : "@libsql/client (local file)",
    region: process.env.VERCEL_REGION ?? null,
  };

  if (!configured) {
    return NextResponse.json(
      {
        ok: false,
        problem:
          "TURSO_DATABASE_URL is not set, so the app is trying to use a local " +
          "SQLite file. A serverless filesystem is empty and read-only, which " +
          "is why pages that read the database fail. Set TURSO_DATABASE_URL and " +
          "TURSO_AUTH_TOKEN in the project's environment variables, then " +
          "redeploy — existing deployments do not pick up new variables.",
        ...report,
      },
      { status: 503 },
    );
  }

  // One cheap read per thing the two main flows depend on: the ZIP table for
  // distance sorting, the users table for signing in.
  try {
    const zips = await get<{ n: number }>("SELECT COUNT(*) AS n FROM zip_codes");
    const sample = await get<{ zip: string; city: string }>(
      "SELECT zip, city FROM zip_codes WHERE zip = ?",
      ["60615"],
    );
    // Signing in reads and writes these two. Reaching them at all is what
    // distinguishes "schema missing" from "schema fine, logic bug".
    await get("SELECT 1 FROM users LIMIT 1");
    await get("SELECT 1 FROM sessions LIMIT 1");

    // Columns added after a database was first created do not arrive on
    // their own: schema.sql is CREATE TABLE IF NOT EXISTS, which does nothing
    // to a table that already exists. Checked by name so the answer is "run
    // the migration" rather than a 500 on the sign-in page.
    const columns = await all<{ name: string }>("PRAGMA table_info(users)");
    const missing = ["password_hash"].filter((c) => !columns.some((x) => x.name === c));

    if (missing.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          problem:
            `The users table is missing ${missing.join(", ")}. Run \`npm run migrate\` ` +
            "with the Turso variables set. Signing in will fail until you do.",
          ...report,
          zipCodes: Number((await get<{ n: number }>("SELECT COUNT(*) AS n FROM zip_codes"))?.n ?? 0),
        },
        { status: 500 },
      );
    }

    const count = Number(zips?.n ?? 0);

    return NextResponse.json({
      ok: count > 0,
      problem:
        count > 0
          ? null
          : "Connected, but zip_codes is empty — the schema and ZIP table were " +
            "never loaded into this database. Run `npm run db:setup` from your " +
            "machine with TURSO_DATABASE_URL and TURSO_AUTH_TOKEN set.",
      ...report,
      zipCodes: count,
      zipLookupWorks: Boolean(sample),
      signInTablesPresent: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        problem:
          "Connected to a database but the query failed. If this mentions 'no " +
          "such table', the schema was never loaded: run `npm run db:setup` " +
          "with the Turso variables set. If it mentions auth, the token is " +
          "wrong or expired.",
        ...report,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
