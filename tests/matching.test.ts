import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { useTestDatabase, cleanupTestDatabase, seed, seedAlert } from "./helpers.ts";

/**
 * Alert matching: who gets told when a restaurant posts.
 *
 * Getting this wrong is expensive in both directions. Too narrow and someone
 * who would have walked ten minutes never hears about dinner; too wide and we
 * send people across the city for food that will be gone before they arrive,
 * which teaches them to ignore us.
 */
const dbPath = useTestDatabase();

const { matchAlertsForListing } = await import("../src/db/queries.ts");

describe("matchAlertsForListing", () => {
  let now: number;

  before(() => {
    now = Date.now();
    const db = seed(dbPath, [{ id: "l_hyde", zip: "60615" }], now);

    // Distances from 60615 (Hyde Park):
    //   60653 Bronzeville  ~1.3 mi
    //   60637 Woodlawn     ~1.6 mi
    //   60616 Chinatown    ~3.6 mi
    //   60601 the Loop     ~5.8 mi
    //   90012 Los Angeles  ~1740 mi
    seedAlert(db, { id: "a_same_zip", zip: "60615", radius: 5 }, now);
    seedAlert(db, { id: "a_close_5", zip: "60653", radius: 5 }, now);
    seedAlert(db, { id: "a_loop_5", zip: "60601", radius: 5 }, now);
    seedAlert(db, { id: "a_loop_10", zip: "60601", radius: 10 }, now);
    seedAlert(db, { id: "a_far_25", zip: "90012", radius: 25 }, now);
    seedAlert(db, { id: "a_off", zip: "60637", radius: 25, active: false }, now);
    db.close();
  });

  after(cleanupTestDatabase);

  const match = (zip = "60615", tags: string[] = []) =>
    matchAlertsForListing(zip, tags)
      .map((m) => m.alert_id)
      .sort();

  test("matches an alert in the same ZIP", () => {
    assert.ok(match().includes("a_same_zip"));
  });

  test("matches an alert whose radius reaches the listing", () => {
    assert.ok(match().includes("a_close_5"), "Bronzeville at ~1.3 mi is inside a 5 mile radius");
  });

  test("respects each seeker's own radius, not a fixed one", () => {
    const matched = match();
    // The Loop is ~5.8 miles from Hyde Park: outside a 5-mile alert, inside a
    // 10-mile one. Both alerts sit at the same ZIP, so only the radius differs.
    assert.ok(!matched.includes("a_loop_5"), "5-mile alert should not match a 5.8-mile listing");
    assert.ok(matched.includes("a_loop_10"), "10-mile alert should match it");
  });

  test("ignores alerts that are switched off", () => {
    assert.ok(!match().includes("a_off"));
  });

  test("never matches across the country", () => {
    assert.ok(!match().includes("a_far_25"));
  });

  test("reports the distance it matched on", () => {
    const matches = matchAlertsForListing("60615", []);
    const loop = matches.find((m) => m.alert_id === "a_loop_10");
    assert.ok(loop);
    assert.ok(
      loop.distance_miles > 5 && loop.distance_miles < 7,
      `expected ~5.8 miles, got ${loop.distance_miles.toFixed(2)}`,
    );
  });

  test("returns nothing for a ZIP we don't have a centroid for", () => {
    assert.deepEqual(matchAlertsForListing("99999", []), []);
  });
});

describe("matchAlertsForListing with dietary filters", () => {
  let now: number;

  before(() => {
    now = Date.now();
    const db = seed(dbPath, [{ id: "l_x", zip: "60615" }], now);
    seedAlert(db, { id: "a_any", zip: "60615", radius: 10, dietary: [] }, now);
    seedAlert(db, { id: "a_vegan", zip: "60615", radius: 10, dietary: ["vegan"] }, now);
    seedAlert(db, { id: "a_vegan_halal", zip: "60615", radius: 10, dietary: ["vegan", "halal"] }, now);
    db.close();
  });

  after(cleanupTestDatabase);

  const match = (tags: string[]) =>
    matchAlertsForListing("60615", tags)
      .map((m) => m.alert_id)
      .sort();

  test("an alert with no filters matches anything", () => {
    assert.deepEqual(match([]), ["a_any"]);
    assert.ok(match(["vegan"]).includes("a_any"));
  });

  test("a filtered alert only matches food that satisfies all of its filters", () => {
    assert.deepEqual(match(["vegan"]), ["a_any", "a_vegan"]);
    assert.deepEqual(match(["vegan", "halal"]), ["a_any", "a_vegan", "a_vegan_halal"]);
  });

  test("partially matching food does not reach a stricter alert", () => {
    // Food that is halal but not vegan must not reach someone who needs both.
    assert.ok(!match(["halal"]).includes("a_vegan_halal"));
    assert.ok(!match(["halal"]).includes("a_vegan"));
  });
});
