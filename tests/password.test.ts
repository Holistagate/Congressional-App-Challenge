import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, MIN_PASSWORD } from "../src/lib/password.ts";

test("a password verifies against its own hash", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
});

test("a wrong password does not", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("Correct horse battery staple", hash), false);
  assert.equal(await verifyPassword("", hash), false);
  assert.equal(await verifyPassword("correct horse battery stapl", hash), false);
});

test("the same password hashes differently every time", async () => {
  // If these ever matched, the salt would not be doing its job and identical
  // passwords would be visibly identical in a stolen database dump.
  const a = await hashPassword("hunter2hunter2");
  const b = await hashPassword("hunter2hunter2");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("hunter2hunter2", a), true);
  assert.equal(await verifyPassword("hunter2hunter2", b), true);
});

test("the stored hash contains no trace of the password", async () => {
  const hash = await hashPassword("pineapple-on-pizza");
  assert.ok(!hash.includes("pineapple"));
  assert.match(hash, /^scrypt\$\d+\$\d+\$\d+\$[\w+/=]+\$[\w+/=]+$/);
});

test("a missing or malformed hash refuses rather than throws", async () => {
  // A null hash is every seeded account, and every account made before
  // passwords existed. Throwing here would take out the sign-in page.
  for (const bad of [null, "", "not-a-hash", "scrypt$x$y$z", "bcrypt$1$2$3$4$5"]) {
    assert.equal(await verifyPassword("anything", bad), false);
  }
});

test("unicode passwords are normalised, so the same typing always works", async () => {
  // "é" composed vs decomposed looks identical and arrives differently
  // depending on the keyboard and the operating system.
  const composed = "café-password";
  const decomposed = "café-password";
  assert.notEqual(composed, decomposed);
  assert.equal(await verifyPassword(decomposed, await hashPassword(composed)), true);
});

test("the minimum length is a real number", () => {
  assert.ok(MIN_PASSWORD >= 8);
});
