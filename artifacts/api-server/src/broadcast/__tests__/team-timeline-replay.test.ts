/**
 * Tests for replayTeamTimeline() — the Doubles Event / Shift Wars
 * counterpart to timeline-replay.ts's Singles replay (see that file's test
 * for the Singles-specific cases; these focus on what's different for
 * team leagues: configurable starting balances and optional Elo tracking).
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { replayTeamTimeline, type TeamReplayMatch, type TeamReplayConfig } from "../team-timeline-replay.ts";

function m(id: number, winnerTeamId: number, loserTeamId: number, stake: number): TeamReplayMatch {
  return { id, playedAt: new Date(2026, 0, id), winnerTeamId, loserTeamId, stake };
}

// Doubles Event shape: fixed 50-point start, Elo tracked from 1000.
const doublesConfig: TeamReplayConfig = {
  initialState: () => ({ points: 50, elo: 1000 }),
  trackElo: true,
};

// Shift Wars shape: no Elo, and — unlike Doubles/Singles — starting points
// are per-team and admin-configurable, not one shared constant.
function shiftWarsConfig(startingPointsByTeam: Record<number, number>): TeamReplayConfig {
  return {
    initialState: (teamId) => ({ points: startingPointsByTeam[teamId] ?? 0, elo: null }),
    trackElo: false,
  };
}

describe("replayTeamTimeline — Doubles Event shape (fixed start, Elo tracked)", () => {
  test("teams start at the fixed 50-point balance with Elo 1000", () => {
    const [entry] = replayTeamTimeline([m(1, 10, 20, 5)], doublesConfig);
    assert.equal(entry.winnerBefore.points, 50);
    assert.equal(entry.loserBefore.points, 50);
    assert.equal(entry.winnerBefore.elo, 1000);
    assert.equal(entry.loserBefore.elo, 1000);
  });

  test("Elo moves via applyEloChange, points move via applyWager", () => {
    const [entry] = replayTeamTimeline([m(1, 10, 20, 5)], doublesConfig);
    assert.equal(entry.winnerAfter.points, 55);
    assert.equal(entry.loserAfter.points, 45);
    // Equal starting Elo (1000 vs 1000) -> the standard K=32 even-match change.
    assert.equal(entry.winnerAfter.elo, 1016);
    assert.equal(entry.loserAfter.elo, 984);
  });

  test("a team eliminated by a stake reaching 0 points stays eliminated", () => {
    const timeline = replayTeamTimeline([m(1, 10, 20, 50), m(2, 30, 20, 1)], doublesConfig);
    assert.equal(timeline[0].loserAfter.points, 0);
    assert.equal(timeline[0].loserAfter.isEliminated, true);
    assert.equal(timeline[1].loserBefore.isEliminated, true);
  });
});

describe("replayTeamTimeline — Shift Wars shape (per-team start, no Elo)", () => {
  test("each team starts at its own configured starting_points, not a shared constant", () => {
    const config = shiftWarsConfig({ 1: 100, 2: 60 });
    const [entry] = replayTeamTimeline([m(1, 1, 2, 10)], config);
    assert.equal(entry.winnerBefore.points, 100);
    assert.equal(entry.loserBefore.points, 60);
  });

  test("Elo stays null throughout when trackElo is false", () => {
    const config = shiftWarsConfig({ 1: 100, 2: 60 });
    const [entry] = replayTeamTimeline([m(1, 1, 2, 10)], config);
    assert.equal(entry.winnerBefore.elo, null);
    assert.equal(entry.winnerAfter.elo, null);
    assert.equal(entry.loserAfter.elo, null);
  });

  test("win/loss streaks accumulate the same way as Singles/Doubles", () => {
    const config = shiftWarsConfig({ 1: 100, 2: 100 });
    const timeline = replayTeamTimeline([m(1, 1, 2, 1), m(2, 1, 2, 1), m(3, 2, 1, 1)], config);
    assert.equal(timeline[2].loserBefore.currentWinStreak, 2); // team 1, about to lose match 3
    assert.equal(timeline[2].loserAfter.currentWinStreak, 0);
    assert.equal(timeline[2].loserAfter.currentLossStreak, 1);
  });
});
