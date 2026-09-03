/**
 * Tests for story-detectors-h2h.ts — the H2H family (Appendix A / section
 * 9.4): H2H_DOMINANCE, RIVALRY, RIVALRY_SWING.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  detectH2HDominance,
  detectRivalry,
  detectRivalrySwing,
  detectH2HStories,
  type SinglesH2HFacts,
} from "../story-detectors-h2h.ts";

function baseFacts(overrides: Partial<SinglesH2HFacts> = {}): SinglesH2HFacts {
  return {
    playerAId: 1,
    playerBId: 2,
    aWins: 2,
    bWins: 2,
    gamesPlayed: 4,
    recentMeetings: [],
    ...overrides,
  };
}

describe("detectH2HDominance (9.4: >=4 meetings and >=75% wins)", () => {
  test("fewer than 4 meetings does not trigger even at 100% share", () => {
    assert.equal(detectH2HDominance(baseFacts({ aWins: 3, bWins: 0, gamesPlayed: 3 })), null);
  });

  test("share below 75% does not trigger", () => {
    assert.equal(detectH2HDominance(baseFacts({ aWins: 2, bWins: 2, gamesPlayed: 4 })), null); // 50% share
  });

  test("exactly 75% share at exactly 4 meetings triggers, naming the dominant player", () => {
    const story = detectH2HDominance(baseFacts({ aWins: 3, bWins: 1, gamesPlayed: 4, playerAId: 7, playerBId: 9 }));
    assert.ok(story);
    assert.equal(story.facts.dominantPlayerId, 7);
    assert.equal(story.facts.dominatedPlayerId, 9);
  });

  test("identifies player B as dominant when B holds the share", () => {
    const story = detectH2HDominance(baseFacts({ aWins: 1, bWins: 5, gamesPlayed: 6, playerAId: 7, playerBId: 9 }));
    assert.ok(story);
    assert.equal(story.facts.dominantPlayerId, 9);
  });
});

describe("detectRivalry (9.4: >=5 meetings, neither side above 70% career share)", () => {
  test("fewer than 5 meetings does not trigger", () => {
    assert.equal(detectRivalry(baseFacts({ aWins: 2, bWins: 2, gamesPlayed: 4 })), null);
  });

  test("one side above 70% share does not trigger (that's H2H_DOMINANCE territory instead)", () => {
    assert.equal(detectRivalry(baseFacts({ aWins: 4, bWins: 1, gamesPlayed: 5 })), null); // 80%
  });

  test("an even, competitive record over 5+ meetings triggers, neutral sentiment", () => {
    const story = detectRivalry(baseFacts({ aWins: 3, bWins: 2, gamesPlayed: 5 })); // 60% max share
    assert.ok(story);
    assert.equal(story.sentiment, "neutral");
  });

  test("exactly 70% share is still within RIVALRY's own bound (not excluded)", () => {
    const story = detectRivalry(baseFacts({ aWins: 7, bWins: 3, gamesPlayed: 10 })); // exactly 70%
    assert.ok(story);
  });
});

describe("detectRivalrySwing (Appendix A: recent H2H reverses longer-term direction)", () => {
  test("fewer than 5 career meetings does not trigger", () => {
    const facts = baseFacts({
      aWins: 3, bWins: 1, gamesPlayed: 4,
      recentMeetings: [
        { matchId: 1, playedAt: new Date(), winnerId: 2, stake: 1 },
        { matchId: 2, playedAt: new Date(), winnerId: 2, stake: 1 },
        { matchId: 3, playedAt: new Date(), winnerId: 2, stake: 1 },
      ],
    });
    assert.equal(detectRivalrySwing(facts), null);
  });

  test("a tied career record has no leader to reverse, does not trigger", () => {
    const facts = baseFacts({
      aWins: 3, bWins: 3, gamesPlayed: 6,
      recentMeetings: Array.from({ length: 3 }, (_, i) => ({ matchId: i, playedAt: new Date(), winnerId: 2, stake: 1 })),
    });
    assert.equal(detectRivalrySwing(facts), null);
  });

  test("fewer than 3 recent meetings does not trigger even with a career leader", () => {
    const facts = baseFacts({
      aWins: 4, bWins: 1, gamesPlayed: 5,
      recentMeetings: [{ matchId: 1, playedAt: new Date(), winnerId: 2, stake: 1 }],
    });
    assert.equal(detectRivalrySwing(facts), null);
  });

  test("career leader is A but recent window is won by B -> triggers a genuine swing", () => {
    const facts = baseFacts({
      playerAId: 1, playerBId: 2,
      aWins: 5, bWins: 1, gamesPlayed: 6, // A dominates the career record
      recentMeetings: [
        { matchId: 10, playedAt: new Date("2026-08-04"), winnerId: 2, stake: 1 },
        { matchId: 9, playedAt: new Date("2026-08-03"), winnerId: 2, stake: 1 },
        { matchId: 8, playedAt: new Date("2026-08-02"), winnerId: 2, stake: 1 },
      ],
    });
    const story = detectRivalrySwing(facts);
    assert.ok(story);
    assert.equal(story.facts.careerLeaderPlayerId, 1);
    assert.equal(story.facts.recentLeaderPlayerId, 2);
  });

  test("recent window still favours the same career leader -> no swing", () => {
    const facts = baseFacts({
      playerAId: 1, playerBId: 2,
      aWins: 5, bWins: 1, gamesPlayed: 6,
      recentMeetings: [
        { matchId: 10, playedAt: new Date(), winnerId: 1, stake: 1 },
        { matchId: 9, playedAt: new Date(), winnerId: 1, stake: 1 },
        { matchId: 8, playedAt: new Date(), winnerId: 2, stake: 1 },
      ],
    });
    assert.equal(detectRivalrySwing(facts), null);
  });

  test("a tied recent window (no clear recent leader) does not trigger", () => {
    const facts = baseFacts({
      playerAId: 1, playerBId: 2,
      aWins: 4, bWins: 2, gamesPlayed: 6,
      recentMeetings: [
        { matchId: 10, playedAt: new Date(), winnerId: 1, stake: 1 },
        { matchId: 9, playedAt: new Date(), winnerId: 2, stake: 1 },
      ],
    });
    assert.equal(detectRivalrySwing(facts), null); // also fails the min-3-recent-meetings gate
  });
});

describe("detectH2HStories (runs the full H2H family together)", () => {
  test("a fresh pair (no meetings) triggers nothing", () => {
    assert.deepEqual(detectH2HStories(baseFacts({ aWins: 0, bWins: 0, gamesPlayed: 0 })), []);
  });

  test("dominance and a swing cannot both fire (dominance implies no swing is possible under 75%+ share)", () => {
    // A dominant 5-1 record where the sole recent loss is B's only win —
    // still A leading recently too, so no swing; dominance still fires.
    const facts = baseFacts({
      playerAId: 1, playerBId: 2, aWins: 5, bWins: 1, gamesPlayed: 6,
      recentMeetings: [
        { matchId: 6, playedAt: new Date(), winnerId: 1, stake: 1 },
        { matchId: 5, playedAt: new Date(), winnerId: 1, stake: 1 },
        { matchId: 4, playedAt: new Date(), winnerId: 1, stake: 1 },
      ],
    });
    const types = detectH2HStories(facts).map(s => s.storyType).sort();
    assert.deepEqual(types, ["H2H_DOMINANCE"]);
  });
});
