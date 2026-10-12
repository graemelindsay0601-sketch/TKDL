import { test } from "node:test";
import assert from "node:assert/strict";
import { replay, throwDart, createMatch, corkDart, type X01Format, type Dart } from "../../shared/darts-rules/index.ts";
import { planBotX01Visit, botOptionsFor, seededRandom } from "../../shared/darts-rules/index.ts";
import { assessCapability, softTip501, knockout501, a2MatchFormat, liveMatchFormat } from "../../career/calendar/formats.ts";
import { simulateNpcMatch } from "../../career/world/simulation.ts";
import { calibratedNpc, HARNESS_SEED } from "../../career/world/harness.ts";
import { generateInitialWorld } from "../../career/world/generation.ts";
import type { Npc, MatchContext } from "../../career/world/types.ts";

/** Soft-tip (DARTSLIVE-style) 501: fat bull, master out, 15-round limit decided by a cork. */
const SOFT: X01Format = { startingScore: 501, inRule: "STRAIGHT", outRule: "MASTER", unit: "LEGS", bestOfLegs: 3, bull: "FAT", roundLimit: 15 };
const d = (segment: number, multiplier: 1 | 2 | 3): Dart => ({ segment, multiplier, value: segment === 25 ? (multiplier === 2 ? 50 : 25) : segment * multiplier });
const T20 = d(20, 3), MISS = d(0, 1);

test("fat bull: an outer bull scores 50 and finishes; master out finishes on a treble", () => {
  let soft = createMatch({ ...SOFT, startingScore: 101 }, 0);
  soft = throwDart(soft, d(17, 1)).state; soft = throwDart(soft, d(17, 2)).state; // 101-17-34 = 50
  assert.equal(throwDart(soft, d(25, 1)).outcome, "LEG_WON", "outer bull = fat bull 50, a valid finish");
  let treble = createMatch({ ...SOFT, startingScore: 101 }, 0);
  treble = throwDart(treble, d(20, 2)).state; treble = throwDart(treble, d(1, 1)).state; // 60 left
  assert.equal(throwDart(treble, T20).outcome, "LEG_WON", "master out: treble 20 finishes 60");
  let steel = createMatch({ ...SOFT, startingScore: 101, outRule: "DOUBLE", bull: undefined, roundLimit: undefined }, 0);
  steel = throwDart(steel, d(17, 1)).state; steel = throwDart(steel, d(17, 2)).state;
  assert.equal(throwDart(steel, d(25, 1)).state.scores[0], 25, "steel-tip outer bull is still 25");
});

test("round limit: after 15 visits each the leg is decided by a cork, not the remaining score", () => {
  const darts: Dart[] = Array.from({ length: 15 * 2 * 3 }, () => d(1, 1));
  let s = replay(SOFT, 0, darts);
  assert.ok(s.cork, "cork starts at the round limit");
  assert.equal(s.turn, 0, "leg starter corks first");
  s = throwDart(s, corkDart("OUTER")).state;
  const out = throwDart(s, corkDart("INNER"));
  assert.equal(out.outcome, "LEG_WON");
  assert.equal(out.state.legsLog[0].winner, 1);
  assert.equal(out.state.legsLog[0].cork, true);
  // Same ring: re-throw in reverse order.
  let t = replay(SOFT, 0, darts);
  t = throwDart(t, corkDart("OUTER")).state; t = throwDart(t, corkDart("OUTER")).state;
  assert.equal(t.cork?.throws.length, 2); assert.equal(t.turn, 1);
  assert.throws(() => throwDart(t, d(20, 1)), /cork dart/);
  assert.equal(replay(SOFT, 0, [...darts, corkDart("OUTER"), corkDart("INNER")]).legNo, 2, "a replayed log reproduces the cork");
});

test("the soft-tip bot plans master-out finishes and never plans a 25 under the fat bull", () => {
  const cfg = { avg: 60, sd: 15, checkoutPct: 1, hitAcc: 0.5 };
  for (const rem of [60, 57, 50, 99, 141, 180]) {
    const plan = planBotX01Visit(rem, cfg, { ...botOptionsFor(SOFT), rng: seededRandom("t", rem) });
    let s = createMatch({ ...SOFT, startingScore: rem }, 0);
    let outcome = "";
    for (const x of plan) { if (s.complete || s.legNo > 1) break; const r = throwDart(s, x); s = r.state; outcome = r.outcome; }
    assert.ok(["LEG_WON", "MATCH_WON"].includes(outcome), `${rem}: ${plan.map(p => p.label).join(" ")}`);
  }
  for (let i = 0; i < 200; i++) {
    const plan = planBotX01Visit(400, { ...cfg, checkoutPct: 0 }, { ...botOptionsFor(SOFT), rng: seededRandom("s", i) });
    assert.ok(plan.every(p => !(p.segment === 25 && p.multiplier === 1)));
  }
});

test("soft-tip formats are executable end to end; other master-out formats stay benched", () => {
  const f = softTip501([5, 7, 9], "floor");
  assert.equal(assessCapability(f).executable, true);
  assert.equal(assessCapability({ ...knockout501([5], "local"), outRule: "MASTER" }).executable, false);
  assert.deepEqual(liveMatchFormat(f, 5), { startingScore: 501, inRule: "STRAIGHT", outRule: "MASTER", bull: "FAT", roundLimit: 15, unit: "LEGS", bestOfLegs: 5 });
  assert.deepEqual(a2MatchFormat(knockout501([5], "local"), 5, 0), { bestOf: 5, firstThrow: 0 }, "steel-tip requests are unchanged");
});

test("NPC soft-tip matches finish on doubles, trebles and bulls, and corks decide round-limit legs", () => {
  const world = generateInitialWorld(HARNESS_SEED, 1);
  const base = { context: { category: "floor", roundImportance: 0.5, elimination: true } as MatchContext, seed: HARNESS_SEED, generationVersion: 1, difficulty: "STANDARD" as const };
  const format = { bestOf: 9, firstThrow: 0 as const, outRule: "MASTER" as const, bull: "FAT" as const, roundLimit: 15 };
  let legs = 0, corks = 0, trebleOrBull = 0;
  for (let i = 0; i < 60; i++) {
    const strong = i % 2 === 0;
    const players: [Npc, Npc] = [calibratedNpc(world[i], strong ? 70 : 35), calibratedNpc(world[i + 100], strong ? 66 : 32)];
    const r = simulateNpcMatch({ ...base, players, matchKey: `soft:${i}`, format });
    assert.equal(Math.max(r.stats[0].legsWon, r.stats[1].legsWon), 5);
    for (const leg of r.legs) { legs++; if (leg.checkout === 0) corks++; else if (leg.checkout === 50 || (leg.checkout <= 60 && leg.checkout % 3 === 0 && (leg.checkout > 40 || leg.checkout % 2 === 1))) trebleOrBull++; }
  }
  assert.ok(trebleOrBull > 0, "some legs finish on a treble or the bull");
  assert.ok(corks > 0 && corks < legs * 0.25, `round-limit corks happen but are rare (${corks}/${legs})`);
  const steel = simulateNpcMatch({ ...base, players: [calibratedNpc(world[0], 66), calibratedNpc(world[1], 60)], matchKey: "steel", format: { bestOf: 7, firstThrow: 0 } });
  assert.ok(steel.legs.every(l => l.checkout > 0));
});

test("event database v8: every soft-tip event plays soft-tip rules; v7 is unchanged", async () => {
  const { catalogueFor } = await import("../../career/calendar/catalogue.ts");
  const { CURRENT_EVENT_DATABASE_VERSION } = await import("../../career/calendar/config.ts");
  assert.equal(CURRENT_EVENT_DATABASE_VERSION, 8);
  const v8 = catalogueFor(8), v7 = catalogueFor(7);
  assert.equal(v8.length, v7.length);
  for (const d of v8.filter(x => x.circuit === "SOFT_TIP")) {
    assert.deepEqual([d.format.outRule, d.format.bull, d.format.roundLimit], ["MASTER", "FAT", 15], d.key);
    assert.equal(assessCapability(d.format).executable, true, d.key);
    assert.match(d.content!.summary!, /master out .*fat bull .*15-round limit/, d.key);
    assert.doesNotMatch(d.content!.summary!, /double to finish/);
  }
  assert.ok(v7.filter(x => x.circuit === "SOFT_TIP").every(d => d.format.outRule === "DOUBLE" && d.format.bull === undefined));
  const steel = (list: typeof v8) => list.filter(x => x.circuit !== "SOFT_TIP").map(d => JSON.stringify({ ...d, eventDatabaseVersion: 0 }));
  assert.deepEqual(steel(v8), steel(v7), "only soft-tip events change in v8");
});

test("live sessions: the server verifies the bot's soft-tip visits and cork darts and rejects a tampered cork", async () => {
  const { verifyBotVisits } = await import("../../career/live/service.ts");
  const { botCorkDart, corkThrowers } = await import("../../shared/darts-rules/index.ts");
  const bot = { avg: 25, sd: 6, checkoutPct: 0, hitAcc: 0.4 }, seed = "soft-session";
  const format: X01Format = { ...SOFT, bestOfLegs: 1 };
  let s = createMatch(format, 0); const log: Dart[] = []; let botVisit = 0;
  const push = (x: Dart) => { log.push(x); s = throwDart(s, x).state; };
  while (!s.cork) {
    if (s.turn === 0) push(d(1, 1));
    else for (const x of planBotX01Visit(s.scores[1], bot, { ...botOptionsFor(format), opened: true, rng: seededRandom(seed, "bot-visit", botVisit++) })) { if (s.turn !== 1 || s.cork) break; push(x); }
  }
  while (s.cork) {
    const throws = s.cork.throws, who = corkThrowers(s.cork.starter, [...throws, "MISS"]).at(-1)!;
    push(who === 0 ? corkDart("OUTER") : botCorkDart(bot, seed, s.legNo, throws.length));
  }
  assert.ok(s.complete && s.legsLog[0].cork, "the leg (and match) was decided by the cork");
  assert.doesNotThrow(() => verifyBotVisits(replay(format, 0, log), bot, seed));
  const corkStart = log.length - s.corkLog[0].darts.length;
  const botIndex = corkThrowers(0, s.corkLog[0].darts.map(x => x.segment === 25 ? (x.multiplier === 2 ? "INNER" : "OUTER") : "MISS")).indexOf(1);
  const tampered = log.slice(); const original = tampered[corkStart + botIndex];
  tampered[corkStart + botIndex] = original.segment === 0 ? corkDart("INNER") : corkDart("MISS");
  assert.throws(() => verifyBotVisits(replay(format, 0, tampered), bot, seed), /cork/);
});
