import test from "node:test";
import assert from "node:assert/strict";
import { BLESSINGS, newRun, runChoices, takeChoice, multiplierOf, legScore, runVisitLimit, runEffects, runRules } from "../curse-run.ts";
import { getCursePool } from "../board-curse-data.ts";
import { X01_CURSE_IDS, CRICKET_CURSE_IDS, codexRewards, maxRunScore } from "../../../../api-server/src/shared/darts-rules/board-curse-codex.ts";

test("20 blessings with unique ids", () => {
  assert.equal(BLESSINGS.length, 20);
  assert.equal(new Set(BLESSINGS.map(b => b.id)).size, 20);
});

test("Codex id lists match the real curse pools", () => {
  assert.deepEqual([...X01_CURSE_IDS].sort(), getCursePool("X01").map(c => c.id).sort());
  assert.deepEqual([...CRICKET_CURSE_IDS].sort(), getCursePool("CRICKET").map(c => c.id).sort());
});

test("choices are seeded: same seed, same offer", () => {
  const a = runChoices("2026-11-28", newRun()), b = runChoices("2026-11-28", newRun());
  assert.deepEqual(a.map(c => c.kind === "pact" ? c.pact.id : c.blessing.id), b.map(c => c.kind === "pact" ? c.pact.id : c.blessing.id));
  assert.equal(a.length, 3);
  assert.equal(a.filter(c => c.kind === "pact").length, 1);
});

test("pacts raise the multiplier, clean slate breaks the oldest", () => {
  let s = newRun();
  const pact = runChoices("x", s).find(c => c.kind === "pact")!;
  s = takeChoice(s, pact);
  assert.equal(multiplierOf(s), 1.5);
  s = takeChoice(s, { kind: "blessing", blessing: BLESSINGS.find(b => b.id === "momentum")! });
  assert.equal(multiplierOf(s), 1.75);
  s = takeChoice(s, { kind: "blessing", blessing: BLESSINGS.find(b => b.id === "clean-slate")! });
  assert.equal(s.pacts.length, 0);
  assert.equal(multiplierOf(s), 1.25);
});

test("leg blessings last one leg; run blessings stay", () => {
  let s = takeChoice(newRun(), { kind: "blessing", blessing: BLESSINGS.find(b => b.id === "quick-hands")! });
  assert.equal(runVisitLimit(s), 21);
  s = takeChoice(s, { kind: "blessing", blessing: BLESSINGS.find(b => b.id === "more-time")! });
  assert.equal(runVisitLimit(s), 19);
  s = takeChoice(s, { kind: "blessing", blessing: BLESSINGS.find(b => b.id === "calm-waters")! });
  assert.equal(runRules(s).maxTier, 1);
  s = takeChoice(s, { kind: "blessing", blessing: BLESSINGS.find(b => b.id === "lucky-treble")! });
  assert.equal(runRules(s).maxTier, 3);
});

test("effects: blessings help you, pacts are curses on you, all leg-long", () => {
  let s = takeChoice(newRun(), { kind: "blessing", blessing: BLESSINGS.find(b => b.id === "lucky-treble")! });
  s = takeChoice(s, runChoices("y", s).find(c => c.kind === "pact")!);
  const fx = runEffects(s);
  assert.equal(fx.length, 2);
  assert.ok(fx.every(e => e.legDuration && e.affectsPlayer === 0));
  assert.equal(fx[0].trebleMultiplier, 1.15);
  assert.ok(!("oneShotTrebleMultiplier" in fx[0]));
});

test("scores and the server's ceiling agree", () => {
  assert.equal(legScore(10, 18, 1), 1000);
  assert.equal(legScore(20, 18, 2), 400);
  assert.ok(legScore(1, 21, 1 + 1 * 0.5 + 1 * 0.25) <= maxRunScore(1));
});

test("codex rewards need a full board", () => {
  assert.deepEqual(codexRewards({ X01: X01_CURSE_IDS.slice(1), CRICKET: [] }), []);
  assert.deepEqual(codexRewards({ X01: X01_CURSE_IDS, CRICKET: [] }), ["tag-bc-hexbreaker"]);
  assert.deepEqual(codexRewards({ X01: X01_CURSE_IDS, CRICKET: CRICKET_CURSE_IDS }), ["tag-bc-hexbreaker", "frame-bc-warded", "name-bc-cursebound"]);
});
