/**
 * Tests for the wager math that every match type (singles, team, doubles)
 * relies on to move points between winner/loser and decide elimination.
 * This is the closest thing this app has to "money" changing hands, so it's
 * worth pinning down the exact behavior with tests rather than trusting it
 * stays correct by inspection alone.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 * (uses Node's built-in test runner — no extra dependency needed)
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getMaxStake, validateStake, applyWager } from "../wager.ts";

describe("getMaxStake", () => {
  test("returns the lower of the two players' points", () => {
    assert.equal(getMaxStake({ points: 25 }, { points: 10 }), 10);
    assert.equal(getMaxStake({ points: 10 }, { points: 25 }), 10);
  });

  test("returns 0 when either player is already at 0", () => {
    assert.equal(getMaxStake({ points: 0 }, { points: 25 }), 0);
    assert.equal(getMaxStake({ points: 25 }, { points: 0 }), 0);
  });

  test("handles equal balances", () => {
    assert.equal(getMaxStake({ points: 15 }, { points: 15 }), 15);
  });
});

describe("validateStake", () => {
  const winner = { points: 20, name: "Winner" };
  const loser  = { points: 10, name: "Loser" };

  test("accepts a valid stake within both balances", () => {
    assert.equal(validateStake(5, winner, loser), null);
  });

  test("accepts a stake of exactly the lower balance", () => {
    assert.equal(validateStake(10, winner, loser), null);
  });

  test("accepts a stake of 0", () => {
    assert.equal(validateStake(0, winner, loser), null);
  });

  test("rejects a negative stake", () => {
    const err = validateStake(-1, winner, loser);
    assert.match(err ?? "", /non-negative integer/);
  });

  test("rejects a non-integer stake", () => {
    const err = validateStake(2.5, winner, loser);
    assert.match(err ?? "", /non-negative integer/);
  });

  test("rejects NaN", () => {
    const err = validateStake(NaN, winner, loser);
    assert.notEqual(err, null);
  });

  test("rejects a stake exceeding the winner's balance", () => {
    const err = validateStake(25, { points: 5, name: "Winner" }, { points: 100, name: "Loser" });
    assert.match(err ?? "", /Winner's balance/);
  });

  test("rejects a stake exceeding the loser's balance", () => {
    const err = validateStake(15, winner, loser);
    assert.match(err ?? "", /Loser's balance/);
  });

  test("a player at 0 points can never have a valid stake above 0", () => {
    const err = validateStake(1, winner, { points: 0, name: "Loser" });
    assert.notEqual(err, null);
  });
});

describe("applyWager", () => {
  test("winner gains the stake, loser loses it", () => {
    const result = applyWager(5, { points: 20 }, { points: 10 });
    assert.deepEqual(result, { newWinnerPoints: 25, newLoserPoints: 5, loserEliminated: false });
  });

  test("loser is eliminated exactly when their points hit 0", () => {
    const result = applyWager(10, { points: 20 }, { points: 10 });
    assert.equal(result.newLoserPoints, 0);
    assert.equal(result.loserEliminated, true);
  });

  test("loser points never go negative even if stake exceeds their balance", () => {
    const result = applyWager(999, { points: 20 }, { points: 10 });
    assert.equal(result.newLoserPoints, 0);
    assert.equal(result.loserEliminated, true);
  });

  test("a stake of 0 changes nothing", () => {
    const result = applyWager(0, { points: 20 }, { points: 10 });
    assert.deepEqual(result, { newWinnerPoints: 20, newLoserPoints: 10, loserEliminated: false });
  });

  test("winner's points always increase by exactly the stake", () => {
    for (const stake of [1, 5, 20, 100]) {
      const result = applyWager(stake, { points: 50 }, { points: 200 });
      assert.equal(result.newWinnerPoints, 50 + stake);
    }
  });
});
