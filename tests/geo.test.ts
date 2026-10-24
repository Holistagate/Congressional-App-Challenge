import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  haversineMiles,
  boundingBox,
  withinRadius,
  formatDistance,
  formatDistanceEs,
  normalizeZip,
  isRadiusOption,
} from "../src/lib/geo.ts";

/**
 * The distance maths that replaces a geocoding service.
 *
 * Expected values are checked against known real-world distances, so a change
 * that quietly breaks the formula shows up as a wrong number of miles rather
 * than as a test that was written to match whatever the code already did.
 */

const HYDE_PARK = { lat: 41.80326, lng: -87.59793 }; // 60615
const WOODLAWN = { lat: 41.78021, lng: -87.6035 }; // 60637
const THE_LOOP = { lat: 41.88609, lng: -87.62242 }; // 60601
const LOS_ANGELES = { lat: 34.06158, lng: -118.23882 }; // 90012

describe("haversineMiles", () => {
  test("is zero for a point against itself", () => {
    assert.equal(haversineMiles(HYDE_PARK, HYDE_PARK), 0);
  });

  test("matches a known short distance (Hyde Park to Woodlawn, ~1.6 mi)", () => {
    const miles = haversineMiles(HYDE_PARK, WOODLAWN);
    assert.ok(miles > 1.4 && miles < 1.8, `expected ~1.6 miles, got ${miles.toFixed(3)}`);
  });

  test("matches a known city-scale distance (Hyde Park to the Loop, ~5.8 mi)", () => {
    const miles = haversineMiles(HYDE_PARK, THE_LOOP);
    assert.ok(miles > 5.5 && miles < 6.2, `expected ~5.8 miles, got ${miles.toFixed(3)}`);
  });

  test("matches a known long distance (Chicago to Los Angeles, ~1740 mi)", () => {
    const miles = haversineMiles(HYDE_PARK, LOS_ANGELES);
    assert.ok(miles > 1700 && miles < 1780, `expected ~1740 miles, got ${miles.toFixed(0)}`);
  });

  test("is symmetric", () => {
    const there = haversineMiles(HYDE_PARK, THE_LOOP);
    const back = haversineMiles(THE_LOOP, HYDE_PARK);
    assert.ok(Math.abs(there - back) < 1e-9);
  });

  test("never returns NaN for antipodal points", () => {
    // The sqrt argument can drift just above 1 through floating point, which
    // would make asin return NaN. geo.ts clamps it; this is that guard.
    const d = haversineMiles({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    assert.ok(Number.isFinite(d), `expected a finite distance, got ${d}`);
    assert.ok(d > 12000, `expected roughly half the earth's circumference, got ${d.toFixed(0)}`);
  });
});

describe("boundingBox", () => {
  test("contains every point inside the radius", () => {
    const radius = 10;
    const box = boundingBox(HYDE_PARK, radius);

    // Anything the box excludes is never scored, so the box must not be
    // tighter than the circle it is standing in for.
    for (const point of [WOODLAWN, THE_LOOP]) {
      if (haversineMiles(HYDE_PARK, point) <= radius) {
        assert.ok(
          point.lat >= box.minLat &&
            point.lat <= box.maxLat &&
            point.lng >= box.minLng &&
            point.lng <= box.maxLng,
          `point within ${radius} miles fell outside the bounding box`,
        );
      }
    }
  });

  test("grows with the radius", () => {
    const small = boundingBox(HYDE_PARK, 5);
    const large = boundingBox(HYDE_PARK, 25);
    assert.ok(large.maxLat > small.maxLat);
    assert.ok(large.minLng < small.minLng);
  });
});

describe("withinRadius", () => {
  test("includes a point just inside and excludes one well outside", () => {
    assert.equal(withinRadius(HYDE_PARK, WOODLAWN, 5), true);
    assert.equal(withinRadius(HYDE_PARK, LOS_ANGELES, 25), false);
  });
});

describe("formatDistance", () => {
  test("says 'in your ZIP code' rather than a false zero", () => {
    assert.equal(formatDistance(0, true), "In your ZIP code");
    assert.equal(formatDistanceEs(0, true), "En tu código postal");
  });

  test("keeps one decimal under ten miles and rounds above it", () => {
    assert.equal(formatDistance(2.34), "About 2.3 miles away");
    assert.equal(formatDistance(23.6), "About 24 miles away");
  });

  test("always hedges, because the measurement is between ZIP centres", () => {
    for (const miles of [0.4, 2.3, 9.9, 24.2]) {
      assert.match(formatDistance(miles), /^About /);
      assert.match(formatDistanceEs(miles), /^A (unas|menos)/);
    }
  });
});

describe("normalizeZip", () => {
  test("accepts five digits and ZIP+4", () => {
    assert.equal(normalizeZip("60615"), "60615");
    assert.equal(normalizeZip("60615-1234"), "60615");
    assert.equal(normalizeZip("606151234"), "60615");
    assert.equal(normalizeZip("  60615 "), "60615");
  });

  test("rejects anything that is not a ZIP", () => {
    for (const bad of ["6061", "606155", "abcde", "", "60 615", "6061a"]) {
      assert.equal(normalizeZip(bad), null, `expected ${JSON.stringify(bad)} to be rejected`);
    }
  });
});

describe("isRadiusOption", () => {
  test("accepts only the three radii the UI offers", () => {
    assert.equal(isRadiusOption(5), true);
    assert.equal(isRadiusOption(10), true);
    assert.equal(isRadiusOption(25), true);
    assert.equal(isRadiusOption(500), false);
    assert.equal(isRadiusOption("abc"), false);
  });
});
