/**
 * Tests for story-detectors-result.ts — the RESULT family (Appendix A /
 * section 9.4): UPSET/MAJOR_UPSET/MODEL_SHOCK, HIGH_STAKE_WIN,
 * HIGH_STAKE_LOSS, ELIMINATION, LEADER_BEATEN, STREAK_BREAKER,
 * DROUGHT_ENDED, FIRST_H2H_WIN, REVENGE. Each describe block builds a
 * baseline "nothing triggers" facts object and overrides only what that
 * story's trigger actually depends on, so a failure isolates to the one
 * condition under test.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  detectUpsetTier,
  detectHighStakeWin,
  detectHighStakeLoss,
  detectElimination,
  detectLeaderBeaten,
  detectStreakBreaker,
  detectDroughtEnded,
  detectFirstH2HWin,
  detectRevenge,
  detectResultStories,
  type SinglesResultMatchFacts,
} from "../story-detectors-result.ts";
import type { SinglesPlayerState } from "../timeline-replay.ts";

function playerState(overrides: Partial<SinglesPlayerState> = {}): SinglesPlayerState {
  return {
    points: 25,
    seasonWins: 2,
    seasonLosses: 2,
    seasonGamesPlayed: 4,
    currentWinStreak: 0,
    currentLossStreak: 0,
    recentForm: ["W", "L", "W", "L"],
    isEliminated: false,
    ...overrides,
  };
}

// A facts object where NOTHING should trigger: a coin-flip favourite winning
// a low, unremarkable stake against a non-leader with no relevant streak or
// H2H history. Each test overrides only the one dimension it's exercising.
function baseFacts(overrides: Partial<SinglesResultMatchFacts> = {}): SinglesResultMatchFacts {
  return {
    matchId: 501,
    playedAt: new Date("2026-09-01T19:00:00Z"),
    winnerId: 1,
    loserId: 2,
    stake: 1,
    winnerBefore: playerState(),
    loserBefore: playerState(),
    loserAfter: playerState(),
    winnerProbability: 0.5,
    h2hBeforeMatch: { playerA: 1, playerB: 2, cutoff: new Date("2026-09-01T19:00:00Z"), aWins: 1, bWins: 1, gamesPlayed: 2, recentMeetings: [] },
    wasLoserLeaderBefore: false,
    highStakeThreshold: 10,
    monthProgress: 0.5,
    ...overrides,
  };
}

describe("detectUpsetTier (9.4: UPSET <40%, MAJOR_UPSET <25%, MODEL_SHOCK <15%)", () => {
  test("winner >=40% probability does not trigger", () => {
    assert.equal(detectUpsetTier(baseFacts({ winnerProbability: 0.40 })), null);
    assert.equal(detectUpsetTier(baseFacts({ winnerProbability: 0.60 })), null);
  });

  test("winner just under 40% triggers plain UPSET, not a higher tier", () => {
    const story = detectUpsetTier(baseFacts({ winnerProbability: 0.39 }));
    assert.ok(story);
    assert.equal(story.storyType, "UPSET");
  });

  test("winner just under 25% triggers MAJOR_UPSET, not plain UPSET", () => {
    const story = detectUpsetTier(baseFacts({ winnerProbability: 0.24 }));
    assert.ok(story);
    assert.equal(story.storyType, "MAJOR_UPSET");
  });

  test("winner just under 15% triggers MODEL_SHOCK, the most severe tier", () => {
    const story = detectUpsetTier(baseFacts({ winnerProbability: 0.14 }));
    assert.ok(story);
    assert.equal(story.storyType, "MODEL_SHOCK");
  });

  test("only ONE tier fires per match, never multiple simultaneously", () => {
    // A single call returns a single StoryCandidate (or null) by construction
    // (the function's return type), but also verify via detectResultStories
    // that the full detector set doesn't produce two upset-tier stories for
    // one match.
    const results = detectResultStories(baseFacts({ winnerProbability: 0.05 }));
    const upsetTierResults = results.filter(r => ["UPSET", "MAJOR_UPSET", "MODEL_SHOCK"].includes(r.storyType));
    assert.equal(upsetTierResults.length, 1);
    assert.equal(upsetTierResults[0].storyType, "MODEL_SHOCK");
  });

  test("leagueType is singles and both participants are subjects", () => {
    const story = detectUpsetTier(baseFacts({ winnerProbability: 0.1, winnerId: 7, loserId: 9 }));
    assert.ok(story);
    assert.equal(story.leagueType, "singles");
    assert.deepEqual(story.subjectKeys.sort(), ["singles:7", "singles:9"]);
    assert.equal(story.anchorMatchId, 501);
  });

  test("more severe tiers score at least as high unexpectedness as less severe ones", () => {
    const upset = detectUpsetTier(baseFacts({ winnerProbability: 0.39 }))!;
    const majorUpset = detectUpsetTier(baseFacts({ winnerProbability: 0.24 }))!;
    const modelShock = detectUpsetTier(baseFacts({ winnerProbability: 0.14 }))!;
    assert.ok(upset.components.unexpectedness < majorUpset.components.unexpectedness);
    assert.ok(majorUpset.components.unexpectedness < modelShock.components.unexpectedness);
  });
});

describe("detectHighStakeWin / detectHighStakeLoss (9.4: stake >= 85th percentile threshold)", () => {
  test("a stake below the threshold triggers neither", () => {
    const facts = baseFacts({ stake: 9, highStakeThreshold: 10 });
    assert.equal(detectHighStakeWin(facts), null);
    assert.equal(detectHighStakeLoss(facts), null);
  });

  test("a stake at or above the threshold triggers HIGH_STAKE_WIN", () => {
    const story = detectHighStakeWin(baseFacts({ stake: 10, highStakeThreshold: 10 }));
    assert.ok(story);
    assert.equal(story.storyType, "HIGH_STAKE_WIN");
    assert.equal(story.sentiment, "positive");
  });

  test("a stake at or above the threshold, loser not eliminated, triggers HIGH_STAKE_LOSS too", () => {
    const story = detectHighStakeLoss(baseFacts({ stake: 15, highStakeThreshold: 10 }));
    assert.ok(story);
    assert.equal(story.storyType, "HIGH_STAKE_LOSS");
    assert.equal(story.sentiment, "negative");
  });

  test("HIGH_STAKE_LOSS does not fire when the high-stake loss also eliminated the loser (that's ELIMINATION's story)", () => {
    const facts = baseFacts({
      stake: 25, highStakeThreshold: 10,
      loserBefore: playerState({ points: 25, isEliminated: false }),
      loserAfter: playerState({ points: 0, isEliminated: true }),
    });
    assert.equal(detectHighStakeLoss(facts), null);
    assert.ok(detectElimination(facts)); // it's still an ELIMINATION story
  });
});

describe("detectElimination (9.4: real wager reduces entity to 0)", () => {
  test("loser not eliminated does not trigger", () => {
    const facts = baseFacts({
      loserBefore: playerState({ isEliminated: false }),
      loserAfter: playerState({ points: 5, isEliminated: false }),
    });
    assert.equal(detectElimination(facts), null);
  });

  test("loser newly eliminated THIS match triggers", () => {
    const facts = baseFacts({
      loserBefore: playerState({ points: 10, isEliminated: false }),
      loserAfter: playerState({ points: 0, isEliminated: true }),
    });
    const story = detectElimination(facts);
    assert.ok(story);
    assert.equal(story.storyType, "ELIMINATION");
    assert.equal(story.sentiment, "negative");
  });

  test("a loser who was ALREADY eliminated before this match does not re-trigger (sticky elimination, not a new event)", () => {
    const facts = baseFacts({
      loserBefore: playerState({ points: 0, isEliminated: true }),
      loserAfter: playerState({ points: 0, isEliminated: true }),
    });
    assert.equal(detectElimination(facts), null);
  });
});

describe("detectLeaderBeaten (Appendix A: current points leader loses)", () => {
  test("loser was not the leader -> no trigger", () => {
    assert.equal(detectLeaderBeaten(baseFacts({ wasLoserLeaderBefore: false })), null);
  });

  test("loser was the leader -> triggers, positive sentiment (the winner's achievement)", () => {
    const story = detectLeaderBeaten(baseFacts({ wasLoserLeaderBefore: true }));
    assert.ok(story);
    assert.equal(story.storyType, "LEADER_BEATEN");
    assert.equal(story.sentiment, "positive");
  });
});

describe("detectStreakBreaker (9.4: winner ends opponent win streak >=4)", () => {
  test("opponent win streak below 4 does not trigger", () => {
    assert.equal(detectStreakBreaker(baseFacts({ loserBefore: playerState({ currentWinStreak: 3 }) })), null);
  });

  test("opponent win streak of exactly 4 triggers", () => {
    const story = detectStreakBreaker(baseFacts({ loserBefore: playerState({ currentWinStreak: 4 }) }));
    assert.ok(story);
    assert.equal(story.storyType, "STREAK_BREAKER");
    assert.equal(story.facts.brokenWinStreak, 4);
  });

  test("a longer broken streak scores higher historicalSignificance than a shorter one", () => {
    const short = detectStreakBreaker(baseFacts({ loserBefore: playerState({ currentWinStreak: 4 }) }))!;
    const long = detectStreakBreaker(baseFacts({ loserBefore: playerState({ currentWinStreak: 9 }) }))!;
    assert.ok(long.components.historicalSignificance > short.components.historicalSignificance);
  });
});

describe("detectDroughtEnded (9.4: win ends own loss streak >=3)", () => {
  test("own loss streak below 3 does not trigger", () => {
    assert.equal(detectDroughtEnded(baseFacts({ winnerBefore: playerState({ currentLossStreak: 2 }) })), null);
  });

  test("own loss streak of exactly 3 triggers", () => {
    const story = detectDroughtEnded(baseFacts({ winnerBefore: playerState({ currentLossStreak: 3 }) }));
    assert.ok(story);
    assert.equal(story.storyType, "DROUGHT_ENDED");
    assert.equal(story.facts.endedLossStreak, 3);
  });
});

describe("detectFirstH2HWin (9.4: first win after >=3 prior losses to same opponent)", () => {
  test("winner has prior wins over this opponent -> not a 'first' win", () => {
    const facts = baseFacts({ h2hBeforeMatch: { playerA: 1, playerB: 2, cutoff: new Date(), aWins: 1, bWins: 3, gamesPlayed: 4, recentMeetings: [] } });
    assert.equal(detectFirstH2HWin(facts), null);
  });

  test("winner has zero prior wins but fewer than 3 prior losses -> does not trigger", () => {
    const facts = baseFacts({ h2hBeforeMatch: { playerA: 1, playerB: 2, cutoff: new Date(), aWins: 0, bWins: 2, gamesPlayed: 2, recentMeetings: [] } });
    assert.equal(detectFirstH2HWin(facts), null);
  });

  test("winner has zero prior wins and exactly 3 prior losses -> triggers", () => {
    const facts = baseFacts({ h2hBeforeMatch: { playerA: 1, playerB: 2, cutoff: new Date(), aWins: 0, bWins: 3, gamesPlayed: 3, recentMeetings: [] } });
    const story = detectFirstH2HWin(facts);
    assert.ok(story);
    assert.equal(story.storyType, "FIRST_H2H_WIN");
  });

  test("no prior meetings at all -> does not trigger (0 wins but also 0 losses, below the minimum)", () => {
    const facts = baseFacts({ h2hBeforeMatch: { playerA: 1, playerB: 2, cutoff: new Date(), aWins: 0, bWins: 0, gamesPlayed: 0, recentMeetings: [] } });
    assert.equal(detectFirstH2HWin(facts), null);
  });
});

describe("detectRevenge (Appendix A: reverses previous meeting; stronger if repeated losses)", () => {
  test("no prior meetings -> does not trigger", () => {
    assert.equal(detectRevenge(baseFacts({ h2hBeforeMatch: { playerA: 1, playerB: 2, cutoff: new Date(), aWins: 0, bWins: 0, gamesPlayed: 0, recentMeetings: [] } })), null);
  });

  test("most recent prior meeting was won by today's WINNER -> not a reversal, does not trigger", () => {
    const facts = baseFacts({
      h2hBeforeMatch: {
        playerA: 1, playerB: 2, cutoff: new Date(), aWins: 2, bWins: 1, gamesPlayed: 3,
        recentMeetings: [{ matchId: 100, playedAt: new Date("2026-08-01"), winnerId: 1, stake: 2 }],
      },
    });
    assert.equal(detectRevenge(facts), null);
  });

  test("most recent prior meeting was won by today's loser -> triggers as a reversal", () => {
    const facts = baseFacts({
      loserId: 2,
      h2hBeforeMatch: {
        playerA: 1, playerB: 2, cutoff: new Date(), aWins: 1, bWins: 1, gamesPlayed: 2,
        recentMeetings: [{ matchId: 100, playedAt: new Date("2026-08-01"), winnerId: 2, stake: 2 }],
      },
    });
    const story = detectRevenge(facts);
    assert.ok(story);
    assert.equal(story.storyType, "REVENGE");
    assert.equal(story.facts.consecutivePriorLosses, 1);
  });

  test("counts consecutive prior losses correctly, stopping at the first meeting the eventual winner actually won", () => {
    const facts = baseFacts({
      loserId: 2,
      h2hBeforeMatch: {
        playerA: 1, playerB: 2, cutoff: new Date(), aWins: 1, bWins: 3, gamesPlayed: 4,
        recentMeetings: [
          { matchId: 103, playedAt: new Date("2026-08-04"), winnerId: 2, stake: 1 },
          { matchId: 102, playedAt: new Date("2026-08-03"), winnerId: 2, stake: 1 },
          { matchId: 101, playedAt: new Date("2026-08-02"), winnerId: 2, stake: 1 },
          { matchId: 100, playedAt: new Date("2026-08-01"), winnerId: 1, stake: 1 }, // winner actually won this one -> streak stops here
        ],
      },
    });
    const story = detectRevenge(facts);
    assert.ok(story);
    assert.equal(story.facts.consecutivePriorLosses, 3);
  });

  test("a longer reversed losing streak scores higher historicalSignificance", () => {
    const oneLoss = detectRevenge(baseFacts({
      loserId: 2,
      h2hBeforeMatch: { playerA: 1, playerB: 2, cutoff: new Date(), aWins: 1, bWins: 1, gamesPlayed: 2, recentMeetings: [{ matchId: 100, playedAt: new Date(), winnerId: 2, stake: 1 }] },
    }))!;
    const fiveLosses = detectRevenge(baseFacts({
      loserId: 2,
      h2hBeforeMatch: {
        playerA: 1, playerB: 2, cutoff: new Date(), aWins: 0, bWins: 5, gamesPlayed: 5,
        recentMeetings: Array.from({ length: 5 }, (_, i) => ({ matchId: 200 + i, playedAt: new Date(), winnerId: 2, stake: 1 })),
      },
    }))!;
    assert.ok(fiveLosses.components.historicalSignificance > oneLoss.components.historicalSignificance);
  });
});

describe("detectResultStories (runs the full RESULT family together)", () => {
  test("a completely unremarkable match still produces its baseline result", () => {
    assert.deepEqual(detectResultStories(baseFacts()).map(story => story.storyType), ["MATCH_RESULT"]);
  });

  test("a single dramatic match can trigger multiple story types at once (left for 9.6 merging to combine, not this file's job)", () => {
    const facts = baseFacts({
      winnerProbability: 0.10, // MODEL_SHOCK
      stake: 20, highStakeThreshold: 10, // HIGH_STAKE_WIN
      wasLoserLeaderBefore: true, // LEADER_BEATEN
      loserBefore: playerState({ currentWinStreak: 6, points: 40, isEliminated: false }), // STREAK_BREAKER
      loserAfter: playerState({ currentWinStreak: 0, points: 20, isEliminated: false }),
    });
    const results = detectResultStories(facts);
    const types = results.map(r => r.storyType).sort();
    // The high stake here is also a high-stake LOSS for the (non-eliminated)
    // loser, so both HIGH_STAKE_WIN and HIGH_STAKE_LOSS legitimately fire
    // alongside MODEL_SHOCK/LEADER_BEATEN/STREAK_BREAKER — five independent
    // true facts about the same match, exactly what 9.6's merging step
    // exists to collapse into one primary narrative later.
    assert.deepEqual(types, ["HIGH_STAKE_LOSS", "HIGH_STAKE_WIN", "LEADER_BEATEN", "MATCH_RESULT", "MODEL_SHOCK", "STREAK_BREAKER"]);
  });
});
