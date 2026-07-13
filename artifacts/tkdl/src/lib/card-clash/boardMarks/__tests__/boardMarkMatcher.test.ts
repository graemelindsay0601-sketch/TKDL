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
