import { test } from "node:test";
import assert from "node:assert/strict";
import { DRILLS, drillFor, drillValue, leaderboard, streak, londonDay, type DrillSession } from "../daily-drill.ts";

const s = (playerId: number, key: string, at: string, extra: Partial<DrillSession> = {}): DrillSession =>
  ({ playerId, name: `P${playerId}`, gameTypeKey: key, darts: 30, score: 501, sdScore: null, winnerIdx: 0, createdAt: new Date(at), ...extra });

test("the drill is the same all day and changes the next day", () => {
  assert.equal(drillFor("2026-11-26").key, drillFor("2026-11-26").key);
  assert.notEqual(drillFor("2026-11-26").key, drillFor("2026-11-27").key);
  assert.ok(DRILLS.includes(drillFor("2030-01-01")));
});

test("values: sprints need a finish, averages need 9 darts, scores come from the session", () => {
  const sprint = DRILLS.find(d => d.key === "301-sprint")!, avg = DRILLS.find(d => d.key === "501-average")!, nine = DRILLS.find(d => d.key === "nine-darts")!;
  assert.equal(drillValue(sprint, s(1, "301_double_out", "2026-11-26T10:00:00Z", { darts: 15 })), 15);
  assert.equal(drillValue(sprint, s(1, "301_double_out", "2026-11-26T10:00:00Z", { winnerIdx: null })), null, "not finished");
  assert.equal(drillValue(avg, s(1, "501_double_out", "2026-11-26T10:00:00Z", { darts: 30, score: 501 })), 50.1);
  assert.equal(drillValue(nine, s(1, "high_score_9", "2026-11-26T10:00:00Z", { sdScore: 211, score: null })), 211);
  assert.equal(drillValue(nine, s(1, "501_double_out", "2026-11-26T10:00:00Z")), null, "wrong game");
});

test("leaderboard keeps each player's best; streak counts consecutive drill days", () => {
  const sprint = DRILLS.find(d => d.key === "301-sprint")!;
  const b = leaderboard(sprint, [s(1, "301_double_out", "2026-11-26T10:00:00Z", { darts: 18 }), s(1, "301_double_out", "2026-11-26T11:00:00Z", { darts: 14 }), s(2, "301_double_out", "2026-11-26T12:00:00Z", { darts: 16 })]);
  assert.deepEqual(b.map(x => [x.playerId, x.value]), [[1, 14], [2, 16]]);
  // play each day's drill on three days running
  const days = ["2026-11-24", "2026-11-25", "2026-11-26"];
  const sessions = days.map(d => { const def = drillFor(d); return s(1, def.gameKey, `${d}T12:00:00Z`, { darts: 20, score: 600, sdScore: 100 }); });
  assert.equal(streak(1, sessions, "2026-11-26"), 3);
  assert.equal(streak(1, sessions.slice(0, 2), "2026-11-26"), 2, "today not done yet: the run up to yesterday still counts");
  assert.equal(londonDay(new Date("2026-06-30T23:30:00Z")), "2026-07-01", "London time in summer");
});

import { passedPlayers } from "../daily-drill.ts";
test("passedPlayers finds who was ahead and is now behind", () => {
  assert.deepEqual(passedPlayers([1, 2, 3, 4], [1, 4, 2, 3], 4), [2, 3]);
  assert.deepEqual(passedPlayers([1, 2], [5, 1, 2], 5), [1, 2]); // new entry straight to the top
  assert.deepEqual(passedPlayers([1, 2, 3], [1, 2, 3], 3), []);
});
