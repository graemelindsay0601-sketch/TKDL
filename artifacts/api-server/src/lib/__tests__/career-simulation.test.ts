import { test } from "node:test";
import assert from "node:assert/strict";
import { balanceReport, calibratedNpc, describe, HARNESS_SEED } from "../../career/world/harness.ts";
import { generateInitialWorld } from "../../career/world/generation.ts";
import { createPerformance, finishingProbability } from "../../career/world/performance.ts";
import { simulateNpcMatch } from "../../career/world/simulation.ts";
import { scopedRandom } from "../../career/world/random.ts";
import { formAfterMatch, regressForm } from "../../career/world/form.ts";
import { toCareerBotConfig } from "../../career/world/bot-adapter.ts";
import type { Npc, MatchContext } from "../../career/world/types.ts";

const seed = HARNESS_SEED;
const world = generateInitialWorld(seed, 1);
const context: MatchContext = { category: "floor", roundImportance: 0.2, elimination: false };
const players: [Npc, Npc] = [calibratedNpc(world[0], 65), calibratedNpc(world[1], 55)];
const input = { players, context, seed, generationVersion: 1, matchKey: "fixture", difficulty: "STANDARD" as const, format: { bestOf: 7, firstThrow: 0 as const } };

test("10,000 controlled matches expose upsets and stronger long-format results without exact percentage targets", () => {
  const report = balanceReport();
  assert.equal(report.matches, 10000);
  for (let i = 0; i < report.groups.length; i += 2) {
    const short = report.groups[i], long = report.groups[i + 1];
    assert.ok(short.strongerWinPct > 55 && short.strongerWinPct < 99, JSON.stringify(short));
    assert.ok(short.upsetPct > 0);
    assert.ok(long.strongerWinPct > short.strongerWinPct + 3);
    assert.ok(short.averages[0].mean > short.averages[1].mean);
  }
});

test("simulation reproduces inputs and stats reconcile to legal darts and leg results", () => {
  const original = structuredClone(input);
  const result = simulateNpcMatch(input);
  assert.deepEqual(result, simulateNpcMatch(input));
  assert.deepEqual(input, original);
  for (let i = 0; i < 200; i++) {
    const match = simulateNpcMatch({ ...input, matchKey: `stats:${i}` });
    assert.ok(match.legs.length >= 4 && match.legs.length <= 7);
    assert.ok(match.participants.includes(match.winnerId));
    assert.notEqual(match.winnerId, match.loserId);
    for (const who of [0, 1] as const) {
      const stats = match.stats[who];
      for (const value of Object.values(stats)) assert.ok(Number.isFinite(value) && value >= 0);
      assert.equal(stats.checkouts, stats.legsWon);
      assert.equal(stats.legsWon, match.legs.filter(leg => leg.winner === who).length);
      assert.equal(stats.points, match.legs.reduce((sum, leg) => sum + leg.points[who], 0));
      assert.equal(stats.darts, match.legs.reduce((sum, leg) => sum + leg.darts[who], 0));
      assert.equal(stats.average, stats.points / stats.darts * 3);
      assert.ok(stats.average <= 180 && stats.checkoutPercentage <= 100 && stats.highestCheckout <= 170);
      assert.ok(stats.checkouts <= stats.doubleAttempts && stats.maximums * 3 <= stats.darts);
    }
    match.legs.forEach((leg, index) => {
      assert.equal(leg.firstThrow, index % 2);
      assert.equal(leg.points[leg.winner], 501);
      assert.ok(leg.points[1 - leg.winner] < 501);
    });
  }
});

test("invalid ability/context/format cannot enter simulation", () => {
  assert.throws(() => simulateNpcMatch({ ...input, format: { bestOf: 8, firstThrow: 0 } }));
  assert.throws(() => simulateNpcMatch({ ...input, players: [players[0], players[0]] }));
  assert.throws(() => simulateNpcMatch({ ...input, players: [{ ...players[0], ability: { ...players[0].ability, scoring: Infinity } }, players[1]] }));
  assert.throws(() => simulateNpcMatch({ ...input, context: { ...context, roundImportance: 2 } }));
});

test("high consistency narrows variance; bounded form cannot erase the ability hierarchy", () => {
  const low: number[] = [], high: number[] = [], hot: number[] = [], cold: number[] = [];
  for (let i = 0; i < 2000; i++) {
    const sample = (npc: Npc) => createPerformance(npc, context, "STANDARD", scopedRandom(seed, 1, "spread", i)).effective.scoring;
    low.push(sample({ ...players[0], ability: { ...players[0].ability, consistency: 10 } }));
    high.push(sample({ ...players[0], ability: { ...players[0].ability, consistency: 95 } }));
    hot.push(sample({ ...players[0], form: 1 }));
    cold.push(sample({ ...players[0], form: -1 }));
  }
  assert.ok(describe(low).sd > describe(high).sd * 2);
  const formDifference = describe(hot).mean - describe(cold).mean;
  assert.ok(formDifference > 0 && formDifference < 10);
});

test("pressure primarily burdens finishing and consistency; persistent context tendencies stay subtle", () => {
  const npc = { ...players[0], ability: { ...players[0].ability, pressure: 10 } };
  const local = createPerformance(npc, { category: "local", roundImportance: 0, elimination: false }, "STANDARD", scopedRandom(seed, 1, "pressure"));
  const major = createPerformance(npc, { category: "major", roundImportance: 1, elimination: true }, "STANDARD", scopedRandom(seed, 1, "pressure"));
  assert.ok(major.effective.finishing < local.effective.finishing);
  assert.ok(major.effective.consistency < local.effective.consistency);
  assert.ok(local.effective.finishing - major.effective.finishing > local.effective.scoring - major.effective.scoring);
  const calm = createPerformance({ ...npc, ability: { ...npc.ability, pressure: 100 } }, { category: "major", roundImportance: 1, elimination: true }, "STANDARD", scopedRandom(seed, 1, "pressure"));
  assert.ok(calm.effective.finishing > major.effective.finishing);
  const specialist = createPerformance({ ...npc, tendencies: { ...npc.tendencies, floor: 2 } }, context, "STANDARD", scopedRandom(seed, 1, "specialist"));
  const normal = createPerformance(npc, context, "STANDARD", scopedRandom(seed, 1, "specialist"));
  assert.equal(specialist.effective.scoring - normal.effective.scoring, 2);
});

test("throw advantage emerges from alternating turns; clutch changes probability without guaranteeing wins", () => {
  const even: [Npc, Npc] = [calibratedNpc(world[0], 60), calibratedNpc(world[1], 60)];
  let firstThrowWins = 0, clutchWins = 0;
  const clutch: [Npc, Npc] = [{ ...even[0], ability: { ...even[0].ability, clutch: 100 } }, { ...even[1], ability: { ...even[1].ability, clutch: 1 } }];
  for (let i = 0; i < 2000; i++) {
    const format = { bestOf: 1, firstThrow: (i % 2) as 0 | 1 };
    const equalResult = simulateNpcMatch({ ...input, players: even, format, matchKey: `throw:${i}` });
    if (equalResult.winnerId === even[format.firstThrow].id) firstThrowWins++;
    if (simulateNpcMatch({ ...input, players: clutch, format, matchKey: `clutch:${i}` }).winnerId === clutch[0].id) clutchWins++;
  }
  assert.ok(firstThrowWins > 1050 && firstThrowWins < 1700, String(firstThrowWins));
  assert.ok(clutchWins > 0 && clutchWins < 2000);
  const profile = createPerformance(clutch[0], context, "STANDARD", scopedRandom(seed, 1, "clutch-p"));
  assert.ok(finishingProbability(profile, true) > finishingProbability(profile, false));
  assert.ok(finishingProbability(profile, true) < 1);
});

test("all difficulty presets preserve expected hierarchy and do not adapt to human results", () => {
  for (const difficulty of ["ACCESSIBLE", "STANDARD", "CHALLENGING"] as const) {
    for (const [strong, weak] of [[73, 59], [59, 43], [43, 28]]) {
      const pair: [Npc, Npc] = [calibratedNpc(world[0], strong), calibratedNpc(world[1], weak)];
      let wins = 0;
      for (let i = 0; i < 300; i++) {
        const result = simulateNpcMatch({ ...input, players: pair, difficulty, matchKey: `preset:${strong}:${i}` });
        if (result.winnerId === pair[0].id) wins++;
      }
      assert.ok(wins > 165, `${difficulty}/${strong}/${weak}: ${wins}`);
    }
  }
});

test("form tracks performance, not win/loss; it regresses and remains bounded", () => {
  const result = simulateNpcMatch(input);
  const profile = result.performance[0];
  const strongDefeat = { ...result.stats[0], average: profile.expectedAverage + 20, checkoutPercentage: 60, legsWon: 0 };
  const luckyWin = { ...result.stats[0], average: profile.expectedAverage - 20, checkoutPercentage: 5, legsWon: 4 };
  assert.ok(formAfterMatch(0, profile, strongDefeat) > 0);
  assert.ok(formAfterMatch(0, profile, luckyWin) < 0);
  let form = 1;
  for (let i = 0; i < 100; i++) form = formAfterMatch(form, profile, strongDefeat);
  assert.ok(form <= 1);
  assert.ok(Math.abs(regressForm(form, 1)) < Math.abs(form));
  const bot = toCareerBotConfig(profile);
  for (const value of Object.values(bot)) assert.ok(Number.isFinite(value) && value > 0);
  assert.ok(bot.checkoutPct < 1 && bot.hitAcc < 1);
  assert.deepEqual(Object.keys(bot).sort(), ["avg", "checkoutPct", "hitAcc", "sd"]);
});
