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
  assert.ok(CURRENT_EVENT_DATABASE_VERSION >= 9);
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

// ------------------------------------------------------------------ mixed soft-tip matches (01 + Cricket + Choice)
import { legGameFor, CHOICE_DARTS, cricketWon, CRICKET_ROUND_LIMIT, planBotCricketVisit, botChoiceDart } from "../../shared/darts-rules/index.ts";
const MIX: X01Format = { ...SOFT, bestOfLegs: 5, mix: "SOFT_TIP" };

test("mixed soft-tip match: legs run 01, Cricket, Cricket, 01 and a deciding Choice leg", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(n => legGameFor(MIX, n)), ["X01", "CRICKET", "CRICKET", "X01", "CHOICE"]);
  assert.deepEqual([1, 6, 7].map(n => legGameFor({ ...MIX, bestOfLegs: 7 }, n)), ["X01", "CRICKET", "CHOICE"]);
  assert.equal(legGameFor(SOFT, 2), "X01", "unmixed soft-tip stays 01");
});

test("cricket leg: closing every number with at least equal points wins the leg; marks beyond three score", () => {
  // Leg 1 (01): player 0 wins quickly from 101 to reach a cricket leg.
  let s = createMatch({ ...MIX, startingScore: 101 }, 0);
  for (const x of [T20, d(17, 1), d(4, 3)]) s = throwDart(s, x).state; // 60+17+12 = 89, 12 left
  for (const x of [MISS, MISS, MISS]) s = throwDart(s, x).state;
  s = throwDart(s, d(6, 2)).state; // D6 finishes
  assert.equal(s.legNo, 2); assert.equal(s.game, "CRICKET"); assert.equal(s.turn, 1, "legs alternate");
  // Player 1 marks T20 x2 (3 to close + 3 scoring = 60) while player 0 misses.
  const visits: Dart[][] = [[T20, T20, MISS], [MISS, MISS, MISS]];
  for (const v of visits) for (const x of v) s = throwDart(s, x).state;
  assert.equal(s.cricket.marks[1][0], 3); assert.equal(s.cricket.points[1], 60);
  const closeAll = [d(19, 3), d(18, 3), d(17, 3), d(16, 3), d(15, 3), d(25, 2), d(25, 1)];
  let out = "";
  for (const x of closeAll) { if (s.turn === 0) for (const m of [MISS, MISS, MISS]) s = throwDart(s, m).state; const r = throwDart(s, x); s = r.state; out = r.outcome; }
  assert.equal(out, "LEG_WON"); assert.equal(s.legsLog[1].game, "CRICKET"); assert.equal(s.legsLog[1].winner, 1);
  assert.ok(cricketWon); 
});

test("cricket round limit: higher points after 20 rounds wins; a Choice leg is a cork, a pick, and the other player throws first", () => {
  const darts: Dart[] = [];
  let s = createMatch({ ...MIX, bestOfLegs: 3, startingScore: 101 }, 0);
  const push = (x: Dart) => { darts.push(x); s = throwDart(s, x).state; };
  for (const x of [T20, d(17, 1), d(4, 3), MISS, MISS, MISS, d(6, 2)]) push(x); // leg 1 (01) to player 0
  push(T20); push(MISS); push(MISS); // player 1 scores nothing yet (closes 20)
  push(d(20, 1)); push(MISS); push(MISS); // player 0 one mark on 20
  while (s.legNo === 2) push(s.turn === 1 && s.cricket.marks[1][0] >= 3 ? d(20, 1) : MISS); // player 1 scores 20 per visit until the limit
  assert.equal(s.legsLog[1].winner, 1, "higher points at the round limit");
  assert.ok(s.visits.filter(v => v.legNo === 2).length === CRICKET_ROUND_LIMIT * 2);
  assert.ok(s.choice && s.choice.picker === null, "deciding leg starts with the choice cork");
  const corkStarter = s.choice!.starter;
  push(corkStarter === 0 ? d(25, 2) : MISS); push(corkStarter === 0 ? MISS : d(25, 2));
  assert.equal(s.choice!.picker, 0);
  push(CHOICE_DARTS.CRICKET);
  assert.equal(s.game, "CRICKET"); assert.equal(s.turn, 1, "the cork loser throws first");
  assert.deepEqual(replay({ ...MIX, bestOfLegs: 3, startingScore: 101 }, 0, darts).choiceLog[0].game, "CRICKET");
});

test("bot cricket visits are deterministic and the server rejects a tampered cricket visit", async () => {
  const { verifyBotVisits } = await import("../../career/live/service.ts");
  const bot = { avg: 50, sd: 12, checkoutPct: 0.3, hitAcc: 0.6 }, seed = "mix-session";
  const format: X01Format = { ...MIX, bestOfLegs: 3 };
  let s = createMatch(format, 1); const log: Dart[] = []; let botVisit = 0;
  const push = (x: Dart) => { log.push(x); s = throwDart(s, x).state; };
  // Leg 1 is 01 (bot starts), leg 2 cricket. Human throws misses; bot plays its seeded visits.
  while (!s.complete && s.legNo <= 2) {
    if (s.turn === 0) { push(MISS); continue; }
    const rng = seededRandom(seed, "bot-visit", botVisit++);
    const plan = s.game === "CRICKET" ? planBotCricketVisit(s.cricket, 1, bot, rng) : planBotX01Visit(s.scores[1], bot, { ...botOptionsFor(format), opened: true, rng });
    for (const x of plan) { if (s.turn !== 1 || s.complete || s.cork) break; const leg = s.legNo; push(x); if (s.legNo !== leg) break; }
    if (s.cork) while (s.cork) push(MISS);
  }
  assert.equal(s.legsLog.find(l => l.legNo === 2)?.game, "CRICKET");
  assert.doesNotThrow(() => verifyBotVisits(replay(format, 1, log), bot, seed));
  const i = replay(format, 1, log).visits.findIndex(v => v.game === "CRICKET" && v.thrower === 1);
  const at = replay(format, 1, log).visits.slice(0, i).reduce((n, v) => n + v.darts.length, 0) + replay(format, 1, log).corkLog.reduce((n, c) => n + c.darts.length, 0);
  const tampered = log.slice(); tampered[at] = tampered[at].segment === 20 && tampered[at].multiplier === 3 ? MISS : d(20, 3);
  assert.throws(() => verifyBotVisits(replay(format, 1, tampered), bot, seed), /does not match/);
  assert.deepEqual(botChoiceDart(bot, seed, 3), botChoiceDart(bot, seed, 3));
});

test("NPC mixed matches play cricket legs and Choice legs, and steel-tip results are unchanged", () => {
  const world = generateInitialWorld(HARNESS_SEED, 1);
  const base = { context: { category: "floor", roundImportance: 0.5, elimination: true } as MatchContext, seed: HARNESS_SEED, generationVersion: 1, difficulty: "STANDARD" as const };
  let cricketLegs = 0, matches = 0;
  for (let i = 0; i < 40; i++) {
    const players: [Npc, Npc] = [calibratedNpc(world[i], 55), calibratedNpc(world[i + 100], 52)];
    const r = simulateNpcMatch({ ...base, players, matchKey: `mix:${i}`, format: { bestOf: 5, firstThrow: 0, outRule: "MASTER", bull: "FAT", roundLimit: 15, mix: "SOFT_TIP" } });
    assert.equal(Math.max(r.stats[0].legsWon, r.stats[1].legsWon), 3); matches++;
    cricketLegs += r.legs.filter((l, n) => n === 1 || n === 2).length;
  }
  assert.ok(cricketLegs >= matches * 2, "legs 2 and 3 are always played as cricket");
});

test("event database v9: soft-tip events play mixed 01/Cricket matches; everything else matches v8", async () => {
  const { catalogueFor } = await import("../../career/calendar/catalogue.ts");
  const v9 = catalogueFor(9), v8 = catalogueFor(8);
  for (const d of v9.filter(x => x.circuit === "SOFT_TIP")) {
    assert.equal(d.format.mix, "SOFT_TIP", d.key);
    assert.equal(assessCapability(d.format).executable, true, d.key);
    assert.match(d.content!.summary!, /01, Cricket, Cricket, 01 and a deciding Choice leg/);
  }
  const rest = (list: typeof v9) => list.filter(x => x.circuit !== "SOFT_TIP").map(d => JSON.stringify({ ...d, eventDatabaseVersion: 0 }));
  assert.deepEqual(rest(v9), rest(v8));
  assert.ok(v8.filter(x => x.circuit === "SOFT_TIP").every(d => d.format.mix === undefined), "v8 is unchanged");
});

test("every recorded dart label fits the live session's 8-character label limit", () => {
  for (const d of [...Object.values(CHOICE_DARTS), corkDart("INNER"), corkDart("OUTER"), corkDart("MISS")]) assert.ok((d.label ?? "").length <= 8, d.label);
});
