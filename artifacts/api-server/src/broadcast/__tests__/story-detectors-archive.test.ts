/**
 * Tests for story-detectors-archive.ts — the ARCHIVE family (Appendix A):
 * LAST_MEETING, HISTORICAL_H2H, SEASON_COMPARISON.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  detectLastMeeting,
  detectHistoricalH2H,
  detectArchiveH2HStories,
  detectSeasonComparison,
  type ArchiveH2HFacts,
  type SeasonComparisonFacts,
} from "../story-detectors-archive.ts";

function h2hFacts(overrides: Partial<ArchiveH2HFacts> = {}): ArchiveH2HFacts {
  return {
    leagueType: "singles",
    entityAId: 1,
    entityBId: 2,
    aWins: 1,
    bWins: 1,
    gamesPlayed: 2,
    lastMeeting: null,
    ...overrides,
  };
}

describe("detectLastMeeting (Appendix A: historical context, not future fixture)", () => {
  test("no prior meeting at all does not trigger", () => {
    assert.equal(detectLastMeeting(h2hFacts({ lastMeeting: null })), null);
  });

  test("a prior meeting triggers, naming it in facts", () => {
    const story = detectLastMeeting(h2hFacts({
      lastMeeting: { matchId: 42, playedAt: new Date("2026-08-01T12:00:00Z"), winnerId: 1, stake: 3 },
    }));
    assert.ok(story);
    assert.equal(story.storyType, "LAST_MEETING");
    assert.equal(story.facts.lastMeetingMatchId, 42);
    assert.equal(story.sentiment, "neutral");
  });

  test("leagueType flows through for a cross-league entity (e.g. shift_wars)", () => {
    const story = detectLastMeeting(h2hFacts({
      leagueType: "shift_wars",
      lastMeeting: { matchId: 1, playedAt: new Date(), winnerId: 1, stake: 1 },
    }));
    assert.ok(story);
    assert.equal(story.leagueType, "shift_wars");
    assert.deepEqual(story.subjectKeys.sort(), ["shift_wars:1", "shift_wars:2"]);
  });
});

describe("detectHistoricalH2H (Appendix A: evergreen validated H2H context)", () => {
  test("fewer than 3 meetings does not trigger", () => {
    assert.equal(detectHistoricalH2H(h2hFacts({ gamesPlayed: 2 })), null);
  });

  test("3 or more meetings triggers", () => {
    const story = detectHistoricalH2H(h2hFacts({ gamesPlayed: 3, aWins: 2, bWins: 1 }));
    assert.ok(story);
    assert.equal(story.storyType, "HISTORICAL_H2H");
  });

  test("a deeper history scores higher historicalSignificance", () => {
    const shallow = detectHistoricalH2H(h2hFacts({ gamesPlayed: 3 }))!;
    const deep = detectHistoricalH2H(h2hFacts({ gamesPlayed: 15 }))!;
    assert.ok(deep.components.historicalSignificance > shallow.components.historicalSignificance);
  });
});

describe("detectArchiveH2HStories", () => {
  test("a fresh pair with no history at all triggers nothing", () => {
    assert.deepEqual(detectArchiveH2HStories(h2hFacts({ gamesPlayed: 0, lastMeeting: null })), []);
  });

  test("both LAST_MEETING and HISTORICAL_H2H can fire together for a deep, recently-active rivalry", () => {
    const facts = h2hFacts({
      gamesPlayed: 5, aWins: 3, bWins: 2,
      lastMeeting: { matchId: 10, playedAt: new Date(), winnerId: 1, stake: 2 },
    });
    const types = detectArchiveH2HStories(facts).map(s => s.storyType).sort();
    assert.deepEqual(types, ["HISTORICAL_H2H", "LAST_MEETING"]);
  });
});

function seasonFacts(overrides: Partial<SeasonComparisonFacts> = {}): SeasonComparisonFacts {
  return {
    leagueType: "singles",
    entityId: 1,
    currentSeasonWinRate: 0.5,
    previousSeasonWinRate: 0.5,
    currentSeasonPosition: 3,
    previousSeasonFinalPosition: 3,
    ...overrides,
  };
}

describe("detectSeasonComparison (Appendix A: current position/form vs previous completed season)", () => {
  test("no previous completed season to compare against does not trigger", () => {
    assert.equal(detectSeasonComparison(seasonFacts({ previousSeasonWinRate: null })), null);
  });

  test("no material change in either win rate or position does not trigger", () => {
    assert.equal(detectSeasonComparison(seasonFacts()), null);
  });

  test("a materially improved win rate triggers, positive sentiment", () => {
    const story = detectSeasonComparison(seasonFacts({ currentSeasonWinRate: 0.7, previousSeasonWinRate: 0.4 }));
    assert.ok(story);
    assert.equal(story.sentiment, "positive");
  });

  test("a materially worse win rate triggers, non-positive sentiment", () => {
    const story = detectSeasonComparison(seasonFacts({ currentSeasonWinRate: 0.3, previousSeasonWinRate: 0.6 }));
    assert.ok(story);
    assert.equal(story.sentiment, "neutral");
  });

  test("a materially improved TABLE POSITION alone (win rate unchanged) also triggers", () => {
    const story = detectSeasonComparison(seasonFacts({ currentSeasonPosition: 1, previousSeasonFinalPosition: 5 }));
    assert.ok(story);
    assert.equal(story.sentiment, "positive");
  });

  test("missing position data on either side just skips the position check, still evaluates win rate", () => {
    const story = detectSeasonComparison(seasonFacts({ currentSeasonPosition: null, currentSeasonWinRate: 0.8, previousSeasonWinRate: 0.3 }));
    assert.ok(story);
  });
});
