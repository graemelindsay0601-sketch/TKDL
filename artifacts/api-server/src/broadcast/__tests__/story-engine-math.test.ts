/**
 * Tests for story-engine-math.ts — the pure formulas from the handover
 * doc's Story Engine spec (section 9): score summing (9.2), treatment
 * thresholds (9.3), freshness half-life decay (9.5), story/subject key
 * encoding, and lifecycle transitions. Each describe block cites the
 * subsection (or, for the key encoding and lifecycle rule, notes that it's
 * this file's own scheme since the doc doesn't specify an algorithm).
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  SCORE_MAX,
  totalScore,
  unexpectednessComponent,
  highStakeThreshold,
  treatmentForScore,
  freshnessMultiplier,
  freshnessComponent,
  isFreshResultEventForNews,
  subjectKey,
  matchAnchoredStoryKey,
  subjectAnchoredStoryKey,
  seasonAnchoredStoryKey,
  seasonAnchoredStoryKeyPrefix,
  nextLifecycle,
  STORY_LIFECYCLES,
  computeSeasonRecapAggregate,
} from "../story-engine-math.ts";
import type { StoryScoreComponents } from "../story-engine-math.ts";

const ZERO_COMPONENTS: StoryScoreComponents = {
  competitiveImportance: 0,
  unexpectedness: 0,
  freshness: 0,
  historicalSignificance: 0,
  performanceAnomaly: 0,
  narrativeContinuity: 0,
  entertainmentValue: 0,
};

const MAX_COMPONENTS: StoryScoreComponents = {
  competitiveImportance: SCORE_MAX.competitiveImportance,
  unexpectedness: SCORE_MAX.unexpectedness,
  freshness: SCORE_MAX.freshness,
  historicalSignificance: SCORE_MAX.historicalSignificance,
  performanceAnomaly: SCORE_MAX.performanceAnomaly,
  narrativeContinuity: SCORE_MAX.narrativeContinuity,
  entertainmentValue: SCORE_MAX.entertainmentValue,
};

describe("SCORE_MAX (9.2)", () => {
  test("component maxes sum to exactly 100", () => {
    const sum = Object.values(SCORE_MAX).reduce((a, b) => a + b, 0);
    assert.equal(sum, 100);
  });
});

describe("totalScore (9.2)", () => {
  test("all-zero components sum to 0", () => {
    assert.equal(totalScore(ZERO_COMPONENTS), 0);
  });

  test("all-max components sum to exactly 100", () => {
    assert.equal(totalScore(MAX_COMPONENTS), 100);
  });

  test("sums a realistic mixed set of components", () => {
    const score = totalScore({
      competitiveImportance: 20,
      unexpectedness: 15,
      freshness: 10,
      historicalSignificance: 5,
      performanceAnomaly: 0,
      narrativeContinuity: 5,
      entertainmentValue: 2,
    });
    assert.equal(score, 57);
  });

  test("clamps a component that exceeds its own max rather than letting it inflate the total", () => {
    const score = totalScore({ ...ZERO_COMPONENTS, competitiveImportance: 999 });
    assert.equal(score, SCORE_MAX.competitiveImportance);
  });

  test("clamps a negative component to 0 rather than letting it deflate the total", () => {
    const score = totalScore({ ...ZERO_COMPONENTS, freshness: -50 });
    assert.equal(score, 0);
  });

  test("rounds a fractional sum to the nearest integer", () => {
    const score = totalScore({ ...ZERO_COMPONENTS, freshness: 10.4, entertainmentValue: 2.4 });
    assert.equal(score, 13); // 10.4 + 2.4 = 12.8 -> 13
  });
});

describe("unexpectednessComponent (9.2: derived from pre-match Predictor)", () => {
  test("a coin-flip winner (50%) is not unexpected at all", () => {
    assert.equal(unexpectednessComponent(0.5), 0);
  });

  test("a heavy favourite winning (>50%) is not unexpected", () => {
    assert.equal(unexpectednessComponent(0.9), 0);
    assert.equal(unexpectednessComponent(1), 0);
  });

  test("a 0% pre-match winner winning anyway is maximally unexpected", () => {
    assert.equal(unexpectednessComponent(0), SCORE_MAX.unexpectedness);
  });

  test("matches the doc's own named UPSET/MAJOR_UPSET/MODEL_SHOCK bands in increasing severity", () => {
    const upset = unexpectednessComponent(0.40);
    const majorUpset = unexpectednessComponent(0.25);
    const modelShock = unexpectednessComponent(0.15);
    assert.ok(upset < majorUpset);
    assert.ok(majorUpset < modelShock);
    assert.ok(Math.abs(upset - 4) < 1e-9);
    assert.ok(Math.abs(majorUpset - 10) < 1e-9);
    assert.ok(Math.abs(modelShock - 14) < 1e-9);
  });

  test("clamps an out-of-range probability rather than producing a negative or inflated component", () => {
    assert.equal(unexpectednessComponent(-0.5), SCORE_MAX.unexpectedness);
    assert.equal(unexpectednessComponent(1.5), 0);
  });
});

describe("highStakeThreshold (9.4: stake >= 85th percentile, minimum 5)", () => {
  test("empty sample falls back to the floor of 5", () => {
    assert.equal(highStakeThreshold([]), 5);
  });

  test("a low-stakes league's 85th percentile below 5 is clamped up to the floor", () => {
    // Every stake is 1 or 2 here — the 85th percentile of this sample is
    // well under 5, so the floor takes over.
    const stakes = [1, 1, 1, 2, 2, 2, 2, 2, 1, 1];
    assert.equal(highStakeThreshold(stakes), 5);
  });

  test("computes the actual 85th percentile once it exceeds the floor", () => {
    // 0..100 (101 values); the 85th percentile of a uniform 0..100 sample
    // via linear interpolation is exactly 85.
    const stakes = Array.from({ length: 101 }, (_, i) => i);
    assert.equal(highStakeThreshold(stakes), 85);
  });

  test("is insensitive to input order (sorts internally)", () => {
    const ascending = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const shuffled = [70, 10, 100, 40, 20, 90, 60, 30, 80, 50];
    assert.equal(highStakeThreshold(ascending), highStakeThreshold(shuffled));
  });

  test("does not mutate the input array", () => {
    const stakes = [50, 10, 30, 20, 40];
    const copy = [...stakes];
    highStakeThreshold(stakes);
    assert.deepEqual(stakes, copy);
  });
});

describe("treatmentForScore (9.3 thresholds)", () => {
  test("exact boundary 85 is major, 84 is featured", () => {
    assert.equal(treatmentForScore(85), "major");
    assert.equal(treatmentForScore(84), "featured");
  });

  test("exact boundary 70 is featured, 69 is supporting", () => {
    assert.equal(treatmentForScore(70), "featured");
    assert.equal(treatmentForScore(69), "supporting");
  });

  test("exact boundary 50 is supporting, 49 is headline_ticker", () => {
    assert.equal(treatmentForScore(50), "supporting");
    assert.equal(treatmentForScore(49), "headline_ticker");
  });

  test("exact boundary 30 is headline_ticker, 29 is archive", () => {
    assert.equal(treatmentForScore(30), "headline_ticker");
    assert.equal(treatmentForScore(29), "archive");
  });

  test("100 and 0 land on the expected ends", () => {
    assert.equal(treatmentForScore(100), "major");
    assert.equal(treatmentForScore(0), "archive");
  });
});

describe("freshnessMultiplier / freshnessComponent (9.5 half-life decay)", () => {
  test("zero hours elapsed gives full freshness for every class", () => {
    assert.equal(freshnessMultiplier(0, "result"), 1);
    assert.equal(freshnessMultiplier(0, "persistent"), 1);
    assert.equal(freshnessMultiplier(0, "milestone"), 1);
  });

  test("result story (12h half-life) is at half strength after exactly 12 hours", () => {
    assert.ok(Math.abs(freshnessMultiplier(12, "result") - 0.5) < 1e-9);
  });

  test("persistent story (48h half-life) is at half strength after exactly 48 hours", () => {
    assert.ok(Math.abs(freshnessMultiplier(48, "persistent") - 0.5) < 1e-9);
  });

  test("milestone story (72h half-life) is at half strength after exactly 72 hours", () => {
    assert.ok(Math.abs(freshnessMultiplier(72, "milestone") - 0.5) < 1e-9);
  });

  test("a result story decays much faster than a milestone story at the same elapsed time", () => {
    const resultMult = freshnessMultiplier(24, "result");
    const milestoneMult = freshnessMultiplier(24, "milestone");
    assert.ok(resultMult < milestoneMult);
  });

  test("negative elapsed hours (clock skew) is treated as zero, not amplified freshness", () => {
    assert.equal(freshnessMultiplier(-5, "result"), freshnessMultiplier(0, "result"));
  });

  test("freshnessComponent scales SCORE_MAX.freshness by the multiplier", () => {
    assert.ok(Math.abs(freshnessComponent(12, "result") - SCORE_MAX.freshness * 0.5) < 1e-9);
    assert.equal(freshnessComponent(0, "milestone"), SCORE_MAX.freshness);
  });

  test("freshnessComponent approaches but never reaches 0 for very large elapsed times", () => {
    const component = freshnessComponent(10_000, "result");
    assert.ok(component > 0);
    assert.ok(component < 0.001);
  });
});

describe("isFreshResultEventForNews", () => {
  const cutoff = new Date("2026-09-05T20:00:00Z");

  test("accepts an event exactly 36 hours before the editorial cutoff", () => {
    assert.equal(isFreshResultEventForNews("2026-09-04T08:00:00Z", cutoff), true);
  });

  test("rejects older, missing, malformed, and future event timestamps", () => {
    assert.equal(isFreshResultEventForNews("2026-09-04T07:59:59Z", cutoff), false);
    assert.equal(isFreshResultEventForNews(undefined, cutoff), false);
    assert.equal(isFreshResultEventForNews("not-a-date", cutoff), false);
    assert.equal(isFreshResultEventForNews("2026-09-05T20:00:01Z", cutoff), false);
  });
});

describe("subjectKey / matchAnchoredStoryKey / subjectAnchoredStoryKey (encoding scheme)", () => {
  test("subjectKey encodes league type and entity id", () => {
    assert.equal(subjectKey("singles", 7), "singles:7");
    assert.equal(subjectKey("doubles", 42), "doubles:42");
    assert.equal(subjectKey("shift_wars", 3), "shift_wars:3");
  });

  test("matchAnchoredStoryKey encodes league, story type, and match id", () => {
    assert.equal(matchAnchoredStoryKey("singles", "UPSET", 501), "singles:UPSET:match:501");
  });

  test("two different matches of the same story type produce different match-anchored keys", () => {
    const a = matchAnchoredStoryKey("singles", "UPSET", 501);
    const b = matchAnchoredStoryKey("singles", "UPSET", 502);
    assert.notEqual(a, b);
  });

  test("subjectAnchoredStoryKey sorts subject keys so order doesn't matter", () => {
    const a = subjectAnchoredStoryKey("singles", "WIN_STREAK", ["singles:7", "singles:3"]);
    const b = subjectAnchoredStoryKey("singles", "WIN_STREAK", ["singles:3", "singles:7"]);
    assert.equal(a, b);
    assert.equal(a, "singles:WIN_STREAK:subjects:singles:3,singles:7");
  });

  test("subjectAnchoredStoryKey does not mutate the input array", () => {
    const input = ["singles:7", "singles:3"];
    subjectAnchoredStoryKey("singles", "WIN_STREAK", input);
    assert.deepEqual(input, ["singles:7", "singles:3"]);
  });

  test("re-detecting the same subject set (e.g. a still-ongoing streak) resolves to the same key", () => {
    const first = subjectAnchoredStoryKey("doubles", "PAIR_SURGE", ["doubles:11", "doubles:12"]);
    const second = subjectAnchoredStoryKey("doubles", "PAIR_SURGE", ["doubles:11", "doubles:12"]);
    assert.equal(first, second);
  });
});

describe("seasonAnchoredStoryKey / seasonAnchoredStoryKeyPrefix (story-engine.ts's own third key shape)", () => {
  test("encodes league, story type, season id, and sorted subjects", () => {
    const key = seasonAnchoredStoryKey("singles", "CHAMPION", 11, ["singles:7"]);
    assert.equal(key, "singles:CHAMPION:season:11:subjects:singles:7");
  });

  test("the same entity winning CHAMPION in two different seasons produces two DIFFERENT keys", () => {
    const season3 = seasonAnchoredStoryKey("singles", "CHAMPION", 3, ["singles:7"]);
    const season11 = seasonAnchoredStoryKey("singles", "CHAMPION", 11, ["singles:7"]);
    assert.notEqual(season3, season11);
  });

  test("sorts subject keys so order doesn't matter, same as subjectAnchoredStoryKey", () => {
    const a = seasonAnchoredStoryKey("shift_wars", "SHIFT_DOMINANCE", 5, ["shift_wars:2", "shift_wars:1"]);
    const b = seasonAnchoredStoryKey("shift_wars", "SHIFT_DOMINANCE", 5, ["shift_wars:1", "shift_wars:2"]);
    assert.equal(a, b);
  });

  test("does not mutate the input array", () => {
    const input = ["singles:9", "singles:2"];
    seasonAnchoredStoryKey("singles", "TITLE_RACE", 4, input);
    assert.deepEqual(input, ["singles:9", "singles:2"]);
  });

  test("seasonAnchoredStoryKeyPrefix is a prefix of every key seasonAnchoredStoryKey produces for that (league, type, season)", () => {
    const prefix = seasonAnchoredStoryKeyPrefix("singles", "TITLE_RACE", 4);
    const key1 = seasonAnchoredStoryKey("singles", "TITLE_RACE", 4, ["singles:1", "singles:2"]);
    const key2 = seasonAnchoredStoryKey("singles", "TITLE_RACE", 4, ["singles:1", "singles:2", "singles:3"]);
    assert.ok(key1.startsWith(prefix));
    assert.ok(key2.startsWith(prefix));
  });

  test("a different season's key does not share the prefix", () => {
    const prefix = seasonAnchoredStoryKeyPrefix("singles", "TITLE_RACE", 4);
    const otherSeasonKey = seasonAnchoredStoryKey("singles", "TITLE_RACE", 5, ["singles:1", "singles:2"]);
    assert.ok(!otherSeasonKey.startsWith(prefix));
  });
});

describe("nextLifecycle (lifecycle transition rule)", () => {
  test("no longer detected -> RESOLVED, regardless of prior state", () => {
    assert.equal(
      nextLifecycle({ previousLifecycle: "ACTIVE", stillDetected: false, previousScore: 60, currentScore: 60 }),
      "RESOLVED",
    );
    assert.equal(
      nextLifecycle({ previousLifecycle: null, stillDetected: false, previousScore: null, currentScore: 0 }),
      "RESOLVED",
    );
  });

  test("never detected before (no previous lifecycle) -> NEW", () => {
    assert.equal(
      nextLifecycle({ previousLifecycle: null, stillDetected: true, previousScore: null, currentScore: 40 }),
      "NEW",
    );
  });

  test("previously RESOLVED and detected again -> NEW, not a reanimated continuation", () => {
    assert.equal(
      nextLifecycle({ previousLifecycle: "RESOLVED", stillDetected: true, previousScore: 40, currentScore: 40 }),
      "NEW",
    );
  });

  test("previously ARCHIVED and detected again -> NEW", () => {
    assert.equal(
      nextLifecycle({ previousLifecycle: "ARCHIVED", stillDetected: true, previousScore: 20, currentScore: 55 }),
      "NEW",
    );
  });

  test("score jumps by 10 or more -> HOT", () => {
    assert.equal(
      nextLifecycle({ previousLifecycle: "ACTIVE", stillDetected: true, previousScore: 40, currentScore: 50 }),
      "HOT",
    );
    assert.equal(
      nextLifecycle({ previousLifecycle: "COOLING", stillDetected: true, previousScore: 40, currentScore: 65 }),
      "HOT",
    );
  });

  test("score drops by 10 or more -> COOLING", () => {
    assert.equal(
      nextLifecycle({ previousLifecycle: "HOT", stillDetected: true, previousScore: 60, currentScore: 50 }),
      "COOLING",
    );
  });

  test("score unchanged or moved by less than 10 in either direction -> ACTIVE", () => {
    assert.equal(
      nextLifecycle({ previousLifecycle: "NEW", stillDetected: true, previousScore: 50, currentScore: 50 }),
      "ACTIVE",
    );
    assert.equal(
      nextLifecycle({ previousLifecycle: "HOT", stillDetected: true, previousScore: 50, currentScore: 55 }),
      "ACTIVE",
    );
    assert.equal(
      nextLifecycle({ previousLifecycle: "ACTIVE", stillDetected: true, previousScore: 50, currentScore: 42 }),
      "ACTIVE",
    );
  });

  test("exact +/-10 boundary is HOT/COOLING, +/-9 is ACTIVE", () => {
    assert.equal(
      nextLifecycle({ previousLifecycle: "ACTIVE", stillDetected: true, previousScore: 50, currentScore: 60 }),
      "HOT",
    );
    assert.equal(
      nextLifecycle({ previousLifecycle: "ACTIVE", stillDetected: true, previousScore: 50, currentScore: 59 }),
      "ACTIVE",
    );
    assert.equal(
      nextLifecycle({ previousLifecycle: "ACTIVE", stillDetected: true, previousScore: 50, currentScore: 40 }),
      "COOLING",
    );
    assert.equal(
      nextLifecycle({ previousLifecycle: "ACTIVE", stillDetected: true, previousScore: 50, currentScore: 41 }),
      "ACTIVE",
    );
  });

  test("every value nextLifecycle can return is one of the table's own STORY_LIFECYCLES", () => {
    const outputs = [
      nextLifecycle({ previousLifecycle: "ACTIVE", stillDetected: false, previousScore: 50, currentScore: 50 }),
      nextLifecycle({ previousLifecycle: null, stillDetected: true, previousScore: null, currentScore: 50 }),
      nextLifecycle({ previousLifecycle: "RESOLVED", stillDetected: true, previousScore: 50, currentScore: 50 }),
      nextLifecycle({ previousLifecycle: "ACTIVE", stillDetected: true, previousScore: 50, currentScore: 65 }),
      nextLifecycle({ previousLifecycle: "ACTIVE", stillDetected: true, previousScore: 50, currentScore: 35 }),
      nextLifecycle({ previousLifecycle: "ACTIVE", stillDetected: true, previousScore: 50, currentScore: 50 }),
    ];
    for (const value of outputs) {
      assert.ok((STORY_LIFECYCLES as readonly string[]).includes(value));
    }
  });
});

describe("computeSeasonRecapAggregate", () => {
  test("zero matches played means nothing to crown a top winner from", () => {
    assert.deepEqual(computeSeasonRecapAggregate([]), { matchesPlayed: 0, topEntityId: null, topWins: 0 });
  });

  test("counts matches played and finds the entity with the most wins", () => {
    // Player 7 wins 3 of 5 matches — the clear top winner.
    const result = computeSeasonRecapAggregate([7, 9, 7, 9, 7]);
    assert.deepEqual(result, { matchesPlayed: 5, topEntityId: 7, topWins: 3 });
  });

  test("a single match crowns its own winner", () => {
    assert.deepEqual(computeSeasonRecapAggregate([3]), { matchesPlayed: 1, topEntityId: 3, topWins: 1 });
  });

  test("a tie for most wins resolves to whichever entity reached that count FIRST, chronologically", () => {
    // Both 1 and 2 finish on 2 wins — 1 gets there first (its 2nd win is
    // match index 2, before 2's 2nd win at index 3).
    const result = computeSeasonRecapAggregate([1, 2, 1, 2]);
    assert.deepEqual(result, { matchesPlayed: 4, topEntityId: 1, topWins: 2 });
  });

  test("real numbers pass straight through untouched", () => {
    const winners = [1, 1, 1, 1, 2, 2, 3];
    assert.deepEqual(computeSeasonRecapAggregate(winners), { matchesPlayed: 7, topEntityId: 1, topWins: 4 });
  });
});
