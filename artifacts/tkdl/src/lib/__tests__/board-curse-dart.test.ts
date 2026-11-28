import test from "node:test";
import assert from "node:assert/strict";
import { applyDartCurse, rollDartCurse, makeDart, MISS, dartTierFor, DART_CURSE_IDS, BOARD_ORDER } from "../board-curse-dart.ts";
import { rankFor, nextRank } from "../../../../api-server/src/shared/darts-rules/board-curse-codex.ts";

const curse = (id: string, dead: number[] = []) => {
  for (let i = 0; i < 400; i++) {
    let s = i; const rng = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (const t of [1, 2, 3] as const) { const c = rollDartCurse("ATW", t, [], rng); if (c.id === id) return { ...c, dead: dead.length ? dead : c.dead }; }
  }
  throw new Error(`never rolled ${id}`);
};

test("12 dart curses, a board of 20", () => {
  assert.equal(DART_CURSE_IDS.length, 12);
  assert.equal(new Set(BOARD_ORDER).size, 20);
});

test("drifts move round the board", () => {
  assert.deepEqual(applyDartCurse(curse("wandering-aim"), makeDart(20, 1), 0), makeDart(1, 1));
  assert.deepEqual(applyDartCurse(curse("wandering-aim"), makeDart(20, 1), 1), makeDart(20, 1));
  assert.deepEqual(applyDartCurse(curse("drunk-arm"), makeDart(5, 3), 2), makeDart(20, 3));
  assert.deepEqual(applyDartCurse(curse("mirror-board"), makeDart(20, 1), 0), makeDart(3, 1));
  assert.deepEqual(applyDartCurse(curse("spin-cycle"), makeDart(20, 2), 0), makeDart(12, 2));
  assert.deepEqual(applyDartCurse(curse("drunk-arm"), makeDart(25, 2), 0), makeDart(25, 2));
});

test("misses, dead numbers and flattened rings", () => {
  assert.deepEqual(applyDartCurse(curse("butter-fingers"), makeDart(20, 3), 0), MISS);
  assert.deepEqual(applyDartCurse(curse("missing-dart"), makeDart(20, 3), 2), MISS);
  assert.deepEqual(applyDartCurse(curse("two-lost-darts"), makeDart(20, 3), 1), MISS);
  assert.deepEqual(applyDartCurse(curse("two-lost-darts"), makeDart(20, 3), 2), makeDart(20, 3));
  assert.deepEqual(applyDartCurse(curse("flattened"), makeDart(19, 3), 0), makeDart(19, 1));
  assert.deepEqual(applyDartCurse(curse("thin-wires"), makeDart(19, 2), 0), makeDart(19, 1));
  assert.deepEqual(applyDartCurse(curse("dead-number", [7]), makeDart(7, 2), 0), MISS);
  assert.deepEqual(applyDartCurse(curse("dead-zone", [7, 8]), makeDart(9, 3), 0), makeDart(9, 1));
  assert.deepEqual(applyDartCurse(curse("shackled"), makeDart(9, 2), 0), MISS);
  assert.deepEqual(applyDartCurse(null, makeDart(9, 2), 0), makeDart(9, 2));
});

test("tiers climb with your own visits", () => {
  assert.equal(dartTierFor(1), 1); assert.equal(dartTierFor(4), 2); assert.equal(dartTierFor(7), 3);
});

test("Curse League ranks", () => {
  assert.equal(rankFor(0).id, "apprentice");
  assert.equal(rankFor(99).id, "apprentice");
  assert.equal(rankFor(100).id, "hexer");
  assert.equal(rankFor(250).id, "warlock");
  assert.equal(nextRank(120)?.id, "warlock");
  assert.equal(nextRank(300), null);
});
