import test from "node:test";
import assert from "node:assert/strict";
import { createCurseRandom, rollCurse } from "../board-curse-data.ts";

function dailySequence(seed: string) {
  const rng = createCurseRandom(seed);
  const recent: string[] = [];
  return Array.from({ length: 9 }, (_, index) => {
    const tier = index < 3 ? 1 : index < 6 ? 2 : 3;
    const rolled = rollCurse("X01", tier, recent, rng);
    recent.unshift(rolled.def.id);
    recent.splice(3);
    return { id: rolled.def.id, description: rolled.description, effect: rolled.effect };
  });
}

test("Daily Curse produces the same full sequence from the same date seed", () => {
  assert.deepEqual(dailySequence("2026-10-03:X01"), dailySequence("2026-10-03:X01"));
});

test("Daily Curse changes when the date seed changes", () => {
  assert.notDeepEqual(dailySequence("2026-10-03:X01"), dailySequence("2026-10-04:X01"));
});
