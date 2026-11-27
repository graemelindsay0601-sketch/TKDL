import { test } from "node:test";
import assert from "node:assert/strict";
import { singlesHighlights, bigFinish, ordinal } from "../community-highlights.ts";

const base = { matchId: 7, gameType: "501", winnerId: 1, winnerName: "Kyle", loserId: 2, loserName: "Sean",
  winner180s: 0, loser180s: 0, wasUpset: false, winnerStreakAfter: 1, loserStreakBefore: 0, loserEliminated: false };

test("an ordinary result is not a moment", () => {
  assert.deepEqual(singlesHighlights(base), []);
});

test("180s from either player are moments, keyed per player per match", () => {
  const h = singlesHighlights({ ...base, winner180s: 2, loser180s: 1 });
  assert.deepEqual(h.map(x => x.key), ["max:7:1", "max:7:2"]);
  assert.equal(h[0].title, "2 MAXIMUMS!");
  assert.equal(h[1].line, "Sean hit a 180 against Kyle.");
});

test("upsets need a 3+ place gap", () => {
  const [h] = singlesHighlights({ ...base, wasUpset: true, winnerRankBefore: 9, loserRankBefore: 1 });
  assert.equal(h.kind, "upset");
  assert.equal(h.line, "Kyle (9th) beat Sean (1st).");
  assert.equal(h.stat, 8);
  assert.deepEqual(singlesHighlights({ ...base, wasUpset: true, winnerRankBefore: 5, loserRankBefore: 3 }), []);
  assert.deepEqual(singlesHighlights({ ...base, wasUpset: true }), []);
});

test("win runs post at 5, 10, 15, 20 only; ending a 5+ run is a moment", () => {
  assert.equal(singlesHighlights({ ...base, winnerStreakAfter: 5 })[0].title, "ON FIRE");
  assert.deepEqual(singlesHighlights({ ...base, winnerStreakAfter: 6 }), []);
  const [end] = singlesHighlights({ ...base, loserStreakBefore: 7 });
  assert.equal(end.line, "Kyle ended Sean's run of 7 wins.");
});

test("eliminations are moments", () => {
  assert.equal(singlesHighlights({ ...base, loserEliminated: true })[0].kind, "elimination");
});

test("big finish: last visit 100-170 only", () => {
  const v = (...vals: number[]) => vals.map(val => ({ val }));
  assert.equal(bigFinish(v(60, 60, 60, 20, 20, 1, 60, 57, 50)), 167);
  assert.equal(bigFinish(v(60, 60, 60, 40)), null); // one-dart 40 finish
  assert.equal(bigFinish(v(60, 60, 60, 60, 40)), 100);
  assert.equal(bigFinish([]), null);
});

test("ordinal", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd"]);
});
