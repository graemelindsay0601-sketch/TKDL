import test from "node:test";
import assert from "node:assert/strict";
import { endlessVisitLimit, dailyVisitLimit } from "../board-curse-survival.ts";
import { BOSSES, moveForPhase, effectsForMove } from "../boss-battles-data.ts";
import { phaseFor } from "../darts-rules.ts";

test("Endless visit limits tighten every two clears and stop at a playable floor", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(n => endlessVisitLimit("X01", n)), [18, 18, 17, 17, 16]);
  assert.equal(endlessVisitLimit("X01", 99), 10);
  assert.equal(endlessVisitLimit("CRICKET", 99), 10);
});

test("Daily Curse uses its fixed format-specific limits", () => {
  assert.equal(dailyVisitLimit("X01"), 15);
  assert.equal(dailyVisitLimit("CRICKET"), 17);
});

test("every boss has its content: two moves, an enraged move, lines and a portrait", () => {
  assert.equal(BOSSES.length, 20);
  for (const b of BOSSES) {
    assert.ok(b.moves.length === 2 && b.enrageMove, b.id);
    assert.ok(b.lines.entrance.length && b.lines.phase3 && b.portrait.face && b.lore, b.id);
    if (["ATW", "HALVEIT", "KILLER"].includes(b.gameMode)) assert.ok(b.gameKey, b.id);
  }
});

test("phase moves: move 1, move 2, then the enraged move; Ascension II starts angry", () => {
  const boss = BOSSES.find(entry => entry.id === "old-jinx")!;
  assert.deepEqual([1, 2, 3].map(p => moveForPhase(boss, p as 1 | 2 | 3).name), ["Jinxed", "Shackled", "Full Jinx"]);
  assert.equal(phaseFor(1, 2), 2);
});

test("boss curses last the whole leg (legDuration) and random parts are filled in", () => {
  const lock = BOSSES.find(b => b.id === "lockdown")!;
  const [e] = effectsForMove(moveForPhase(lock, 1));
  assert.equal(e.legDuration, true);
  assert.ok(e.lockdownSegment! >= 10 && e.lockdownSegment! <= 20);
  const wild = effectsForMove(moveForPhase(BOSSES[0], 2))[0];
  assert.ok(wild.wildDartIndex! >= 0 && wild.wildDartIndex! <= 2);
});
