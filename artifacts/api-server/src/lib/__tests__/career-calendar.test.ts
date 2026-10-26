import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import {createCareerSponsorshipFoundation} from "../../db/migrations/create_career_sponsorship_foundation.ts";
import { createCareerNpcSponsorMarketSPF } from "../../db/migrations/create_career_npc_sponsor_market_spf.ts";
import { createCareerCalendar, syncEventDefinitions } from "../../db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../../db/migrations/create_career_finance.ts";
import { createCareerSporting } from "../../db/migrations/create_career_sporting.ts";
import { createCareerSponsorHQSPD } from "../../db/migrations/create_career_sponsor_hq_spd.ts";
import { ensureCareerCountyTeams } from "../../db/migrations/create_career_county_teams.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerCalendarService } from "../../career/calendar/service.ts";
import { generateSeason, calendarHashOf, definitionHash } from "../../career/calendar/generation.ts";
import { EVENT_CATALOGUE_V1, catalogueFor } from "../../career/calendar/catalogue.ts";
import { assessCapability, knockout501, setsKnockout501, groupKnockout501, league501, x01Variant, specialGame, pairs501 } from "../../career/calendar/formats.ts";
import { evaluateRule, R, type ParticipantFacts } from "../../career/calendar/eligibility.ts";
import { bracketOrder, generateKnockoutDraw, finishingPosition } from "../../career/calendar/draw.ts";
import { assertTransition, canTransition, calculateAnzStandings } from "../../career/calendar/engine.ts";
import { anzLegsWonAgainstThrow, anzTournamentAverage } from "../../career/calendar/anz-stats.ts";
import { CURRENT_EVENT_DATABASE_VERSION, SEASON_GROUPINGS, WEEKS_PER_SEASON, DEVELOPMENT_CADENCE } from "../../career/calendar/config.ts";
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
  await createCareerSponsorshipFoundation(db); await createCareerNpcSponsorMarketSPF(db);
  await createCareerCalendar(db);
  await db.transaction(tx => ensureCareerCountyTeams(tx));
  await createCareerFinance(db); await createCareerSporting(db); // A3 weekly settlement reads A5 ranking tables via life commitments (SP-G/SP-H)
  await createCareerSponsorHQSPD(db);
});
beforeEach(async () => { await pg.exec("DELETE FROM career_saves; UPDATE feature_flags SET enabled=true, admin_test_mode=false"); });
after(async () => { await pg.close(); });

async function careerFor(player = 1, slot = 1, seed = HARNESS_SEED) {
  const save = await saves.create(player, { slot });
  // Preserve this original A3 regression fixture; v5 adds age-aware intake.
  await db.execute(sql`UPDATE career_saves SET world_seed = ${seed},event_database_version=2,player_database_version=1 WHERE id = ${save.id}`);
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
  assert.deepEqual(SEASON_GROUPINGS.map(g => [g.fromWeek, g.toWeek]), [[1, 6], [7, 17], [18, 28], [29, 38], [39, 46], [47, 52]]);
});

test("2026 WDF World Open and qualifying divisions are playable and connect to world entries", () => {
  const definitions = catalogueFor(24);
  const expected = [
    "world-ranking-open", "women-world-ranking-open", "youth-world-ranking-open", "girls-world-ranking-open",
    "lakeside-qualifier-open", "lakeside-qualifier-women", "lakeside-qualifier-youth", "lakeside-qualifier-girls",
    "uk-lakeside-qualifier-open", "uk-lakeside-qualifier-women", "uk-lakeside-qualifier-youth", "uk-lakeside-qualifier-girls",
  ];
  const drafts = generateSeason(HARNESS_SEED, 24, 1);
  const eventDrafts = drafts.filter(d => expected.includes(d.definitionKey));
  assert.equal(eventDrafts.length, expected.length);
  assert.ok(eventDrafts.every(d => d.executable), "all WDF divisions must run in the Career tournament engine");
  const qualifiers = definitions.filter(d => expected.some(key => key.includes("qualifier") && d.key === key));
  assert.equal(qualifiers.length, 8);
  for (const qualifier of qualifiers) {
    const output = qualifier.qualificationOutputs[0];
    assert.ok(output, `${qualifier.key} must grant a world-championship place`);
    const target = definitions.find(d => d.key === output.targetKey);
    assert.ok(target, `${qualifier.key} must point to a real event definition`);
    assert.ok(target!.entitlementIntake.includes(output.targetKey), `${output.targetKey} must accept qualifier entries`);
  }
});

test("the verified PDC Women's Series 21–24 events are present and playable", () => {
  const womenEvents = generateSeason(HARNESS_SEED, 24, 1).filter(d => d.definitionKey === "women-tour");
  assert.equal(womenEvents.length, 24);
  assert.ok(womenEvents.every(d => d.executable), "all 24 events must be playable");
});

test("confirmed PDC annual tour coverage includes 24 Development and 15 European events", () => {
  const drafts = generateSeason(HARNESS_SEED, 24, 1);
  const development = drafts.filter(d => d.definitionKey === "development-tour");
  const european = drafts.filter(d => d.definitionKey === "european-dart-series");
  assert.equal(development.length, 24);
  assert.ok(development.every(d => d.executable));
  assert.equal(european.length, 15);
  assert.ok(european.every(d => d.executable));
  assert.ok(catalogueFor(24).find(d => d.key === "development-tour")!.eligibility);
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

test("the current Career event edition has no formats that cannot reach the live scorer", () => {
  const current = generateSeason(HARNESS_SEED, CURRENT_EVENT_DATABASE_VERSION, 1);
  const unsupported = current.filter(event => !event.executable);
  assert.equal(unsupported.length, 0, unsupported.map(event => {
    const capability = event.snapshot.capability;
    return `${event.name}: ${capability.executable ? "unexpected supported classification" : capability.reasons.join(",")}`;
  }).join("\n"));
});

test("v35 adds distinct WDF youth and authored Under-23 event divisions without rewriting v34", () => {
  const v34 = catalogueFor(34);
  const current = catalogueFor(35);
  assert.equal(v34.find(d => d.key === "wdf-world-girls-championship")!.rankingCategory, "YOUTH");
  assert.equal(current.find(d => d.key === "wdf-world-girls-championship")!.rankingCategory, "WDF_YOUTH_GIRLS");
  assert.equal(current.find(d => d.key === "youth-world-championship")!.rankingCategory, "WDF_YOUTH_OPEN");
  const open = current.find(d => d.key === "u23-world-ranking-open")!;
  const girls = current.find(d => d.key === "u23-girls-world-ranking-open")!;
  const generated = generateSeason(HARNESS_SEED, 35, 1).filter(d =>
    d.definitionKey === "u23-world-ranking-open" || d.definitionKey === "u23-girls-world-ranking-open");
  assert.equal(generated.length, 2);
  assert.ok(generated.every(d => d.executable));
  assert.equal(open.rankingCategory, "WDF_U23_OPEN");
  assert.equal(girls.rankingCategory, "WDF_U23_GIRLS");
  assert.match(open.legacyConcept!, /Career-authored/);
  assert.equal(open.eventDatabaseVersion, 35);
  assert.equal(girls.eventDatabaseVersion, 35);
});

test("instance snapshots preserve the definition they were generated from", async () => {
  const save = await careerFor();
  // The original A3 regression fixture intentionally stays on v2; its snapshot must match that edition.
  const version = Number((await rows(sql`SELECT event_database_version FROM career_saves WHERE id = ${save.id}`))[0].event_database_version);
  const [definitionRow] = await rows(sql`SELECT * FROM career_event_definitions WHERE event_database_version = ${version} AND definition_key = 'open-championship'`);
  const definition = catalogueFor(version).find(d => d.key === "open-championship")!;
  assert.equal(definitionRow.definition_hash, definitionHash(definition));
  const [instance] = await rows(sql`SELECT * FROM career_event_instances WHERE career_save_id = ${save.id} AND definition_key = 'open-championship'`);
  const snapshot = instance.snapshot as Record<string, unknown>;
  assert.deepEqual((snapshot.resolvedFrom as Record<string, unknown>).definitionHash, definitionHash(definition));
  assert.deepEqual(snapshot.format, definition.format);
  assert.deepEqual(snapshot.qualificationOutputs, definition.qualificationOutputs);
  assert.equal(snapshot.schedule, undefined, "schedule is resolved into instance columns, not copied");
  // Legacy definitions remain pinned in the DB; a changed current definition is refused.
  await db.execute(sql`UPDATE career_event_definitions SET definition_hash = ${"0".repeat(64)} WHERE definition_key = 'open-championship' AND event_database_version = ${version}`);
  await assert.doesNotReject(db.transaction(tx => syncEventDefinitions(tx)));
  await db.execute(sql`UPDATE career_event_definitions SET definition_hash = ${definitionHash(definition)} WHERE definition_key = 'open-championship' AND event_database_version = ${version}`);
  const currentDefinition = catalogueFor(CURRENT_EVENT_DATABASE_VERSION).find(d => d.key === "open-championship")!;
  await db.execute(sql`UPDATE career_event_definitions SET definition_hash = ${"0".repeat(64)} WHERE definition_key = 'open-championship' AND event_database_version = ${CURRENT_EVENT_DATABASE_VERSION}`);
  await assert.rejects(db.transaction(tx => syncEventDefinitions(tx)), /changed inside current shipped database version/);
  await db.execute(sql`UPDATE career_event_definitions SET definition_hash = ${definitionHash(currentDefinition)} WHERE definition_key = 'open-championship' AND event_database_version = ${CURRENT_EVENT_DATABASE_VERSION}`);
  const [after] = await rows(sql`SELECT snapshot FROM career_event_instances WHERE career_save_id = ${save.id} AND id = ${instance.id}`);
  assert.deepEqual(after.snapshot, instance.snapshot);
});

test("calendar reads migrate old event editions but preserve the world seed", async () => {
  const migrationActor = { playerId: 2 };
  const save = await careerFor(migrationActor.playerId);
  await calendar.calendar(migrationActor, save.id, {});
  const stale = (await rows(sql`SELECT id FROM career_event_instances WHERE career_save_id=${save.id} AND definition_key='club-league-night'
    AND country='NZL' AND start_week>(SELECT current_week FROM career_saves WHERE id=${save.id})
    AND status IN ('SCHEDULED','REGISTRATION_OPEN') LIMIT 1`))[0];
  assert.ok(stale, "a future Auckland club night exists in the old save");
  // Recreate the stale persisted snapshot from a pre-v26 save. Production
  // updates remain guarded; only this isolated migration fixture bypasses it.
  await db.execute(sql`DELETE FROM career_calendar_addons WHERE career_save_id=${save.id} AND addon='career-events-v35'`);
  await db.execute(sql`ALTER TABLE career_event_instances DISABLE TRIGGER career_event_instances_history_guard`);
  try {
    await db.execute(sql`UPDATE career_event_instances SET event_database_version=25,
      snapshot=jsonb_set(snapshot,'{eligibility}','{"type":"PRO_STATUS","status":"AMATEUR"}'::jsonb) WHERE id=${stale.id}`);
  } finally {
    await db.execute(sql`ALTER TABLE career_event_instances ENABLE TRIGGER career_event_instances_history_guard`);
  }
  await db.execute(sql`UPDATE career_saves SET event_database_version=26 WHERE id=${save.id}`);
  const before = await rows(sql`SELECT event_database_version, world_seed FROM career_saves WHERE id = ${save.id}`);
  const upgradedCalendar = await calendar.calendar(migrationActor, save.id, {});
  assert.deepEqual(await rows(sql`SELECT event_database_version, world_seed FROM career_saves WHERE id = ${save.id}`), [
    { event_database_version: CURRENT_EVENT_DATABASE_VERSION, world_seed: before[0].world_seed },
  ]);
  const visibleAuckland = (upgradedCalendar.events as Array<{ definitionKey: string; venue: { country: string }; human: { eligible: boolean } }>)
    .find(event => event.definitionKey === "club-league-night" && event.venue.country === "NZL");
  assert.ok(visibleAuckland, "the migrated Auckland club night is visible in the calendar");
  assert.equal(visibleAuckland.human.eligible, false, "the live calendar blocks this Scottish player from Auckland");
  const migrated = (await rows(sql`SELECT event_database_version,snapshot FROM career_event_instances WHERE career_save_id=${save.id}
    AND definition_key='club-league-night' AND country='NZL' AND start_week>(SELECT current_week FROM career_saves WHERE id=${save.id})
    AND status IN ('SCHEDULED','REGISTRATION_OPEN') LIMIT 1`))[0];
  assert.equal(Number(migrated.event_database_version), CURRENT_EVENT_DATABASE_VERSION, "the future fixture is rebuilt from the new immutable edition");
  const migratedSnapshot = migrated.snapshot as { eligibility: Parameters<typeof evaluateRule>[0] };
  assert.equal(evaluateRule(migratedSnapshot.eligibility, facts({ country: "GBR", zone: "UK_IRELAND", locality: "ayrshire" })).eligible, false,
    "existing Scottish saves cannot enter the retained Auckland fixture");
  const migratedWdf = (await rows(sql`SELECT event_database_version, snapshot FROM career_event_instances
    WHERE career_save_id=${save.id} AND definition_key='women-world-championship' AND season=1
      AND start_week>(SELECT current_week FROM career_saves WHERE id=${save.id})
      AND status IN ('SCHEDULED','REGISTRATION_OPEN') LIMIT 1`))[0];
  assert.ok(migratedWdf, "the existing save retains its future WDF Women's World Championship");
  assert.equal(Number(migratedWdf.event_database_version), CURRENT_EVENT_DATABASE_VERSION, "future WDF fixtures migrate to the current edition");
  const wdfEligibility = (migratedWdf.snapshot as { eligibility: unknown }).eligibility;
  assert.ok(JSON.stringify(wdfEligibility).includes('"type":"NON_TOUR_CARD"'),
    "the migrated WDF event excludes current PDC Tour Card holders");
  const nzClubNight = generateSeason(String(before[0].world_seed), CURRENT_EVENT_DATABASE_VERSION, 1)
    .find(event => event.definitionKey === "club-league-night" && event.country === "NZL");
  assert.ok(nzClubNight, "the upgraded calendar edition includes the New Zealand club fixture");
  const clubEligibility = nzClubNight.snapshot.eligibility;
  assert.equal(evaluateRule(clubEligibility, facts({ country: "GBR", zone: "UK_IRELAND", locality: "ayrshire" })).eligible, false,
    "an existing Scottish save cannot enter a New Zealand grassroots night");
  assert.equal(evaluateRule(clubEligibility, facts({ country: "NZL", zone: "REST_OF_WORLD", locality: "auckland" })).eligible, true,
    "players local to the host country can enter");
  const anz = await rows(sql`SELECT definition_key, executable, start_week FROM career_event_instances
    WHERE career_save_id = ${save.id} AND definition_key IN (
      'anz-premier-night-1','anz-premier-night-2','anz-premier-night-3',
      'anz-premier-night-4','anz-premier-night-5','anz-premier-finals'
    ) ORDER BY start_week`);
  assert.equal(anz.length, 6, "an existing Career save receives the complete six-night Oceania series");
  assert.ok(anz.every(row => row.executable === true), "every ANZ series night is playable");
  assert.deepEqual(anz.map(row => Number(row.start_week)), [39,40,41,42,43,44]);
  const youthCupDivisions = await rows(sql`SELECT definition_key, executable FROM career_event_instances
    WHERE career_save_id = ${save.id} AND definition_key IN (
      'continental-youth-cup-singles', 'continental-youth-cup-pairs',
      'continental-girls-youth-cup-singles', 'continental-girls-youth-cup-pairs'
    ) ORDER BY definition_key`);
  assert.equal(youthCupDivisions.length, 4, "an existing save receives all future playable youth cup divisions");
  assert.ok(youthCupDivisions.every(row => row.executable === true), "each added division is executable");
  const additionalWdf = await rows(sql`SELECT definition_key, executable FROM career_event_instances
    WHERE career_save_id = ${save.id} AND definition_key IN (
      'world-ranking-open', 'women-world-ranking-open', 'youth-world-ranking-open', 'girls-world-ranking-open',
      'lakeside-qualifier-open', 'lakeside-qualifier-women', 'lakeside-qualifier-youth', 'lakeside-qualifier-girls',
      'uk-lakeside-qualifier-open', 'uk-lakeside-qualifier-women', 'uk-lakeside-qualifier-youth', 'uk-lakeside-qualifier-girls'
    )`);
  assert.equal(additionalWdf.length, 12, "existing saves receive all verified World Open and qualifier divisions");
  assert.ok(additionalWdf.every(row => row.executable === true), "all World Open and qualifier divisions are executable");
  const refreshedPdc = await rows(sql`SELECT definition_key, count(*)::int AS count, bool_and(executable) AS playable
    FROM career_event_instances
    WHERE career_save_id = ${save.id} AND definition_key IN ('development-tour', 'european-dart-series', 'women-tour')
    GROUP BY definition_key`);
  const pdcCounts = Object.fromEntries(refreshedPdc.map(row => [row.definition_key, Number(row.count)]));
  assert.equal(pdcCounts["development-tour"], 24, "existing saves receive the completed Development Tour calendar");
  assert.equal(pdcCounts["european-dart-series"], 15, "existing saves receive all stops through ET15");
  assert.equal(pdcCounts["women-tour"], 24, "existing saves keep the completed Women's Series calendar");
  assert.ok(refreshedPdc.every(row => row.playable === true), "all migrated PDC fixtures remain playable");
  await db.execute(sql`UPDATE career_saves SET event_database_version = 99 WHERE id = ${save.id}`);
  await rejectsStatus(calendar.calendar(migrationActor, save.id, {}), 409);
  assert.equal((await rows(sql`SELECT event_database_version FROM career_saves WHERE id = ${save.id}`))[0].event_database_version, 99);
});

test("every current qualification grant has a matching eligible event consumer", () => {
  const definitions = catalogueFor(CURRENT_EVENT_DATABASE_VERSION);
  const hasQualification = (rule: Parameters<typeof evaluateRule>[0], key: string): boolean => {
    if ("all" in rule) return rule.all.some(child => hasQualification(child, key));
    if ("any" in rule) return rule.any.some(child => hasQualification(child, key));
    if ("not" in rule) return false;
    return rule.type === "QUALIFICATION" && rule.targetKey === key;
  };
  const grants = definitions.flatMap(source => source.qualificationOutputs.map(output => ({ source, output })));
  assert.ok(grants.length > 0, "the current edition has qualification paths");
  for (const { source, output } of grants) {
    const consumers = definitions.filter(target => hasQualification(target.eligibility, output.targetKey));
    assert.ok(consumers.length > 0, `${source.key} grants ${output.targetKey}, which must unlock an event`);
  }
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
  const unsupported = find(e => !e.capability.executable && e.status === "CANCELLED");
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
test("A6.5 capability: 501 double-out knockouts (straight/double-in, legs or sets) are executable; everything else is explicit UNSUPPORTED_FORMAT", () => {
  const live = { executable: true, engine: "A2_X01_KNOCKOUT", simulationVersion: 1, liveScorer: "GAME_SCORER_X01" };
  assert.deepEqual(assessCapability(knockout501([5, 7], "floor")), live);
  assert.deepEqual(assessCapability(setsKnockout501([3, 5], 5, "major", 3)), live, "set play");
  assert.deepEqual(assessCapability(x01Variant(501, "DOUBLE", [5], "local")), live, "double-in legs");
  assert.deepEqual(assessCapability(setsKnockout501([3, 5], 5, "major", 3, "DOUBLE")), live, "double-in set play");
  const cases: [string, ReturnType<typeof knockout501>, string][] = [
    ["3001", x01Variant(3001, "STRAIGHT", [5], "local"), "STARTING_SCORE"], ["cricket", specialGame("CRICKET", [3]), "GAME_TYPE"],
    ["master-out", { ...knockout501([3], "local"), outRule: "MASTER" }, "OUT_RULE"],
    ["groups", groupKnockout501(9, [11], 4, 2, "major", 4), "STRUCTURE"], ["league", league501(11, "stage", 16), "STRUCTURE"], ["pairs", pairs501([3]), "PAIRS"],
  ];
  for (const [name, format, reason] of cases) {
    const capability = assessCapability(format);
    assert.equal(capability.executable, false, name);
    assert.ok(!capability.executable && capability.code === "UNSUPPORTED_FORMAT" && capability.reasons.includes(reason as never), name);
  }
  const wc = EVENT_CATALOGUE_V1.find(d => d.key === "world-darts-championship")!;
  assert.equal(assessCapability(wc.format).executable, true, "the Palace runs as authored set play");
  assert.equal(wc.format.scoringUnit, "SETS");
});

// ------------------------------------------------------------------ draws
test("Oceania Premier League awards the official nightly points and orders series standings", () => {
  const rows = [
    { participant_key: "p1", participant_kind: "NPC", npc_id: "n1", finishing_position: 1, wins: 3, legs_for: 18, legs_against: 10, metadata: { anzCountback: { complete: true, legsWonAgainstThrow: 4, points: 3000, darts: 100 } } },
    { participant_key: "p1", participant_kind: "NPC", npc_id: "n1", finishing_position: 3, wins: 2, legs_for: 16, legs_against: 12, metadata: { anzCountback: { complete: true, legsWonAgainstThrow: 2, points: 3000, darts: 100 } } },
    { participant_key: "p2", participant_kind: "NPC", npc_id: "n2", finishing_position: 2, wins: 2, legs_for: 15, legs_against: 12, metadata: { anzCountback: { complete: true, legsWonAgainstThrow: 3, points: 3000, darts: 100 } } },
    { participant_key: "p2", participant_kind: "NPC", npc_id: "n2", finishing_position: 1, wins: 3, legs_for: 19, legs_against: 9, metadata: { anzCountback: { complete: true, legsWonAgainstThrow: 5, points: 3000, darts: 100 } } },
    { participant_key: "p3", participant_kind: "NPC", npc_id: "n3", finishing_position: 4, wins: 1, legs_for: 10, legs_against: 14, metadata: { anzCountback: { complete: true, legsWonAgainstThrow: 1, points: 1800, darts: 100 } } },
  ];
  const standings = calculateAnzStandings(rows);
  assert.deepEqual(standings.map(row => [row.participant_key, row.points, row.nightsWon]), [
    ["p2", 8, 1], ["p1", 7, 1], ["p3", 2, 0],
  ]);
});

test("ANZ count-back orders tied points through legs won against throw and weighted average", () => {
  const base = (participant_key: string, legsWonAgainstThrow: number, points: number, darts: number) => ({
    participant_key, participant_kind: "NPC", npc_id: participant_key, finishing_position: 2, wins: 3, legs_for: 12, legs_against: 9,
    metadata: { anzCountback: { complete: true, legsWonAgainstThrow, points, darts } },
  });
  const rows = [base("average", 4, 6000, 200), base("breaks", 5, 5000, 200), base("lower-average", 4, 4500, 200)];
  const standings = calculateAnzStandings(rows);
  assert.deepEqual(standings.map(row => row.participant_key), ["breaks", "average", "lower-average"]);
  assert.equal(standings[0].legsWonAgainstThrow, 5);
  assert.equal(standings[1].tournamentAverage, 90);
});

test("ANZ match count-back records breaks of throw and weighted three-dart averages", () => {
  assert.deepEqual(anzLegsWonAgainstThrow([
    { firstThrow: 0, winner: 0 }, { firstThrow: 1, winner: 0 },
    { firstThrow: 0, winner: 1 }, { firstThrow: 1, winner: 1 },
  ]), [1, 1]);
  assert.equal(anzTournamentAverage(3000, 100), 90);
  assert.equal(anzTournamentAverage(0, 0), null);
});

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
  const matches = Number((await rows(sql`SELECT COUNT(*)::int AS n FROM career_tournament_matches WHERE career_save_id = ${save.id} AND result_source = 'A2_SIMULATION'`))[0].n);
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

test("a retry sent while the first advance is still running joins it (no double advance); another advance is refused", async () => {
  const save = await careerFor();
  const body = { operationKey: "advance-dropped-signal", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 2 } };
  const first = calendar.advance(actor, save.id, body);
  const retry = calendar.advance(actor, save.id, body);
  await rejectsStatus(calendar.advance(actor, save.id, { ...body, operationKey: "advance-second-tab" }), 409);
  const [a, b] = await Promise.all([first, retry]) as { to: { week: number }; weeksPlayed: number }[];
  assert.equal(a, b, "the retry receives the original result");
  assert.deepEqual([a.to.week, a.weeksPlayed], [3, 2]);
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_world_periods WHERE career_save_id = ${save.id}`))[0].n, 2);
  assert.equal((await saves.read(1, save.id)).currentWeek, 3);
  const later = await calendar.advance(actor, save.id, body) as { to: { week: number } };
  assert.equal(later.to.week, 3, "once finished, a late retry gets the stored result");
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
  assert.ok(view.overview!.currentWeekActions.some(a => a.eventId === target.id));
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
  // Career changes must not mutate Classic Tour data or introduce a calendar dependency.
  const calendarSources = ["catalogue", "engine", "service", "generation", "eligibility", "formats", "geography", "providers", "selection", "draw", "config", "harness", "router"]
    .map(name => readFileSync(new URL(`../../career/calendar/${name}.ts`, import.meta.url), "utf8")).join("\n");
  assert.ok(!/from ["'][^"']*tour/i.test(calendarSources), "Career calendar does not import Classic Tour modules");
  assert.ok(!/tour_(events|trophies|progress)/i.test(readFileSync(new URL("../../db/migrations/create_career_calendar.ts", import.meta.url), "utf8")));
});

// ------------------------------------------------------------------ NEXT_MATCH: play straight on to a booked event
test("NEXT_MATCH plays past ordinary stops straight to the human's booked match in one advance", async () => {
  const pick = async (id: string) => {
    const view = await calendar.calendar(actor, id, { scope: "WORLD", fromWeek: 1, toWeek: 8 }) as { events: { id: string; dates: { startWeek: number }; capability: { executable: boolean }; human: { canEnter: boolean } | null }[] };
    return view.events.filter(e => e.human?.canEnter && e.capability.executable && e.dates.startWeek >= 2).sort((x, y) => y.dates.startWeek - x.dates.startWeek)[0];
  };
  const a = await careerFor(1, 1), b = await careerFor(1, 2);
  const target = await pick(a.id);
  assert.ok(target, "an enterable event after week 1");
  for (const s of [a, b]) assert.equal((await calendar.enter(actor, s.id, { eventId: (await pick(s.id)).id }) as { entered: boolean }).entered, true);
  const direct = await calendar.advance(actor, a.id, { operationKey: "next-match-a-1", expectedSeason: 1, expectedWeek: 1, target: { kind: "NEXT_MATCH" } }) as { stop: { reason: string }; to: { week: number } };
  assert.equal(direct.stop.reason, "HUMAN_MATCH_PENDING");
  assert.equal(direct.to.week, target.dates.startWeek);
  // The ordinary advance stops earlier (registration deadlines / the booked week's start) — the reason NEXT_MATCH exists.
  const meaningful = await calendar.advance(actor, b.id, { operationKey: "next-match-b-1", expectedSeason: 1, expectedWeek: 1, target: { kind: "NEXT_MEANINGFUL" } }) as { to: { week: number } };
  assert.ok(meaningful.to.week < direct.to.week, "NEXT_MEANINGFUL stops earlier");
  // Retry-safe like every advance: the same operation key returns the stored outcome.
  const again = await calendar.advance(actor, a.id, { operationKey: "next-match-a-1", expectedSeason: 1, expectedWeek: 1, target: { kind: "NEXT_MATCH" } }) as { stop: { reason: string } };
  assert.equal(again.stop.reason, direct.stop.reason);
});
