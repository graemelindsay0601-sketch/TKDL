import assert from "node:assert/strict";
import test from "node:test";
import { reverseTeamLedger } from "../team-match-rollback.ts";

test("reverses an exact Doubles winner ledger", () => {
  assert.deepEqual(
    reverseTeamLedger(
      { points: 70, elo: 1016, wins: 4, losses: 1, isEliminated: false },
      { pointsDelta: 20, eloDelta: 16, won: true },
    ),
    { points: 50, elo: 1000, wins: 3, losses: 1, isEliminated: false },
  );
});

test("reverses a floor-clamped loss using its recorded Elo delta", () => {
  assert.deepEqual(
    reverseTeamLedger(
      { points: 0, elo: 800, wins: 0, losses: 3, isEliminated: true },
      { pointsDelta: -10, eloDelta: -4, won: false, causedElimination: true },
    ),
    { points: 10, elo: 804, wins: 0, losses: 2, isEliminated: false },
  );
});

test("reverses every member of an uneven Shift Wars result independently", () => {
  const solo = reverseTeamLedger(
    { points: 80, wins: 3, losses: 0 },
    { pointsDelta: 20, won: true },
  );
  const sideA = reverseTeamLedger(
    { points: 40, wins: 0, losses: 2 },
    { pointsDelta: -10, won: false },
  );
  const sideB = reverseTeamLedger(
    { points: 25, wins: 1, losses: 2 },
    { pointsDelta: -10, won: false },
  );
  assert.deepEqual([solo.points, sideA.points, sideB.points], [60, 50, 35]);
  assert.equal(solo.wins, 2);
  assert.equal(sideA.losses, 1);
  assert.equal(sideB.losses, 1);
});

test("refuses a rollback when later manual edits spent the recorded gain", () => {
  assert.throws(
    () => reverseTeamLedger({ points: 5, wins: 1, losses: 0 }, { pointsDelta: 10, won: true }),
    /balance changed/,
  );
});
