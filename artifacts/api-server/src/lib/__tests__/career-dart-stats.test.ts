import { test } from "node:test";
import assert from "node:assert/strict";
import { dartStats, type StoredMatch } from "../../career/stats/darts.ts";
import type { X01Format } from "../../shared/darts-rules/x01.ts";

const d = (segment: number, multiplier: 1 | 2 | 3) => ({ segment, multiplier, value: segment * multiplier });
const T20 = d(20, 3), MISS = { segment: 0, multiplier: 1 as const, value: 0 };
const misses = [MISS, MISS, MISS];
const bo1: X01Format = { startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: 1 };
const bo3: X01Format = { ...bo1, bestOfLegs: 3 };

test("a nine-darter: averages, tons, checkout and best leg", () => {
  const nine: StoredMatch = { format: bo1, firstThrower: 0, source: "TOURNAMENT",
    darts: [T20, T20, T20, ...misses, T20, T20, T20, ...misses, T20, d(19, 3), d(12, 2)] };
  const s = dartStats([nine]);
  assert.equal(s.matches, 1); assert.equal(s.legsWon, 1); assert.equal(s.darts, 9);
  assert.equal(s.average, 167); assert.equal(s.first9Average, 167);
  assert.deepEqual(s.tons, { "100+": 0, "140+": 1, "180": 2 });
  assert.deepEqual([s.checkout.attempts, s.checkout.hits, s.checkout.percent, s.checkout.highest], [1, 1, 100, 141]);
  assert.equal(s.checkout.bySize.over100, 1); assert.equal(s.bestLeg, 9);
  assert.deepEqual(s.doubles, [{ double: "D12", attempts: 1, hits: 1, percent: 100 }]);
});

test("darts at a double are counted one by one, and a missed double that leaves another is a second attempt", () => {
  // 501 left on 32 after 469 (T20 x 7 = 420, then 49 = T13 + D5): miss D16 into a single 16, then hit D8.
  const darts = [T20, T20, T20, ...misses, T20, T20, T20, ...misses, T20, d(13, 3), d(5, 2), ...misses, d(16, 1), d(8, 2)];
  const s = dartStats([{ format: bo1, firstThrower: 0, source: "MONEY_MATCH", darts }]);
  assert.equal(s.checkout.attempts, 2); assert.equal(s.checkout.hits, 1); assert.equal(s.checkout.percent, 50);
  assert.deepEqual(s.doubles.map(x => [x.double, x.attempts, x.hits]).sort(), [["D16", 1, 0], ["D8", 1, 1]]);
});

test("a deciding leg is one both players need; soft-tip and double-in matches are left out", () => {
  const leg = (winnerFirst: boolean) => winnerFirst
    ? [T20, T20, T20, ...misses, T20, T20, T20, ...misses, T20, d(19, 3), d(12, 2)]
    : [];
  // Bo3: you win leg 1 (you throw first), the bot wins leg 2 (bot throws first: it is fed three 180s and a 141), you win leg 3.
  const botLeg = [T20, T20, T20, ...misses, T20, T20, T20, ...misses, T20, d(19, 3), d(12, 2)];
  const s = dartStats([
    { format: bo3, firstThrower: 0, source: "TOURNAMENT", darts: [...leg(true), ...botLeg, ...leg(true)] },
    { format: { ...bo1, inRule: "DOUBLE" }, firstThrower: 0, source: "TOURNAMENT", darts: [] },
    { format: { ...bo1, bull: "FAT" }, firstThrower: 0, source: "TOURNAMENT", darts: [] },
  ]);
  assert.equal(s.matches, 1); assert.equal(s.legsPlayed, 3); assert.equal(s.legsWon, 2);
  assert.deepEqual([s.deciders.played, s.deciders.won], [1, 1]);
});

test("favourite and weakest doubles need enough attempts; empty history gives no numbers", () => {
  const empty = dartStats([]);
  assert.equal(empty.average, null); assert.equal(empty.checkout.percent, null); assert.equal(empty.favouriteDouble, null);
});
