import { test } from "node:test";
import assert from "node:assert/strict";
import { eloUpdate, nightPairs, ranks, expected } from "../shadow-ladder.ts";
import { shadowTraits } from "../shadow-profile.ts";

test("elo: the winner gains what the loser drops; upsets move more", () => {
  const [a, b] = eloUpdate(1000, 1000, true);
  assert.equal(a - 1000, 1000 - b);
  const [, upsetLoser] = eloUpdate(900, 1100, true);
  const [, expectedLoser] = eloUpdate(1100, 900, true);
  assert.ok(1100 - upsetLoser > 900 - expectedLoser);
  assert.ok(expected(1100, 900) > 0.5);
});

test("night pairs alternate so everyone meets both neighbours", () => {
  assert.deepEqual(nightPairs([1, 2, 3, 4, 5], 0), [[1, 2], [3, 4]]);
  assert.deepEqual(nightPairs([1, 2, 3, 4, 5], 1), [[2, 3], [4, 5]]);
});

test("ranks share a place on equal ratings", () => {
  const r = ranks([{ id: 1, rating: 1010 }, { id: 2, rating: 1010 }, { id: 3, rating: 990 }]);
  assert.equal(r.get(1), 1); assert.equal(r.get(2), 1); assert.equal(r.get(3), 3);
});

const base = { era: "all" as const, eraLabel: "", darts: 400, practiceDarts: 400, leagueDarts: 0, computedAvg: 55, primarySeg: 20, treblePct: 0.2, singlePct: 0.6, checkoutSegs: [16] };
test("traits come from the real darts", () => {
  const t = shadowTraits({ ...base, scoringDist: [{ seg: 20, mult: 3, n: 40 }, { seg: 20, mult: 1, n: 140 }, { seg: 0, mult: 0, n: 20 }],
    doubleRates: { "16": 0.4 }, doubleHitPct: 0.1, pressureDoubleHitPct: 0.03 }).map(x => x.key);
  assert.deepEqual(t, ["big_scorer", "double_trouble", "bottler", "wild", "specialist"]);
  assert.deepEqual(shadowTraits({ ...base, scoringDist: [{ seg: 20, mult: 1, n: 10 }], doubleRates: {}, doubleHitPct: 0.2, pressureDoubleHitPct: null }), []);
});
