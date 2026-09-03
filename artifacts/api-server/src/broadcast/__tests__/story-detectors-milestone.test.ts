/**
 * Tests for story-detectors-milestone.ts — the MILESTONE family (Appendix
 * A / section 9.4): CAREER_MATCH_MILESTONE, CAREER_WIN_MILESTONE,
 * 180_MILESTONE, ELIMINATION_MILESTONE.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  detectCareerMatchMilestone,
  detectCareerWinMilestone,
  detect180Milestone,
  detectEliminationMilestone,
  detectMilestoneStories,
  type SinglesMilestoneFacts,
} from "../story-detectors-milestone.ts";

function baseFacts(overrides: Partial<SinglesMilestoneFacts> = {}): SinglesMilestoneFacts {
  return {
    playerId: 1,
    matchId: 501,
    won: true,
    careerGamesPlayedAfter: 13,
    careerWinsAfter: 7,
    career180sAfter: null,
    matchThrown180s: 0,
    careerEliminationsAfter: null,
    justEliminatedThisMatch: false,
    ...overrides,
  };
}

describe("detectCareerMatchMilestone", () => {
  test("an off-milestone game count does not trigger", () => {
    assert.equal(detectCareerMatchMilestone(baseFacts({ careerGamesPlayedAfter: 13 })), null);
  });

  test("hitting exactly 25 career matches triggers", () => {
    const story = detectCareerMatchMilestone(baseFacts({ careerGamesPlayedAfter: 25 }));
    assert.ok(story);
    assert.equal(story.facts.careerGamesPlayed, 25);
    assert.equal(story.anchorMatchId, 501);
  });

  test("hitting exactly 100 career matches also triggers", () => {
    assert.ok(detectCareerMatchMilestone(baseFacts({ careerGamesPlayedAfter: 100 })));
  });
});

describe("detectCareerWinMilestone", () => {
  test("a loss can never cross a WIN milestone, even at a milestone win-count number", () => {
    assert.equal(detectCareerWinMilestone(baseFacts({ won: false, careerWinsAfter: 25 })), null);
  });

  test("an off-milestone win count does not trigger", () => {
    assert.equal(detectCareerWinMilestone(baseFacts({ won: true, careerWinsAfter: 11 })), null);
  });

  test("winning the match that crosses exactly 25 career wins triggers", () => {
    const story = detectCareerWinMilestone(baseFacts({ won: true, careerWinsAfter: 25 }));
    assert.ok(story);
    assert.equal(story.facts.careerWins, 25);
  });
});

describe("detect180Milestone (Appendix A: only if reliable historical totals can be derived)", () => {
  test("null career total (can't be reliably derived) never triggers, even at a nominal milestone number", () => {
    assert.equal(detect180Milestone(baseFacts({ career180sAfter: null })), null);
  });

  test("a reliable career total that isn't at a milestone number does not trigger", () => {
    assert.equal(detect180Milestone(baseFacts({ career180sAfter: 11 })), null);
  });

  test("a reliable career total landing exactly on a milestone triggers", () => {
    const story = detect180Milestone(baseFacts({ career180sAfter: 10, matchThrown180s: 2 }));
    assert.ok(story);
    assert.equal(story.facts.career180s, 10);
    assert.equal(story.facts.matchThrown180s, 2);
  });
});

describe("detectEliminationMilestone (Appendix A: only if existing counter supports claim)", () => {
  test("not eliminated this match never triggers, regardless of the counter", () => {
    assert.equal(detectEliminationMilestone(baseFacts({ justEliminatedThisMatch: false, careerEliminationsAfter: 5 })), null);
  });

  test("eliminated but counter is null (unsupported claim) does not trigger", () => {
    assert.equal(detectEliminationMilestone(baseFacts({ justEliminatedThisMatch: true, careerEliminationsAfter: null })), null);
  });

  test("eliminated with a supported counter landing on a milestone triggers, tagged cooldown_sensitive", () => {
    const story = detectEliminationMilestone(baseFacts({ justEliminatedThisMatch: true, careerEliminationsAfter: 5 }));
    assert.ok(story);
    assert.ok(story.tags.includes("cooldown_sensitive"));
    assert.equal(story.sentiment, "neutral");
  });

  test("eliminated with a supported counter NOT landing on a milestone does not trigger", () => {
    assert.equal(detectEliminationMilestone(baseFacts({ justEliminatedThisMatch: true, careerEliminationsAfter: 4 })), null);
  });
});

describe("detectMilestoneStories (runs the full MILESTONE family together)", () => {
  test("an unremarkable match triggers nothing", () => {
    assert.deepEqual(detectMilestoneStories(baseFacts()), []);
  });

  test("a match that crosses multiple milestones at once triggers all of them", () => {
    const facts = baseFacts({
      won: true, careerGamesPlayedAfter: 50, careerWinsAfter: 25,
      career180sAfter: 25, matchThrown180s: 1,
    });
    const types = detectMilestoneStories(facts).map(s => s.storyType).sort();
    assert.deepEqual(types, ["180_MILESTONE", "CAREER_MATCH_MILESTONE", "CAREER_WIN_MILESTONE"]);
  });
});
