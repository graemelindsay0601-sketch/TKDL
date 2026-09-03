/**
 * Tests for predictor-math.ts — the pure formulas from the handover doc's
 * Non-Elo Match Predictor spec (section 7). Each test cites the subsection
 * it's checking so a failure points straight back to the source formula.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  smoothedRate, PRIOR_GAMES,
  recentFormScore,
  scoringEvents, scoringRate30, percentileRank, dartsPerformanceScore,
  weightedAverageWithRedistribution,
  pairProbability,
  confidenceScore, confidenceBand,
} from "../predictor-math.ts";

describe("smoothedRate (7.2)", () => {
  test("pulls small samples toward 50%", () => {
    // 1 win, 1 game, season prior of 4 -> (1 + 2) / (1 + 4) = 0.6, not 1.0
    assert.equal(smoothedRate(1, 1, PRIOR_GAMES.season), 0.6);
  });

  test("converges toward the raw rate as games grow", () => {
    // 80 wins out of 100 with a prior of 4 should sit close to 0.8
    const rate = smoothedRate(80, 100, PRIOR_GAMES.season);
    assert.ok(Math.abs(rate - 0.8) < 0.02);
  });

  test("zero games returns exactly 0.5 regardless of prior size", () => {
    assert.equal(smoothedRate(0, 0, PRIOR_GAMES.career), 0.5);
  });
});

describe("recentFormScore (7.3)", () => {
  test("weights newest results heaviest ([5,4,3,2,1])", () => {
    // 5 wins in a row -> weightedWins = weightSum -> 1.0
    assert.equal(recentFormScore(["W", "W", "W", "W", "W"], 0.5), 1.0);
  });

  test("only uses the most recent 5 even if more are given", () => {
    const withExtra = recentFormScore(["W", "W", "W", "W", "W", "L", "L", "L"], 0.5);
    assert.equal(withExtra, 1.0);
  });

  test("blends 50/50 with seasonRate when fewer than 2 matches exist", () => {
    // 1 win, seasonRate 0.5 -> raw=1.0, blended = 0.5*1.0 + 0.5*0.5 = 0.75
    assert.equal(recentFormScore(["W"], 0.5), 0.75);
  });

  test("zero matches returns the season rate untouched", () => {
    assert.equal(recentFormScore([], 0.42), 0.42);
  });

  test("does not blend once 2+ matches are available", () => {
    // 2 matches (W, L) with weights [5,4]: weightedWins=5, weightSum=9 -> 5/9
    const result = recentFormScore(["W", "L"], 0.9);
    assert.ok(Math.abs(result - 5 / 9) < 1e-9);
  });
});

describe("darts-performance factor (7.4)", () => {
  test("scoringEvents weights higher scores more heavily", () => {
    const events = scoringEvents({ s100: 10, s140: 5, s170: 2, s180: 1 });
    assert.equal(events, 1.0 * 10 + 1.4 * 5 + 1.8 * 2 + 2.2 * 1);
  });

  test("scoringRate30 normalizes to a 30-dart window, floored at 1 dart-unit", () => {
    assert.equal(scoringRate30(9, 90), 3); // 9 events / (90/30) = 3
    assert.equal(scoringRate30(9, 10), 9); // dartsThrown/30 < 1 -> floored to 1
  });

  test("percentileRank ranks against the cohort, not the player's own history", () => {
    const cohort = [1, 2, 3, 4, 5];
    assert.equal(percentileRank(3, cohort), 3 / 5); // 3 values <= 3
    assert.equal(percentileRank(10, cohort), 1);    // above everyone
    assert.equal(percentileRank(0, cohort), 0);     // below everyone
  });

  test("percentileRank returns null on an empty cohort rather than dividing by zero", () => {
    assert.equal(percentileRank(3, []), null);
  });

  test("dartsPerformanceScore combines 60/40 when both percentiles are available", () => {
    assert.equal(dartsPerformanceScore(0.8, 0.5), 0.60 * 0.8 + 0.40 * 0.5);
  });

  test("falls back to scoring-only when checkout data is insufficient", () => {
    assert.equal(dartsPerformanceScore(0.8, null), 0.8);
  });
});

describe("weightedAverageWithRedistribution (feature redistribution rule)", () => {
  test("computes a normal weighted average when everything is available", () => {
    const result = weightedAverageWithRedistribution([
      { weight: 0.25, value: 0.8 },
      { weight: 0.75, value: 0.4 },
    ]);
    assert.ok(Math.abs(result! - (0.25 * 0.8 + 0.75 * 0.4)) < 1e-9);
  });

  test("redistributes an unavailable feature's weight proportionally, never substituting zero", () => {
    // 20% darts-performance unavailable -> its weight is redistributed
    // across the remaining 80%, not silently scored as 0.
    const result = weightedAverageWithRedistribution([
      { weight: 0.25, value: 0.8 },
      { weight: 0.55, value: 0.6 },
      { weight: 0.20, value: null },
    ]);
    // Renormalized over 0.80 total: (0.25*0.8 + 0.55*0.6) / 0.80
    const expected = (0.25 * 0.8 + 0.55 * 0.6) / 0.80;
    assert.ok(Math.abs(result! - expected) < 1e-9);
  });

  test("returns null only when every single feature is unavailable", () => {
    assert.equal(weightedAverageWithRedistribution([{ weight: 1, value: null }]), null);
  });
});

describe("pairProbability (7.5)", () => {
  test("equal strengths produce a 50/50 split", () => {
    const { pA, pB } = pairProbability(0.5, 0.5);
    assert.equal(pA, 0.5);
    assert.equal(pB, 0.5);
  });

  test("a stronger player gets a higher probability", () => {
    const { pA, pB } = pairProbability(0.8, 0.2);
    assert.ok(pA > 0.5);
    assert.ok(pA > pB);
  });

  test("clamps to [0.10, 0.90] even for an extreme mismatch", () => {
    const { pA, pB } = pairProbability(1.0, 0.0);
    assert.ok(Math.abs(pA - 0.90) < 1e-9);
    assert.ok(Math.abs(pB - 0.10) < 1e-9);
  });

  test("pA and pB always sum to 1", () => {
    const { pA, pB } = pairProbability(0.63, 0.41);
    assert.ok(Math.abs(pA + pB - 1) < 1e-9);
  });
});

describe("confidence (7.6)", () => {
  test("zero games across the board scores 0 -> LOW", () => {
    const score = confidenceScore({ seasonGames: 0, careerGames: 0, h2hGames: 0, detailedMatches: 0, recentGames: 0 });
    assert.equal(score, 0);
    assert.equal(confidenceBand(score), "LOW");
  });

  test("hitting every cap scores exactly 100 -> HIGH", () => {
    const score = confidenceScore({ seasonGames: 10, careerGames: 30, h2hGames: 8, detailedMatches: 8, recentGames: 5 });
    assert.equal(score, 100);
    assert.equal(confidenceBand(score), "HIGH");
  });

  test("values beyond the cap don't push the score past their component's max", () => {
    const score = confidenceScore({ seasonGames: 999, careerGames: 999, h2hGames: 999, detailedMatches: 999, recentGames: 999 });
    assert.equal(score, 100);
  });

  test("band thresholds: 44 is LOW, 45 is MEDIUM, 74 is MEDIUM, 75 is HIGH", () => {
    assert.equal(confidenceBand(44), "LOW");
    assert.equal(confidenceBand(45), "MEDIUM");
    assert.equal(confidenceBand(74), "MEDIUM");
    assert.equal(confidenceBand(75), "HIGH");
  });
});
