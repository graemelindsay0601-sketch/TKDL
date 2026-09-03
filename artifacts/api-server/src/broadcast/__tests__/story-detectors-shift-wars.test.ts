/**
 * Tests for story-detectors-shift-wars.ts — the SHIFT_WARS family
 * (Appendix A): SHIFT_LEAD_CHANGE, SHIFT_MOMENTUM, SHIFT_COMEBACK,
 * SHIFT_DOMINANCE.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  detectShiftLeadChange,
  detectShiftMomentum,
  detectShiftComeback,
  detectShiftDominance,
  detectShiftWarsStories,
  type ShiftWarsStandingsFacts,
  type ShiftWarsTeamStanding,
} from "../story-detectors-shift-wars.ts";

function team(overrides: Partial<ShiftWarsTeamStanding> = {}): ShiftWarsTeamStanding {
  return { teamId: 1, points: 20, wins: 3, losses: 3, ...overrides };
}

function baseFacts(overrides: Partial<ShiftWarsStandingsFacts> = {}): ShiftWarsStandingsFacts {
  return {
    current: [team({ teamId: 1, points: 20 }), team({ teamId: 2, points: 18 })],
    previous: [team({ teamId: 1, points: 18 }), team({ teamId: 2, points: 17 })],
    deficitRecoveryWindows: [],
    ...overrides,
  };
}

describe("detectShiftLeadChange (Appendix A: department points leader changes)", () => {
  test("no previous snapshot -> no trigger", () => {
    assert.deepEqual(detectShiftLeadChange(baseFacts({ previous: null })), []);
  });

  test("same leader in both snapshots does not trigger", () => {
    assert.deepEqual(detectShiftLeadChange(baseFacts()), []);
  });

  test("leader changes -> triggers", () => {
    const facts = baseFacts({
      current: [team({ teamId: 2, points: 25 }), team({ teamId: 1, points: 20 })],
      previous: [team({ teamId: 1, points: 20 }), team({ teamId: 2, points: 18 })],
    });
    const stories = detectShiftLeadChange(facts);
    assert.equal(stories.length, 1);
    assert.equal(stories[0].facts.newLeaderTeamId, 2);
    assert.equal(stories[0].leagueType, "shift_wars");
  });
});

describe("detectShiftMomentum (Appendix A: recent results materially swing gap, either direction)", () => {
  test("small gap change does not trigger", () => {
    assert.deepEqual(detectShiftMomentum(baseFacts()), []);
  });

  test("gap widens materially -> triggers, tagged widening", () => {
    const facts = baseFacts({
      current: [team({ teamId: 1, points: 30 }), team({ teamId: 2, points: 18 })], // gap 12
      previous: [team({ teamId: 1, points: 20 }), team({ teamId: 2, points: 18 })], // gap 2
    });
    const stories = detectShiftMomentum(facts);
    assert.equal(stories.length, 1);
    assert.equal(stories[0].facts.direction, "widening");
  });

  test("gap tightens materially -> triggers, tagged tightening", () => {
    const facts = baseFacts({
      current: [team({ teamId: 1, points: 20 }), team({ teamId: 2, points: 19 })], // gap 1
      previous: [team({ teamId: 1, points: 20 }), team({ teamId: 2, points: 10 })], // gap 10
    });
    const stories = detectShiftMomentum(facts);
    assert.equal(stories.length, 1);
    assert.equal(stories[0].facts.direction, "tightening");
  });
});

describe("detectShiftComeback (Appendix A: deficit materially recovered across multiple results)", () => {
  test("no recovery windows given -> nothing to check", () => {
    assert.deepEqual(detectShiftComeback(baseFacts({ deficitRecoveryWindows: [] })), []);
  });

  test("window shorter than the minimum matches does not trigger even with a big recovery", () => {
    const facts = baseFacts({ deficitRecoveryWindows: [{ teamId: 2, matches: 2, deficitBefore: 20, deficitNow: 2 }] });
    assert.deepEqual(detectShiftComeback(facts), []);
  });

  test("a material recovery over enough matches triggers", () => {
    const facts = baseFacts({ deficitRecoveryWindows: [{ teamId: 2, matches: 4, deficitBefore: 15, deficitNow: 3 }] });
    const stories = detectShiftComeback(facts);
    assert.equal(stories.length, 1);
    assert.equal(stories[0].facts.teamId, 2);
  });

  test("a deficit that barely moved does not trigger", () => {
    const facts = baseFacts({ deficitRecoveryWindows: [{ teamId: 2, matches: 4, deficitBefore: 10, deficitNow: 9 }] });
    assert.deepEqual(detectShiftComeback(facts), []);
  });

  test("multiple teams recovering independently each produce their own candidate", () => {
    const facts = baseFacts({
      deficitRecoveryWindows: [
        { teamId: 2, matches: 4, deficitBefore: 15, deficitNow: 3 },
        { teamId: 3, matches: 5, deficitBefore: 20, deficitNow: 5 },
      ],
    });
    assert.equal(detectShiftComeback(facts).length, 2);
  });
});

describe("detectShiftDominance (Appendix A: sustained high win share with adequate matches)", () => {
  test("fewer than 8 games does not trigger even at 100% win share", () => {
    assert.deepEqual(detectShiftDominance(baseFacts({ current: [team({ teamId: 1, wins: 5, losses: 0 })] })), []);
  });

  test("win share below 75% does not trigger", () => {
    assert.deepEqual(detectShiftDominance(baseFacts({ current: [team({ teamId: 1, wins: 5, losses: 4 })] })), []); // ~56%
  });

  test("8+ games with >=75% win share triggers", () => {
    const stories = detectShiftDominance(baseFacts({ current: [team({ teamId: 1, wins: 7, losses: 2 })] })); // ~78%
    assert.equal(stories.length, 1);
    assert.equal(stories[0].facts.teamId, 1);
  });

  test("multiple dominant teams (if more than 2 departments exist) each get their own candidate", () => {
    const facts = baseFacts({
      current: [team({ teamId: 1, wins: 8, losses: 1 }), team({ teamId: 2, wins: 7, losses: 1 })],
    });
    assert.equal(detectShiftDominance(facts).length, 2);
  });
});

describe("detectShiftWarsStories (runs the full SHIFT_WARS family together)", () => {
  test("a quiet Edition triggers nothing", () => {
    assert.deepEqual(detectShiftWarsStories(baseFacts()), []);
  });
});
