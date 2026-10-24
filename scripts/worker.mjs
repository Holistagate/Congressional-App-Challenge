/**
 * The background worker, for running MealBridge without a cron service.
 *
 *   npm run worker
 *
 * It does the same three jobs as the /api/cron route — expire listings that
 * the clock has overtaken, post any recurring rules that are due, and send
 * whatever is queued — by calling that route on a loop.
 *
 * In production use a real scheduler pointed at /api/cron instead (Vercel
 * Cron, GitHub Actions, or crontab + curl). This exists so a laptop with
 * `npm run dev` behaves like the deployed app.
 */

const url = process.env.APP_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;
const everyMs = Number(process.env.WORKER_INTERVAL_MS ?? 60_000);

let stopping = false;

async function tick() {
  try {
    const res = await fetch(`${url}/api/cron`, {
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    });

    if (!res.ok) {
      console.error(`[worker] ${res.status} ${res.statusText}`);
      return;
    }

    const body = await res.json();
    const did =
      body.expired || body.markedGone || body.recurringPosted || body.notificationsSent;

    // Only speak up when something happened. A worker that prints every
    // minute trains you to stop reading its output.
    if (did) {
      console.log(
        `[worker] expired=${body.expired} gone=${body.markedGone} ` +
          `recurring=${body.recurringPosted} sent=${body.notificationsSent}` +
          (body.notificationsFailed ? ` failed=${body.notificationsFailed}` : ""),
      );
    }
  } catch (err) {
    console.error(`[worker] could not reach ${url}: ${err.message}`);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true;
    console.log("\n[worker] stopping");
    process.exit(0);
  });
}

console.log(`[worker] polling ${url}/api/cron every ${Math.round(everyMs / 1000)}s`);

await tick();
while (!stopping) {
  await new Promise((r) => setTimeout(r, everyMs));
  if (!stopping) await tick();
}
