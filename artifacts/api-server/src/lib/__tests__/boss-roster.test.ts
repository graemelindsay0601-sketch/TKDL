import { test } from "node:test";
import assert from "node:assert/strict";
import { BOSS_ROSTER, TOTAL_BOSSES, bossUnlocked, bossHealth, phaseFor, visitImpact, PERKS, unlockedPerks, BOSS_LOOT, lootFor, nemesisOf } from "../../shared/darts-rules/index.ts";

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
  assert.deepEqual([60, 100, 140, 180].map(v => visitImpact(v)), ["none", "stun", "stun", "break"]);
});

test("perks: thick skin and shield breaker change the thresholds; cool head holds the anger off", () => {
  assert.equal(visitImpact(85, "X01", "thick-skin"), "stun");
  assert.equal(visitImpact(140, "X01", "shield-breaker"), "break");
  assert.equal(visitImpact(6, "CRICKET"), "stun");
  assert.equal(visitImpact(8, "CRICKET", "shield-breaker"), "break");
  assert.equal(phaseFor(0.6, 0, true), 1);
  assert.equal(phaseFor(0.3, 0, true), 2);
  assert.equal(phaseFor(0.2, 0, true), 3);
  assert.deepEqual(unlockedPerks(["rookie-wall", "lockdown"]).map(p => p.id), ["iron-will", "thick-skin"]);
  for (const p of PERKS) assert.ok(BOSS_ROSTER.some(b => b.id === p.from), p.id);
});

test("loot: one exclusive unlock per boss, -bb- ids, unique", () => {
  assert.equal(BOSS_LOOT.length, 20);
  assert.equal(new Set(BOSS_LOOT.map(l => l.id)).size, 20);
  for (const b of BOSS_ROSTER) assert.match(lootFor(b.id)!.id, /-bb-/);
});

test("nemesis: the boss with the most losses, from 3", () => {
  assert.equal(nemesisOf({ "old-jinx": { attempts: 3, wins: 1 } }), null);
  assert.deepEqual(nemesisOf({ "old-jinx": { attempts: 5, wins: 0 }, lockdown: { attempts: 4, wins: 0 } }), { bossId: "old-jinx", losses: 5 });
  // Beaten it: your Nemesis moves on to the next one.
  assert.deepEqual(nemesisOf({ "old-jinx": { attempts: 6, wins: 1 }, lockdown: { attempts: 4, wins: 0 } }, ["old-jinx"]), { bossId: "lockdown", losses: 4 });
});
