import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProfile, eraOptions, dartsForEra, scoutingReport, type LoggedDart } from "../shadow-profile.ts";

const d = (seg: number, mult: number, at: string, phase = "scoring", source: "practice" | "league" = "practice"): LoggedDart =>
  ({ seg, mult, val: seg === 25 ? (mult === 2 ? 50 : 25) : seg * mult, phase, at, source });
const many = (n: number, f: (i: number) => LoggedDart) => Array.from({ length: n }, (_, i) => f(i));

test("scoring spread is replayed from real darts, misses as seg 0", () => {
  const darts = [...many(6, () => d(20, 3, "2026-11-01")), ...many(3, () => d(20, 1, "2026-11-01")), d(1, 1, "2026-11-01"), d(0, 0, "2026-11-01")];
  const p = buildProfile(darts);
  assert.deepEqual(p.scoringDist[0], { seg: 20, mult: 3, n: 6 });
  assert.ok(p.scoringDist.some(x => x.seg === 0 && x.n === 1));
  assert.equal(p.primarySeg, 20);
  assert.equal(p.treblePct, 0.67);
});

test("doubles: per-double rate needs 8 attempts; trebles in the checkout phase aren't attempts", () => {
  const co = [...many(4, () => d(16, 2, "2026-11-01", "checkout")), ...many(4, () => d(16, 1, "2026-11-01", "checkout")), d(20, 3, "2026-11-01", "checkout"), d(8, 2, "2026-11-01", "checkout")];
  const p = buildProfile(co);
  assert.equal(p.doubleRates["16"], 0.5);
  assert.equal(p.doubleRates["8"], undefined);
  assert.equal(p.doubleHitPct, 0.56); // 5 / 9
});

test("pressure finishing comes from league darts only", () => {
  const prac = many(10, i => d(16, i < 5 ? 2 : 1, "2026-11-01", "checkout"));
  const lg = many(10, i => d(16, i < 2 ? 2 : 1, "2026-11-01", "checkout", "league"));
  const p = buildProfile([...prac, ...lg]);
  assert.equal(p.pressureDoubleHitPct, 0.2);
  assert.equal(p.leagueDarts, 10);
  assert.ok(scoutingReport(p).some(r => r.label === "Under pressure" && r.tone === "bad"));
});

test("eras: peak month, named months, current window", () => {
  const oct = many(200, () => d(20, 3, "2026-10-10"));
  const nov = many(200, () => d(20, 1, "2026-11-10"));
  const opts = eraOptions([...oct, ...nov], new Date("2026-11-27T12:00:00Z"));
  assert.ok(opts.find(o => o.era === "peak")!.label.includes("October 2026"));
  assert.deepEqual(opts.filter(o => o.era.startsWith("month:")).map(o => o.era), ["month:2026-11", "month:2026-10"]);
  assert.equal(dartsForEra([...oct, ...nov], "month:2026-10").darts.length, 200);
  assert.equal(buildProfile([...oct, ...nov], "peak").computedAvg, 180);
  // current: last 60 days has all 400
  assert.equal(dartsForEra([...oct, ...nov], "current", new Date("2026-11-27T12:00:00Z")).darts.length, 400);
});
