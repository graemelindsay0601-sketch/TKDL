import { test } from "node:test";
import assert from "node:assert/strict";
import { botX01Visit, BOT_LEVELS, type ShadowProfile } from "../bot-engine.ts";

const base: ShadowProfile = { playerId: 1, playerName: "G", primarySeg: 20, treblePct: 0.2, singlePct: 0.5, checkoutSegs: [16], doubleHitPct: 0.3, computedAvg: 60, totalDarts: 500 };

test("a v2 shadow replays its own scoring darts", () => {
  // Only ever threw T19 and S5 when scoring: every scoring dart must be one of those.
  const p: ShadowProfile = { ...base, scoringDist: [{ seg: 19, mult: 3, n: 50 }, { seg: 5, mult: 1, n: 50 }] };
  for (let i = 0; i < 200; i++) {
    for (const d of botX01Visit(501, true, { ...BOT_LEVELS.club, shadowProfile: p })) {
      assert.ok((d.segment === 19 && d.multiplier === 3) || (d.segment === 5 && d.multiplier === 1), JSON.stringify(d));
    }
  }
});

test("pressure finishing uses the league rate", () => {
  const p: ShadowProfile = { ...base, doubleRates: { "16": 0 }, pressureDoubleHitPct: 1, scoringDist: [{ seg: 20, mult: 1, n: 100 }] };
  const cfg = { ...BOT_LEVELS.club, shadowProfile: p };
  // 32 left: aims D16. Calm: never hits (rate 0 on D16). Under pressure: always hits.
  for (let i = 0; i < 50; i++) assert.ok(!botX01Visit(32, true, cfg).some(d => d.segment === 16 && d.multiplier === 2));
  for (let i = 0; i < 50; i++) assert.ok(botX01Visit(32, true, cfg, { pressure: true }).some(d => d.segment === 16 && d.multiplier === 2));
});

test("a thin shadow plays like a standard bot at the player's average", () => {
  const p: ShadowProfile = { ...base, thin: true, computedAvg: 90 };
  let pts = 0;
  for (let i = 0; i < 400; i++) pts += botX01Visit(501, true, { ...BOT_LEVELS.beginner, shadowProfile: p }).reduce((s, d) => s + d.value, 0);
  assert.ok(pts / 400 > 60, `avg ${pts / 400}`);
});
