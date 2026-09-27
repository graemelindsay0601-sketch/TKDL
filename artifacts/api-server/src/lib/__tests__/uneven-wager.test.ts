import { test } from "node:test";
import assert from "node:assert/strict";
import { wagerPot, computeWagerShares } from "../wager-pot.ts";
import { applyCombinedWager, validateCombinedStake, combinedPot } from "../wager.ts";

const solo = { name: "Graeme's team", points: 50 };
const combined = [
  { name: "Jamie's team", points: 30, fieldedCount: 1 },
  { name: "Kyle's team", points: 40, fieldedCount: 1 },
];

test("a total wager of 20 moves 20, regardless of who wins a 1v2", () => {
  assert.equal(wagerPot(20, 1, 2, "total"), 20);
  assert.deepEqual(computeWagerShares(20, 1, 2, "total"), { pot: 20, winnerShares: [20], loserShares: [10, 10] });
  assert.deepEqual(computeWagerShares(20, 2, 1, "total"), { pot: 20, winnerShares: [10, 10], loserShares: [20] });
});

test("Graeme wins: his team receives 20; each combined team pays 10", () => {
  const result = applyCombinedWager(20, "combined", solo, combined);
  assert.equal(result.newSoloPoints, 70);
  assert.deepEqual(result.combinedResults.map(r => r.newPoints), [20, 30]);
  assert.equal(result.soloPointsDelta + result.combinedResults.reduce((n, r) => n + r.pointsDelta, 0), 0);
});

test("Graeme loses: his team pays 20; each combined team receives 10", () => {
  const result = applyCombinedWager(20, "solo", solo, combined);
  assert.equal(result.newSoloPoints, 30);
  assert.deepEqual(result.combinedResults.map(r => r.newPoints), [40, 50]);
  assert.equal(result.soloPointsDelta + result.combinedResults.reduce((n, r) => n + r.pointsDelta, 0), 0);
});

test("the extra team's own balance must cover its share", () => {
  assert.match(validateCombinedStake(20, "combined", solo, [combined[0], { ...combined[1], points: 9 }])!, /Kyle/);
  assert.equal(validateCombinedStake(20, "combined", solo, [combined[0], { ...combined[1], points: 10 }]), null);
  assert.match(validateCombinedStake(20, "solo", { ...solo, points: 19 }, combined)!, /Graeme/);
});

test("odd pots are conserved and proportional shares follow fielded headcount", () => {
  assert.deepEqual(applyCombinedWager(21, "combined", solo, combined).combinedResults.map(r => r.share), [11, 10]);
  const unequal = [combined[0], { ...combined[1], fieldedCount: 2 }];
  assert.deepEqual(applyCombinedWager(20, "combined", solo, unequal).combinedResults.map(r => r.share), [7, 13]);
});

test("old clients keep their per-player stakes", () => {
  assert.equal(wagerPot(20, 1, 2), 40);
  assert.equal(combinedPot(20, 1, combined), 40);
  assert.deepEqual(computeWagerShares(20, 2, 2), { pot: 40, winnerShares: [20, 20], loserShares: [20, 20] });
});
