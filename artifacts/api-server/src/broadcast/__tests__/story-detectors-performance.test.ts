/**
 * Tests for story-detectors-performance.ts — the PERFORMANCE family
 * (Appendix A / section 9.4): CLINICAL_FINISHING, DOUBLE_TROUBLE,
 * SCORING_POWER, SCORING_WITHOUT_FINISHING, SEASON_BEST, PERSONAL_BEST.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  detectClinicalFinishing,
  detectDoubleTrouble,
  detectScoringPower,
  detectScoringWithoutFinishing,
  detectSeasonBest,
  detectPersonalBest,
  detectPerformanceStories,
  type SinglesPerformanceFacts,
} from "../story-detectors-performance.ts";

function baseFacts(overrides: Partial<SinglesPerformanceFacts> = {}): SinglesPerformanceFacts {
  return {
    playerId: 1,
    matchId: 501,
    won: true,
    checkoutAttempts: 0,
    checkoutHits: 0,
    scoringRate30: 3.0,
    ownBaselineCheckoutRate: 0.4,
    ownBaselineScoringRate30: 3.0,
    checkoutPercentile: 0.5,
    scoringPercentile: 0.5,
    isVerifiedSeasonBest: false,
    isVerifiedPersonalBest: false,
    recordMetricLabel: null,
    recordMetricValue: null,
    ...overrides,
  };
}

describe("detectClinicalFinishing (9.4: >=6 attempts, rate above own baseline + league percentile)", () => {
  test("fewer than 6 attempts does not trigger", () => {
    const facts = baseFacts({ checkoutAttempts: 5, checkoutHits: 5, ownBaselineCheckoutRate: 0.3, checkoutPercentile: 0.9 });
    assert.equal(detectClinicalFinishing(facts), null);
  });

  test("high rate but only average league percentile does not trigger", () => {
    const facts = baseFacts({ checkoutAttempts: 6, checkoutHits: 6, ownBaselineCheckoutRate: 0.3, checkoutPercentile: 0.5 });
    assert.equal(detectClinicalFinishing(facts), null);
  });

  test("high league percentile but only marginally above own baseline does not trigger", () => {
    const facts = baseFacts({ checkoutAttempts: 6, checkoutHits: 3, ownBaselineCheckoutRate: 0.45, checkoutPercentile: 0.9 }); // rate 0.5, delta 0.05
    assert.equal(detectClinicalFinishing(facts), null);
  });

  test("meeting all three conditions triggers", () => {
    const facts = baseFacts({ checkoutAttempts: 6, checkoutHits: 5, ownBaselineCheckoutRate: 0.3, checkoutPercentile: 0.9 }); // rate 0.83, delta 0.53
    const story = detectClinicalFinishing(facts);
    assert.ok(story);
    assert.equal(story.storyType, "CLINICAL_FINISHING");
    assert.equal(story.anchorMatchId, 501);
  });

  test("no baseline data available (new player) does not trigger", () => {
    const facts = baseFacts({ checkoutAttempts: 6, checkoutHits: 6, ownBaselineCheckoutRate: null, checkoutPercentile: 0.9 });
    assert.equal(detectClinicalFinishing(facts), null);
  });
});

describe("detectDoubleTrouble (9.4: >=8 attempts, rate materially below own baseline)", () => {
  test("fewer than 8 attempts does not trigger even at 0% rate (guards against a single poor finish)", () => {
    const facts = baseFacts({ checkoutAttempts: 1, checkoutHits: 0, ownBaselineCheckoutRate: 0.5 });
    assert.equal(detectDoubleTrouble(facts), null);
  });

  test("8+ attempts with rate only marginally below baseline does not trigger", () => {
    const facts = baseFacts({ checkoutAttempts: 8, checkoutHits: 4, ownBaselineCheckoutRate: 0.55 }); // rate 0.5, delta 0.05
    assert.equal(detectDoubleTrouble(facts), null);
  });

  test("8+ attempts with rate materially below baseline triggers, negative sentiment", () => {
    const facts = baseFacts({ checkoutAttempts: 8, checkoutHits: 1, ownBaselineCheckoutRate: 0.5 }); // rate 0.125, delta 0.375
    const story = detectDoubleTrouble(facts);
    assert.ok(story);
    assert.equal(story.sentiment, "negative");
    assert.ok(story.tags.includes("cooldown_sensitive"));
  });
});

describe("detectScoringPower (Appendix A: high scoringRate30 percentile)", () => {
  test("average percentile does not trigger", () => {
    assert.equal(detectScoringPower(baseFacts({ scoringPercentile: 0.5 })), null);
  });

  test("high percentile triggers", () => {
    const story = detectScoringPower(baseFacts({ scoringPercentile: 0.9 }));
    assert.ok(story);
    assert.equal(story.storyType, "SCORING_POWER");
  });

  test("no cohort to rank against (null percentile) does not trigger", () => {
    assert.equal(detectScoringPower(baseFacts({ scoringPercentile: null })), null);
  });
});

describe("detectScoringWithoutFinishing (Appendix A: strong scoring + weak checkout + poor/close outcome)", () => {
  test("strong scoring and weak checkout, but the player still WON, does not trigger", () => {
    const facts = baseFacts({ scoringPercentile: 0.9, checkoutPercentile: 0.1, won: true });
    assert.equal(detectScoringWithoutFinishing(facts), null);
  });

  test("strong scoring, weak checkout, and a loss triggers", () => {
    const facts = baseFacts({ scoringPercentile: 0.9, checkoutPercentile: 0.1, won: false });
    const story = detectScoringWithoutFinishing(facts);
    assert.ok(story);
    assert.equal(story.sentiment, "negative");
  });

  test("strong scoring but only average (not weak) checkout does not trigger", () => {
    const facts = baseFacts({ scoringPercentile: 0.9, checkoutPercentile: 0.5, won: false });
    assert.equal(detectScoringWithoutFinishing(facts), null);
  });
});

describe("detectSeasonBest / detectPersonalBest (9.4: only when historical data proves the claim)", () => {
  test("unverified claims never trigger, regardless of any other facts", () => {
    const facts = baseFacts({ isVerifiedSeasonBest: false, isVerifiedPersonalBest: false, scoringPercentile: 1, checkoutPercentile: 1 });
    assert.equal(detectSeasonBest(facts), null);
    assert.equal(detectPersonalBest(facts), null);
  });

  test("a verified season best triggers with the record metric in facts", () => {
    const story = detectSeasonBest(baseFacts({ isVerifiedSeasonBest: true, recordMetricLabel: "180s", recordMetricValue: 4 }));
    assert.ok(story);
    assert.equal(story.facts.metric, "180s");
    assert.equal(story.facts.value, 4);
  });

  test("SEASON_BEST/PERSONAL_BEST expose verifiedRecordClaim so the Commentary Engine's 17.2 record-claim rule can be satisfied", () => {
    const seasonBest = detectSeasonBest(baseFacts({ isVerifiedSeasonBest: true, recordMetricLabel: "180s", recordMetricValue: 4 }));
    const personalBest = detectPersonalBest(baseFacts({ isVerifiedPersonalBest: true, recordMetricLabel: "180s", recordMetricValue: 6 }));
    assert.equal(seasonBest?.facts.verifiedRecordClaim, true);
    assert.equal(personalBest?.facts.verifiedRecordClaim, true);
  });

  test("a verified personal best triggers and scores at least as high as a season best on historical significance", () => {
    const seasonBest = detectSeasonBest(baseFacts({ isVerifiedSeasonBest: true, recordMetricLabel: "180s", recordMetricValue: 4 }))!;
    const personalBest = detectPersonalBest(baseFacts({ isVerifiedPersonalBest: true, recordMetricLabel: "180s", recordMetricValue: 6 }))!;
    assert.ok(personalBest.components.historicalSignificance >= seasonBest.components.historicalSignificance);
  });
});

describe("detectPerformanceStories (runs the full PERFORMANCE family together)", () => {
  test("an unremarkable match triggers nothing", () => {
    assert.deepEqual(detectPerformanceStories(baseFacts()), []);
  });

  test("a verified personal-best match with strong scoring also triggers SCORING_POWER alongside PERSONAL_BEST", () => {
    const facts = baseFacts({
      scoringPercentile: 0.95, checkoutPercentile: 0.9, ownBaselineCheckoutRate: 0.3,
      checkoutAttempts: 6, checkoutHits: 5,
      isVerifiedPersonalBest: true, recordMetricLabel: "scoringRate30", recordMetricValue: 8,
    });
    const types = detectPerformanceStories(facts).map(s => s.storyType).sort();
    assert.deepEqual(types, ["CLINICAL_FINISHING", "PERSONAL_BEST", "SCORING_POWER"]);
  });
});
