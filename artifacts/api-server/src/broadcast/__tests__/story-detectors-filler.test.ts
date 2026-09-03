/**
 * Tests for story-detectors-filler.ts — the FILLER family: PRACTICE_ACTIVITY,
 * SHADOW_BOT_PROMO, FEATURE_SPOTLIGHT. This file predates any of its three
 * detectors actually being wired into story-engine.ts, and had no test file
 * of its own until they were — see story-engine.ts's own FILLER wiring
 * section for the real gather/registry code that now calls these.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  detectPracticeActivity,
  detectShadowBotPromo,
  detectFeatureSpotlight,
  type PracticeActivityFacts,
  type FeatureSpotlightFacts,
} from "../story-detectors-filler.ts";

function practiceFacts(overrides: Partial<PracticeActivityFacts> = {}): PracticeActivityFacts {
  return {
    windowDays: 7,
    sessionCount: 5,
    distinctPlayerCount: 3,
    topPlayerId: 9,
    topPlayerSessionCount: 3,
    ...overrides,
  };
}

describe("detectPracticeActivity", () => {
  test("below the minimum session threshold does not trigger — a hollow '0 sessions' story is worse than none", () => {
    assert.equal(detectPracticeActivity(practiceFacts({ sessionCount: 2 })), null);
  });

  test("at the threshold, triggers with the real aggregate facts", () => {
    const story = detectPracticeActivity(practiceFacts({ sessionCount: 3, distinctPlayerCount: 2, topPlayerId: 5, topPlayerSessionCount: 2 }));
    assert.ok(story);
    assert.equal(story.storyType, "PRACTICE_ACTIVITY");
    assert.equal(story.leagueType, "singles");
    assert.equal(story.facts.windowDays, 7);
    assert.equal(story.facts.sessionCount, 3);
    assert.equal(story.facts.distinctPlayerCount, 2);
    assert.equal(story.facts.topPlayerId, 5);
    assert.equal(story.facts.topPlayerSessionCount, 2);
  });

  test("no sessions at all (topPlayerId null) omits the top-player facts entirely, rather than sending null through the fact firewall", () => {
    const story = detectPracticeActivity(practiceFacts({ sessionCount: 0, distinctPlayerCount: 0, topPlayerId: null, topPlayerSessionCount: 0 }));
    // Below MIN_SESSIONS anyway, but confirms the omission logic independent of the threshold gate.
    assert.equal(story, null);
  });

  test("subjectKeys is the fixed filler namespace, not player-specific — this is one running story, not one per top player", () => {
    const story = detectPracticeActivity(practiceFacts());
    assert.ok(story);
    assert.deepEqual(story.subjectKeys, ["filler:practice_activity"]);
  });
});

describe("detectShadowBotPromo", () => {
  test("always returns a candidate — there is nothing to detect, this mode either exists or it doesn't", () => {
    const story = detectShadowBotPromo();
    assert.equal(story.storyType, "SHADOW_BOT_PROMO");
    assert.equal(story.leagueType, "singles");
    assert.deepEqual(story.facts, {});
    assert.deepEqual(story.subjectKeys, ["filler:shadow_bot_promo"]);
  });
});

describe("detectFeatureSpotlight", () => {
  function spotlightFacts(overrides: Partial<FeatureSpotlightFacts> = {}): FeatureSpotlightFacts {
    return { featureKey: "card_clash", featureName: "Card Clash", featureBlurb: "Collect and battle player cards.", ...overrides };
  }

  test("carries the registry row's own facts straight through — a direct registry read, not a prediction", () => {
    const story = detectFeatureSpotlight(spotlightFacts());
    assert.equal(story.storyType, "FEATURE_SPOTLIGHT");
    assert.equal(story.facts.featureName, "Card Clash");
    assert.equal(story.facts.featureBlurb, "Collect and battle player cards.");
  });

  test("subjectKeys is namespaced by the registry row's own key — several spotlighted features must be tellable apart, each with its own persistent story/priority", () => {
    const a = detectFeatureSpotlight(spotlightFacts({ featureKey: "card_clash" }));
    const b = detectFeatureSpotlight(spotlightFacts({ featureKey: "boss_battle" }));
    assert.notDeepEqual(a.subjectKeys, b.subjectKeys);
    assert.deepEqual(a.subjectKeys, ["filler:feature_spotlight:card_clash"]);
  });
});
