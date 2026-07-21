import { test } from "node:test";
import assert from "node:assert/strict";
import { doesDartMatchBoardMarkTarget } from "../boardMarkMatcher";
import type { BoardMarkDartResult } from "../boardMarkTypes";

function dart(segment: number, multiplier: 1 | 2 | 3): BoardMarkDartResult {
  return { segment, multiplier, throwingPlayerId: "p1" };
}

test("number bed 20 matches S20", () => {
  assert.equal(doesDartMatchBoardMarkTarget(dart(20, 1), { type: "number", value: 20 }), true);
});

test("number bed 20 matches D20", () => {
  assert.equal(doesDartMatchBoardMarkTarget(dart(20, 2), { type: "number", value: 20 }), true);
});

test("number bed 20 matches T20", () => {
  assert.equal(doesDartMatchBoardMarkTarget(dart(20, 3), { type: "number", value: 20 }), true);
});

test("number bed 20 does not match S19", () => {
  assert.equal(doesDartMatchBoardMarkTarget(dart(19, 1), { type: "number", value: 20 }), false);
});

test("treble 20 matches T20", () => {
  assert.equal(doesDartMatchBoardMarkTarget(dart(20, 3), { type: "treble", value: 20 }), true);
});

test("treble 20 does not match S20", () => {
  assert.equal(doesDartMatchBoardMarkTarget(dart(20, 1), { type: "treble", value: 20 }), false);
});

test("treble 20 does not match D20", () => {
  assert.equal(doesDartMatchBoardMarkTarget(dart(20, 2), { type: "treble", value: 20 }), false);
});

test("double 16 matches D16", () => {
  assert.equal(doesDartMatchBoardMarkTarget(dart(16, 2), { type: "double", value: 16 }), true);
});

test("double 16 does not match S16", () => {
  assert.equal(doesDartMatchBoardMarkTarget(dart(16, 1), { type: "double", value: 16 }), false);
});

test("bull target matches the app's bull representation (outer bull, segment 25 mult 1)", () => {
  assert.equal(doesDartMatchBoardMarkTarget(dart(25, 1), { type: "bull", value: "bull" }), true);
});

test("bull target matches the app's bull representation (bullseye, segment 25 mult 2)", () => {
  assert.equal(doesDartMatchBoardMarkTarget(dart(25, 2), { type: "bull", value: "bull" }), true);
});

test("bull target does not match a normal segment", () => {
  assert.equal(doesDartMatchBoardMarkTarget(dart(20, 1), { type: "bull", value: "bull" }), false);
});

test("number bed 20 does not match bull even though bull is segment 25", () => {
  assert.equal(doesDartMatchBoardMarkTarget(dart(25, 1), { type: "number", value: 20 }), false);
});

// ── "any" category targets (leg-wide cards) — restricted to 15-20 ──

test("treble value 'any' matches every treble 15-20", () => {
  for (const n of [15, 16, 17, 18, 19, 20]) {
    assert.equal(doesDartMatchBoardMarkTarget(dart(n, 3), { type: "treble", value: "any" }), true, `expected T${n} to match`);
  }
});

test("treble value 'any' does NOT match trebles outside 15-20", () => {
  for (const n of [1, 5, 10, 14]) {
    assert.equal(doesDartMatchBoardMarkTarget(dart(n, 3), { type: "treble", value: "any" }), false, `expected T${n} NOT to match`);
  }
});

test("double value 'any' matches every double 15-20 but not outside it", () => {
  for (const n of [15, 16, 17, 18, 19, 20]) {
    assert.equal(doesDartMatchBoardMarkTarget(dart(n, 2), { type: "double", value: "any" }), true, `expected D${n} to match`);
  }
  for (const n of [1, 7, 13, 14]) {
    assert.equal(doesDartMatchBoardMarkTarget(dart(n, 2), { type: "double", value: "any" }), false, `expected D${n} NOT to match`);
  }
});

test("number value 'any' matches beds 15-20 but not outside it, and never bull", () => {
  for (const n of [15, 16, 17, 18, 19, 20]) {
    assert.equal(doesDartMatchBoardMarkTarget(dart(n, 1), { type: "number", value: "any" }), true, `expected ${n} to match`);
  }
  assert.equal(doesDartMatchBoardMarkTarget(dart(10, 1), { type: "number", value: "any" }), false);
  assert.equal(doesDartMatchBoardMarkTarget(dart(25, 1), { type: "number", value: "any" }), false);
});
