import { test } from "node:test";
import assert from "node:assert/strict";
import { levelTargets, electGaffer, revengeWins, unlocksFor, nextStep, GAFFER_LADDER, SQUAD_LADDER, gameKey } from "../gaffer.ts";

test("difficulty levels come from recent months and always go up", () => {
  assert.deepEqual(levelTargets("oneEighties", [6, 4]), [5, 6, 7]);
  assert.deepEqual(levelTargets("meet", [8, 8]), [8, 10, 11]);
});

test("levels stay between the floor and the cap", () => {
  assert.deepEqual(levelTargets("oneEighties", []), [2, 3, 4]);
  assert.deepEqual(levelTargets("meet", [12, 12]), [11, 11, 11]);
  assert.deepEqual(levelTargets("finishing", [60]), [45, 45, 45]);
});

test("most votes wins; ties go to more matches", () => {
  const c = [{ id: 1, matches: 5 }, { id: 2, matches: 8 }, { id: 3, matches: 3 }];
  assert.deepEqual(electGaffer(c, [{ voter: 9, candidate: 1 }, { voter: 8, candidate: 1 }, { voter: 7, candidate: 3 }]), { id: 1, by: "vote" });
  assert.deepEqual(electGaffer(c, [{ voter: 9, candidate: 1 }, { voter: 8, candidate: 2 }]), { id: 2, by: "vote" });
});

test("votes for yourself or for someone who can't stand don't count", () => {
  const c = [{ id: 1, matches: 5 }, { id: 2, matches: 8 }];
  assert.deepEqual(electGaffer(c, [{ voter: 1, candidate: 1 }, { voter: 3, candidate: 99 }]), { id: 2, by: "most_matches" });
});

test("no candidates means no Gaffer", () => {
  assert.equal(electGaffer([], [{ voter: 1, candidate: 2 }]), null);
});

test("revenge wins only count a win over whoever won your last meeting, inside the month", () => {
  const d = (s: string) => new Date(s);
  const h = [
    { winner: 2, loser: 1, at: d("2026-10-20") },
    { winner: 1, loser: 2, at: d("2026-11-03") }, // revenge for 1
    { winner: 1, loser: 2, at: d("2026-11-10") }, // not revenge: 1 won the last one
    { winner: 3, loser: 4, at: d("2026-11-11") }, // first meeting
    { winner: 2, loser: 1, at: d("2026-11-12") }, // revenge for 2
  ];
  const r = revengeWins(h, d("2026-11-01"), d("2026-12-01"));
  assert.equal(r.get(1), 1);
  assert.equal(r.get(2), 1);
  assert.equal(r.get(3), undefined);
});

test("ladders and game keys", () => {
  assert.equal(unlocksFor(GAFFER_LADDER, 3).length, 3);
  assert.equal(nextStep(SQUAD_LADDER, 1)?.hits, 3);
  assert.equal(gameKey(" Cricket "), "cricket");
});
