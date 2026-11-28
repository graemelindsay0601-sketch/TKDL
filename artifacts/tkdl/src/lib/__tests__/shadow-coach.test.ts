import { test } from "node:test";
import assert from "node:assert/strict";
import { coachReport, sideOf } from "../shadow-coach.ts";

// You: 501 → 60s, then miss 7 darts at D20 while the shadow finishes.
const lostOnDoubles = { winner: 1 as const, start: [101, 101] as [number, number], visits: [
  { p: 0 as const, score: 61, left: 40, darts: [20, 20, 21] },
  { p: 1 as const, score: 60, left: 41, darts: [20, 20, 20] },
  { p: 0 as const, score: 0, left: 40, darts: [20, 1, 0] },   // 20 → D10 is still a finish; 1 → 19 odd
  { p: 1 as const, score: 1, left: 40, darts: [1] },
  { p: 0 as const, score: 0, left: 40, darts: [0, 0, 0] },
  { p: 1 as const, score: 40, left: 0, darts: [40] },
] };

test("darts at a double are counted from what was left before each dart", () => {
  const you = sideOf(lostOnDoubles, 0, true);
  assert.equal(you.dblAtt, 5); // 40, 20 (after a single 20) then three at 40
  assert.equal(you.dblHit, 0);
  const them = sideOf(lostOnDoubles, 1, true);
  assert.equal(them.dblAtt, 1); assert.equal(them.dblHit, 1);
});

test("the headline names why the game was lost", () => {
  const r = coachReport([lostOnDoubles], true, "Shadow Robert")!;
  assert.match(r.headline, /lost it on the doubles: 0\/5/);
  assert.match(r.legs[0].text, /Lost on the doubles/);
});

test("losing before getting a dart at a double is a scoring loss", () => {
  const leg = { winner: 1 as const, start: [501, 101] as [number, number], visits: [
    { p: 0 as const, score: 45, left: 456, darts: [20, 20, 5] }, { p: 1 as const, score: 101, left: 0, darts: [60, 1, 40] }] };
  assert.match(coachReport([leg])!.headline, /lost it in the scoring/);
});

test("a typed visit that didn't start on a finish adds no darts at a double", () => {
  const leg = { winner: 0 as const, start: [101, 101] as [number, number], visits: [
    { p: 0 as const, score: 61, left: 40, darts: [60, 1, 0], typed: true },
    { p: 1 as const, score: 60, left: 41, darts: [20, 20, 20] },
    { p: 0 as const, score: 40, left: 0, darts: [0, 40], typed: true }] };
  assert.deepEqual([sideOf(leg, 0, true).dblAtt, sideOf(leg, 0, true).dblHit], [2, 1]);
});
