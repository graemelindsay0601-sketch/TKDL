/**
 * Tests for story-detectors-doubles.ts — the DOUBLES family (Appendix A):
 * PAIR_UPSET, PAIR_ELIMINATED (match-anchored) and UNBEATEN_PAIR,
 * PAIR_SURGE (subject-anchored).
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  detectPairUpset,
  detectPairEliminated,
  detectDoublesMatchStories,
  detectUnbeatenPair,
  detectPairSurge,
  detectDoublesFormStories,
  type DoublesMatchResultFacts,
  type DoublesTeamFormFacts,
} from "../story-detectors-doubles.ts";
import type { TeamState } from "../team-timeline-replay.ts";

function teamState(overrides: Partial<TeamState> = {}): TeamState {
  return {
    points: 50,
    elo: 1000,
    wins: 2,
    losses: 2,
    currentWinStreak: 0,
    currentLossStreak: 0,
    recentForm: ["W", "L", "W", "L"],
    isEliminated: false,
    ...overrides,
  };
}

function matchFacts(overrides: Partial<DoublesMatchResultFacts> = {}): DoublesMatchResultFacts {
  return {
    matchId: 701,
    playedAt: new Date("2026-09-05T19:00:00Z"),
    winnerTeamId: 1,
    loserTeamId: 2,
    loserBefore: teamState(),
    loserAfter: teamState(),
    winnerProbability: 0.5,
    ...overrides,
  };
}

describe("detectPairUpset (Appendix A: team model underdog wins)", () => {
  test("favourite winning (>=40%) does not trigger", () => {
    assert.equal(detectPairUpset(matchFacts({ winnerProbability: 0.40 })), null);
  });

  test("underdog winning (<40%) triggers", () => {
    const story = detectPairUpset(matchFacts({ winnerProbability: 0.2 }));
    assert.ok(story);
    assert.equal(story.storyType, "PAIR_UPSET");
    assert.equal(story.leagueType, "doubles");
  });

  test("subjects are both teams via doubles-namespaced keys", () => {
    const story = detectPairUpset(matchFacts({ winnerProbability: 0.1, winnerTeamId: 5, loserTeamId: 9 }));
    assert.ok(story);
    assert.deepEqual(story.subjectKeys.sort(), ["doubles:5", "doubles:9"]);
  });
});

describe("detectPairEliminated (Appendix A: team reaches zero)", () => {
  test("loser not eliminated does not trigger", () => {
    const facts = matchFacts({ loserBefore: teamState({ isEliminated: false }), loserAfter: teamState({ points: 10, isEliminated: false }) });
    assert.equal(detectPairEliminated(facts), null);
  });

  test("loser newly eliminated this match triggers", () => {
    const facts = matchFacts({ loserBefore: teamState({ points: 20, isEliminated: false }), loserAfter: teamState({ points: 0, isEliminated: true }) });
    const story = detectPairEliminated(facts);
    assert.ok(story);
    assert.equal(story.sentiment, "negative");
  });

  test("a team already eliminated before this match does not re-trigger", () => {
    const facts = matchFacts({ loserBefore: teamState({ points: 0, isEliminated: true }), loserAfter: teamState({ points: 0, isEliminated: true }) });
    assert.equal(detectPairEliminated(facts), null);
  });
});

describe("detectDoublesMatchStories", () => {
  test("an unremarkable match triggers nothing", () => {
    assert.deepEqual(detectDoublesMatchStories(matchFacts()), []);
  });

  test("a low-probability winner whose opponent gets eliminated triggers both", () => {
    const facts = matchFacts({
      winnerProbability: 0.1,
      loserBefore: teamState({ points: 5, isEliminated: false }),
      loserAfter: teamState({ points: 0, isEliminated: true }),
    });
    const types = detectDoublesMatchStories(facts).map(s => s.storyType).sort();
    assert.deepEqual(types, ["PAIR_ELIMINATED", "PAIR_UPSET"]);
  });
});

function formFacts(overrides: Partial<DoublesTeamFormFacts> = {}): DoublesTeamFormFacts {
  return {
    teamId: 1,
    state: teamState(),
    positionWindow: null,
    currentPosition: null,
    ...overrides,
  };
}

describe("detectUnbeatenPair (Appendix A: current drawn team unbeaten with >=3 matches)", () => {
  test("any losses at all disqualifies, regardless of win count", () => {
    assert.equal(detectUnbeatenPair(formFacts({ state: teamState({ wins: 10, losses: 1 }) })), null);
  });

  test("zero losses but fewer than 3 wins does not trigger", () => {
    assert.equal(detectUnbeatenPair(formFacts({ state: teamState({ wins: 2, losses: 0 }) })), null);
  });

  test("zero losses and exactly 3 wins triggers", () => {
    const story = detectUnbeatenPair(formFacts({ state: teamState({ wins: 3, losses: 0 }) }));
    assert.ok(story);
    assert.equal(story.storyType, "UNBEATEN_PAIR");
  });
});

describe("detectPairSurge (Appendix A: strong recent team form OR table move)", () => {
  test("neither a win streak nor a table move does not trigger", () => {
    assert.equal(detectPairSurge(formFacts({ state: teamState({ currentWinStreak: 1 }), positionWindow: null })), null);
  });

  test("a win streak of 3+ triggers even with no table-move data", () => {
    const story = detectPairSurge(formFacts({ state: teamState({ currentWinStreak: 3 }) }));
    assert.ok(story);
  });

  test("a table move of +2 over >=3 matches triggers even with no active win streak", () => {
    const story = detectPairSurge(formFacts({
      state: teamState({ currentWinStreak: 0 }),
      positionWindow: { matches: 3, positionBefore: 5 },
      currentPosition: 3,
    }));
    assert.ok(story);
  });

  test("a table move below the +2 threshold does not trigger on its own", () => {
    const story = detectPairSurge(formFacts({
      state: teamState({ currentWinStreak: 0 }),
      positionWindow: { matches: 3, positionBefore: 4 },
      currentPosition: 3,
    }));
    assert.equal(story, null);
  });
});

describe("detectDoublesFormStories", () => {
  test("a flat, unremarkable team triggers nothing", () => {
    assert.deepEqual(detectDoublesFormStories(formFacts()), []);
  });

  test("a team both unbeaten and on a strong streak triggers both", () => {
    const facts = formFacts({ state: teamState({ wins: 4, losses: 0, currentWinStreak: 4 }) });
    const types = detectDoublesFormStories(facts).map(s => s.storyType).sort();
    assert.deepEqual(types, ["PAIR_SURGE", "UNBEATEN_PAIR"]);
  });
});
