import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  liveState,
  isCollectable,
  isListable,
  windowRemaining,
  countdown,
  formatWindow,
  CLOSING_SOON_MS,
} from "../src/lib/domain.ts";
import { useTestDatabase, cleanupTestDatabase, seed } from "./helpers.ts";

/**
 * Expiry.
 *
 * Two layers have to agree: `liveState` decides what a seeker is shown right
 * now, and `expireStaleListings` writes that conclusion back to the database.
 * The read layer is the one that matters — a listing must stop being offered
 * the moment its window closes, whether or not the sweep has run.
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const NOW = Date.UTC(2026, 9, 24, 19, 0, 0); // a fixed instant, so nothing is flaky

const listing = (over: Partial<Parameters<typeof liveState>[0]> = {}) => ({
  status: "active" as const,
  pickup_start: NOW - HOUR,
  pickup_end: NOW + HOUR,
  portions_remaining: 10,
  ...over,
});

describe("liveState", () => {
  test("open while inside the window with portions left", () => {
    assert.equal(liveState(listing(), NOW), "open");
  });

  test("soon once the window is within the closing-soon threshold", () => {
    const almost = listing({ pickup_end: NOW + CLOSING_SOON_MS - MIN });
    assert.equal(liveState(almost, NOW), "soon");
  });

  test("still open just outside that threshold", () => {
    const notYet = listing({ pickup_end: NOW + CLOSING_SOON_MS + MIN });
    assert.equal(liveState(notYet, NOW), "open");
  });

  test("later before the window opens", () => {
    assert.equal(liveState(listing({ pickup_start: NOW + HOUR, pickup_end: NOW + 2 * HOUR }), NOW), "later");
  });

  test("ended the instant the window closes", () => {
    assert.equal(liveState(listing({ pickup_end: NOW }), NOW), "ended");
    assert.equal(liveState(listing({ pickup_end: NOW - 1 }), NOW), "ended");
  });

  test("gone when nothing is left, even inside the window", () => {
    assert.equal(liveState(listing({ portions_remaining: 0 }), NOW), "gone");
  });

  test("gone outranks the clock", () => {
    // Zero portions during an open window is still gone, not open.
    const g = listing({ portions_remaining: 0, pickup_end: NOW + 5 * HOUR });
    assert.equal(liveState(g, NOW), "gone");
  });

  test("cancelled outranks everything", () => {
    const c = listing({ status: "cancelled", portions_remaining: 0, pickup_end: NOW - HOUR });
    assert.equal(liveState(c, NOW), "cancelled");
  });

  test("a stored status of expired is honoured", () => {
    assert.equal(liveState(listing({ status: "expired" }), NOW), "ended");
  });
});

describe("isCollectable / isListable", () => {
  test("only open and soon are collectable", () => {
    assert.equal(isCollectable("open"), true);
    assert.equal(isCollectable("soon"), true);
    for (const s of ["later", "gone", "ended", "cancelled"] as const) {
      assert.equal(isCollectable(s), false, `${s} should not be collectable`);
    }
  });

  test("later is listable but not collectable", () => {
    assert.equal(isListable("later"), true);
    assert.equal(isCollectable("later"), false);
  });

  test("nothing finished is listable", () => {
    for (const s of ["gone", "ended", "cancelled"] as const) {
      assert.equal(isListable(s), false, `${s} should not be listable`);
    }
  });
});

describe("windowRemaining", () => {
  test("is 1 before the window opens and 0 after it closes", () => {
    const l = listing({ pickup_start: NOW + HOUR, pickup_end: NOW + 2 * HOUR });
    assert.equal(windowRemaining(l, NOW), 1);
    assert.equal(windowRemaining(listing({ pickup_end: NOW - 1 }), NOW), 0);
  });

  test("is one half at the midpoint", () => {
    const l = listing({ pickup_start: NOW - HOUR, pickup_end: NOW + HOUR });
    assert.ok(Math.abs(windowRemaining(l, NOW) - 0.5) < 1e-9);
  });

  test("decreases monotonically through the window", () => {
    const l = listing({ pickup_start: NOW, pickup_end: NOW + 4 * HOUR });
    let previous = Infinity;
    for (let t = 0; t <= 4 * HOUR; t += 30 * MIN) {
      const value = windowRemaining(l, NOW + t);
      assert.ok(value <= previous, "remaining fraction went up");
      previous = value;
    }
  });

  test("never leaves 0..1, even with a nonsense window", () => {
    const broken = listing({ pickup_start: NOW + HOUR, pickup_end: NOW });
    const v = windowRemaining(broken, NOW);
    assert.ok(v >= 0 && v <= 1, `expected 0..1, got ${v}`);
  });
});

describe("countdown", () => {
  test("rounds up, so nobody is told they have less time than they do", () => {
    // 90 seconds is "2 min", never "1 min".
    assert.equal(countdown(90 * 1000), "Ends in 2 min");
    assert.equal(countdown(61 * 1000), "Ends in 2 min");
  });

  test("switches to hours past the hour mark", () => {
    assert.equal(countdown(2 * HOUR + 5 * MIN), "Ends in 2 hr 5 min");
    assert.equal(countdown(3 * HOUR), "Ends in 3 hr");
  });

  test("says ended at or below zero", () => {
    assert.equal(countdown(0), "Ended");
    assert.equal(countdown(-5 * MIN), "Ended");
  });

  test("speaks Spanish too", () => {
    assert.equal(countdown(30 * MIN, "es"), "Termina en 30 min");
    assert.equal(countdown(0, "es"), "Terminado");
  });
});

describe("formatWindow", () => {
  test("drops the repeated meridiem within one half of the day", () => {
    const start = new Date(2026, 9, 24, 17, 30).getTime();
    const end = new Date(2026, 9, 24, 21, 0).getTime();
    const text = formatWindow(start, end);
    assert.match(text, /5:30\s+–\s+9:00\s*PM/);
    assert.equal((text.match(/PM/g) ?? []).length, 1, "the meridiem should appear once");
  });

  test("keeps both when the window crosses midday", () => {
    const start = new Date(2026, 9, 24, 11, 0).getTime();
    const end = new Date(2026, 9, 24, 14, 0).getTime();
    const text = formatWindow(start, end);
    assert.match(text, /AM/);
    assert.match(text, /PM/);
  });
});

/* ------------------------------------------------------- the sweep ------- */

const dbPath = useTestDatabase();
const { expireStaleListings, listNearby, lookupZip, getListing } = await import(
  "../src/db/queries.ts"
);

describe("expireStaleListings", () => {
  let now: number;

  before(() => {
    now = Date.now();
    seed(
      dbPath,
      [
        { id: "e_live", zip: "60615", endOffsetMs: 2 * HOUR },
        { id: "e_past", zip: "60615", startOffsetMs: -5 * HOUR, endOffsetMs: -HOUR },
        { id: "e_empty", zip: "60615", portionsTotal: 4, portionsRemaining: 0 },
      ],
      now,
    ).close();
  });

  after(cleanupTestDatabase);

  test("marks a closed window expired and an emptied listing gone", () => {
    const result = expireStaleListings(now);
    assert.equal(result.expired, 1);
    assert.equal(result.gone, 1);

    assert.equal(getListing("e_past")?.status, "expired");
    assert.equal(getListing("e_empty")?.status, "gone");
    assert.equal(getListing("e_live")?.status, "active", "a live listing must be left alone");
  });

  test("is safe to run again", () => {
    const second = expireStaleListings(now);
    assert.equal(second.expired, 0);
    assert.equal(second.gone, 0);
  });

  test("the read path already hid them, sweep or no sweep", () => {
    // This is the point: a seeker is never shown stale food because a cron
    // job did not fire. The sweep only makes the stored column agree.
    const o = lookupZip("60615")!;
    const visible = listNearby({
      lat: o.lat,
      lng: o.lng,
      zip: "60615",
      radiusMiles: 25,
      at: now,
    }).map((l) => l.id);

    assert.deepEqual(visible, ["e_live"]);
  });
});
