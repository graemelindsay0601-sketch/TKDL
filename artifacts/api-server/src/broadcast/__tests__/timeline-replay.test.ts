/**
 * Tests for replaySinglesTimeline() — the pure replay logic Historical
 * Reconstruction (TKDL LIVE, handover section 6) uses to answer "what did
 * this player's record/points/streak look like immediately before match
 * X", something the players table can't answer since it only ever holds
 * current totals.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { replaySinglesTimeline, SINGLES_SEASON_STARTING_POINTS, type SinglesReplayMatch } from "../timeline-replay.ts";

function m(id: number, winnerId: number, loserId: number, stake: number, playedAt = new Date(2026, 0, id)): SinglesReplayMatch {
  return { id, playedAt, winnerId, loserId, stake };
}

describe("replaySinglesTimeline", () => {
  test("a player's first appearance starts at the season's starting balance", () => {
    const [entry] = replaySinglesTimeline([m(1, 100, 200, 5)]);
    assert.equal(entry.winnerBefore.points, SINGLES_SEASON_STARTING_POINTS);
    assert.equal(entry.loserBefore.points, SINGLES_SEASON_STARTING_POINTS);
  });

  test("points move by the real stake via applyWager, not a recomputed value", () => {
    const [entry] = replaySinglesTimeline([m(1, 100, 200, 5)]);
    assert.equal(entry.winnerAfter.points, SINGLES_SEASON_STARTING_POINTS + 5);
    assert.equal(entry.loserAfter.points, SINGLES_SEASON_STARTING_POINTS - 5);
  });

  test("win/loss counts and streaks accumulate correctly across several matches", () => {
    // 100 beats 200 twice, then 200 beats 100 once.
    const timeline = replaySinglesTimeline([
      m(1, 100, 200, 1),
      m(2, 100, 200, 1),
      m(3, 200, 100, 1),
    ]);

    const last = timeline[2];
    // Before match 3: player 100 is on a 2-win streak, player 200 on a 2-loss streak.
    assert.equal(last.winnerBefore.currentWinStreak, 0); // this is 200's "before", who was losing
    assert.equal(last.loserBefore.currentWinStreak, 2);  // 100's "before" state (about to lose)
    assert.equal(last.loserBefore.currentLossStreak, 0);

    // After match 3: 200 (winner) now has 1 win; 100 (loser) streak resets to a 1-loss streak.
    assert.equal(last.winnerAfter.seasonWins, 1);
    assert.equal(last.loserAfter.currentWinStreak, 0);
    assert.equal(last.loserAfter.currentLossStreak, 1);
    assert.equal(last.loserAfter.seasonWins, 2);   // 100's 2 earlier wins are still on the books
    assert.equal(last.loserAfter.seasonLosses, 1);
  });

  test("recentForm is newest-first and reflects the outcome just applied", () => {
    const timeline = replaySinglesTimeline([
      m(1, 100, 200, 1),
      m(2, 200, 100, 1),
      m(3, 100, 200, 1),
    ]);
    // Player 100: W, L, W -> newest first should read ["W", "L", "W"]
    assert.deepEqual(timeline[2].winnerAfter.recentForm, ["W", "L", "W"]);
  });

  test("recentForm is capped and drops the oldest entries", () => {
    const matches: SinglesReplayMatch[] = [];
    for (let i = 1; i <= 12; i++) matches.push(m(i, 100, 200, 1)); // 100 wins every time
    const timeline = replaySinglesTimeline(matches);
    const finalForm = timeline[timeline.length - 1].winnerAfter.recentForm;
    assert.equal(finalForm.length, 10);
    assert.ok(finalForm.every(r => r === "W"));
  });

  test("a stake that exceeds the loser's balance eliminates them, and it's sticky", () => {
    // Player 200 loses all 25, then somehow appears again (defensive case) —
    // isEliminated must still read true afterward regardless.
    const timeline = replaySinglesTimeline([
      m(1, 100, 200, 25),
      m(2, 300, 200, 1),
    ]);
    assert.equal(timeline[0].loserAfter.points, 0);
    assert.equal(timeline[0].loserAfter.isEliminated, true);
    assert.equal(timeline[1].loserBefore.isEliminated, true);
    assert.equal(timeline[1].loserAfter.isEliminated, true);
  });

  test("unrelated players' states never affect each other", () => {
    const timeline = replaySinglesTimeline([
      m(1, 100, 200, 10),
      m(2, 300, 400, 3),
    ]);
    assert.equal(timeline[1].winnerBefore.points, SINGLES_SEASON_STARTING_POINTS);
    assert.equal(timeline[1].loserBefore.points, SINGLES_SEASON_STARTING_POINTS);
  });

  test("an empty match list returns an empty timeline", () => {
    assert.deepEqual(replaySinglesTimeline([]), []);
  });
});
