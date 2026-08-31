/**
 * Regression coverage for a scoring-corruption bug found during the backend
 * TypeScript cleanup: unlike every other card-effect applier in this file
 * (applyX01GoodCard/applyX01BadCard return a plain number),
 * applyCricketGoodCard/applyCricketBadCard return an OBJECT with a
 * pointsBonus/pointsReduction field. The caller in
 * card-score-integration.ts was doing `player1Modifier += applyCricketGoodCard(...)`
 * directly — adding a whole object to a running numeric total — which
 * silently produces NaN and corrupts every Cricket match's card-adjusted
 * score. These tests pin the actual (object) return shape down so that bug
 * class can't quietly come back if this file is touched again.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { applyCricketGoodCard, applyCricketBadCard, type CricketScoringContext } from "../card-effects.ts";

const baseContext: CricketScoringContext = {
  playerMarks: { 20: 2, 19: 1, 18: 1, 17: 0, 16: 0, 15: 0, 25: 1 },
  targetNumber: 20,
  currentMarksOnTarget: 3,
  opponentMarks: { 20: 2, 19: 1, 18: 1, 17: 0, 16: 0, 15: 0, 25: 1 },
};

describe("applyCricketGoodCard", () => {
  test("returns an object with a numeric pointsBonus field, not a bare number", () => {
    const result = applyCricketGoodCard("Close = +20 points", baseContext);
    assert.equal(typeof result, "object");
    assert.equal(typeof result.pointsBonus, "number");
    assert.equal(result.pointsBonus, 20);
    // Guard against the exact bug this fixed: the caller used to do
    // `modifier += applyCricketGoodCard(...)` — adding the whole return
    // value, not `.pointsBonus`, to a running numeric total. `+` on a
    // number and a plain object coerces the object to "[object Object]"
    // and silently turns the running total into a garbage string (which
    // only surfaces as NaN much later, once it hits Math.min/Math.max).
    const corrupted = 0 + (result as unknown as number);
    assert.equal(typeof corrupted, "string");
    assert.equal(Number.isNaN(Math.min(100, corrupted as unknown as number)), true);
  });

  test("also returns the marksModified map alongside pointsBonus", () => {
    const result = applyCricketGoodCard("Bull = 2x mark", {
      ...baseContext,
      playerMarks: { ...baseContext.playerMarks, 50: 1 },
    });
    assert.equal(result.marksModified[50], 2);
    assert.equal(result.pointsBonus, 0);
  });

  test("an unrecognized effect string falls back to a zero bonus rather than throwing", () => {
    const result = applyCricketGoodCard("Some future card effect nobody's coded yet", baseContext);
    assert.equal(result.pointsBonus, 0);
  });
});

describe("applyCricketBadCard", () => {
  test("returns an object with a numeric pointsReduction field, not a bare number", () => {
    const result = applyCricketBadCard("Lose 2 marks", baseContext);
    assert.equal(typeof result, "object");
    assert.equal(typeof result.pointsReduction, "number");
    assert.equal(result.pointsReduction, 2);
  });

  test("a marks-halving effect reduces every mark count, not just points", () => {
    const result = applyCricketBadCard("Marks 50%", baseContext);
    assert.equal(result.marksReduced[20], 1); // floor(2 * 0.5)
    assert.equal(result.marksReduced[19], 0); // floor(1 * 0.5)
    assert.equal(result.pointsReduction, 0);
  });
});
