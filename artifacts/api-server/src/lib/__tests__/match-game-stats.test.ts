import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanGameStats, gameStatsKind } from "../match-game-stats.ts";

test("game kind comes from the match's game type", () => {
  assert.equal(gameStatsKind("cricket"), "cricket");
  assert.equal(gameStatsKind("cutthroat_cricket"), "cricket");
  assert.equal(gameStatsKind("around_the_world"), "atw");
  assert.equal(gameStatsKind("501"), null);
  assert.equal(gameStatsKind(null), null);
});

test("cricket stats are accepted when they add up", () => {
  const ok = { darts: 30, visits: 10, marks: 24, bestVisit: 9, nineMarkVisits: 1, blankVisits: 2 };
  assert.deepEqual(cleanGameStats("cricket", ok), ok);
});

test("cricket stats that can't happen are refused", () => {
  const base = { darts: 30, visits: 10, marks: 24, bestVisit: 9, nineMarkVisits: 1, blankVisits: 2 };
  assert.equal(cleanGameStats("cricket", { ...base, bestVisit: 10 }), null);
  assert.equal(cleanGameStats("cricket", { ...base, marks: 91 }), null);
  assert.equal(cleanGameStats("cricket", { ...base, darts: 31 }), null); // more than 3 darts a visit
  assert.equal(cleanGameStats("cricket", { ...base, darts: -1 }), null);
  assert.equal(cleanGameStats("cricket", "nope"), null);
});

test("around the world stats: a perfect 9-darter is fine, nonsense is not", () => {
  const nine = { darts: 9, visits: 3, bestVisit: 9, trebleSkips: 7, doubleSkips: 0, bullDarts: 2, blankVisits: 0 };
  assert.deepEqual(cleanGameStats("atw", nine), nine);
  assert.equal(cleanGameStats("atw", { ...nine, bestVisit: 10 }), null);
  assert.equal(cleanGameStats("atw", { ...nine, trebleSkips: 10 }), null);
  assert.equal(cleanGameStats("atw", { ...nine, bullDarts: 1.5 }), null);
});
