import test from "node:test";
import assert from "node:assert/strict";
import { endlessVisitLimit, dailyVisitLimit } from "../board-curse-survival.ts";
import { BOSSES, getBossEffectsForLeg } from "../boss-battles-data.ts";

test("Endless visit limits tighten every two clears and stop at a playable floor", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(n => endlessVisitLimit("X01", n)), [18, 18, 17, 17, 16]);
  assert.equal(endlessVisitLimit("X01", 99), 10);
  assert.equal(endlessVisitLimit("CRICKET", 99), 10);
});

test("Daily Curse uses its fixed format-specific limits", () => {
  assert.equal(dailyVisitLimit("X01"), 15);
  assert.equal(dailyVisitLimit("CRICKET"), 17);
});

test("Ascension II combines a regular boss move with its enrage move", () => {
  const boss = BOSSES.find(entry => entry.id === "old-jinx")!;
  const standard = getBossEffectsForLeg(boss, 1, 0);
  const ascended = getBossEffectsForLeg(boss, 1, 2);
  assert.equal(standard.effects.length, 1);
  assert.equal(ascended.isEnrage, true);
  assert.equal(ascended.effects.length, 2);
  assert.match(ascended.move.name, /Ascended/);
});
