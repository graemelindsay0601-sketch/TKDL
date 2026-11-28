import { test } from "node:test";
import assert from "node:assert/strict";
import { BOSS_ROSTER, TOTAL_BOSSES, bossUnlocked, bossHealth, phaseFor, visitImpact } from "../../shared/darts-rules/index.ts";

test("20 bosses, 5 per world, orders 1..20, ids unique, the original six kept", () => {
  assert.equal(TOTAL_BOSSES, 20);
  assert.deepEqual(BOSS_ROSTER.map(b => b.order), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.equal(new Set(BOSS_ROSTER.map(b => b.id)).size, 20);
  for (const w of ["pub", "shop", "arena", "void"]) assert.equal(BOSS_ROSTER.filter(b => b.world === w).length, 5);
  for (const id of ["rookie-wall", "old-jinx", "the-warden", "lockdown", "the-annihilator", "the-reckoning"]) assert.ok(BOSS_ROSTER.some(b => b.id === id));
  assert.equal(BOSS_ROSTER.at(-1)!.id, "the-reckoning");
});

test("unlocks: the previous boss, or already beaten (old clears stay playable)", () => {
  assert.ok(bossUnlocked("rookie-wall", []));
  assert.ok(!bossUnlocked("quizmaster", ["rookie-wall"]));
  assert.ok(bossUnlocked("quizmaster", ["rookie-wall", "old-jinx"]));
  // Someone who beat the old 6-boss ladder: The Warden moved to 6 behind a new boss, but stays playable.
  assert.ok(bossUnlocked("the-warden", ["rookie-wall", "old-jinx", "the-warden"]));
  assert.ok(!bossUnlocked("nope", ["rookie-wall"]));
});

test("health: 501 needs two legs, and a lost leg heals the boss", () => {
  assert.equal(bossHealth({ mode: "X01", start: 501, mine: 501, legsWon: 0 }), 1);
  assert.equal(bossHealth({ mode: "X01", start: 501, mine: 0, legsWon: 1 }), 0);
  assert.equal(bossHealth({ mode: "X01", start: 501, mine: 501, legsWon: 1 }), 0.5);
  assert.equal(bossHealth({ mode: "CRICKET", marks: 21, legsWon: 1 }), 0);
  assert.equal(bossHealth({ mode: "ATW", mine: 21, of: 21 }), 0);
  assert.equal(bossHealth({ mode: "KILLER", theirs: 1, of: 3 }), 1 / 3);
  assert.equal(bossHealth({ mode: "HALVEIT", mine: 0, theirs: 0, round: 0, rounds: 8 }), 0.5);
  assert.ok(bossHealth({ mode: "HALVEIT", mine: 120, theirs: 20, round: 5, rounds: 8 }) < 0.2);
});

test("phases at two thirds and one third; ascension angrier sooner; visits stun or break", () => {
  assert.deepEqual([1, 0.66, 0.34, 0.33, 0].map(h => phaseFor(h)), [1, 2, 2, 3, 3]);
  assert.equal(phaseFor(0.5, 1), 3);
  assert.equal(phaseFor(1, 2), 2);
  assert.deepEqual([60, 100, 140, 180].map(visitImpact), ["none", "stun", "stun", "break"]);
});
