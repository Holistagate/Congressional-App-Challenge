import { test } from "node:test";
import assert from "node:assert/strict";
import { toInstant, readOffset } from "../src/lib/time.ts";

/**
 * The bug these cover shipped, and could only have been caught here.
 *
 * A `datetime-local` input posts wall-clock time with no zone. Parsed on a
 * machine in the same zone as the person typing, it is right; parsed on a
 * server in UTC, a 7:15 PM pickup in Kentucky became 3:15 PM and the listing
 * was rejected for having already closed. Every one of these assertions
 * passes in either zone, because none of them depends on where the test runs.
 */

const EASTERN_DST = 240; // getTimezoneOffset() in New York in October: UTC-4

test("reads wall-clock time in the browser's zone, not the server's", () => {
  // 7:15 PM in Kentucky is 23:15 UTC the same day.
  assert.equal(
    toInstant("2026-10-26T19:15", EASTERN_DST),
    Date.parse("2026-10-26T23:15:00Z"),
  );
});

test("a zone-less value with no offset is read as UTC", () => {
  assert.equal(toInstant("2026-10-26T19:15", 0), Date.parse("2026-10-26T19:15:00Z"));
});

test("east of UTC goes the other way", () => {
  // Berlin in October is UTC+2, so getTimezoneOffset() is -120.
  assert.equal(toInstant("2026-10-26T19:15", -120), Date.parse("2026-10-26T17:15:00Z"));
});

test("an explicit zone in the value wins over the offset", () => {
  assert.equal(toInstant("2026-10-26T19:15:00Z", EASTERN_DST), Date.parse("2026-10-26T19:15:00Z"));
  assert.equal(toInstant("2026-10-26T19:15:00+02:00", EASTERN_DST), Date.parse("2026-10-26T17:15:00Z"));
});

test("seconds are allowed", () => {
  assert.equal(toInstant("2026-10-26T19:15:30", 0), Date.parse("2026-10-26T19:15:30Z"));
});

test("junk and emptiness are zero, not NaN", () => {
  // NaN would slip past a Number.isFinite check somewhere downstream and end
  // up in the database as a null pickup time.
  for (const bad of ["", "   ", "not a date", null]) {
    assert.equal(toInstant(bad, 0), 0);
  }
});

test("offsets outside the real world are ignored", () => {
  // Arrives from a form, so it is attacker-controlled: a wild value would
  // otherwise shift a pickup window by years.
  for (const bad of ["99999", "-99999", "abc", "", "1.5", null]) {
    assert.equal(readOffset(bad), 0);
  }
  assert.equal(readOffset("240"), 240);
  assert.equal(readOffset("-120"), -120);
  assert.equal(readOffset("840"), 840);
  assert.equal(readOffset("841"), 0);
});
