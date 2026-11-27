import { test } from "node:test";
import assert from "node:assert/strict";
import { targetFor, pickKind, monthKey, shiftMonth, unlocksFor, nextStep, pairKey } from "../league-target.ts";

test("target is the last 2 months' average plus 10%, rounded up", () => {
  assert.equal(targetFor("matches", [24, 28]), 29);
  assert.equal(targetFor("matches", [20]), 22);
});

test("targets stay between the floor and the cap", () => {
  assert.equal(targetFor("matches", [5, 6]), 15);
  assert.equal(targetFor("matches", [80, 90]), 40);
  assert.equal(targetFor("players", [12, 12]), 11);
});

test("no history means the floor", () => {
  assert.equal(targetFor("matches", []), 15);
  assert.equal(targetFor("matches", [0, 0]), 15);
});

test("a quiet month doesn't drag the average down to zero", () => {
  assert.equal(targetFor("matches", [0, 30]), 33);
});

test("180s only rotate in when the league is reaching the floor", () => {
  const none = [{ matches: 25, pairings: 5, oneEighties: 0, players: 3 }];
  for (let m = 1; m <= 12; m++) assert.equal(pickKind(`2026-${String(m).padStart(2, "0")}`, none), "matches");
  const busy = [{ matches: 25, pairings: 20, oneEighties: 4, players: 10 }];
  const kinds = new Set(Array.from({ length: 12 }, (_, i) => pickKind(`2027-${String(i + 1).padStart(2, "0")}`, busy)));
  assert.deepEqual([...kinds].sort(), ["matches", "oneEighties", "pairings", "players"]);
});

test("month keys use London time and shift across years", () => {
  assert.equal(monthKey(new Date("2026-10-31T23:30:00Z")), "2026-10");
  assert.equal(monthKey(new Date("2026-07-31T23:30:00Z")), "2026-08");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});

test("ladder unlocks build up and the next step is shown", () => {
  assert.equal(unlocksFor(0).length, 0);
  assert.equal(unlocksFor(3).length, 2);
  assert.equal(nextStep(3)?.hits, 6);
  assert.equal(nextStep(12), null);
  assert.equal(pairKey(5, 2), pairKey(2, 5));
});
