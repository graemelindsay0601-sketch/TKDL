/**
 * Tests for the ELO rating math used to rank players/teams by skill
 * (separate from the points/wager ledder). Covers the core symmetry
 * properties, the "always gain at least 1" guarantee, the tier
 * boundaries, and the ELO floor that stops a long losing streak from
 * driving a rating below a sane minimum.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calcEloChange, calcTier, applyEloChange } from "../elo.ts";

describe("calcEloChange", () => {
  test("equal ratings produce half the K-factor (16)", () => {
    assert.equal(calcEloChange(1000, 1000), 16);
  });

  test("a big underdog beating a much higher-rated opponent gains close to the full K-factor", () => {
    const change = calcEloChange(800, 1600);
    assert.ok(change >= 28 && change <= 32, `expected a large upset gain, got ${change}`);
  });

  test("a heavy favorite beating a much lower-rated opponent gains very little", () => {
    const change = calcEloChange(1600, 800);
    assert.ok(change >= 1 && change <= 4, `expected a small favorite gain, got ${change}`);
  });

  test("the winner always gains at least 1 point, however lopsided the ratings", () => {
    assert.equal(calcEloChange(3000, 100) >= 1, true);
  });

  test("who wins matters, not just the rating gap: an upset always gains more than the expected result", () => {
    // Same 200-point gap between the two players either way, but the outcome
    // (who actually won) should swing the reward in opposite directions.
    const favoriteWinsAsExpected = calcEloChange(1100, 900); // rated-higher player wins
    const underdogUpset          = calcEloChange(900, 1100); // rated-lower player wins
    assert.ok(underdogUpset > favoriteWinsAsExpected);
  });
});

describe("calcTier", () => {
  test("1100+ is Gold", () => {
    assert.equal(calcTier(1100), "Gold");
    assert.equal(calcTier(2000), "Gold");
  });

  test("980-1099 is Silver", () => {
    assert.equal(calcTier(1099), "Silver");
    assert.equal(calcTier(980), "Silver");
  });

  test("below 980 is Bronze", () => {
    assert.equal(calcTier(979), "Bronze");
    assert.equal(calcTier(0), "Bronze");
  });
});

describe("applyEloChange", () => {
  test("winner's elo increases by the calculated change", () => {
    const { newWinnerElo, change } = applyEloChange(1000, 1000);
    assert.equal(newWinnerElo, 1000 + change);
  });

  test("loser's elo decreases by the calculated change", () => {
    const { newLoserElo, change } = applyEloChange(1000, 1000);
    assert.equal(newLoserElo, 1000 - change);
  });

  test("loser's elo never drops below the floor (800)", () => {
    const { newLoserElo } = applyEloChange(1600, 805);
    assert.ok(newLoserElo >= 800, `expected elo floored at 800, got ${newLoserElo}`);
  });

  test("loser already at the floor stays at the floor after another loss", () => {
    const { newLoserElo } = applyEloChange(1600, 800);
    assert.equal(newLoserElo, 800);
  });
});
