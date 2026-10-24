import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTestDatabase, cleanupTestDatabase, seed } from "./helpers.ts";

/**
 * ZIP distance sorting: the query a seeker's home screen is built on.
 *
 * The database has to exist before the app's db module is imported, because
 * that module opens a connection at import time from DATABASE_PATH.
 */
const dbPath = useTestDatabase();

const { listNearby, lookupZip } = await import("../src/db/queries.ts");

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

describe("listNearby", () => {
  let now: number;

  before(() => {
    now = Date.now();
    seed(
      dbPath,
      [
        // Same ZIP as the seeker.
        { id: "l_same", zip: "60615", description: "Same ZIP" },
        // ~1.3 miles away.
        { id: "l_near", zip: "60653", description: "Bronzeville" },
        // ~1.6 miles away.
        { id: "l_mid", zip: "60637", description: "Woodlawn" },
        // ~3.6 miles away.
        { id: "l_far", zip: "60616", description: "Chinatown" },
        // Another state entirely.
        { id: "l_la", zip: "90012", description: "Los Angeles" },
      ],
      now,
    ).close();
  });

  const origin = () => lookupZip("60615")!;

  function ids(opts: Partial<Parameters<typeof listNearby>[0]> = {}) {
    const o = origin();
    return listNearby({
      lat: o.lat,
      lng: o.lng,
      zip: "60615",
      radiusMiles: 25,
      at: now,
      ...opts,
    }).map((l) => l.id);
  }

  test("puts the seeker's own ZIP first", () => {
    assert.equal(ids()[0], "l_same");
  });

  test("orders the rest by increasing distance", () => {
    assert.deepEqual(ids(), ["l_same", "l_near", "l_mid", "l_far"]);
  });

  test("excludes anything beyond the chosen radius", () => {
    assert.deepEqual(ids({ radiusMiles: 5 }), ["l_same", "l_near", "l_mid", "l_far"]);

    // Los Angeles is ~1740 miles away and must never appear, at any radius
    // the UI offers.
    assert.ok(!ids({ radiusMiles: 25 }).includes("l_la"));
  });

  test("a tighter radius drops the furthest listings", () => {
    const within2 = listNearby({
      lat: origin().lat,
      lng: origin().lng,
      zip: "60615",
      radiusMiles: 2,
      at: now,
    }).map((l) => l.id);

    assert.ok(within2.includes("l_same"));
    assert.ok(within2.includes("l_near"));
    assert.ok(!within2.includes("l_far"), "Chinatown is ~3.6 miles and should be excluded at 2");
  });

  test("reports a distance that agrees with the ordering", () => {
    const o = origin();
    const rows = listNearby({ lat: o.lat, lng: o.lng, zip: "60615", radiusMiles: 25, at: now });

    for (let i = 1; i < rows.length; i++) {
      // Same-ZIP rows sort ahead regardless, so only compare within the rest.
      if (rows[i - 1].same_zip === rows[i].same_zip) {
        assert.ok(
          rows[i - 1].distance_miles <= rows[i].distance_miles + 1e-9,
          `row ${i} is closer than the row before it`,
        );
      }
    }
  });

  test("flags same_zip on exactly the matching listing", () => {
    const o = origin();
    const rows = listNearby({ lat: o.lat, lng: o.lng, zip: "60615", radiusMiles: 25, at: now });
    const flagged = rows.filter((r) => r.same_zip === 1).map((r) => r.id);
    assert.deepEqual(flagged, ["l_same"]);
  });
});

describe("listNearby tie-breaking", () => {
  let now: number;

  before(() => {
    now = Date.now();
    seed(
      dbPath,
      [
        // Three listings in one ZIP, so distance cannot separate them and the
        // closing time has to.
        { id: "t_last", zip: "60653", endOffsetMs: 6 * HOUR },
        { id: "t_first", zip: "60653", endOffsetMs: 30 * MIN },
        { id: "t_second", zip: "60653", endOffsetMs: 3 * HOUR },
      ],
      now,
    ).close();
  });

  test("at equal distance, the window closing soonest comes first", () => {
    const o = lookupZip("60615")!;
    const rows = listNearby({ lat: o.lat, lng: o.lng, zip: "60615", radiusMiles: 25, at: now });
    assert.deepEqual(
      rows.map((r) => r.id),
      ["t_first", "t_second", "t_last"],
    );
  });
});

describe("listNearby filters", () => {
  let now: number;

  before(() => {
    now = Date.now();
    seed(
      dbPath,
      [
        { id: "f_veg", zip: "60615", dietary: ["vegetarian"] },
        { id: "f_vegan_halal", zip: "60615", dietary: ["vegan", "halal"] },
        { id: "f_plain", zip: "60615", dietary: [] },
        { id: "f_later", zip: "60615", startOffsetMs: 3 * HOUR, endOffsetMs: 5 * HOUR },
        { id: "f_empty", zip: "60615", portionsTotal: 5, portionsRemaining: 0 },
        { id: "f_cancelled", zip: "60615", status: "cancelled" },
        { id: "f_ended", zip: "60615", startOffsetMs: -5 * HOUR, endOffsetMs: -1 * HOUR },
      ],
      now,
    ).close();
  });


  const run = (opts: Record<string, unknown> = {}) => {
    const o = lookupZip("60615")!;
    return listNearby({
      lat: o.lat,
      lng: o.lng,
      zip: "60615",
      radiusMiles: 25,
      at: now,
      ...opts,
    }).map((l) => l.id);
  };

  test("hides listings with nothing left", () => {
    assert.ok(!run().includes("f_empty"));
  });

  test("hides cancelled and finished listings", () => {
    const got = run();
    assert.ok(!got.includes("f_cancelled"));
    assert.ok(!got.includes("f_ended"));
  });

  test("dietary filters require every need to be met, not just one", () => {
    // Asking for vegan AND halal must not match a listing that is only vegan.
    const both = run({ dietary: ["vegan", "halal"] });
    assert.deepEqual(both, ["f_vegan_halal"]);

    const vegetarian = run({ dietary: ["vegetarian"] });
    assert.deepEqual(vegetarian, ["f_veg"]);
  });

  test("'available now' excludes a window that has not opened", () => {
    assert.ok(!run({ when: "now" }).includes("f_later"));
    assert.ok(run().includes("f_later"), "it should still appear with no time filter");
  });

  test("'later today' shows only windows that have not opened", () => {
    assert.deepEqual(run({ when: "later" }), ["f_later"]);
  });
});

after(cleanupTestDatabase);
