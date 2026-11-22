import test from "node:test";
import assert from "node:assert/strict";
import { passwordVariants } from "../password-variants.ts";

test("phone-typed passwords: first-letter case and stray spaces are forgiven, nothing else", () => {
  assert.deepEqual(passwordVariants("merry"), ["merry", "Merry"]);
  assert.deepEqual(passwordVariants("Merry"), ["Merry", "merry"]);
  assert.ok(passwordVariants("Merry ").includes("Merry"));
  assert.ok(passwordVariants("Merry ").includes("merry"));
  assert.deepEqual(passwordVariants("1234"), ["1234"]);
  assert.ok(!passwordVariants("merry").includes("MERRY"));
  assert.ok(!passwordVariants("merry").includes("mErry"));
});
