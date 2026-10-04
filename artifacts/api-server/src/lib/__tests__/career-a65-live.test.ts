import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import { createCareerCalendar } from "../../db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../../db/migrations/create_career_finance.ts";
import { createCareerSporting } from "../../db/migrations/create_career_sporting.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerRouter } from "../../career/router.ts";
import { createCareerCalendarRouter } from "../../career/calendar/router.ts";
import { createCareerFinanceRouter } from "../../career/finance/router.ts";
import { createCareerSportingService } from "../../career/sporting/service.ts";
import { createCareerSportingRouter } from "../../career/sporting/router.ts";
import { createCareerLiveMatchService } from "../../career/live/service.ts";
import { createCareerLiveRouter } from "../../career/live/router.ts";
import { createCareerIdentityService, createCareerIdentityRouter } from "../../career/identity/service.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";
import { createCareerAdminRouter, CAREER_RESET_CONFIRMATION } from "../../career/admin-router.ts";
import { EVENT_CATALOGUE_V2 } from "../../career/calendar/catalogue.ts";
import { replay, throwDart, type X01Format, type Dart } from "../../shared/darts-rules/x01.ts";
import { planBotX01Visit, type BotSkill } from "../../shared/darts-rules/bot.ts";
import { seededRandom } from "../../shared/darts-rules/random.ts";

/**
 * A6.5 end-to-end: Career -> live session -> bull-up -> darts through the shared
 * rules -> server verification -> A3 result -> bracket, money, rankings, milestones.
 * Served by the real composed routers in the same order as routes/career.ts.
 */
const pg = new PGlite();
const db = drizzle(pg);
const saves = createCareerService(db);
const career = createCareerSportingService(db);
const live = createCareerLiveMatchService(db, career.calendar);
let base = "";
let server: ReturnType<ReturnType<typeof express>["listen"]>;
const thisYear = new Date().getUTCFullYear();
const dobForAge = (age: number) => `${thisYear - age}-06-15`; // age at 1 Jan of this year = age - 1 (birthday in June)

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1), (2);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  await createCareerSaves(db); await createCareerWorld(db); await createCareerCalendar(db); await createCareerFinance(db); await createCareerSporting(db);
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use((req, _res, next) => {
    const player = Number(req.header("x-test-player") ?? 0);
    (req as unknown as { session: unknown }).session = player ? { playerId: player, isAdmin: req.header("x-test-admin") === "true" } : {};
    (req as unknown as { log: unknown }).log = { error: (e: unknown) => console.error(e) };
    next();
  });
  const available = (isAdmin: boolean) => saves.isAvailable(isAdmin);
  const router = express.Router();
  router.use(createCareerIdentityRouter(createCareerIdentityService(db), available));
  router.use(createCareerLiveRouter(live, available));
  router.use(createCareerSportingRouter(career, available));
  router.use(createCareerFinanceRouter(career.finance, available));
  router.use(createCareerCalendarRouter(career.calendar, available));
  router.use(createCareerRouter(saves));
  app.use("/api/career", router);
  app.use("/api", createCareerAdminRouter(db));
  server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/career`;
});
after(async () => { server.close(); await pg.close(); });

async function call(method: string, path: string, body?: unknown, player = 1) {
  const res = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(player ? { "x-test-player": String(player) } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed: any = null; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed };
}
const q = async (query: ReturnType<typeof sql>) => (await db.execute(query)).rows as Record<string, any>[];

async function newCareer(slot: number, body: Record<string, unknown>) {
  const created = await call("POST", "/saves", { slot, careerName: `A65 ${slot}`, ...body });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  await db.execute(sql`UPDATE career_saves SET world_seed = ${HARNESS_SEED} WHERE id = ${created.body.id}`);
  assert.equal((await call("POST", `/saves/${created.body.id}/initialize`, {})).status, 200);
  return created.body.id as string;
}
let opCounter = 0;
async function advanceToHumanMatch(id: string, maxSteps = 30) {
  for (let i = 0; i < maxSteps; i++) {
    const save = (await call("GET", `/saves/${id}`)).body;
    const r = await call("POST", `/saves/${id}/calendar/advance`, { operationKey: `a65-adv-${++opCounter}`, expectedSeason: save.currentSeason, expectedWeek: save.currentWeek, target: { kind: "NEXT_MEANINGFUL" } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    if (r.body.stop.reason === "HUMAN_MATCH_PENDING") return r.body.stop.detail.matchIds[0] as string;
  }
  throw new Error("no human match reached");
}
async function enterFirst(id: string, predicate: (e: any) => boolean) {
  const events = (await call("GET", `/saves/${id}/calendar?scope=AVAILABLE`)).body.events.filter(predicate);
  assert.ok(events.length > 0, "an eligible, affordable event exists");
  const entered = await call("POST", `/saves/${id}/events/${events[0].id}/entry`);
  assert.equal(entered.body.entered, true, JSON.stringify(entered.body));
  return events[0];
}
/** Bull-up: the human keeps missing until a winner is decided (exercises ties / reverse order). */
async function bullUp(id: string, matchId: string, humanThrow: "INNER" | "OUTER" | "MISS" = "MISS") {
  let s = (await call("POST", `/saves/${id}/matches/${matchId}/session`)).body;
  for (let i = 0; i < 30 && s.status === "BULL_UP"; i++) {
    const r = await call("POST", `/saves/${id}/matches/${matchId}/session/bull`, { throw: humanThrow, expectedRevision: s.revision });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    s = r.body;
  }
  assert.equal(s.status, "IN_PLAY");
  return s;
}
/** Plays the match exactly as the browser would: the seeded bot visits and a human dart policy, checkpointed per visit. */
async function playOut(id: string, matchId: string, session: any, human: BotSkill, humanSeed: string, opts: { stopAfterVisits?: number } = {}) {
  const darts: Dart[] = [...session.darts];
  let revision = session.revision, visits = 0;
  const humanRng = seededRandom(humanSeed);
  for (;;) {
    const st = replay(session.format as X01Format, session.firstThrower, darts);
    if (st.complete) throw new Error("log complete without server completion");
    const p = st.turn;
    const plan = p === 1
      ? planBotX01Visit(st.scores[1], session.bot.config, { doubleOut: true, opened: st.opened[1], rng: seededRandom(session.bot.seed, "bot-visit", st.visits.filter(v => v.thrower === 1).length) })
      : planBotX01Visit(st.scores[0], human, { doubleOut: true, opened: st.opened[0], rng: humanRng });
    let s = st;
    for (const d of plan) { const r = throwDart(s, d); s = r.state; darts.push(d); if (!["SCORED", "UNOPENED", "OPENED"].includes(r.outcome)) break; }
    const res = await call("PUT", `/saves/${id}/matches/${matchId}/session/darts`, { darts, expectedRevision: revision });
    assert.equal(res.status, 200, JSON.stringify(res.body).slice(0, 300));
    revision = res.body.revision;
    if (res.body.status === "COMPLETED") return { session: res.body, darts };
    if (opts.stopAfterVisits && ++visits >= opts.stopAfterVisits) return { session: res.body, darts };
  }
}
const STRONG: BotSkill = { avg: 100, sd: 6, checkoutPct: 0.85, hitAcc: 0.9 };
const WEAK: BotSkill = { avg: 20, sd: 5, checkoutPct: 0.02, hitAcc: 0.1 };

// ------------------------------------------------------------------ identity / age
test("identity: a 15-year-old Career can be created; under 15 is rejected; DOB is immutable; legacy saves are PROFILE_INCOMPLETE", async () => {
  const under = await call("POST", "/saves", { slot: 1, dateOfBirth: `${thisYear - 14}-01-02` });
  assert.equal(under.status, 409); assert.match(under.body.error, /at least 15/);
  const id = await newCareer(1, { dateOfBirth: `${thisYear - 15}-01-01`, homeLocality: "ayrshire" });
  const profile = (await call("GET", `/saves/${id}/profile`)).body;
  assert.deepEqual([profile.status, profile.age, profile.ageAtCareerStart, profile.junior, profile.qSchool.eligibleNow], ["COMPLETE", 15, 15, true, false]);
  assert.equal(profile.qSchool.minimumAge, 16);
  assert.deepEqual(profile.qSchool.eligibleFrom.season, 2, "turns 16 on 1 Jan next year = season 2 week 1");
  assert.equal((await call("PUT", `/saves/${id}/profile`, { dateOfBirth: `${thisYear - 30}-01-01` })).status, 409, "DOB cannot be changed through the API");
  await assert.rejects(db.execute(sql`UPDATE career_profiles SET date_of_birth = '1980-01-01' WHERE career_save_id = ${id}`),
    (e: any) => /immutable/.test(String(e?.cause?.message ?? e?.message)), "nor directly in the database");
  // A save without a DOB (as every pre-A6.5 save) cannot make sporting progress until the DOB is set once.
  const legacy = (await call("POST", "/saves", { slot: 3, careerName: "Legacy" })).body.id;
  await call("POST", `/saves/${legacy}/initialize`, {});
  assert.equal((await call("GET", `/saves/${legacy}/profile`)).body.status, "PROFILE_INCOMPLETE");
  const blocked = await call("POST", `/saves/${legacy}/calendar/advance`, { operationKey: "a65-legacy-1", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 1 } });
  assert.deepEqual([blocked.status, blocked.body.code], [409, "PROFILE_INCOMPLETE"]);
  const set = await call("PUT", `/saves/${legacy}/profile`, { dateOfBirth: dobForAge(40) });
  assert.deepEqual([set.status, set.body.status], [200, "COMPLETE"]);
  assert.equal((await call("POST", `/saves/${legacy}/calendar/advance`, { operationKey: "a65-legacy-2", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 1 } })).status, 200);
  assert.equal((await call("PUT", `/saves/${legacy}/profile`, { dateOfBirth: dobForAge(41) })).status, 409, "set once only");
  // Restart carries the identity unchanged (no DOB drift); delete removes it.
  const restarted = (await call("POST", `/saves/${legacy}/restart`, {})).body.id;
  const rp = (await call("GET", `/saves/${restarted}/profile`)).body;
  assert.deepEqual([rp.dateOfBirth, rp.careerStartDate], [set.body.dateOfBirth, set.body.careerStartDate]);
  assert.equal((await call("DELETE", `/saves/${restarted}`, {})).status, 204);
  assert.equal((await q(sql`SELECT COUNT(*)::int n FROM career_profiles WHERE career_save_id = ${restarted}`))[0].n, 0);
});

test("age pathways: junior events accept a 15-year-old and refuse adults; open events stay available; Q-School refuses under 16 with a date", async () => {
  const junior = (await call("GET", "/saves")).body.slots[0].career.id;
  const adult = await newCareer(2, { dateOfBirth: dobForAge(26) });
  const cal = async (id: string) => (await call("GET", `/saves/${id}/calendar?scope=WORLD&fromWeek=1&toWeek=52`)).body.events as any[];
  const jEvents = await cal(junior), aEvents = await cal(adult);
  const jNight = jEvents.find(e => e.definitionKey === "junior-development-night" && e.human.eligible);
  assert.ok(jNight, "a junior development night is open to the 15-year-old");
  assert.ok(jNight.human.age.junior && jNight.human.age.maxAgeExclusive === 18);
  const aNight = aEvents.find(e => e.definitionKey === "junior-development-night");
  assert.ok(aNight && !aNight.human.eligible && aNight.human.eligibilityReasons.includes("ABOVE_MAXIMUM_AGE"), "adults see the junior circuit as age-ineligible");
  assert.ok(jEvents.some(e => e.definitionKey === "friday-night-501" && e.human.eligible), "open amateur events remain available to a junior");
  const jQ = jEvents.find(e => e.circuit === "Q_SCHOOL" && e.season === 1)!;
  assert.ok(jQ.human.denials.includes("BELOW_MINIMUM_AGE"));
  assert.equal(jQ.human.age.minAge, 16);
  assert.ok(jQ.human.age.eligibleFrom === null || jQ.human.age.eligibleFrom.season >= 1);
  const aQ = aEvents.find(e => e.circuit === "Q_SCHOOL" && e.season === 1)!;
  assert.ok(!aQ.human.denials.includes("BELOW_MINIMUM_AGE"), "26-year-old meets the Q-School age rule");
  const dc = aEvents.find(e => e.definitionKey === "double-crown")!;
  assert.deepEqual([dc.name, dc.format.inRule, dc.format.scoringUnit, dc.capability.executable], ["The Double Crown", "DOUBLE", "SETS", true]);
});

// ------------------------------------------------------------------ the playable loop
test("full human loop (junior, legs): enter, reach the match, bull-up, play through the shared rules, server accepts once, bracket/money/rankings/milestones move", async () => {
  const id = (await call("GET", "/saves")).body.slots[0].career.id; // the 15-year-old
  const before = (await call("GET", `/saves/${id}/finance`)).body;
  const event = await enterFirst(id, e => e.definitionKey === "junior-development-night" && e.capability.executable);
  const matchId = await advanceToHumanMatch(id);
  const blocked = await call("POST", `/saves/${id}/calendar/advance`, { operationKey: "a65-blocked", expectedSeason: 1, expectedWeek: (await call("GET", `/saves/${id}`)).body.currentWeek, target: { kind: "WEEKS", weeks: 1 } });
  assert.equal(blocked.body.stop.reason, "HUMAN_MATCH_PENDING", "the calendar cannot advance past the pending match");
  // Two concurrent opens create ONE session; reload returns the same one.
  const [o1, o2] = await Promise.all([call("POST", `/saves/${id}/matches/${matchId}/session`), call("POST", `/saves/${id}/matches/${matchId}/session`)]);
  assert.equal(o1.status, 200); assert.equal(o2.status, 200); assert.equal(o1.body.sessionId, o2.body.sessionId);
  assert.equal((await q(sql`SELECT COUNT(*)::int n FROM career_match_sessions WHERE career_save_id = ${id} AND match_id = ${matchId}`))[0].n, 1);
  assert.equal(o1.body.bullUp.required, true, "A3 format says BULL_UP, so the session requires it");
  assert.equal(o1.body.format.unit, "LEGS");
  assert.ok(!("ability" in o1.body.bot) && !JSON.stringify(o1.body).includes("potential"), "no hidden NPC ability is exposed");
  const s = await bullUp(id, matchId, "INNER");
  const reloaded = (await call("GET", `/saves/${id}/matches/${matchId}/session`)).body;
  assert.deepEqual([reloaded.bullUp.throws, reloaded.firstThrower], [s.bullUp.throws, s.firstThrower], "reload cannot re-roll the bull-up");
  // Mid-match recovery: a partial log is persisted server-side.
  const partial = await playOut(id, matchId, s, STRONG, "h1", { stopAfterVisits: 3 });
  const mid = (await call("GET", `/saves/${id}/matches/${matchId}/session`)).body;
  const canon = (ds: Dart[]) => ds.map(d => [d.segment, d.multiplier, d.value]);
  assert.deepEqual(canon(mid.darts), canon(partial.darts));
  // Tampering: changing the opponent's darts is refused.
  const midState = replay(mid.format, mid.firstThrower, mid.darts);
  const botVisitIndex = midState.visits.findIndex(v => v.thrower === 1);
  const tamperedIndex = midState.visits.slice(0, botVisitIndex).reduce((n, v) => n + v.darts.length, 0);
  const tampered = [...mid.darts];
  tampered[tamperedIndex] = tampered[tamperedIndex].value === 0 ? { segment: 1, multiplier: 1, value: 1 } : { segment: 0, multiplier: 1, value: 0 };
  const bad = await call("PUT", `/saves/${id}/matches/${matchId}/session/darts`, { darts: tampered, expectedRevision: mid.revision });
  assert.equal(bad.status, 409, "altered opponent dart refused"); assert.match(bad.body.error, /Opponent|log rejected/);
  assert.equal((await call("PUT", `/saves/${id}/matches/${matchId}/session/darts`, { darts: mid.darts, expectedRevision: mid.revision - 1 })).status, 409, "stale revision refused");
  const done = await playOut(id, matchId, mid, STRONG, "h1b");
  assert.equal(done.session.result.humanWon, true);
  const match = (await q(sql`SELECT status, winner_key, result_source, legs_a, legs_b, first_throw_detail, summary FROM career_tournament_matches WHERE career_save_id = ${id} AND id = ${matchId}`))[0];
  assert.deepEqual([match.status, match.winner_key, match.result_source], ["COMPLETED", "HUMAN", "HUMAN_LIVE"]);
  assert.equal(match.first_throw_detail.method, "LIVE_BULL_UP");
  assert.equal(match.summary.live.sessionId, s.sessionId);
  // Duplicate final submission returns the original result; a different log is refused; no second result.
  const dup = await call("PUT", `/saves/${id}/matches/${matchId}/session/darts`, { darts: done.darts, expectedRevision: 0 });
  assert.deepEqual([dup.status, dup.body.duplicate], [200, true]);
  assert.equal((await call("PUT", `/saves/${id}/matches/${matchId}/session/darts`, { darts: done.darts.slice(0, -1), expectedRevision: 0 })).status, 409, "a different log after completion is refused");
  // Keep playing the event's later human matches until the event finishes for the human.
  let next: string[] = done.session.result.nextHumanMatchIds ?? [];
  for (let guard = 0; guard < 8; guard++) {
    if (!next.length) {
      const st = (await call("GET", `/saves/${id}/events/${event.id}`)).body;
      if (st.status === "COMPLETED" || st.human?.result) break;
      next = [await advanceToHumanMatch(id)];
    }
    const sess = await bullUp(id, next[0], "OUTER");
    const r = await playOut(id, next[0], sess, STRONG, `h-${guard}`);
    next = r.session.result.nextHumanMatchIds ?? [];
  }
  const result = (await q(sql`SELECT finishing_position, is_champion, metadata FROM career_event_results WHERE career_save_id = ${id} AND event_id = ${event.id} AND participant_key = 'HUMAN'`))[0];
  assert.ok(result, "event completed with a permanent human result");
  assert.equal(result.metadata.humanAge, 15, "age at the event is a persisted fact");
  const after = (await call("GET", `/saves/${id}/finance`)).body;
  const prizes = await q(sql`SELECT COUNT(*)::int n FROM career_finance_entries WHERE career_save_id = ${id} AND event_id = ${event.id} AND category = 'PRIZE'`);
  assert.ok(prizes[0].n <= 1, "prize paid at most once");
  if (result.finishing_position <= 2) assert.ok(after.careerEarningsPence > before.careerEarningsPence, "prize money reached A4");
  const contributions = await q(sql`SELECT COUNT(*)::int n FROM career_ranking_contributions WHERE career_save_id = ${id} AND participant_key = 'HUMAN'`);
  assert.ok(contributions[0].n >= 1, "A5 ranking contribution recorded");
  // The Career advances again afterwards.
  const save = (await call("GET", `/saves/${id}`)).body;
  const moved = await call("POST", `/saves/${id}/calendar/advance`, { operationKey: "a65-after", expectedSeason: save.currentSeason, expectedWeek: save.currentWeek, target: { kind: "WEEKS", weeks: 1 } });
  assert.equal(moved.status, 200); assert.notEqual(moved.body.stop.reason, "HUMAN_MATCH_PENDING");
  const ms = await q(sql`SELECT kind, detail FROM career_sporting_milestones WHERE career_save_id = ${id} AND participant_key = 'HUMAN'`);
  assert.ok(ms.every(m => m.detail.humanAge === 15), "every human milestone carries the human's age " + JSON.stringify(ms));
});

test("losing the first match: elimination recorded, no further human matches, calendar continues", async () => {
  const id = (await call("GET", "/saves")).body.slots[1].career.id; // the 26-year-old
  const event = await enterFirst(id, e => e.definitionKey === "friday-night-501" && e.capability.executable);
  const matchId = await advanceToHumanMatch(id);
  const s = await bullUp(id, matchId, "MISS");
  const done = await playOut(id, matchId, s, WEAK, "weak");
  assert.equal(done.session.result.humanWon, false);
  assert.deepEqual(done.session.result.nextHumanMatchIds, []);
  const row = (await q(sql`SELECT winner_key FROM career_tournament_matches WHERE career_save_id = ${id} AND id = ${matchId}`))[0];
  assert.notEqual(row.winner_key, "HUMAN");
  const save = (await call("GET", `/saves/${id}`)).body;
  const r = await call("POST", `/saves/${id}/calendar/advance`, { operationKey: "a65-lose-after", expectedSeason: save.currentSeason, expectedWeek: save.currentWeek, target: { kind: "WEEKS", weeks: 1 } });
  assert.equal(r.status, 200);
  const result = (await q(sql`SELECT stage_reached, is_champion FROM career_event_results WHERE career_save_id = ${id} AND event_id = ${event.id} AND participant_key = 'HUMAN'`))[0];
  assert.ok(result && !result.is_champion, "eliminated with a permanent result once the event completes");
});

/** Labelled fixture: re-author the pending match's event format in an isolated save (sets / double-in). */
async function reformat(id: string, matchId: string, format: unknown, bestOf: number) {
  const m = (await q(sql`SELECT event_id FROM career_tournament_matches WHERE career_save_id = ${id} AND id = ${matchId}`))[0];
  await db.execute(sql`UPDATE career_event_instances SET snapshot = jsonb_set(snapshot, '{format}', ${JSON.stringify(format)}::jsonb) WHERE career_save_id = ${id} AND id = ${m.event_id}`);
  await db.execute(sql`UPDATE career_tournament_matches SET best_of = ${bestOf} WHERE career_save_id = ${id} AND id = ${matchId}`);
}

test("set-play Career match (best of 3 sets, best of 5 legs per set) through the same session boundary", async () => {
  const id = await newCareer(3, { dateOfBirth: dobForAge(30) });
  await enterFirst(id, e => e.definitionKey === "friday-night-501" && e.capability.executable);
  const matchId = await advanceToHumanMatch(id);
  const wc = EVENT_CATALOGUE_V2.find(d => d.key === "world-darts-championship")!.format;
  await reformat(id, matchId, { ...wc, stages: [{ ...wc.stages[0], bestOfByRound: [3] }] }, 3);
  const s = await bullUp(id, matchId, "MISS");
  assert.deepEqual([s.format.unit, s.format.bestOfSets, s.format.bestOfLegsPerSet], ["SETS", 3, 5], "best-of sets translated, not confused with sets-to-win");
  const done = await playOut(id, matchId, s, STRONG, "sets");
  const st = replay(done.session.format, done.session.firstThrower, done.darts);
  assert.equal(Math.max(...st.sets), 2, "first to 2 sets");
  const row = (await q(sql`SELECT legs_a, legs_b, summary, winner_key, a_key FROM career_tournament_matches WHERE career_save_id = ${id} AND id = ${matchId}`))[0];
  const humanA = row.a_key === "HUMAN";
  assert.deepEqual(humanA ? row.summary.sets : [row.summary.sets[1], row.summary.sets[0]], st.sets);
  assert.deepEqual(humanA ? [row.legs_a, row.legs_b] : [row.legs_b, row.legs_a], st.totalLegs, "total legs recorded");
  assert.equal(row.winner_key === "HUMAN", st.winner === 0);
  for (const leg of st.legsLog) assert.ok(leg.setNo <= 3);
  const again = await call("PUT", `/saves/${id}/matches/${matchId}/session/darts`, { darts: done.darts, expectedRevision: 0 });
  assert.equal(again.body.duplicate, true, "no duplicate result");
});

test("Double Crown format (501 double-in double-out sets): no score before opening, opening double scores, bot obeys, result accepted", async () => {
  const id = (await call("GET", "/saves")).body.slots[2].career.id;
  const save = (await call("GET", `/saves/${id}`)).body;
  await advanceToHumanMatch(id).catch(() => null);
  await enterFirst(id, e => e.definitionKey === "friday-night-501" && e.capability.executable && e.dates.startWeek > save.currentWeek);
  const matchId = await advanceToHumanMatch(id);
  const dc = EVENT_CATALOGUE_V2.find(d => d.key === "double-crown")!.format;
  await reformat(id, matchId, { ...dc, stages: [{ ...dc.stages[0], bestOfByRound: [3] }] }, 3);
  const s = await bullUp(id, matchId, "INNER");
  assert.deepEqual([s.format.inRule, s.format.outRule, s.format.unit], ["DOUBLE", "DOUBLE", "SETS"]);
  // A forged log where the human "scores" before opening is impossible: the rules engine zeroes it.
  const st0 = replay(s.format, s.firstThrower, s.firstThrower === 0 ? [{ segment: 20, multiplier: 3, value: 60 }] : []);
  if (s.firstThrower === 0) assert.equal(st0.scores[0], 501);
  const done = await playOut(id, matchId, s, STRONG, "dido");
  const st = replay(done.session.format, done.session.firstThrower, done.darts);
  for (const v of st.visits) if (!v.startOpened && v.points > 0) {
    const first = v.darts.findIndex(d => d.multiplier === 2);
    assert.ok(first >= 0, "a scoring unopened visit contains the opening double");
    assert.equal(v.points, v.darts.slice(first).reduce((n, d) => n + d.value, 0), "only darts from the opening double on count");
  }
  assert.ok(st.visits.some(v => v.thrower === 1 && !v.startOpened), "the bot also had to open");
  assert.ok(done.session.result.facts);
  assert.equal((await q(sql`SELECT status FROM career_tournament_matches WHERE career_save_id = ${id} AND id = ${matchId}`))[0].status, "COMPLETED");
});

test("concurrency: two completions race; result completion races calendar advance — exactly one sporting outcome", async () => {
  const id = (await call("GET", "/saves")).body.slots[2].career.id;
  const save = (await call("GET", `/saves/${id}`)).body;
  await enterFirst(id, e => e.capability.executable && e.finance.affordable !== false && e.dates.startWeek > save.currentWeek && ["GRASSROOTS", "COUNTY"].includes(e.circuit));
  const matchId = await advanceToHumanMatch(id);
  const s = await bullUp(id, matchId, "OUTER");
  // Play to one dart from the end, then submit the final log twice at once, alongside an advance.
  const full = await (async () => { const sandbox = { ...s }; const r = await playOutOffline(sandbox, STRONG, "race"); return r; })();
  const prefix = full.slice(0, -1);
  const mid = await call("PUT", `/saves/${id}/matches/${matchId}/session/darts`, { darts: prefix, expectedRevision: s.revision });
  assert.equal(mid.status, 200);
  const cur = (await call("GET", `/saves/${id}`)).body;
  const [a, b, adv] = await Promise.all([
    call("PUT", `/saves/${id}/matches/${matchId}/session/darts`, { darts: full, expectedRevision: mid.body.revision }),
    call("PUT", `/saves/${id}/matches/${matchId}/session/darts`, { darts: full, expectedRevision: mid.body.revision }),
    call("POST", `/saves/${id}/calendar/advance`, { operationKey: "a65-race-adv", expectedSeason: cur.currentSeason, expectedWeek: cur.currentWeek, target: { kind: "WEEKS", weeks: 1 } }),
  ]);
  const statuses = [a, b].map(r => r.status === 200 ? (r.body.duplicate ? "DUP" : "OK") : r.status).sort();
  assert.ok(["DUP,OK", "409,OK"].includes(statuses.join(",")), `one completion wins: ${statuses}`);
  assert.ok([200, 409].includes(adv.status));
  const results = await q(sql`SELECT COUNT(*)::int n FROM career_tournament_matches WHERE career_save_id = ${id} AND id = ${matchId} AND status = 'COMPLETED'`);
  assert.equal(results[0].n, 1);
  const sessions = await q(sql`SELECT status FROM career_match_sessions WHERE career_save_id = ${id} AND match_id = ${matchId}`);
  assert.deepEqual(sessions.map(r => r.status), ["COMPLETED"]);
});

/** Offline full playthrough (no checkpoints) used to build a complete log for the race test. */
async function playOutOffline(session: any, human: BotSkill, seed: string): Promise<Dart[]> {
  const darts: Dart[] = [...session.darts];
  const humanRng = seededRandom(seed);
  for (;;) {
    const st = replay(session.format as X01Format, session.firstThrower, darts);
    if (st.complete) return darts;
    const p = st.turn;
    const plan = p === 1
      ? planBotX01Visit(st.scores[1], session.bot.config, { doubleOut: true, opened: st.opened[1], rng: seededRandom(session.bot.seed, "bot-visit", st.visits.filter(v => v.thrower === 1).length) })
      : planBotX01Visit(st.scores[0], human, { doubleOut: true, opened: st.opened[0], rng: humanRng });
    let s = st;
    for (const d of plan) { const r = throwDart(s, d); s = r.state; darts.push(d); if (s.complete || !["SCORED", "UNOPENED", "OPENED"].includes(r.outcome)) break; }
  }
}

test("sponsor facts (grind fix): an amateur qualifier final is not a Major finish; Q-School finishes still count", async () => {
  const { humanBestFinishByCircuit } = await import("../../career/finance/engine.ts");
  const id = (await call("GET", "/saves")).body.slots[1].career.id;
  const inst = async (key: string) => (await q(sql`SELECT id, season, definition_key, circuit, classification FROM career_event_instances WHERE career_save_id = ${id} AND definition_key LIKE ${key} ORDER BY start_day LIMIT 1`))[0];
  const qual = await inst("open-championship-qualifier");
  const qs = await inst("q-school-first-%");
  assert.deepEqual([qual.circuit, qual.classification, qs.circuit, qs.classification], ["MAJOR", "QUALIFIER", "Q_SCHOOL", "QUALIFIER"]);
  // Test fixture rows (last test in the file): the human reached the final (2nd) of both events.
  for (const e of [qual, qs]) await db.execute(sql`INSERT INTO career_event_entries (career_save_id, event_id, participant_key, participant_kind, source, status, entered_season, entered_week)
    VALUES (${id}, ${e.id}, 'HUMAN', 'HUMAN', 'HUMAN_ENTRY', 'CONFIRMED', ${e.season}, 1) ON CONFLICT DO NOTHING`);
  for (const e of [qual, qs]) await db.execute(sql`INSERT INTO career_event_results (career_save_id, event_id, participant_key, participant_kind, season, definition_key, finishing_position, stage_reached, is_champion, matches_played, wins, losses, legs_for, legs_against, metadata)
    VALUES (${id}, ${e.id}, 'HUMAN', 'HUMAN', ${e.season}, ${e.definition_key}, 2, 'FINAL', false, 5, 4, 1, 20, 12, '{"testFixture":true}'::jsonb) ON CONFLICT DO NOTHING`);
  const best = await db.transaction(tx => humanBestFinishByCircuit(tx, id));
  assert.equal(best.MAJOR, undefined, "a qualifier final does not satisfy circuitFinish MAJOR <= 2 (ELITE sponsor)");
  assert.equal(best.Q_SCHOOL, 2, "Q-School qualifier results remain circuit finishes");
});

test("A6.6 admin reset cascades populated Career data only, requires confirmation and works while Hidden", async () => {
  const tables = (await pg.query<{ table_name: string }>(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`)).rows;
  const owned = (await pg.query<{ table_name: string }>(`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='career_save_id'`)).rows.map(t => t.table_name);
  const careerTables = ['career_saves', ...owned];
  const catalogues = tables.filter(t => t.table_name.startsWith('career_') && !careerTables.includes(t.table_name)).map(t => t.table_name);
  const count = async (table: string) => Number((await pg.query<{ n: number }>(`SELECT count(*)::int n FROM "${table}"`)).rows[0].n);
  assert.ok(await count('career_match_sessions') > 0);
  assert.ok(await count('career_world_players') > 0);
  const saveCount = await count('career_saves');
  assert.ok(saveCount > 0);
  // Representative non-Career rows linked to the same player must survive.
  // Reuse the populated real Career FK graph from the A6.5 tests above.
  const unrelated = ['users', 'matches', 'player_currency', 'achievements', 'master501_progress', 'master501_runs', 'tour_trophies', 'player_tour_runs'];
  for (const table of unrelated) await pg.exec(`CREATE TABLE ${table}(id integer PRIMARY KEY, player_id integer REFERENCES players(id), value text); INSERT INTO ${table} VALUES (1,1,'keep exactly');`);
  await pg.exec(`UPDATE feature_flags SET enabled=false,admin_test_mode=false WHERE feature_name='tour_career_2'`);
  const preserved = ['players', 'feature_flags', ...unrelated, ...catalogues];
  const snapshot = async () => Promise.all(preserved.map(async t => [t, (await pg.query(`SELECT * FROM "${t}" ORDER BY 1`)).rows]));
  const before = await snapshot();
  const reset = async (player: number, admin: boolean, confirmation?: string) => fetch(`${base.replace('/career', '')}/admin/career/reset`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-player': String(player), 'x-test-admin': String(admin) },
    body: JSON.stringify({ confirmation }),
  });
  assert.equal((await reset(0, false, CAREER_RESET_CONFIRMATION)).status, 403);
  assert.equal((await reset(1, false, CAREER_RESET_CONFIRMATION)).status, 403);
  assert.equal((await reset(1, true)).status, 400);
  assert.equal((await reset(1, true, 'yes')).status, 400);
  assert.equal(await count('career_saves'), saveCount);
  const response = await reset(1, true, CAREER_RESET_CONFIRMATION);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deletedSaves: saveCount });
  for (const table of careerTables) assert.equal(await count(table), 0, `${table} should cascade with saves`);
  assert.deepEqual(await snapshot(), before);
  const again = await reset(1, true, CAREER_RESET_CONFIRMATION);
  assert.deepEqual(await again.json(), { deletedSaves: 0 });
});
