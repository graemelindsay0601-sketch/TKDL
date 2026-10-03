import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import { createCareerCalendar, syncEventDefinitions } from "../../db/migrations/create_career_calendar.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerCalendarService } from "../../career/calendar/service.ts";
import { generateSeason, calendarHashOf, definitionHash } from "../../career/calendar/generation.ts";
import { EVENT_CATALOGUE_V1 } from "../../career/calendar/catalogue.ts";
import { assessCapability, knockout501, setsKnockout501, groupKnockout501, league501, x01Variant, specialGame, pairs501 } from "../../career/calendar/formats.ts";
import { evaluateRule, R, type ParticipantFacts } from "../../career/calendar/eligibility.ts";
import { bracketOrder, generateKnockoutDraw, finishingPosition } from "../../career/calendar/draw.ts";
import { assertTransition, canTransition } from "../../career/calendar/engine.ts";
import { SEASON_GROUPINGS, WEEKS_PER_SEASON, DEVELOPMENT_CADENCE } from "../../career/calendar/config.ts";
import { scopedRandom } from "../../career/world/random.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";
import { staticCalendarReport } from "../../career/calendar/harness.ts";

const SEED_B = "bc".repeat(32);
const pg = new PGlite();
const db = drizzle(pg);
const saves = createCareerService(db);
const calendar = createCareerCalendarService(db);
const actor = { playerId: 1 };

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY, points INTEGER); INSERT INTO players VALUES (1,42),(2,71);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test');
    CREATE TABLE tour_events (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO tour_events VALUES (1, 'Friday Night 501'), (61, 'PDC Worlds');
    CREATE TABLE tour_trophies (id INTEGER PRIMARY KEY, event_id INTEGER); INSERT INTO tour_trophies SELECT g, 1 + (g - 1) / 5 FROM generate_series(1, 305) g;`);
  await createCareerSaves(db);
  await createCareerWorld(db);
  await createCareerCalendar(db);
});
beforeEach(async () => { await pg.exec("DELETE FROM career_saves; UPDATE feature_flags SET enabled=true, admin_test_mode=false"); });
after(async () => { await pg.close(); });

async function careerFor(player = 1, slot = 1, seed = HARNESS_SEED) {
  const save = await saves.create(player, { slot });
  await db.execute(sql`UPDATE career_saves SET world_seed = ${seed} WHERE id = ${save.id}`);
  await calendar.initialize({ playerId: player }, save.id);
  return save;
}
const rows = async (query: ReturnType<typeof sql>) => (await db.execute(query)).rows;
/** Drizzle wraps PostgreSQL errors; match the message anywhere in the cause chain. */
const rejectsWith = (promise: Promise<unknown>, pattern: RegExp) => assert.rejects(promise, (error: unknown) => {
  for (let e = error as { message?: string; cause?: unknown } | undefined, d = 0; e && d < 5; e = e.cause as typeof e, d++) if (pattern.test(String(e.message))) return true;
  return false;
});
const rejectsStatus = (promise: Promise<unknown>, status: number) => assert.rejects(promise, (e: unknown) => (e as { status?: number }).status === status);
const facts = (over: Partial<ParticipantFacts> = {}): ParticipantFacts => ({ key: "HUMAN", kind: "HUMAN", country: "GBR", zone: "UK_IRELAND", locality: "ayrshire",
  professionalStatus: "AMATEUR", tourCard: false, rankings: {}, entitlementTargets: new Set(), invited: false,
  results: { SAME: new Map(), PREVIOUS: new Map() }, defendingChampion: false, ...over });

// ------------------------------------------------------------------ calendar generation
test("season generation is deterministic, 52-week bounded and hundreds of instances strong", () => {
  const a = generateSeason(HARNESS_SEED, 1, 1), again = generateSeason(HARNESS_SEED, 1, 1), b = generateSeason(SEED_B, 1, 1);
  assert.equal(calendarHashOf(a), calendarHashOf(again));
  assert.notEqual(calendarHashOf(a), calendarHashOf(b), "different seeds rotate local content");
  assert.ok(a.length >= 300 && b.length >= 300, `hundreds of instances (${a.length}/${b.length})`);
  for (const d of a) {
    assert.ok(d.startWeek >= 1 && d.endWeek <= WEEKS_PER_SEASON && d.startDay <= d.endDay && d.registrationOpensWeek <= d.startWeek);
    assert.ok(SEASON_GROUPINGS.some(g => d.startWeek >= g.fromWeek && d.startWeek <= g.toWeek));
  }
  const backbone = (x: typeof a) => x.filter(d => !d.localityKey).map(d => `${d.instanceKey}@${d.startDay}`);
  assert.deepEqual(backbone(a), backbone(b), "authored backbone is identical across seeds");
  assert.notDeepEqual(generateSeason(HARNESS_SEED, 1, 2).filter(d => d.localityKey).map(d => d.instanceKey), a.filter(d => d.localityKey).map(d => d.instanceKey), "seasons rotate too");
  assert.equal(new Set(a.map(d => d.id)).size, a.length);
  assert.deepEqual(SEASON_GROUPINGS.map(g => [g.fromWeek, g.toWeek]), [[1, 8], [9, 16], [17, 32], [33, 44], [45, 52]]);
});

test("static harness reports a broad, international, non-flat calendar", () => {
  const report = staticCalendarReport(HARNESS_SEED);
  assert.equal(report.duplicateStableIds, 0);
  assert.equal(report.invalidEventWindows, 0);
  assert.equal(report.specialWithRanking, 0);
  assert.equal(Object.keys(report.byCircuit).length, 14, "all fourteen circuits present");
  assert.deepEqual(Object.keys(report.byClassification), ["INVITATIONAL_EXHIBITION", "QUALIFIER", "RANKING", "SPECIAL"]);
  assert.ok(Object.keys(report.byCountry).length >= 10);
  assert.ok(report.simulationCapability.unsupported > 0 && report.simulationCapability.executable > 300);
  assert.deepEqual(Object.keys(report.qSchoolPathways).sort(), ["EUROPE:FINAL", "EUROPE:FIRST", "UK_IRELAND:FINAL", "UK_IRELAND:FIRST"]);
  assert.ok(report.determinism.sameSeedIdentical && report.determinism.differentSeedDiffers && report.determinism.authoredBackboneStable);
  for (const tier of ["LOCAL", "STANDARD", "FEATURED", "TELEVISED", "MAJOR", "WORLD"]) assert.ok((report.byPresentationTier as Record<string, number>)[tier] > 0, tier);
});

test("instance snapshots preserve the definition they were generated from", async () => {
  const save = await careerFor();
  const [definitionRow] = await rows(sql`SELECT * FROM career_event_definitions WHERE event_database_version = 1 AND definition_key = 'open-championship'`);
  const definition = EVENT_CATALOGUE_V1.find(d => d.key === "open-championship")!;
  assert.equal(definitionRow.definition_hash, definitionHash(definition));
  const [instance] = await rows(sql`SELECT * FROM career_event_instances WHERE career_save_id = ${save.id} AND definition_key = 'open-championship'`);
  const snapshot = instance.snapshot as Record<string, unknown>;
  assert.deepEqual((snapshot.resolvedFrom as Record<string, unknown>).definitionHash, definitionHash(definition));
  assert.deepEqual(snapshot.format, definition.format);
  assert.deepEqual(snapshot.qualificationOutputs, definition.qualificationOutputs);
  assert.equal(snapshot.schedule, undefined, "schedule is resolved into instance columns, not copied");
  // A later edit of the catalogue row cannot rewrite the instance; a changed shipped definition is refused.
  await db.execute(sql`UPDATE career_event_definitions SET definition_hash = ${"0".repeat(64)} WHERE definition_key = 'open-championship'`);
  await assert.rejects(db.transaction(tx => syncEventDefinitions(tx)), /changed inside shipped database version/);
  await db.execute(sql`UPDATE career_event_definitions SET definition_hash = ${definitionHash(definition)} WHERE definition_key = 'open-championship'`);
  const [after] = await rows(sql`SELECT snapshot FROM career_event_instances WHERE career_save_id = ${save.id} AND id = ${instance.id}`);
  assert.deepEqual(after.snapshot, instance.snapshot);
});

test("event database version is honoured, not silently rewritten", async () => {
  const save = await careerFor();
  const before = await rows(sql`SELECT event_database_version, world_seed FROM career_saves WHERE id = ${save.id}`);
  await calendar.calendar(actor, save.id, {});
  assert.deepEqual(await rows(sql`SELECT event_database_version, world_seed FROM career_saves WHERE id = ${save.id}`), before);
  await db.execute(sql`UPDATE career_saves SET event_database_version = 99 WHERE id = ${save.id}`);
  await rejectsStatus(calendar.calendar(actor, save.id, {}), 409);
  assert.equal((await rows(sql`SELECT event_database_version FROM career_saves WHERE id = ${save.id}`))[0].event_database_version, 99);
});

// ------------------------------------------------------------------ lifecycle / immutability
test("lifecycle transitions are validated in code and in the database", async () => {
  assert.ok(canTransition("SCHEDULED", "REGISTRATION_OPEN") && canTransition("IN_PROGRESS", "COMPLETED"));
  for (const [from, to] of [["IN_PROGRESS", "SCHEDULED"], ["COMPLETED", "IN_PROGRESS"], ["SCHEDULED", "COMPLETED"], ["DRAWN", "REGISTRATION_OPEN"], ["CANCELLED", "SCHEDULED"]] as const) {
    assert.throws(() => assertTransition(from, to), /Invalid Career event transition/);
  }
  const save = await careerFor();
  const [event] = await rows(sql`SELECT id FROM career_event_instances WHERE career_save_id = ${save.id} AND status = 'SCHEDULED' AND start_day > 1 ORDER BY instance_key LIMIT 1`);
  await rejectsWith(db.execute(sql`UPDATE career_event_instances SET status = 'IN_PROGRESS' WHERE career_save_id = ${save.id} AND id = ${event.id}`), /Invalid Career event transition SCHEDULED -> IN_PROGRESS/);
  await rejectsWith(db.execute(sql`UPDATE career_event_instances SET start_day = start_day - 1 WHERE career_save_id = ${save.id} AND id = ${event.id} AND start_day > 1`), /immutable/);
  await db.execute(sql`UPDATE career_event_instances SET status = 'CANCELLED', status_reason = 'TEST' WHERE career_save_id = ${save.id} AND id = ${event.id}`);
  await rejectsWith(db.execute(sql`UPDATE career_event_instances SET status_reason = 'REWRITE' WHERE career_save_id = ${save.id} AND id = ${event.id}`), /historical and immutable/);
});

// ------------------------------------------------------------------ eligibility
test("eligibility composes ALL/ANY/NOT with structured denial reasons", () => {
  const rule = R.all(R.nonTourCard(), R.any(R.qualified("q-school-final:UK_IRELAND"), R.ranking("pro-world", 64)), R.not(R.country("NLD")));
  assert.deepEqual(evaluateRule(rule, facts()), { eligible: false, reasons: ["REQUIRES_QUALIFICATION", "REQUIRES_RANKING"] });
  assert.deepEqual(evaluateRule(rule, facts({ entitlementTargets: new Set(["q-school-final:UK_IRELAND"]) })), { eligible: true, reasons: [] });
  assert.deepEqual(evaluateRule(rule, facts({ entitlementTargets: new Set(["q-school-final:UK_IRELAND"]), tourCard: true })).reasons, ["TOUR_CARD_HOLDER_EXCLUDED"]);
  assert.equal(evaluateRule(rule, facts({ entitlementTargets: new Set(["q-school-final:UK_IRELAND"]), country: "NLD", zone: "EUROPE" })).eligible, false);
  assert.deepEqual(evaluateRule(R.tourCard(), facts({ tourCard: null })).reasons, ["REQUIRES_TOUR_CARD"], "unknown Tour Card authority never grants access");
  assert.equal(evaluateRule(R.defendingChampion(), facts()).eligible, false, "defending champion is opt-in per event");
  assert.equal(evaluateRule(R.result("world-dart-series", 2, "SAME"), facts({ results: { SAME: new Map([["world-dart-series", 2]]), PREVIOUS: new Map() } })).eligible, true);
});

test("entry returns structured denials and never duplicates", async () => {
  const save = await careerFor();
  const view = await calendar.calendar(actor, save.id, {});
  const find = (pred: (e: (typeof view.events)[number]) => boolean) => view.events.find(pred)!;
  const pro = find(e => e.circuit === "PRO_CIRCUIT");
  assert.ok(pro.human!.denials.includes("REQUIRES_TOUR_CARD"));
  const unsupported = find(e => !e.capability.executable && e.status === "REGISTRATION_OPEN");
  const denied = await calendar.enter(actor, save.id, { eventId: unsupported.id });
  assert.equal(denied.entered, false);
  assert.ok(denied.denials.includes("UNSUPPORTED_FORMAT"));
  const future = find(e => e.status === "SCHEDULED");
  assert.ok((await calendar.enter(actor, save.id, { eventId: future.id })).denials.includes("REGISTRATION_NOT_OPEN"));
  const final = find(e => e.definitionKey === "q-school-final-uk_ireland-d1");
  assert.ok(final.human!.denials.includes("REQUIRES_QUALIFICATION"));
  const open = find(e => e.human!.canEnter && e.capability.executable);
  const first = await calendar.enter(actor, save.id, { eventId: open.id });
  const second = await calendar.enter(actor, save.id, { eventId: open.id });
  assert.deepEqual([first.entered, first.created, second.entered, second.created], [true, true, true, false]);
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_event_entries WHERE career_save_id = ${save.id} AND event_id = ${open.id}`))[0].n, 1);
});

test("schedule conflicts block impossible human schedules without choosing for the player", async () => {
  const save = await careerFor();
  const { events } = await calendar.calendar(actor, save.id, { scope: "AVAILABLE" });
  const pair = events.flatMap(a => events.filter(b => b.id > a.id && b.dates.startDay <= a.dates.endDay && a.dates.startDay <= b.dates.endDay && !a.series && !b.series).map(b => [a, b] as const))[0];
  assert.ok(pair, "fixture needs two overlapping enterable events");
  assert.equal((await calendar.enter(actor, save.id, { eventId: pair[0].id })).entered, true);
  const blocked = await calendar.enter(actor, save.id, { eventId: pair[1].id });
  assert.equal(blocked.entered, false);
  assert.ok(blocked.denials.includes("SCHEDULE_CONFLICT"));
  assert.deepEqual(blocked.event.human!.conflictsWith, [pair[0].id]);
  // Withdrawal releases the booking; the player chooses.
  assert.equal((await calendar.withdraw(actor, save.id, { eventId: pair[0].id })).withdrawn, true);
  assert.equal((await calendar.enter(actor, save.id, { eventId: pair[1].id })).entered, true);
  // Database primary key also refuses a raw double booking.
  await assert.rejects(db.execute(sql`INSERT INTO career_participant_bookings (career_save_id, season, participant_key, day, event_id) VALUES (${save.id}, 1, 'HUMAN', ${pair[1].dates.startDay}, ${pair[0].id})`));
});

test("Q-School pathways are exclusive and multi-day series enter together", async () => {
  const save = await careerFor();
  const { events } = await calendar.calendar(actor, save.id, { circuit: "Q_SCHOOL" });
  const ukDay2 = events.find(e => e.definitionKey === "q-school-first-uk_ireland-d2")!;
  const result = await calendar.enter(actor, save.id, { eventId: ukDay2.id });
  assert.equal(result.entered, true);
  const entered = await rows(sql`SELECT i.definition_key FROM career_event_entries e JOIN career_event_instances i ON i.career_save_id = e.career_save_id AND i.id = e.event_id WHERE e.career_save_id = ${save.id} AND e.participant_key = 'HUMAN' ORDER BY 1`);
  assert.deepEqual(entered.map(r => r.definition_key), ["q-school-first-uk_ireland-d1", "q-school-first-uk_ireland-d2", "q-school-first-uk_ireland-d3"]);
  const europe = events.find(e => e.definitionKey === "q-school-first-europe-d1")!;
  const denied = await calendar.enter(actor, save.id, { eventId: europe.id });
  assert.equal(denied.entered, false);
  assert.ok(denied.denials.includes("NOT_ELIGIBLE") || denied.denials.includes("OUTSIDE_REGION"));
});

test("retired Career saves cannot enter or advance; ownership never leaks", async () => {
  const save = await careerFor();
  const other = await careerFor(2, 1, SEED_B);
  const { events } = await calendar.calendar(actor, save.id, { scope: "AVAILABLE" });
  await rejectsStatus(calendar.event({ playerId: 2 }, save.id, events[0].id), 404);
  await rejectsStatus(calendar.event(actor, save.id, other.id), 404);
  await rejectsStatus(calendar.enter({ playerId: 2 }, save.id, { eventId: events[0].id }), 404);
  await rejectsStatus(calendar.enter(actor, other.id, { eventId: events[0].id }), 404);
  await saves.retire(1, save.id);
  await rejectsStatus(calendar.enter(actor, save.id, { eventId: events[0].id }), 409);
  await rejectsStatus(calendar.advance(actor, save.id, { operationKey: "retired-advance", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 1 } }), 409);
  const view = await calendar.calendar(actor, save.id, {});
  assert.ok(view.events.every(e => e.human!.denials.includes("CAREER_NOT_ACTIVE")), "archived saves stay readable but inert");
  await db.execute(sql`UPDATE feature_flags SET enabled = false`);
  await rejectsStatus(calendar.calendar(actor, other.id, {}), 404);
});

test("retired NPCs are never selected into fields", async () => {
  const save = await careerFor();
  const retired = (await rows(sql`UPDATE career_world_players SET status = 'RETIRED', stage = 'RETIRED', retired_season = 1
    WHERE career_save_id = ${save.id} AND id IN (SELECT id FROM career_world_players WHERE career_save_id = ${save.id} AND tier IN ('GRASSROOTS','AMATEUR') ORDER BY world_key LIMIT 40) RETURNING id`)).map(r => String(r.id));
  await calendar.advance(actor, save.id, { operationKey: "retired-npcs-week", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 1 } });
  const entered = await rows(sql`SELECT COUNT(*)::int AS n FROM career_event_entries WHERE career_save_id = ${save.id} AND npc_id IN (${sql.join(retired.map(id => sql`${id}::uuid`), sql`, `)})`);
  assert.equal(entered[0].n, 0);
  assert.ok(Number((await rows(sql`SELECT COUNT(*)::int AS n FROM career_event_entries WHERE career_save_id = ${save.id}`))[0].n) > 0, "fields still assembled from active NPCs");
});

// ------------------------------------------------------------------ formats
test("only 501 double-out legs knockout is executable; everything else is explicit UNSUPPORTED_FORMAT", () => {
  assert.deepEqual(assessCapability(knockout501([5, 7], "floor")), { executable: true, engine: "A2_501_DO_KNOCKOUT", simulationVersion: 1 });
  const cases: [string, ReturnType<typeof knockout501>, string][] = [
    ["sets", setsKnockout501([3, 5], 5, "major", 3), "SET_PLAY"], ["double-in", x01Variant(501, "DOUBLE", [5], "local"), "IN_RULE"],
    ["301", x01Variant(301, "STRAIGHT", [5], "local"), "STARTING_SCORE"], ["cricket", specialGame("CRICKET", [3]), "GAME_TYPE"],
    ["groups", groupKnockout501(9, [11], 4, 2, "major", 4), "STRUCTURE"], ["league", league501(11, "stage", 16), "STRUCTURE"], ["pairs", pairs501([3]), "PAIRS"],
  ];
  for (const [name, format, reason] of cases) {
    const capability = assessCapability(format);
    assert.equal(capability.executable, false, name);
    assert.ok(!capability.executable && capability.code === "UNSUPPORTED_FORMAT" && capability.reasons.includes(reason as never), name);
  }
  const wc = EVENT_CATALOGUE_V1.find(d => d.key === "world-darts-championship")!;
  assert.equal(assessCapability(wc.format).executable, false, "the sets-play Palace is not faked as legs");
  assert.equal(wc.format.scoringUnit, "SETS");
});

// ------------------------------------------------------------------ draws
test("draws are deterministic, give byes to the top seed numbers and never pair two byes", () => {
  assert.deepEqual(bracketOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  for (let n = 2; n <= 128; n++) {
    const entrants = Array.from({ length: n }, (_, i) => `p${String(i).padStart(3, "0")}`);
    const a = generateKnockoutDraw(entrants, [], 0, scopedRandom(HARNESS_SEED, 1, "draw-test", n));
    const b = generateKnockoutDraw(entrants, [], 0, scopedRandom(HARNESS_SEED, 1, "draw-test", n));
    assert.deepEqual(a, b);
    assert.equal(a.byes, a.size - n);
    assert.equal(a.positions.filter(p => p.participantKey).length, n);
  }
  const seeded = generateKnockoutDraw(Array.from({ length: 24 }, (_, i) => `p${i}`), ["p5", "p9"], 8, scopedRandom(HARNESS_SEED, 1, "seeded"));
  const pos = (k: string) => seeded.positions.find(p => p.participantKey === k)!.position;
  assert.ok(pos("p5") <= 16 && pos("p9") > 16, "seeds 1 and 2 are in opposite halves");
  assert.equal(seeded.positions[1].participantKey, null, "seed 1 receives a bye");
  assert.deepEqual([finishingPosition(3, 3), finishingPosition(2, 3), finishingPosition(1, 3)], [2, 3, 5]);
});

// ------------------------------------------------------------------ cadence / advancement
test("multi-week advance processes each A2 week exactly once and retries return the stored result", async () => {
  const save = await careerFor();
  const body = { operationKey: "advance-four-weeks", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 4 } };
  const first = await calendar.advance(actor, save.id, body) as { to: { season: number; week: number }; weeksPlayed: number };
  assert.deepEqual([first.to.season, first.to.week, first.weeksPlayed], [1, 5, 4]);
  const periods = await rows(sql`SELECT sequence, request FROM career_world_periods WHERE career_save_id = ${save.id} AND kind = 'PERIOD' ORDER BY sequence`);
  assert.deepEqual(periods.map(p => p.sequence), [1, 2, 3, 4]);
  for (const p of periods) assert.equal((p.request as { elapsedYears: number }).elapsedYears, DEVELOPMENT_CADENCE.elapsedYearsPerPeriod);
  const matches = Number((await rows(sql`SELECT COUNT(*)::int AS n FROM career_simulated_matches WHERE career_save_id = ${save.id}`))[0].n);
  assert.ok(matches > 50, "many matches were played");
  const world = (await rows(sql`SELECT period FROM career_world_state WHERE career_save_id = ${save.id}`))[0];
  assert.equal(world.period, 4, "matches never advance development; only weeks do");
  const retry = await calendar.advance(actor, save.id, body) as { to: { week: number } };
  assert.equal(retry.to.week, 5);
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_world_periods WHERE career_save_id = ${save.id}`))[0].n, 4);
  await rejectsStatus(calendar.advance(actor, save.id, { ...body, target: { kind: "WEEKS", weeks: 2 } }), 409);
  await rejectsStatus(calendar.advance(actor, save.id, { ...body, operationKey: "stale-advance" }), 409);
  const [season] = await rows(sql`SELECT played_week, developed_week FROM career_seasons WHERE career_save_id = ${save.id} AND season = 1`);
  assert.deepEqual([season.played_week, season.developed_week], [4, 4]);
  assert.equal((await saves.read(1, save.id)).currentWeek, 5);
});

test("next-meaningful-date advancement stops at the human's events and never skips past them", async () => {
  const save = await careerFor();
  const { events } = await calendar.calendar(actor, save.id, { scope: "AVAILABLE" });
  const target = events.filter(e => e.capability.executable && e.dates.startWeek >= 3 && !e.series).sort((a, b) => a.dates.startWeek - b.dates.startWeek)[0];
  assert.equal((await calendar.enter(actor, save.id, { eventId: target.id })).entered, true);
  let week = 1;
  for (let i = 0; i < 10 && week < target.dates.startWeek; i++) {
    const r = await calendar.advance(actor, save.id, { operationKey: `meaningful-${i}`, expectedSeason: 1, expectedWeek: week, target: { kind: "NEXT_MEANINGFUL" } }) as { to: { week: number }; stop: { reason: string; detail?: { type: string; eventId: string }[] } };
    assert.ok(r.to.week <= target.dates.startWeek, "never skips the entered event");
    assert.equal(r.stop.reason, "MEANINGFUL_DATE");
    week = r.to.week;
    if (week === target.dates.startWeek) assert.ok(r.stop.detail!.some(d => d.type === "HUMAN_EVENT" && d.eventId === target.id));
  }
  assert.equal(week, target.dates.startWeek);
  const view = await calendar.calendar(actor, save.id, {});
  assert.ok(view.overview.currentWeekActions.some(a => a.eventId === target.id));
});

// ------------------------------------------------------------------ isolation / cascade / Classic Tour
test("save isolation, deletion and restart cascade every A3 row", async () => {
  const a = await careerFor(1, 1);
  const b = await careerFor(1, 2, SEED_B);
  const counts = async (id: string) => Object.fromEntries(await Promise.all(["career_seasons", "career_event_instances", "career_event_entries", "career_participant_bookings",
    "career_tournament_matches", "career_event_results", "career_qualification_entitlements", "career_calendar_operations"].map(async t => [t,
      (await rows(sql`SELECT COUNT(*)::int AS n FROM ${sql.raw(t)} WHERE career_save_id = ${id}`))[0].n])));
  const beforeB = await counts(b.id);
  const snapshotB = await rows(sql`SELECT id, status, entrant_count FROM career_event_instances WHERE career_save_id = ${b.id} ORDER BY id`);
  await calendar.advance(actor, a.id, { operationKey: "isolation-advance", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 2 } });
  assert.deepEqual(await counts(b.id), beforeB);
  assert.deepEqual(await rows(sql`SELECT id, status, entrant_count FROM career_event_instances WHERE career_save_id = ${b.id} ORDER BY id`), snapshotB);
  const afterA = await counts(a.id);
  assert.ok(afterA.career_tournament_matches > 0 && afterA.career_event_results > 0);
  const restarted = await saves.restart(1, a.id);
  assert.deepEqual(Object.values(await counts(a.id)), Object.values(afterA).map(() => 0), "restart cascades the old universe");
  await calendar.initialize(actor, restarted.id);
  assert.equal((await counts(restarted.id)).career_tournament_matches, 0);
  await saves.delete(1, restarted.id);
  assert.ok(Object.values(await counts(restarted.id)).every(n => n === 0));
  assert.deepEqual(await counts(b.id), beforeB);
});

test("Classic Tour data and code are untouched by A3", async () => {
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM tour_events`))[0].n, 2);
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM tour_trophies`))[0].n, 305);
  const save = await careerFor();
  await calendar.advance(actor, save.id, { operationKey: "tour-regression", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 1 } });
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM tour_trophies`))[0].n, 305);
  // The Classic Tour seed is byte-identical to the approved A2 baseline.
  const tourSeed = readFileSync(new URL("../tourSeed.ts", import.meta.url));
  assert.equal(createHash("sha256").update(tourSeed).digest("hex"), TOUR_SEED_SHA256);
  const calendarSources = ["catalogue", "engine", "service", "generation", "eligibility", "formats", "geography", "providers", "selection", "draw", "config", "harness", "router"]
    .map(name => readFileSync(new URL(`../../career/calendar/${name}.ts`, import.meta.url), "utf8")).join("\n");
  assert.ok(!/from ["'][^"']*tour/i.test(calendarSources), "Career calendar does not import Classic Tour modules");
  assert.ok(!/tour_(events|trophies|progress)/i.test(readFileSync(new URL("../../db/migrations/create_career_calendar.ts", import.meta.url), "utf8")));
});
/** sha256 of artifacts/api-server/src/lib/tourSeed.ts at approved A2 commit 92b09c7 (61 events / 305 trophies). */
const TOUR_SEED_SHA256 = "bd9c35ae2b2c8c1b560be03987972a9d9432e0019d167c8c62e171e7bbc4b994";
