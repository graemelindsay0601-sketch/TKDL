/**
 * Tests for title-predictor-math.ts — the pure formulas from the handover
 * doc's Open-Wager Title Predictor spec (section 8). Each test cites the
 * subsection it's checking so a failure points straight back to the source
 * formula.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  londonMonthEndUTC, daysRemainingInMonth,
  leagueDailyRate,
  poissonSample,
  activityPropensity, pairFrequencyFactor, pairWeight, sampleWeightedPair,
  sampleStake,
  titleConfidenceScore,
} from "../title-predictor-math.ts";
import { confidenceBand } from "../predictor-math.ts";

// Deterministic RNG for tests that need reproducible "random" draws: cycles
// through a fixed sequence rather than calling Math.random.
function sequenceRng(values: number[]): () => number {
  let i = 0;
  return () => values[(i++) % values.length];
}

describe("londonMonthEndUTC / daysRemainingInMonth (8.3)", () => {
  test("GMT month (January): London midnight Feb 1 = UTC midnight Feb 1 (UTC+0)", () => {
    const end = londonMonthEndUTC(new Date("2026-01-15T12:00:00Z"));
    assert.equal(end.toISOString(), "2026-02-01T00:00:00.000Z");
  });

  test("BST month (July): London midnight Aug 1 = 23:00 UTC on Jul 31 (UTC+1)", () => {
    const end = londonMonthEndUTC(new Date("2026-07-15T12:00:00Z"));
    assert.equal(end.toISOString(), "2026-07-31T23:00:00.000Z");
  });

  test("December rolls over into January of the next year", () => {
    const end = londonMonthEndUTC(new Date("2026-12-20T09:00:00Z"));
    assert.equal(end.toISOString(), "2027-01-01T00:00:00.000Z");
  });

  test("daysRemainingInMonth is never negative, even moments after rollover", () => {
    const justAfter = new Date("2026-02-01T00:00:01Z");
    assert.ok(daysRemainingInMonth(justAfter) >= 0);
  });

  test("daysRemainingInMonth roughly matches a manual day count mid-month", () => {
    // Jan 15 -> Feb 1 is ~17 days.
    const days = daysRemainingInMonth(new Date("2026-01-15T00:00:00Z"));
    assert.ok(Math.abs(days - 17) < 0.1);
  });
});

describe("leagueDailyRate (8.3)", () => {
  test("blends 70/30 current/historical when history exists", () => {
    assert.ok(Math.abs(leagueDailyRate(1.0, 0.5) - (0.70 * 1.0 + 0.30 * 0.5)) < 1e-9);
  });

  test("falls back to currentDailyRate alone when there's no history", () => {
    assert.equal(leagueDailyRate(0.8, null), 0.8);
  });
});

describe("poissonSample (8.3)", () => {
  test("lambda <= 0 always returns 0", () => {
    assert.equal(poissonSample(0), 0);
    assert.equal(poissonSample(-5), 0);
  });

  test("mean of many draws converges toward lambda", () => {
    const lambda = 8;
    let sum = 0;
    const n = 20000;
    // Seeded-ish via Math.random is fine here — this is a statistical
    // convergence check, not a correctness assertion on one draw.
    for (let i = 0; i < n; i++) sum += poissonSample(lambda);
    const mean = sum / n;
    assert.ok(Math.abs(mean - lambda) < 0.3, `mean ${mean} too far from lambda ${lambda}`);
  });

  test("a fixed rng sequence produces a deterministic, reproducible draw", () => {
    // With lambda=1 (L = 1/e ≈ 0.3679): p starts at 1, multiply by 0.9 (p=0.9,
    // still > L, k=1), multiply by 0.5 (p=0.45, still > L, k=2), multiply by
    // 0.5 (p=0.225, <= L, stop, k=3) -> result k-1 = 2.
    const rng = sequenceRng([0.9, 0.5, 0.5]);
    assert.equal(poissonSample(1, rng), 2);
  });
});

describe("activityPropensity (8.4)", () => {
  test("zero appearances still gets a positive propensity (one-appearance smoothing prior)", () => {
    assert.equal(activityPropensity(0), 1);
  });

  test("propensity grows with real appearances", () => {
    assert.equal(activityPropensity(5), 6);
    assert.ok(activityPropensity(5) > activityPropensity(2));
  });
});

describe("pairFrequencyFactor (8.4)", () => {
  test("no historical meetings anywhere in the pool -> factor of exactly 1", () => {
    assert.equal(pairFrequencyFactor(0, 0), 1);
  });

  test("the most-frequent pair in the pool gets the full +25%", () => {
    assert.equal(pairFrequencyFactor(10, 10), 1.25);
  });

  test("a less-frequent pair gets a proportionally smaller bonus", () => {
    assert.ok(Math.abs(pairFrequencyFactor(5, 10) - 1.125) < 1e-9);
  });
});

describe("pairWeight (8.4)", () => {
  test("equals the geometric mean of propensities times the frequency factor", () => {
    const w = pairWeight(4, 9, 1.2);
    assert.ok(Math.abs(w - Math.sqrt(4 * 9) * 1.2) < 1e-9);
  });
});

describe("sampleWeightedPair (8.4)", () => {
  test("a single candidate pair is always returned", () => {
    const result = sampleWeightedPair([{ a: 1, b: 2, weight: 5 }]);
    assert.deepEqual(result, { a: 1, b: 2 });
  });

  test("empty candidate list returns null", () => {
    assert.equal(sampleWeightedPair([]), null);
  });

  test("roulette selection respects relative weights with a deterministic rng", () => {
    const pairs = [
      { a: 1, b: 2, weight: 1 },
      { a: 3, b: 4, weight: 9 },
    ];
    // total=10; rng()=0.05 -> r=0.5, first pair's weight(1) doesn't cover it
    // (0.5-1<=0 is true actually)... use an rng clearly inside the second
    // pair's share instead: rng()=0.5 -> r=5; 5-1=4 (still >0, not pair 1);
    // 4-9=-5 (<=0) -> pair 2.
    const result = sampleWeightedPair(pairs, () => 0.5);
    assert.deepEqual(result, { a: 3, b: 4 });
  });
});

describe("sampleStake (8.5)", () => {
  test("falls back to stake 1 when there's no positive stake history", () => {
    assert.equal(sampleStake([], 100), 1);
  });

  test("samples from the empirical list rather than a fitted distribution", () => {
    const stakes = [3, 7, 11];
    // rng()=0.5 with 3 items -> index floor(1.5)=1 -> stakes[1]=7
    assert.equal(sampleStake(stakes, 100, () => 0.5), 7);
  });

  test("clamps the sampled stake down to maxStake", () => {
    assert.equal(sampleStake([50], 10, () => 0), 10);
  });

  test("clamps to 0 when maxStake is 0 (defensive floor, not an expected path)", () => {
    assert.equal(sampleStake([50], 0, () => 0), 0);
  });
});

describe("titleConfidenceScore (8.8)", () => {
  test("early month, thin history, no prior seasons -> low confidence", () => {
    const score = titleConfidenceScore({
      elapsedDays: 2, daysRemaining: 28, matchesThisSeason: 1,
      currentDailyRate: 0.5, historicalDailyRate: null,
    });
    assert.equal(confidenceBand(score), "LOW");
  });

  test("late month, plenty of history, pace matching the historical rate -> high confidence", () => {
    const score = titleConfidenceScore({
      elapsedDays: 27, daysRemaining: 3, matchesThisSeason: 25,
      currentDailyRate: 1.0, historicalDailyRate: 1.0,
    });
    assert.equal(confidenceBand(score), "HIGH");
  });

  test("a season running wildly off its historical pace scores lower stability than one tracking it, all else equal", () => {
    const steady = titleConfidenceScore({
      elapsedDays: 15, daysRemaining: 15, matchesThisSeason: 10,
      currentDailyRate: 1.0, historicalDailyRate: 1.0,
    });
    const erratic = titleConfidenceScore({
      elapsedDays: 15, daysRemaining: 15, matchesThisSeason: 10,
      currentDailyRate: 3.0, historicalDailyRate: 1.0,
    });
    assert.ok(erratic < steady);
  });

  test("more of the month elapsed increases confidence, all else equal", () => {
    const early = titleConfidenceScore({
      elapsedDays: 3, daysRemaining: 27, matchesThisSeason: 5,
      currentDailyRate: 1.0, historicalDailyRate: 1.0,
    });
    const late = titleConfidenceScore({
      elapsedDays: 27, daysRemaining: 3, matchesThisSeason: 5,
      currentDailyRate: 1.0, historicalDailyRate: 1.0,
    });
    assert.ok(late > early);
  });
});
