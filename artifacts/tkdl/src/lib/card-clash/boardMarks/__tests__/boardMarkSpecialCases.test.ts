import { test } from "node:test";
import assert from "node:assert/strict";
import { applyBoardMarkSabotage, computeMatchSwingOutcome } from "../boardMarkSpecialCases";
import type { BoardMark } from "../boardMarkTypes";

function mark(id: string, ownerPlayerId: string): BoardMark {
  return {
    id,
    type: "hot",
    target: { type: "bull", value: "bull" },
    ownerPlayerId,
    appliesTo: "neutral",
    duration: "until_hit",
  };
}

// ── Sabotage ──

test("erase removes exactly one of the opponent's marks, leaves the rest", () => {
  const marks = [mark("a", "1"), mark("b", "1"), mark("c", "0")];
  const result = applyBoardMarkSabotage(marks, "erase", "1");
  assert.equal(result.removedCount, 1);
  assert.equal(result.marks.length, 2);
  // the untouched own-player mark ("c") must still be present
  assert.ok(result.marks.some(m => m.id === "c"));
});

test("purge removes all of the opponent's marks, leaves everything else", () => {
  const marks = [mark("a", "1"), mark("b", "1"), mark("c", "0"), mark("d", "0")];
  const result = applyBoardMarkSabotage(marks, "purge", "1");
  assert.equal(result.removedCount, 2);
  assert.equal(result.marks.length, 2);
  assert.ok(result.marks.every(m => m.ownerPlayerId === "0"));
});

test("sabotage never touches marks NOT owned by the target opponent id", () => {
  const marks = [mark("a", "0"), mark("b", "0")];
  const eraseResult = applyBoardMarkSabotage(marks, "erase", "1"); // player 1 owns nothing
  assert.equal(eraseResult.removedCount, 0);
  assert.equal(eraseResult.marks.length, 2);

  const purgeResult = applyBoardMarkSabotage(marks, "purge", "1");
  assert.equal(purgeResult.removedCount, 0);
  assert.equal(purgeResult.marks.length, 2);
});

test("sabotage with no opponent marks returns removedCount 0 and the original array (never a dead draw signal)", () => {
  const marks: BoardMark[] = [];
  const result = applyBoardMarkSabotage(marks, "erase", "1");
  assert.equal(result.removedCount, 0);
  assert.deepEqual(result.marks, []);
});

// ── Match Swing ──

test("overtake triggers only when the opponent is 2+ legs ahead of the drawer", () => {
  // player 0 draws, player 1 (opponent) is 2 ahead: [0, 2]
  const met = computeMatchSwingOutcome("overtake", 0, [0, 2]);
  assert.equal(met.conditionMet, true);
  assert.deepEqual(met.delta, [0, -1]); // removes a leg from player 1

  const notMet = computeMatchSwingOutcome("overtake", 0, [0, 1]); // only 1 ahead
  assert.equal(notMet.conditionMet, false);
  assert.deepEqual(notMet.delta, [0, 0]);
});

test("overtake correctly identifies the opponent relative to whichever player drew it", () => {
  // player 1 draws, player 0 (opponent) is 3 ahead: [3, 0]
  const met = computeMatchSwingOutcome("overtake", 1, [3, 0]);
  assert.equal(met.conditionMet, true);
  assert.deepEqual(met.delta, [-1, 0]); // removes a leg from player 0
});

test("underdog's grace triggers only when the drawer themself is 2+ legs behind", () => {
  // player 0 draws, is 2 behind: [0, 2]
  const met = computeMatchSwingOutcome("underdogs_grace", 0, [0, 2]);
  assert.equal(met.conditionMet, true);
  assert.deepEqual(met.delta, [1, 0]); // grants player 0 a leg

  const notMet = computeMatchSwingOutcome("underdogs_grace", 0, [1, 2]); // only 1 behind
  assert.equal(notMet.conditionMet, false);
});

test("overtake and underdog's grace trigger under the same underlying gap, by design — different execution (remove vs grant)", () => {
  const standing: [number, number] = [0, 2];
  const overtake = computeMatchSwingOutcome("overtake", 0, standing);
  const grace = computeMatchSwingOutcome("underdogs_grace", 0, standing);
  assert.equal(overtake.conditionMet, true);
  assert.equal(grace.conditionMet, true);
  // overtake takes from the opponent; grace grants to the drawer -- opposite mechanism, same trigger condition
  assert.deepEqual(overtake.delta, [0, -1]);
  assert.deepEqual(grace.delta, [1, 0]);
});

test("set point triggers only when the current set's leg gap is exactly 1, and always benefits the drawer", () => {
  // gap of exactly 1, player 0 drawing, player 1 currently ahead in this set
  const met = computeMatchSwingOutcome("set_point", 0, [1, 2]);
  assert.equal(met.conditionMet, true);
  assert.deepEqual(met.delta, [0, -1]); // takes from opponent (player 1), regardless of who's "ahead" in the set

  const tooClose = computeMatchSwingOutcome("set_point", 0, [1, 1]); // gap of 0
  assert.equal(tooClose.conditionMet, false);

  const tooFar = computeMatchSwingOutcome("set_point", 0, [0, 2]); // gap of 2
  assert.equal(tooFar.conditionMet, false);
});

test("set point always takes from the drawer's opponent, never from the drawer themself, regardless of who is ahead", () => {
  // player 0 drawing, player 0 currently ahead 2-1 in this set (gap 1)
  const drawerAhead = computeMatchSwingOutcome("set_point", 0, [2, 1]);
  assert.equal(drawerAhead.conditionMet, true);
  assert.deepEqual(drawerAhead.delta, [0, -1]); // still takes from player 1, not player 0
});

test("no match swing kind ever produces a delta that touches both players at once", () => {
  const kinds: Array<"overtake" | "underdogs_grace" | "set_point"> = ["overtake", "underdogs_grace", "set_point"];
  const standings: [number, number][] = [[0, 2], [2, 0], [1, 2], [2, 1]];
  for (const kind of kinds) {
    for (const standing of standings) {
      for (const player of [0, 1] as const) {
        const outcome = computeMatchSwingOutcome(kind, player, standing);
        if (outcome.conditionMet) {
          const nonZero = outcome.delta.filter(d => d !== 0);
          assert.equal(nonZero.length, 1, `expected exactly one non-zero delta for ${kind}/${player}/${standing}`);
        }
      }
    }
  }
});
