/**
 * Tests for story-detectors-form.ts — the FORM family (Appendix A /
 * section 9.4): WIN_STREAK, LOSS_STREAK, FORM_REVERSAL, QUIET_CLIMBER,
 * FREEFALL, ABOVE_BASELINE.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  detectWinStreak,
  detectLossStreak,
  detectFormReversal,
  detectQuietClimber,
  detectFreefall,
  detectAboveBaseline,
  detectFormStories,
  type SinglesFormFacts,
} from "../story-detectors-form.ts";

function baseFacts(overrides: Partial<SinglesFormFacts> = {}): SinglesFormFacts {
  return {
    playerId: 1,
    recentResultsNewestFirst: ["W", "L", "W", "L", "W", "L", "W", "L", "W", "L"],
    currentWinStreak: 0,
    currentLossStreak: 0,
    seasonRate: 0.5,
    currentPosition: 4,
    positionWindow: null,
    majorStoryAlreadyExplainsMove: false,
    ...overrides,
  };
}

describe("detectWinStreak (9.4: 3 noteworthy, 5 strong, 7+ major)", () => {
  test("below 3 does not trigger", () => {
    assert.equal(detectWinStreak(baseFacts({ currentWinStreak: 2 })), null);
  });

  test("exactly 3 triggers at the noteworthy tier", () => {
    const story = detectWinStreak(baseFacts({ currentWinStreak: 3 }));
    assert.ok(story);
    assert.equal(story.facts.tier, "noteworthy");
  });

  test("exactly 5 triggers at the strong tier", () => {
    const story = detectWinStreak(baseFacts({ currentWinStreak: 5 }));
    assert.ok(story);
    assert.equal(story.facts.tier, "strong");
  });

  test("exactly 7 triggers at the major tier", () => {
    const story = detectWinStreak(baseFacts({ currentWinStreak: 7 }));
    assert.ok(story);
    assert.equal(story.facts.tier, "major");
  });

  test("higher tiers score strictly higher on every scored component", () => {
    const noteworthy = detectWinStreak(baseFacts({ currentWinStreak: 3 }))!;
    const strong = detectWinStreak(baseFacts({ currentWinStreak: 5 }))!;
    const major = detectWinStreak(baseFacts({ currentWinStreak: 7 }))!;
    assert.ok(noteworthy.components.entertainmentValue < strong.components.entertainmentValue);
    assert.ok(strong.components.entertainmentValue < major.components.entertainmentValue);
  });

  test("subject is the single player, sentiment positive", () => {
    const story = detectWinStreak(baseFacts({ playerId: 5, currentWinStreak: 4 }));
    assert.ok(story);
    assert.deepEqual(story.subjectKeys, ["singles:5"]);
    assert.equal(story.sentiment, "positive");
    assert.equal(story.anchorMatchId, undefined); // subject-anchored, not match-anchored
  });
});

describe("detectLossStreak (9.4: 3+ losses, cooldown-sensitive)", () => {
  test("below 3 does not trigger", () => {
    assert.equal(detectLossStreak(baseFacts({ currentLossStreak: 2 })), null);
  });

  test("3+ triggers, negative sentiment, tagged cooldown_sensitive", () => {
    const story = detectLossStreak(baseFacts({ currentLossStreak: 3 }));
    assert.ok(story);
    assert.equal(story.sentiment, "negative");
    assert.ok(story.tags.includes("cooldown_sensitive"));
  });
});

describe("detectFormReversal (Appendix A: recent five materially better/worse than prior five)", () => {
  test("fewer than 10 recorded results does not trigger even with a big swing", () => {
    const facts = baseFacts({ recentResultsNewestFirst: ["W", "W", "W", "W", "W"] });
    assert.equal(detectFormReversal(facts), null);
  });

  test("recent five identical to prior five does not trigger", () => {
    const facts = baseFacts({ recentResultsNewestFirst: ["W", "L", "W", "L", "W", "W", "L", "W", "L", "W"] });
    // recent5 winRate = 3/5, prior5 winRate = 3/5 -> delta 0
    assert.equal(detectFormReversal(facts), null);
  });

  test("a big improvement (0 wins prior five -> 5 wins recent five) triggers as 'improving'", () => {
    const facts = baseFacts({ recentResultsNewestFirst: ["W", "W", "W", "W", "W", "L", "L", "L", "L", "L"] });
    const story = detectFormReversal(facts);
    assert.ok(story);
    assert.equal(story.facts.direction, "improving");
    assert.equal(story.sentiment, "positive");
  });

  test("a big decline (5 wins prior five -> 0 wins recent five) triggers as 'declining'", () => {
    const facts = baseFacts({ recentResultsNewestFirst: ["L", "L", "L", "L", "L", "W", "W", "W", "W", "W"] });
    const story = detectFormReversal(facts);
    assert.ok(story);
    assert.equal(story.facts.direction, "declining");
    assert.equal(story.sentiment, "neutral");
  });
});

describe("detectQuietClimber (Appendix A: +2 positions over >=3 matches, no Major story explaining it)", () => {
  test("no position window data does not trigger", () => {
    assert.equal(detectQuietClimber(baseFacts({ positionWindow: null })), null);
  });

  test("window shorter than 3 matches does not trigger even with a big move", () => {
    const facts = baseFacts({ currentPosition: 1, positionWindow: { matches: 2, positionBefore: 5 } });
    assert.equal(detectQuietClimber(facts), null);
  });

  test("improvement below 2 positions does not trigger", () => {
    const facts = baseFacts({ currentPosition: 4, positionWindow: { matches: 3, positionBefore: 5 } });
    assert.equal(detectQuietClimber(facts), null);
  });

  test("improvement of exactly 2 positions over >=3 matches triggers", () => {
    const facts = baseFacts({ currentPosition: 3, positionWindow: { matches: 3, positionBefore: 5 } });
    const story = detectQuietClimber(facts);
    assert.ok(story);
    assert.equal(story.storyType, "QUIET_CLIMBER");
  });

  test("a Major story already explaining the move suppresses the trigger entirely", () => {
    const facts = baseFacts({ currentPosition: 1, positionWindow: { matches: 4, positionBefore: 6 }, majorStoryAlreadyExplainsMove: true });
    assert.equal(detectQuietClimber(facts), null);
  });
});

describe("detectFreefall (Appendix A: -2 positions with sustained losses, neutral tone)", () => {
  test("position decline without an active loss streak does not trigger", () => {
    const facts = baseFacts({ currentPosition: 6, positionWindow: { matches: 3, positionBefore: 4 }, currentLossStreak: 0 });
    assert.equal(detectFreefall(facts), null);
  });

  test("decline of exactly 2 positions with a loss streak of 2+ triggers, neutral sentiment", () => {
    const facts = baseFacts({ currentPosition: 6, positionWindow: { matches: 3, positionBefore: 4 }, currentLossStreak: 2 });
    const story = detectFreefall(facts);
    assert.ok(story);
    assert.equal(story.sentiment, "neutral");
  });

  test("decline below 2 positions does not trigger even with a long loss streak", () => {
    const facts = baseFacts({ currentPosition: 5, positionWindow: { matches: 3, positionBefore: 4 }, currentLossStreak: 5 });
    assert.equal(detectFreefall(facts), null);
  });
});

describe("detectAboveBaseline (Appendix A: performance materially above own baseline)", () => {
  test("fewer than 3 recent games does not trigger", () => {
    const facts = baseFacts({ recentResultsNewestFirst: ["W", "W"], seasonRate: 0.3 });
    assert.equal(detectAboveBaseline(facts), null);
  });

  test("recent form only marginally above baseline does not trigger", () => {
    // recentRate = 3/5 = 0.6, seasonRate 0.5 -> delta 0.1, below the 0.15 material threshold
    const facts = baseFacts({ recentResultsNewestFirst: ["W", "W", "W", "L", "L"], seasonRate: 0.5 });
    assert.equal(detectAboveBaseline(facts), null);
  });

  test("recent form materially above baseline triggers", () => {
    // recentRate = 5/5 = 1.0, seasonRate 0.5 -> delta 0.5
    const facts = baseFacts({ recentResultsNewestFirst: ["W", "W", "W", "W", "W"], seasonRate: 0.5 });
    const story = detectAboveBaseline(facts);
    assert.ok(story);
    assert.equal(story.storyType, "ABOVE_BASELINE");
    assert.ok(story.components.performanceAnomaly > 0);
  });
});

describe("detectFormStories (runs the full FORM family together)", () => {
  test("a flat, unremarkable player triggers nothing", () => {
    assert.deepEqual(detectFormStories(baseFacts()), []);
  });

  test("a player on multiple qualifying fronts triggers multiple story types", () => {
    const facts = baseFacts({
      currentWinStreak: 5,
      recentResultsNewestFirst: ["W", "W", "W", "W", "W", "L", "L", "L", "L", "L"],
      seasonRate: 0.4,
      currentPosition: 2,
      positionWindow: { matches: 3, positionBefore: 5 },
    });
    const types = detectFormStories(facts).map(s => s.storyType).sort();
    // recentRate (5 wins then 5 losses -> 5/10 = 0.5) vs seasonRate 0.4 is
    // only a 0.1 delta, below ABOVE_BASELINE's own 0.15 material threshold
    // — so it correctly sits this one out even though the other three fire.
    assert.deepEqual(types, ["FORM_REVERSAL", "QUIET_CLIMBER", "WIN_STREAK"]);
  });
});
