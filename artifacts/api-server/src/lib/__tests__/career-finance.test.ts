import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import {createCareerSponsorshipFoundation} from "../../db/migrations/create_career_sponsorship_foundation.ts";
import { createCareerCalendar } from "../../db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../../db/migrations/create_career_finance.ts";
import { createCareerSponsorJourneysSPB } from "../../db/migrations/create_career_sponsor_journeys_spb.ts";
import { createCareerSponsorJourneysSPB3 } from "../../db/migrations/create_career_sponsor_journeys_spb3.ts";
import { createCareerFinanceSPC } from "../../db/migrations/create_career_finance_spc.ts";
import { createCareerSponsorHQSPD } from "../../db/migrations/create_career_sponsor_hq_spd.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerFinanceService } from "../../career/finance/service.ts";
import { materializeSponsorActivities } from "../../career/finance/sponsor-activities.ts";
import { post } from "../../career/finance/ledger.ts";
import { activeContracts, advanceSponsorLifecycle, applyCoverage, evaluateOffers, postDueGuaranteedPayments, profileFor, type ContractRow, type SponsorFactsProvider } from "../../career/finance/engine.ts";
import { scheduleContractGuarantees } from "../../career/finance/sponsor-guarantees.ts";
import type { SponsorApproachSource } from "../../career/finance/sponsor-journey.ts";
import { groupTrips, travelBand, tripCost } from "../../career/finance/travel.ts";
import {
  CURRENT_SPONSOR_DATABASE_VERSION, SPONSOR_GUARANTEE_CONFIGURATION_STATUS, evaluateRequirement,
  SPONSOR_CATALOGUE_V1, sponsorCatalogue, type SportingFacts,
} from "../../career/finance/sponsors.catalogue.ts";
import { PRIZE_PROFILES, prizeForPosition, FEE_PROFILES } from "../../career/finance/config.ts";
import { lockRoot } from "../../career/world/service.ts";
import type { RootRow } from "../../career/calendar/engine.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";

const pg = new PGlite();
const db = drizzle(pg);
const saves = createCareerService(db);
/** Fixture sporting facts (A5 does not exist yet). Mutable per test. */
const fixture: SportingFacts = { careerStarted: true, titles: 0, bestFinishByCircuit: {}, qualifications: [], professionalStatus: "AMATEUR", tourCard: false, worldRanking: null };
const facts: SponsorFactsProvider = { id: "TEST_FIXTURE", facts: async () => structuredClone(fixture) };
const finance = createCareerFinanceService(db, { facts });
const realFacts = createCareerFinanceService(db);
const actor = { playerId: 1 };
type Ev = Awaited<ReturnType<typeof finance.calendar.calendar>>["events"][number] & { finance: Record<string, any> };

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1), (2);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  await createCareerSaves(db); await createCareerWorld(db); await createCareerSponsorshipFoundation(db); await createCareerCalendar(db);
  await createCareerFinance(db); await createCareerSponsorJourneysSPB(db); await createCareerSponsorJourneysSPB3(db);
  await createCareerFinance(db); await createCareerSponsorJourneysSPB(db); await createCareerSponsorJourneysSPB3(db); // idempotent re-run
  await createCareerFinanceSPC(db); await createCareerFinanceSPC(db); // additive A4/SP-B3 migration is idempotent
  await createCareerSponsorHQSPD(db); await createCareerSponsorHQSPD(db);
});
beforeEach(async () => {
  await pg.exec("DELETE FROM career_saves; UPDATE feature_flags SET enabled = true");
  Object.assign(fixture, { titles: 0, bestFinishByCircuit: {}, qualifications: [], professionalStatus: "AMATEUR", tourCard: false, worldRanking: null });
});
after(async () => { await pg.close(); });

async function career(player = 1, slot = 1) {
  const save = await saves.create(player, { slot });
  // Original A4 catalogue/NPC fixtures, not a silent upgrade to the A8.2 content universe.
  await db.execute(sql`UPDATE career_saves SET world_seed = ${HARNESS_SEED},event_database_version=1,player_database_version=1,
    settings_snapshot=settings_snapshot-'sponsorDatabaseVersionAtCreation' WHERE id = ${save.id}`);
  await finance.initialize({ playerId: player }, save.id);
  assert.equal(Number((await rows(sql`SELECT sponsor_database_version FROM career_finance_state WHERE career_save_id=${save.id}`))[0]!.sponsor_database_version),1,
    "the legacy finance fixture must retain its v1 catalogue pin");
  return save;
}
async function careerWithCurrentCatalogue(player = 1, slot = 1) {
  const save = await saves.create(player, { slot });
  await finance.initialize({ playerId: player }, save.id);
  return save;
}
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows;
const rejectsStatus = (p: Promise<unknown>, status: number) => assert.rejects(p, (e: unknown) => (e as { status?: number }).status === status);
const rejectsWith = (p: Promise<unknown>, pattern: RegExp) => assert.rejects(p, (error: unknown) => {
  for (let e = error as { message?: string; cause?: unknown } | undefined, d = 0; e && d < 5; e = e.cause as typeof e, d++) if (pattern.test(String(e.message))) return true;
  return false;
});
test("SP-D materializes only explicit signed clauses, repeatably, without adding compensation",async()=>{
  const save=await career(),offer="00000000-0000-4000-8000-000000000101",contract="00000000-0000-4000-8000-000000000102";
  const root=(await db.execute(sql`SELECT current_season,current_week FROM career_saves WHERE id=${save.id}`)).rows[0]!;
  await db.execute(sql`INSERT INTO career_sponsor_offers
    (career_save_id,id,operation_key,sponsor_key,sponsor_database_version,tier,kind,terms,source,offered_season,offered_week,expires_season,expires_week,status,resolved_at)
    VALUES(${save.id},${offer},'spd-fixture-offer','fixture-local',3,'LOCAL','NEW','{}'::jsonb,'{}'::jsonb,1,1,1,52,'ACCEPTED',NOW())`);
  await db.execute(sql`INSERT INTO career_sponsor_contracts
    (career_save_id,id,offer_id,sponsor_key,sponsor_database_version,tier,terms,start_season,start_week,end_season,end_week,status)
    VALUES(${save.id},${contract},${offer},'fixture-local',3,'LOCAL','{}'::jsonb,1,1,1,52,'ACTIVE')`);
  const specification={version:1 as const,required:[{id:"community-duty",type:"COMMUNITY_APPEARANCE" as const,maxPerSeason:1,windowWeeks:4,firstWindowWeek:8,extraCompensationPence:0 as const}],
    optional:[{id:"community-invite",type:"COMMUNITY_APPEARANCE" as const,maxPerSeason:2,windowWeeks:2,firstWindowWeek:12,compensationPence:0 as const}]};
  const args={saveId:save.id,contractId:contract,sponsorKey:"fixture-local",worldSeed:HARNESS_SEED,season:Number(root.current_season),week:Number(root.current_week),endSeason:1,endWeek:52,specification};
  const beforeMigration=(await rows(sql`SELECT sponsor_database_version,terms FROM career_sponsor_contracts WHERE career_save_id=${save.id} AND id=${contract}`))[0]!;
  await createCareerSponsorHQSPD(db);
  const afterMigration=(await rows(sql`SELECT sponsor_database_version,terms FROM career_sponsor_contracts WHERE career_save_id=${save.id} AND id=${contract}`))[0]!;
  assert.deepEqual(afterMigration,beforeMigration,"re-running the additive migration leaves the existing v3 contract unchanged");
  assert.deepEqual(await db.transaction(tx=>materializeSponsorActivities(tx,{...args,specification:undefined})),{commitments:0,opportunities:0});
  await db.transaction(tx=>materializeSponsorActivities(tx,args)); await db.transaction(tx=>materializeSponsorActivities(tx,args));
  assert.deepEqual((await rows(sql`SELECT COUNT(*)::int n FROM career_sponsor_commitments WHERE career_save_id=${save.id}`))[0]!.n,1);
  assert.deepEqual((await rows(sql`SELECT COUNT(*)::int n FROM career_sponsor_opportunities WHERE career_save_id=${save.id}`))[0]!.n,2);
  assert.equal(Number((await rows(sql`SELECT balance_pence FROM career_saves WHERE id=${save.id}`))[0]!.balance_pence),25000);
  assert.equal((await rows(sql`SELECT COUNT(*)::int n FROM career_sponsor_week_bookings WHERE career_save_id=${save.id}`))[0]!.n,0);

  const lateSave=await career(1,2),lateOffer="00000000-0000-4000-8000-000000000201",lateContract="00000000-0000-4000-8000-000000000202";
  await db.execute(sql`INSERT INTO career_sponsor_offers
    (career_save_id,id,operation_key,sponsor_key,sponsor_database_version,tier,kind,terms,source,offered_season,offered_week,expires_season,expires_week,status,resolved_at)
    VALUES(${lateSave.id},${lateOffer},'spd-late-offer','fixture-local',3,'LOCAL','NEW','{}'::jsonb,'{}'::jsonb,1,1,1,52,'ACCEPTED',NOW())`);
  await db.execute(sql`INSERT INTO career_sponsor_contracts
    (career_save_id,id,offer_id,sponsor_key,sponsor_database_version,tier,terms,start_season,start_week,end_season,end_week,status)
    VALUES(${lateSave.id},${lateContract},${lateOffer},'fixture-local',3,'LOCAL','{}'::jsonb,1,1,1,52,'ACTIVE')`);
  await db.transaction(tx=>materializeSponsorActivities(tx,{...args,saveId:lateSave.id,contractId:lateContract,week:10,
    specification:{version:1,required:[{id:"late-duty",type:"COMMUNITY_APPEARANCE",maxPerSeason:1,windowWeeks:4,firstWindowWeek:8,extraCompensationPence:0}],optional:[]}}));
  const lateWindow=(await rows(sql`SELECT available_from_week,due_week FROM career_sponsor_commitments WHERE career_save_id=${lateSave.id} AND contract_id=${lateContract}`))[0]!;
  assert.deepEqual([Number(lateWindow.available_from_week),Number(lateWindow.due_week)],[11,11],
    "late signing shortens the remaining window; it must not push the authored deadline");
});
async function events(saveId: string, query: Record<string, unknown> = {}) { return (await finance.calendar.calendar(actor, saveId, query)).events as Ev[]; }
async function withRoot<T>(saveId: string, work: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], root: RootRow) => Promise<T>) {
  return db.transaction(async tx => work(tx, await lockRoot(tx, actor, saveId) as RootRow));
}
async function createResultApproaches(saveId: string, resultKey: string, overrides: Partial<Extract<SponsorApproachSource, { kind: "RESULT" }>> = {}) {
  const root = await saves.read(1, saveId);
  const source: Extract<SponsorApproachSource, { kind: "RESULT" }> = {
    kind: "RESULT", eventId: resultKey, eventName: "Ayrshire Open", circuit: "GRASSROOTS",
    season: root.currentSeason, week: root.currentWeek, finishingPosition: 1, isChampion: false,
    ...overrides,
  };
  return withRoot(saveId, (tx, locked) => evaluateOffers(tx, locked, structuredClone(fixture), `event:${resultKey}`,
    root.currentSeason, root.currentWeek, source));
}
/** Test-only funding/draining through the ledger authority itself (not exposed over HTTP). */
async function adjust(saveId: string, key: string, amountPence: number) {
  return withRoot(saveId, (tx, root) => post(tx, root, { operationKey: `adjustment:${key}`, category: "ADJUSTMENT", amountPence, headline: amountPence >= 0 ? "START" : "EXPENSE", reason: "test fixture" }));
}
async function ledger(saveId: string) { return rows(sql`SELECT * FROM career_finance_entries WHERE career_save_id = ${saveId} ORDER BY created_at, id`); }
/** Advance week by week, deciding every pending human match with `win`. */
async function playThrough(saveId: string, untilWeek: number, win: boolean, tag: string) {
  for (let i = 0; i < 80; i++) {
    const root = await saves.read(1, saveId);
    if (root.currentWeek >= untilWeek && root.currentSeason === 1) return;
    const r = await finance.calendar.advance(actor, saveId, { operationKey: `${tag}-step-${i}`, expectedSeason: root.currentSeason, expectedWeek: root.currentWeek, target: { kind: "WEEKS", weeks: 1 } }) as { stop: { reason: string; detail?: { matchIds: string[] } } };
    if (r.stop.reason === "HUMAN_MATCH_PENDING") {
      for (const matchId of r.stop.detail!.matchIds) {
        const match = (await rows(sql`SELECT best_of FROM career_tournament_matches WHERE career_save_id = ${saveId} AND id = ${matchId}`))[0];
        const target = (Number(match.best_of) + 1) / 2;
        await finance.calendar.recordHumanMatchResult(actor, saveId, { matchId, humanLegs: win ? target : 0, opponentLegs: win ? 0 : target, humanThrewFirst: true });
      }
    }
  }
  throw new Error("playThrough did not finish");
}

// ------------------------------------------------------------------ ledger authority
test("SP-D3 keeps v1-v3 intact and pins v4 activities only for new Career saves", async () => {
  assert.equal(CURRENT_SPONSOR_DATABASE_VERSION, 4);
  assert.equal(finance.versions.sponsorDatabaseVersion, CURRENT_SPONSOR_DATABASE_VERSION);
  assert.equal(SPONSOR_GUARANTEE_CONFIGURATION_STATUS, "AWAITING_BALANCE_APPROVAL");
  for (const version of [1, 2, 3, CURRENT_SPONSOR_DATABASE_VERSION]) {
    assert.ok(sponsorCatalogue(version).every(definition =>
      (definition.terms.contractFoundation?.guaranteedPayments.length ?? 0) === 0),
    `catalogue v${version} must not offer an unapproved guarantee`);
  }

  const save = await careerWithCurrentCatalogue();
  const financeState = (await rows(sql`SELECT sponsor_database_version FROM career_finance_state WHERE career_save_id = ${save.id}`))[0];
  assert.equal(Number(financeState.sponsor_database_version), CURRENT_SPONSOR_DATABASE_VERSION,
    "a new save must pin the current catalogue version");
  assert.deepEqual((await finance.sponsors(actor, save.id)).guaranteeConfiguration, {
    status: "AWAITING_BALANCE_APPROVAL",
    catalogueVersion: CURRENT_SPONSOR_DATABASE_VERSION,
  });
  assert.equal(((await rows(sql`SELECT settings_snapshot FROM career_saves WHERE id=${save.id}`))[0]!.settings_snapshot as Record<string,unknown>).sponsorDatabaseVersionAtCreation,4);
  const legacy=await careerWithCurrentCatalogue(1,2);
  await db.execute(sql`UPDATE career_saves SET settings_snapshot=settings_snapshot-'sponsorDatabaseVersionAtCreation' WHERE id=${legacy.id}`);
  await db.execute(sql`DELETE FROM career_finance_state WHERE career_save_id=${legacy.id}`);
  await finance.initialize(actor,legacy.id);
  assert.equal(Number((await rows(sql`SELECT sponsor_database_version FROM career_finance_state WHERE career_save_id=${legacy.id}`))[0]!.sponsor_database_version),3,
    "an old save missing its finance row must retain its historical v3 catalogue pin");
});

test("SP-C schedules per-season and monthly guarantees at deterministic Career weeks and excludes earlier mid-season periods", () => {
  const contract = {
    id: "contract-fixture", sponsor_key: "forge-workwear",
    terms: {
      displayName: "Fixture Partner",
      contractFoundation: { guaranteedPayments: [
        { amountPence: 3001, cadence: "PER_SEASON", installments: 4 },
        { amountPence: 1201, cadence: "MONTHLY", installments: 12 },
        { amountPence: 500, cadence: "ON_SIGNING", installments: 1 },
      ] },
    },
    start_season: 1, start_week: 20, end_season: 2, end_week: 19,
  } as unknown as ContractRow;
  const { payments, unsupported } = scheduleContractGuarantees(contract);
  assert.deepEqual(unsupported, []);
  assert.deepEqual(payments.filter(payment => payment.cadence === "PER_SEASON").map(payment => [payment.season, payment.week, payment.installment, payment.amountPence]),
    [[1, 27, 3, 750], [1, 40, 4, 750], [2, 1, 1, 751], [2, 14, 2, 750]]);
  assert.deepEqual(payments.filter(payment => payment.cadence === "MONTHLY" && payment.season === 1).map(payment => [payment.week, payment.amountPence]),
    [[22, 100], [27, 100], [31, 100], [35, 100], [40, 100], [44, 100], [48, 100]]);
  assert.deepEqual(payments.filter(payment => payment.cadence === "ON_SIGNING").map(payment => [payment.season, payment.week]), [[1, 20]]);

  const fullSeason = scheduleContractGuarantees({
    ...contract, id: "contract-full-season", start_week: 1, end_season: 1, end_week: 52,
  } as unknown as ContractRow);
  assert.deepEqual(fullSeason.payments.filter(payment => payment.cadence === "PER_SEASON").map(payment => payment.amountPence), [751, 750, 750, 750]);
  assert.deepEqual(fullSeason.payments.filter(payment => payment.cadence === "MONTHLY").map(payment => payment.amountPence),
    [101, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
  assert.deepEqual(fullSeason.payments.filter(payment => payment.cadence === "ON_SIGNING").map(payment => payment.amountPence), [500]);

  const tooSmall = scheduleContractGuarantees({
    ...contract, id: "contract-too-small",
    terms: { ...contract.terms, contractFoundation: { guaranteedPayments: [
      { amountPence: 3, cadence: "PER_SEASON", installments: 4 },
    ] } },
  } as unknown as ContractRow);
  assert.equal(tooSmall.payments.length, 0);
  assert.equal(tooSmall.unsupported.length, 1);
});

test("A1 start balance is the ledger's CAREER_START; headlines reconcile; no duplicate start on restart", async () => {
  const save = await career();
  const start = await ledger(save.id);
  assert.equal(start.length, 1);
  assert.deepEqual([start[0].category, start[0].headline, start[0].operation_key, Number(start[0].amount_pence)], ["CAREER_START", "START", "career-start", 25000]);
  const s = await finance.summary(actor, save.id);
  assert.deepEqual([s.balancePence, s.startingBalancePence, s.careerEarningsPence, s.sponsorEarningsPence, s.careerExpensesPence, s.reconciled], [25000, 25000, 0, 0, 0, true]);
  await rejectsWith(db.execute(sql`INSERT INTO career_finance_entries (id, career_save_id, kind, amount_pence) VALUES (gen_random_uuid(), ${save.id}, 'CAREER_START', 25000)`), /duplicate key|operation_unique/);
  const restarted = await saves.restart(1, save.id);
  assert.equal((await rows(sql`SELECT COUNT(*)::int n FROM career_finance_entries WHERE career_save_id = ${save.id}`))[0].n, 0);
  const fresh = await ledger(restarted.id);
  assert.deepEqual(fresh.map(r => [r.category, Number(r.amount_pence)]), [["CAREER_START", 25000]]);
});

test("ledger is integer, immutable, idempotent, reversible and can never go negative", async () => {
  const save = await career();
  const a = await adjust(save.id, "debit-1", -1000), again = await adjust(save.id, "debit-1", -1000);
  assert.equal(a.row.id, again.row.id);
  assert.equal(again.created, false);
  await rejectsStatus(adjust(save.id, "debit-1", -2000), 409);
  await rejectsWith(db.execute(sql`UPDATE career_finance_entries SET amount_pence = 1 WHERE career_save_id = ${save.id}`), /immutable/);
  await rejectsWith(db.execute(sql`UPDATE career_saves SET balance_pence = -1 WHERE id = ${save.id}`), /balance_nonnegative/);
  await assert.rejects(adjust(save.id, "too-much", -1_000_000), (e: unknown) => (e as { code?: string }).code === "INSUFFICIENT_FUNDS");
  assert.equal((await ledger(save.id)).length, 2, "a refused debit writes nothing");
  const reversal = await finance.reverseEntry(actor, save.id, { entryId: a.row.id, operationKey: "undo-debit-1", reason: "fixture reversal" });
  assert.deepEqual([reversal.category, reversal.amountPence, reversal.reversesEntryId], ["ADJUSTMENT", 1000, a.row.id]);
  const s = await finance.summary(actor, save.id);
  assert.equal(s.balancePence, 25000); assert.equal(s.reconciled, true); assert.equal(s.careerExpensesPence, 0);
  await assert.rejects(withRoot(save.id, (tx, root) => post(tx, root, { operationKey: "adjustment:float", category: "ADJUSTMENT", amountPence: 1.5, headline: "START", reason: "x" })), /integer pence/);
});

// ------------------------------------------------------------------ event costs / atomic entry
test("preview exposes fee, travel, accommodation, coverage and affordability for every calendar event", async () => {
  const save = await career();
  const list = await events(save.id);
  assert.ok(list.length > 300 && list.every(e => e.finance && typeof e.finance.affordable === "boolean"));
  const local = list.find(e => e.definitionKey === "friday-night-501" && e.venue.localityKey === "ayrshire")!;
  assert.deepEqual([local.finance.travelBand, local.finance.entryFeePence, local.finance.estimatedTravelPence, local.finance.estimatedAccommodationPence], ["LOCAL", 500, 0, 0]);
  const sunday = list.find(e => e.definitionKey === "sunday-league-sprint")!;
  assert.equal(sunday.finance.entryFeePence, 0);
  const qs = list.find(e => e.definitionKey === "q-school-first-uk_ireland-d1")!;
  assert.deepEqual([qs.finance.entryFeeBasis, qs.finance.entryFeePence, qs.finance.travelBand, qs.finance.nights], ["PER_SERIES", 30000, "DOMESTIC", 3]);
  assert.equal(qs.finance.affordable, false, "£300 Q-School + trip is unaffordable from £250");
  assert.ok(qs.human!.denials.includes("INSUFFICIENT_FUNDS"));
  const europe = list.find(e => e.definitionKey === "european-series-qualifier" && e.venue.country === "DEU")!;
  assert.equal(europe.finance.travelBand, "EUROPE");
  const detail = await finance.eventFinance(actor, save.id, local.id);
  assert.equal(detail.status, "NOT_ENTERED"); assert.equal(detail.actuals, null);
});

test("entry charge and sporting entry are atomic, idempotent and concurrency-safe", async () => {
  const save = await career();
  const local = (await events(save.id, { scope: "AVAILABLE" })).find(e => e.definitionKey === "friday-night-501" && e.finance.travelBand === "LOCAL")!;
  const [x, y] = await Promise.all([finance.calendar.enter(actor, save.id, { eventId: local.id }), finance.calendar.enter(actor, save.id, { eventId: local.id })]);
  assert.deepEqual([x.entered, y.entered].sort(), [true, true]);
  assert.equal([x.created, y.created].filter(Boolean).length, 1, "double click charges once");
  const fees = (await ledger(save.id)).filter(r => r.category === "ENTRY_FEE");
  assert.deepEqual(fees.map(r => [Number(r.amount_pence), r.event_id]), [[-500, local.id]]);
  // Injected failure after the A3 entry row: both sporting entry and payment roll back.
  const other = (await events(save.id, { scope: "AVAILABLE" })).find(e => e.capability.executable && e.finance.entryFeePence > 0 && e.id !== local.id && !e.series)!;
  await pg.exec(`CREATE FUNCTION fail_event_finance() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'injected finance fault'; END; $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_event_finance BEFORE INSERT ON career_event_finance FOR EACH ROW EXECUTE FUNCTION fail_event_finance()`);
  try { await assert.rejects(finance.calendar.enter(actor, save.id, { eventId: other.id }), /injected finance fault|Failed query/); }
  finally { await pg.exec("DROP TRIGGER fail_event_finance ON career_event_finance; DROP FUNCTION fail_event_finance()"); }
  assert.equal((await rows(sql`SELECT COUNT(*)::int n FROM career_event_entries WHERE career_save_id = ${save.id} AND event_id = ${other.id}`))[0].n, 0, "no sporting entry without payment");
  assert.equal((await rows(sql`SELECT COUNT(*)::int n FROM career_participant_bookings WHERE career_save_id = ${save.id} AND event_id = ${other.id}`))[0].n, 0);
  assert.equal((await ledger(save.id)).filter(r => r.event_id === other.id).length, 0, "no payment without sporting entry");
  assert.equal((await finance.summary(actor, save.id)).balancePence, 24500);
  // Unaffordable entry is refused with a structured reason and writes nothing.
  await adjust(save.id, "drain", -24400);
  const denied = await finance.calendar.enter(actor, save.id, { eventId: other.id });
  assert.equal(denied.entered, false);
  assert.ok(denied.denials.includes("INSUFFICIENT_FUNDS"));
  assert.equal((await rows(sql`SELECT COUNT(*)::int n FROM career_event_entries WHERE career_save_id = ${save.id} AND event_id = ${other.id}`))[0].n, 0);
});

test("withdrawal refunds follow policy exactly once; late withdrawal refunds nothing", async () => {
  const save = await career();
  const list = await events(save.id, { scope: "AVAILABLE" });
  const local = list.find(e => e.definitionKey === "friday-night-501" && e.finance.travelBand === "LOCAL" && e.dates.startWeek >= 2)!;
  const standard = list.find(e => e.capability.executable && FEE_PROFILES[(e.profiles as { entryFee: string }).entryFee]?.refundPolicy === "standard" && e.finance.entryFeePence > 0 && e.finance.affordable && !e.series)!;
  for (const e of [local, standard]) assert.equal((await finance.calendar.enter(actor, save.id, { eventId: e.id })).entered, true);
  assert.equal((await finance.calendar.withdraw(actor, save.id, { eventId: local.id })).withdrawn, true);
  assert.equal((await finance.calendar.withdraw(actor, save.id, { eventId: local.id })).withdrawn, false, "retry does not refund twice");
  assert.equal((await finance.calendar.withdraw(actor, save.id, { eventId: standard.id })).withdrawn, true);
  const refunds = (await ledger(save.id)).filter(r => r.category === "REFUND");
  assert.deepEqual(refunds.map(r => [r.event_id, Number(r.amount_pence)]).sort(), [[local.id, 500], [standard.id, Math.floor(standard.finance.entryFeePence * 0.8)]].sort());
  for (const r of refunds) assert.ok(r.reverses_entry_id, "refund references the original charge");
  // Re-enter (new charge attempt), then a post-lock (late) withdrawal refunds 0%.
  assert.equal((await finance.calendar.enter(actor, save.id, { eventId: local.id })).entered, true);
  assert.equal((await ledger(save.id)).filter(r => r.category === "ENTRY_FEE" && r.event_id === local.id).length, 2);
  await playThrough(save.id, local.dates.startWeek, false, "late");
  const root = await saves.read(1, save.id);
  const r = await finance.calendar.advance(actor, save.id, { operationKey: "late-withdraw-week", expectedSeason: 1, expectedWeek: root.currentWeek, target: { kind: "WEEKS", weeks: 1 } }) as { stop: { reason: string } };
  if (r.stop.reason === "HUMAN_MATCH_PENDING") {
    const out = await finance.calendar.withdraw(actor, save.id, { eventId: local.id });
    assert.deepEqual([out.withdrawn, out.postLock], [true, true]);
    assert.equal((await ledger(save.id)).filter(x => x.category === "REFUND" && x.event_id === local.id).length, 1, "late withdrawal adds no refund");
  }
  assert.equal((await finance.summary(actor, save.id)).reconciled, true);
});

test("travel and accommodation commit in the event's week, once per trip; multi-day series share one trip", async () => {
  const save = await career();
  await adjust(save.id, "qschool-funds", 100000);
  const list = await events(save.id, { circuit: "Q_SCHOOL" });
  const day1 = list.find(e => e.definitionKey === "q-school-first-uk_ireland-d1")!;
  assert.equal((await finance.calendar.enter(actor, save.id, { eventId: day1.id })).entered, true);
  const afterEntry = await ledger(save.id);
  assert.deepEqual(afterEntry.filter(r => r.category !== "CAREER_START" && r.category !== "ADJUSTMENT").map(r => [r.category, Number(r.amount_pence)]), [["ENTRY_FEE", -30000]], "fee once per series; no travel yet");
  const s1 = await finance.summary(actor, save.id);
  assert.equal(s1.reservedForTravelPence, 6000 + 3 * 7000, "trip estimate reserved, not charged");
  await finance.calendar.advance(actor, save.id, { operationKey: "to-week-two", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 1 } });
  assert.equal((await ledger(save.id)).filter(r => r.category === "TRAVEL").length, 0, "week 1 play-out does not charge week 2 travel");
  await playThrough(save.id, 3, false, "qschool");
  const trip = await rows(sql`SELECT * FROM career_trips WHERE career_save_id = ${save.id}`);
  assert.equal(trip.length, 1);
  assert.deepEqual([trip[0].band, trip[0].nights, (trip[0].event_ids as string[]).length, Number(trip[0].travel_gross_pence), Number(trip[0].accommodation_gross_pence)], ["DOMESTIC", 3, 3, 6000, 21000]);
  const costs = (await ledger(save.id)).filter(r => r.category === "TRAVEL" || r.category === "ACCOMMODATION");
  assert.deepEqual(costs.map(r => [r.category, Number(r.amount_pence), r.trip_id]).sort(), [["ACCOMMODATION", -21000, trip[0].id], ["TRAVEL", -6000, trip[0].id]]);
  const s = await finance.summary(actor, save.id);
  assert.equal(s.reservedForTravelPence, 0);
  assert.equal(s.reconciled, true);
  const view = await finance.eventFinance(actor, save.id, day1.id);
  assert.equal(view.actuals!.trip!.nights, 3);
  // Q-School results carry no prize money and no Tour Card (A5).
  assert.equal((await rows(sql`SELECT COUNT(*)::int n FROM career_finance_entries WHERE career_save_id = ${save.id} AND category = 'PRIZE'`))[0].n, 0);
  assert.equal((await saves.read(1, save.id)).hasTourCard, false);
});

test("trip grouping and travel bands are deterministic geography, not nationality", () => {
  const home = { locality: "ayrshire", country: "GBR", zone: "UK_IRELAND" };
  const ev = (id: string, start: number, end: number, country: string, zone: string, city: string, venue = "x", locality: string | null = null) =>
    ({ id, start_day: start, end_day: end, locality_key: locality, venue_key: venue, country, zone, city, circuit: "PRO_CIRCUIT", series_key: null });
  assert.equal(travelBand(home, ev("a", 1, 1, "GBR", "UK_IRELAND", "Kilbirnie", "club-ayrshire", "ayrshire")), "LOCAL");
  assert.equal(travelBand(home, ev("a", 1, 1, "GBR", "UK_IRELAND", "Glasgow", "glasgow-hall")), "LOCAL");
  assert.equal(travelBand(home, ev("a", 1, 1, "GBR", "UK_IRELAND", "Manchester")), "DOMESTIC");
  assert.equal(travelBand(home, ev("a", 1, 1, "IRL", "UK_IRELAND", "Dublin")), "UK_IRELAND");
  assert.equal(travelBand(home, ev("a", 1, 1, "DEU", "EUROPE", "Berlin")), "EUROPE");
  assert.equal(travelBand(home, ev("a", 1, 1, "AUS", "REST_OF_WORLD", "Sydney")), "LONG_HAUL");
  const trips = groupTrips(home, [ev("sat", 20, 20, "DEU", "EUROPE", "Düsseldorf"), ev("sun", 21, 21, "DEU", "EUROPE", "Düsseldorf"), ev("later", 40, 40, "DEU", "EUROPE", "Berlin"), ev("home", 21, 21, "GBR", "UK_IRELAND", "Kilbirnie", "club-ayrshire", "ayrshire")]);
  assert.equal(trips.length, 2, "two consecutive European events share one trip; a later one is separate; local never travels");
  assert.deepEqual([trips[0].events.map(e => e.id), trips[0].travelPence, trips[0].nights], [["sat", "sun"], 18000, 3]);
  assert.deepEqual(tripCost("DOMESTIC", 1), { band: "DOMESTIC", travelPence: 6000, nights: 0, accommodationPence: 0 }, "no hotel for a single-day domestic trip");
});

test("a blocked advance resumes only from where it stopped; retried later it never moves time or money", async () => {
  const save = await career();
  const local = (await events(save.id, { scope: "AVAILABLE" })).filter(e => e.definitionKey === "friday-night-501" && e.finance.travelBand === "LOCAL").sort((a, b) => a.dates.startDay - b.dates.startDay)[0];
  await finance.calendar.enter(actor, save.id, { eventId: local.id });
  await playThrough(save.id, local.dates.startWeek, false, "pre-block");
  const root = await saves.read(1, save.id);
  const body = { operationKey: "blocking-advance", expectedSeason: 1, expectedWeek: root.currentWeek, target: { kind: "WEEKS", weeks: 1 } };
  const blocked = await finance.calendar.advance(actor, save.id, body) as { stop: { reason: string; detail: { matchIds: string[] } } };
  assert.equal(blocked.stop.reason, "HUMAN_MATCH_PENDING");
  for (const matchId of blocked.stop.detail.matchIds) await finance.calendar.recordHumanMatchResult(actor, save.id, { matchId, humanLegs: 0, opponentLegs: 3, humanThrewFirst: false });
  const resumed = await finance.calendar.advance(actor, save.id, body) as { to: { week: number } };
  assert.equal(resumed.to.week, root.currentWeek + 1, "resume from the same position completes the step");
  await playThrough(save.id, root.currentWeek + 4, false, "moved-on");
  const before = { week: (await saves.read(1, save.id)).currentWeek, ledger: (await ledger(save.id)).length };
  await finance.calendar.advance(actor, save.id, body);
  assert.deepEqual({ week: (await saves.read(1, save.id)).currentWeek, ledger: (await ledger(save.id)).length }, before);
});

// ------------------------------------------------------------------ prizes
test("prize bands map finishing positions; cash vs ranking-eligible kept separate", () => {
  const p = PRIZE_PROFILES["prize:pro_circuit"];
  assert.deepEqual([1, 2, 3, 5, 9, 17, 33, 65, 128].map(pos => prizeForPosition(p, pos)), [1500000, 1000000, 500000, 300000, 200000, 150000, 100000, 0, 0]);
  assert.equal(prizeForPosition(PRIZE_PROFILES["prize:q_school"], 1), 0);
  const special = profileFor({ definition_key: "sudden-death-night", classification: "SPECIAL", snapshot: { profiles: { entryFee: "fee:special", prize: "prize:special" } } as never });
  const ranking = profileFor({ definition_key: "friday-night-501", classification: "RANKING", snapshot: { profiles: { entryFee: "fee:grassroots", prize: "prize:grassroots" } } as never });
  const qualifier = profileFor({ definition_key: "vault-qualifier", classification: "QUALIFIER", snapshot: { profiles: { entryFee: "fee:vault", prize: "prize:vault" } } as never });
  assert.deepEqual([special.rankingEligible, ranking.rankingEligible, qualifier.rankingEligible], [false, true, false]);
});

test("winning pays prize exactly once; a Special pays cash with £0 ranking-eligible; losing early pays nothing", async () => {
  const save = await career();
  const all = await events(save.id);
  const local = (e: Ev) => e.finance.travelBand === "LOCAL";
  const special = all.filter(e => e.definitionKey === "sudden-death-night" && local(e)).sort((a, b) => a.dates.startDay - b.dates.startDay)[0];
  const ranking = all.filter(e => e.definitionKey === "friday-night-501" && local(e) && e.dates.startWeek < special.dates.startWeek && e.dates.startWeek >= special.registration.opensWeek)[0]
    ?? all.filter(e => e.definitionKey === "friday-night-501" && local(e) && e.dates.startWeek < special.dates.startWeek)[0];
  await playThrough(save.id, Math.min(special.registration.opensWeek, ranking.registration.opensWeek), false, "pre");
  if ((await saves.read(1, save.id)).currentWeek < Math.max(special.registration.opensWeek, ranking.registration.opensWeek)) {
    assert.equal((await finance.calendar.enter(actor, save.id, { eventId: ranking.id })).entered, true);
    await playThrough(save.id, special.registration.opensWeek, true, "pre2");
    assert.equal((await finance.calendar.enter(actor, save.id, { eventId: special.id })).entered, true);
  } else for (const e of [ranking, special]) assert.equal((await finance.calendar.enter(actor, save.id, { eventId: e.id })).entered, true);
  await playThrough(save.id, special.dates.startWeek + 1, true, "winner");
  const awards = await rows(sql`SELECT event_id, finishing_position, cash_award_pence, ranking_eligible_pence, classification FROM career_prize_awards WHERE career_save_id = ${save.id} ORDER BY classification`);
  assert.deepEqual(awards.map(a => [a.event_id, a.finishing_position, Number(a.cash_award_pence), Number(a.ranking_eligible_pence), a.classification]),
    [[ranking.id, 1, 2500, 2500, "RANKING"], [special.id, 1, 2000, 0, "SPECIAL"]]);
  const prizes = (await ledger(save.id)).filter(r => r.category === "PRIZE");
  assert.equal(prizes.length, 2);
  // Retried completion processing is a no-op.
  await withRoot(save.id, async (tx, root) => {
    const event = (await tx.execute(sql`SELECT * FROM career_event_instances WHERE career_save_id = ${save.id} AND id = ${ranking.id}`)).rows[0] as never;
    const results = (await tx.execute(sql`SELECT participant_key, finishing_position, is_champion FROM career_event_results WHERE career_save_id = ${save.id} AND event_id = ${ranking.id}`)).rows as never;
    await finance.hooks.onEventCompleted(tx, root, event, results);
    await finance.hooks.onEventCompleted(tx, root, event, results);
  });
  assert.equal((await ledger(save.id)).filter(r => r.category === "PRIZE").length, 2, "no duplicate prize");
  await rejectsWith(db.execute(sql`UPDATE career_prize_awards SET cash_award_pence = 1 WHERE career_save_id = ${save.id}`), /immutable/);
  const s = await finance.summary(actor, save.id);
  assert.equal(s.careerEarningsPence, 4500); assert.equal(s.reconciled, true);
  const tables = await rows(sql`SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE classification = 'SPECIAL' AND ranking_eligible)::int bad FROM career_event_prize_tables WHERE career_save_id = ${save.id}`);
  assert.ok(Number(tables[0].n) > 10, "prize tables snapshotted for every completed event (A5 input)"); assert.equal(tables[0].bad, 0);
  // Loser path: early exit in a paying event earns zero, recorded as a factual award row.
  const save2 = await career(1, 2);
  const lose = (await events(save2.id, { scope: "AVAILABLE" })).find(e => e.definitionKey === "friday-night-501" && e.finance.travelBand === "LOCAL")!;
  await finance.calendar.enter(actor, save2.id, { eventId: lose.id });
  await playThrough(save2.id, lose.dates.startWeek + 1, false, "loser");
  const award = (await rows(sql`SELECT finishing_position, cash_award_pence, ledger_entry_id FROM career_prize_awards WHERE career_save_id = ${save2.id}`))[0];
  assert.ok(Number(award.finishing_position) > 2); assert.equal(Number(award.cash_award_pence), 0); assert.equal(award.ledger_entry_id, null);
});

test("cancelled events refund entry once; unsupported events can never be charged", async () => {
  const save = await career();
  const list = await events(save.id, { scope: "AVAILABLE" });
  const target = list.find(e => e.capability.executable && e.finance.entryFeePence > 0 && e.finance.travelBand === "LOCAL" && e.dates.startWeek >= 2 && !e.series)!;
  await finance.calendar.enter(actor, save.id, { eventId: target.id });
  // Force an organiser cancellation (unfillable field) through A3's own lock path.
  await db.execute(sql`UPDATE career_event_instances SET minimum_entrants = 128 WHERE career_save_id = ${save.id} AND id = ${target.id}`);
  const firstUnsupported = (await events(save.id)).filter(e => !e.capability.executable).sort((a, b) => a.dates.startWeek - b.dates.startWeek)[0];
  await playThrough(save.id, Math.max(target.dates.startWeek, firstUnsupported.dates.startWeek) + 1, false, "cancel");
  assert.equal((await rows(sql`SELECT status_reason FROM career_event_instances WHERE career_save_id = ${save.id} AND id = ${target.id}`))[0].status_reason, "INSUFFICIENT_ENTRANTS");
  const refunds = (await ledger(save.id)).filter(r => r.category === "REFUND" && r.event_id === target.id);
  assert.deepEqual(refunds.map(r => Number(r.amount_pence)), [target.finance.entryFeePence]);
  await withRoot(save.id, async (tx, root) => {
    const event = (await tx.execute(sql`SELECT * FROM career_event_instances WHERE career_save_id = ${save.id} AND id = ${target.id}`)).rows[0] as never;
    await finance.hooks.onEventCancelled(tx, root, event, "INSUFFICIENT_ENTRANTS");
  });
  assert.equal((await ledger(save.id)).filter(r => r.category === "REFUND" && r.event_id === target.id).length, 1, "cancellation retry does not refund twice");
  assert.equal((await rows(sql`SELECT status FROM career_event_finance WHERE career_save_id = ${save.id} AND event_id = ${target.id}`))[0].status, "CANCELLED");
  const unsupported = (await events(save.id)).find(e => !e.capability.executable && e.status === "CANCELLED")!;
  const denied = await finance.calendar.enter(actor, save.id, { eventId: unsupported.id });
  assert.ok(denied.denials.includes("UNSUPPORTED_FORMAT"));
  const cancelledUnsupported = await rows(sql`SELECT id FROM career_event_instances WHERE career_save_id = ${save.id} AND status_reason = 'INTENTIONALLY_BENCHED'`);
  assert.ok(cancelledUnsupported.length > 0);
  assert.equal((await rows(sql`SELECT COUNT(*)::int n FROM career_finance_entries WHERE career_save_id = ${save.id} AND event_id IN (SELECT id FROM career_event_instances WHERE career_save_id = ${save.id} AND NOT executable)`))[0].n, 0);
  assert.equal((await finance.summary(actor, save.id)).reconciled, true);
});

test("a broke Career still has a legitimate sporting recovery route (free local events)", async () => {
  const save = await career();
  await adjust(save.id, "broke", -25000);
  assert.equal((await finance.summary(actor, save.id)).balancePence, 0);
  const season = (await events(save.id)).filter(e => e.capability.executable && e.finance.estimatedPlayerCostPence === 0 && e.human!.eligible)
    .sort((a, b) => a.dates.startDay - b.dates.startDay);
  assert.ok(season.length >= 8, `free, no-travel, prize-paying events this season: ${season.length}`);
  assert.ok(season.every(e => e.finance.topPrizePence > 0), "every free route can actually pay");
  const paid = (await events(save.id)).find(e => e.definitionKey === "friday-night-501" && e.status === "REGISTRATION_OPEN")!;
  assert.ok(paid.human!.denials.includes("INSUFFICIENT_FUNDS"), "paid events are refused, not entered on credit");
  const first = season[0];
  await playThrough(save.id, first.registration.opensWeek, false, "broke-wait");
  const available = await events(save.id, { scope: "AVAILABLE" });
  assert.ok(available.some(e => e.id === first.id), "the free event is open to a £0 player");
  assert.ok(available.every(e => e.finance.estimatedPlayerCostPence === 0), "nothing costing money is offered as enterable");
  assert.equal((await finance.calendar.enter(actor, save.id, { eventId: first.id })).entered, true);
  await playThrough(save.id, first.dates.startWeek + 1, true, "recovery");
  const s = await finance.summary(actor, save.id);
  assert.ok(s.balancePence > 0, "winning a free event rebuilds the balance"); assert.equal(s.reconciled, true);
});

// ------------------------------------------------------------------ sponsorship
test("sponsor requirements: unknown authority never grants; offers are deterministic and idempotent", async () => {
  const base: SportingFacts = { careerStarted: true, titles: 0, bestFinishByCircuit: {}, qualifications: [], professionalStatus: null, tourCard: null, worldRanking: null };
  const ironflight = SPONSOR_CATALOGUE_V1.find(s => s.key === "ironflight")!;
  assert.equal(evaluateRequirement(ironflight.offerRequirement, base), null, "unknown Tour Card authority");
  assert.equal(evaluateRequirement(ironflight.offerRequirement, { ...base, tourCard: true }), true);
  assert.equal(evaluateRequirement({ fact: "worldRanking", maxPosition: 16 }, base), null);
  const save = await career();
  const other = await career(1, 2);
  assert.deepEqual((await finance.sponsors(actor, save.id)).offers, [], "self-funded start");
  Object.assign(fixture, { titles: 1, bestFinishByCircuit: { GRASSROOTS: 1 } });
  const first = await finance.evaluateOffers(actor, save.id, { triggerKey: "first-title" });
  const second = await finance.evaluateOffers(actor, save.id, { triggerKey: "first-title" });
  assert.deepEqual(first.created, ["forge-workwear", "lochside-joinery"], "both LOCAL sponsors qualify; tier then key order");
  assert.deepEqual(second.created, [], "same trigger is idempotent");
  assert.deepEqual((await finance.evaluateOffers(actor, other.id, { triggerKey: "first-title" })).created, ["forge-workwear", "lochside-joinery"], "same facts, same offers");
  const offer = (await finance.sponsors(actor, save.id)).offers.find(o => o.sponsorKey === "forge-workwear")!;
  assert.deepEqual([offer.sponsorKey, offer.tier, offer.status, offer.offered, offer.expires], ["forge-workwear", "LOCAL", "AVAILABLE", { season: 1, week: 1 }, { season: 1, week: 5 }]);
  await rejectsWith(db.execute(sql`UPDATE career_sponsor_offers SET terms = '{}'::jsonb WHERE career_save_id = ${save.id}`), /immutable/);
});

test("accepting a sponsor: one contract, one signing bonus, snapshot terms, coverage, event payment and bonus", async () => {
  const save = await career();
  Object.assign(fixture, { titles: 1, bestFinishByCircuit: { GRASSROOTS: 1 } });
  await finance.evaluateOffers(actor, save.id, { triggerKey: "first-title" });
  const offer = (await finance.sponsors(actor, save.id)).offers.find(o => o.sponsorKey === "forge-workwear")!;
  const [a, b] = await Promise.all([finance.acceptOffer(actor, save.id, { offerId: offer.id }), finance.acceptOffer(actor, save.id, { offerId: offer.id })]);
  assert.equal(a.contractId, b.contractId);
  assert.equal([a.created, b.created].filter(Boolean).length, 1);
  assert.deepEqual((await finance.acceptOffer(actor, save.id, { offerId: offer.id })).created, false);
  const bonuses = (await ledger(save.id)).filter(r => r.category === "SPONSOR_SIGNING_BONUS");
  assert.deepEqual(bonuses.map(r => Number(r.amount_pence)), [10000]);
  const sponsor = await finance.sponsors(actor, save.id);
  assert.equal(sponsor.active!.sponsorKey, "forge-workwear");
  assert.equal((await saves.read(1, save.id)).sponsor, "Forge Workwear");
  await rejectsWith(db.execute(sql`INSERT INTO career_sponsor_contracts (career_save_id, id, offer_id, sponsor_key, sponsor_database_version, tier, terms, start_season, start_week, end_season, end_week, status)
    SELECT career_save_id, gen_random_uuid(), offer_id, sponsor_key, sponsor_database_version, tier, terms, 1, 1, 1, 52, 'ACTIVE' FROM career_sponsor_contracts WHERE career_save_id = ${save.id}`), /duplicate key|one_active|offer_unique/);
  // Coverage: Forge covers 50% of grassroots entry fees (cap £10/event).
  const local = (await events(save.id, { scope: "AVAILABLE" })).find(e => e.definitionKey === "friday-night-501" && e.finance.travelBand === "LOCAL")!;
  assert.equal(local.finance.sponsorCoverage.entryFeePence, 250);
  await finance.calendar.enter(actor, save.id, { eventId: local.id });
  const fee = (await ledger(save.id)).find(r => r.category === "ENTRY_FEE")!;
  assert.deepEqual([Number(fee.amount_pence), Number(fee.gross_amount_pence), Number(fee.sponsor_covered_pence), fee.contract_id], [-250, 500, 250, a.contractId]);
  await playThrough(save.id, local.dates.startWeek + 1, true, "sponsored");
  const sponsorRows = (await ledger(save.id)).filter(r => r.headline === "SPONSOR").map(r => [r.category, Number(r.amount_pence)]).sort();
  assert.deepEqual(sponsorRows, [["SPONSOR_EVENT_PAYMENT", 1000], ["SPONSOR_PERFORMANCE_BONUS", 2500], ["SPONSOR_SIGNING_BONUS", 10000]]);
  const s = await finance.summary(actor, save.id);
  assert.deepEqual([s.sponsorEarningsPence, s.careerEarningsPence, s.careerExpensesPence, s.sponsorCoveredExpensesPence, s.reconciled], [13500, 2500, 250, 250, true]);
  assert.equal(s.balancePence, 25000 + 13500 + 2500 - 250);
  const commercial = (await finance.sponsors(actor, save.id)).commercial!;
  assert.deepEqual(commercial.cashReceivedPence, { total: 13500, signing: 10000, guarantees: 0, eventPayments: 1000, performanceBonuses: 2500 });
  assert.equal(commercial.costsCoveredPence, 250);
  assert.equal(commercial.remainingGuaranteesPence, 0);
  assert.equal(commercial.potentialBonuses.length, 1, "potential bonuses remain separate from cash received");
});

test("SP-C ledger payments are idempotent, journey-atomic, paid only on due weeks, and roll back together", async () => {
  Object.assign(fixture, { titles: 1, bestFinishByCircuit: { GRASSROOTS: 1 } });
  const save = await career();
  await finance.evaluateOffers(actor, save.id, { triggerKey: "guarantee-ledger-fixture" });
  const offer = (await finance.sponsors(actor, save.id)).offers.find(candidate => candidate.sponsorKey === "forge-workwear")!;
  const accepted = await finance.acceptOffer(actor, save.id, { offerId: offer.id });
  const [baseContract] = await activeContracts(db, save.id);
  const contract = {
    ...baseContract,
    terms: {
      ...baseContract.terms,
      contractFoundation: {
        ...baseContract.terms.contractFoundation!,
        guaranteedPayments: [
          { amountPence: 500, cadence: "ON_SIGNING", installments: 1 },
          { amountPence: 3000, cadence: "PER_SEASON", installments: 4 },
          { amountPence: 750, cadence: "MONTHLY", installments: 12 },
        ],
      },
    },
  } as ContractRow;
  assert.equal(accepted.created, true);

  await withRoot(save.id, async (tx, root) => {
    assert.equal(await postDueGuaranteedPayments(tx, root, [contract], 1, 1), 3);
    assert.equal(await postDueGuaranteedPayments(tx, root, [contract], 1, 1), 0, "same due date retries do not duplicate");
  });
  for (const [week, dueCount] of [[14, 2], [27, 2], [40, 2]] as const) {
    await db.execute(sql`UPDATE career_saves SET current_week = ${week} WHERE id = ${save.id}`);
    await withRoot(save.id, async (tx, root) => {
      assert.equal(await postDueGuaranteedPayments(tx, root, [contract], 1, week), dueCount);
      assert.equal(await postDueGuaranteedPayments(tx, root, [contract], 1, week), 0);
    });
  }
  await db.execute(sql`UPDATE career_saves SET current_week = 48 WHERE id = ${save.id}`);
  await assert.rejects(withRoot(save.id, async (tx, root) => {
    assert.equal(await postDueGuaranteedPayments(tx, root, [contract], 1, 48), 1);
    throw new Error("injected rollback after guarantee and timeline");
  }), /injected rollback/);

  const guaranteeRows = (await ledger(save.id)).filter(row => row.category === "SPONSOR_GUARANTEED_PAYMENT");
  assert.equal(guaranteeRows.length, 9, "three at Week 1; two at each of Weeks 14, 27 and 40; rolled-back Week 48 is absent");
  assert.deepEqual(guaranteeRows.filter(row => row.week === 1).map(row => Number(row.amount_pence)).sort((a, b) => a - b), [63, 500, 750]);
  assert.equal(guaranteeRows.some(row => row.week === 48), false, "rolled-back payment is absent");
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_sponsor_journey_events
    WHERE career_save_id = ${save.id} AND event_type = 'FINANCIAL_PAYMENT'`))[0].n, 9,
  "each committed guarantee has one persistent Career sponsor-timeline entry");
  assert.equal((await finance.summary(actor, save.id)).reconciled, true);
});

test("SP-C2 pays approved-snapshot guarantees on every real multi-week advance without duplicating signing cash", async () => {
  Object.assign(fixture, { titles: 1 });
  const save = await careerWithCurrentCatalogue();
  const definition = sponsorCatalogue(CURRENT_SPONSOR_DATABASE_VERSION).find(item => item.key === "forge-workwear")!;
  const terms = structuredClone(definition.terms);
  terms.contractFoundation!.guaranteedPayments = [
    { amountPence: 500, cadence: "ON_SIGNING", installments: 1 },
    { amountPence: 5200, cadence: "PER_SEASON", installments: 4 },
    { amountPence: 1200, cadence: "MONTHLY", installments: 12 },
  ];
  const offer = (await db.execute(sql`INSERT INTO career_sponsor_offers
    (career_save_id, id, operation_key, sponsor_key, sponsor_database_version, tier, kind, terms, source,
     offered_season, offered_week, expires_season, expires_week, status)
    VALUES (${save.id}, gen_random_uuid(), 'spc2:multiweek-guarantee-offer', ${terms.sponsorKey}, ${terms.sponsorDatabaseVersion},
      ${terms.tier}, 'NEW', ${JSON.stringify(terms)}::jsonb, '{"fixture":"test"}'::jsonb, 1, 1, 1, 52, 'AVAILABLE')
    RETURNING id`)).rows[0];
  const accepted = await finance.acceptOffer(actor, save.id, { offerId: String(offer.id) });
  assert.equal(accepted.created, true);

  const signingAndWeekOne = (await ledger(save.id)).filter(row => Number(row.season) === 1 && Number(row.week) === 1);
  assert.deepEqual(signingAndWeekOne
    .filter(row => ["SPONSOR_SIGNING_BONUS", "SPONSOR_GUARANTEED_PAYMENT"].includes(String(row.category)))
    .map(row => [row.category, Number(row.amount_pence)]).sort((a, b) => String(a[0]).localeCompare(String(b[0])) || Number(a[1]) - Number(b[1])),
  [
    ["SPONSOR_GUARANTEED_PAYMENT", 100],
    ["SPONSOR_GUARANTEED_PAYMENT", 500],
    ["SPONSOR_GUARANTEED_PAYMENT", 1300],
    ["SPONSOR_SIGNING_BONUS", 10000],
  ], "the contractual signing bonus and signing/recurring guarantees have separate A4 ledger identities");

  const request = {
    operationKey: "spc2:advance-through-week-fourteen",
    expectedSeason: 1,
    expectedWeek: 1,
    target: { kind: "WEEKS", weeks: 14 },
  };
  const advanced = await finance.calendar.advance(actor, save.id, request) as {
    to: { season: number; week: number }; weeksPlayed: number;
  };
  assert.deepEqual([advanced.to.season, advanced.to.week, advanced.weeksPlayed], [1, 15, 14]);
  const retry = await finance.calendar.advance(actor, save.id, request) as { to: { season: number; week: number } };
  assert.deepEqual(retry.to, advanced.to);

  const guarantees = (await ledger(save.id)).filter(row => row.category === "SPONSOR_GUARANTEED_PAYMENT");
  assert.equal(guarantees.length, 7, "week 1 plus every due monthly/quarterly instalment through week 14 posts exactly once");
  assert.deepEqual(guarantees.map(row => [Number(row.season), Number(row.week)]),
    [[1, 1], [1, 1], [1, 1], [1, 5], [1, 9], [1, 14], [1, 14]]);
  assert.equal(new Set(guarantees.map(row => row.operation_key)).size, guarantees.length);

  const sponsorView = await finance.sponsors(actor, save.id);
  assert.deepEqual(sponsorView.commercial?.cashReceivedPence,
    { total: 13500, signing: 10000, guarantees: 3500, eventPayments: 0, performanceBonuses: 0 });
  assert.equal(sponsorView.commercial?.remainingGuaranteesPence, 3400);
  assert.equal(sponsorView.commercial?.pastDueGuaranteesPence, 0);
  assert.equal((await finance.summary(actor, save.id)).reconciled, true);
});

test("SP-C2 rolls back a due guarantee and date together when the calendar's payment hook fails", async () => {
  Object.assign(fixture, { titles: 1 });
  const save = await careerWithCurrentCatalogue();
  const definition = sponsorCatalogue(CURRENT_SPONSOR_DATABASE_VERSION).find(item => item.key === "forge-workwear")!;
  const terms = structuredClone(definition.terms);
  terms.contractFoundation!.guaranteedPayments = [
    { amountPence: 5200, cadence: "PER_SEASON", installments: 52 },
  ];
  const offer = (await db.execute(sql`INSERT INTO career_sponsor_offers
    (career_save_id, id, operation_key, sponsor_key, sponsor_database_version, tier, kind, terms, source,
     offered_season, offered_week, expires_season, expires_week, status)
    VALUES (${save.id}, gen_random_uuid(), 'spc2:rollback-guarantee-offer', ${terms.sponsorKey}, ${terms.sponsorDatabaseVersion},
      ${terms.tier}, 'NEW', ${JSON.stringify(terms)}::jsonb, '{"fixture":"test"}'::jsonb, 1, 1, 1, 52, 'AVAILABLE')
    RETURNING id`)).rows[0];
  await finance.acceptOffer(actor, save.id, { offerId: String(offer.id) });

  const body = { operationKey: "spc2:rollback-calendar-payment", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 1 } };
  const originalHook = finance.hooks.onCalendarMoved;
  finance.hooks.onCalendarMoved = async (tx, root, season, week) => {
    await originalHook(tx, root, season, week);
    throw new Error("injected calendar finance failure");
  };
  try {
    await assert.rejects(finance.calendar.advance(actor, save.id, body), /injected calendar finance failure/);
  } finally {
    finance.hooks.onCalendarMoved = originalHook;
  }

  assert.equal((await saves.read(1, save.id)).currentWeek, 1, "failed weekly transaction must not move the Career date");
  assert.equal((await ledger(save.id)).filter(row => row.category === "SPONSOR_GUARANTEED_PAYMENT" && Number(row.week) === 2).length, 0,
    "a rolled-back date transition cannot leave its scheduled cash behind");
  const retry = await finance.calendar.advance(actor, save.id, body) as { to: { week: number }; weeksPlayed: number };
  assert.deepEqual([retry.to.week, retry.weeksPlayed], [2, 1]);
  const posted = (await ledger(save.id)).filter(row => row.category === "SPONSOR_GUARANTEED_PAYMENT" && Number(row.week) === 2);
  assert.equal(posted.length, 1, "retry posts the now-due instalment exactly once");
  assert.equal((await finance.summary(actor, save.id)).reconciled, true);
});

test("SP-B3 persists result-earned interest and promotes it only when A4 later creates an offer", async () => {
  const save = await career();
  Object.assign(fixture, { titles: 0, bestFinishByCircuit: { GRASSROOTS: 8 } });
  assert.deepEqual(await createResultApproaches(save.id, "interest-result-001", { finishingPosition: 8 }), [],
    "a real top-eight result can draw interest without meeting either local offer threshold");
  const firstView = await finance.sponsors(actor, save.id);
  assert.equal(firstView.offers.length, 0);
  const interest = firstView.journeys.find(j => j.sponsorKey === "forge-workwear")!;
  assert.equal(interest.status, "INTEREST");
  assert.equal(interest.timeline.length, 1);
  assert.equal(interest.timeline[0].type, "INTEREST");
  assert.equal(interest.timeline[0].season, 1);
  assert.equal(interest.timeline[0].week, 1);
  const interestSummary = (interest.timeline[0].details as Record<string, unknown>).summary;
  assert.match(String(interestSummary), /Ayrshire Open/);
  assert.match(String(interestSummary), /not a formal offer/);
  assert.deepEqual((await ledger(save.id)).filter(row => String(row.category).startsWith("SPONSOR_")), [],
    "interest creates no offer, contract or payment");
  assert.deepEqual(await createResultApproaches(save.id, "interest-result-001", { finishingPosition: 8 }), [],
    "replaying the same completed result is idempotent");
  assert.equal((await finance.sponsors(actor, save.id)).journeys.find(j => j.sponsorKey === "forge-workwear")!.timeline.length, 1);

  await db.execute(sql`UPDATE career_saves SET current_week = 2 WHERE id = ${save.id}`);
  Object.assign(fixture, { titles: 1, bestFinishByCircuit: { GRASSROOTS: 1 } });
  assert.deepEqual(await createResultApproaches(save.id, "formal-offer-result-002", { finishingPosition: 1, isChampion: true }),
    ["forge-workwear", "lochside-joinery"]);
  const initial = (await finance.sponsors(actor, save.id)).offers.find(o => o.sponsorKey === "forge-workwear")!;
  const initialId = String(initial.id);
  const initialJourney = initial.journey as unknown as { status: string; timeline: Array<{ type: string; details: Record<string, unknown> }> };
  assert.equal(initialJourney.status, "OFFERED");
  assert.equal(initialJourney.timeline[0].type, "INTEREST");
  assert.deepEqual(initialJourney.timeline.map(event => event.type), ["INTEREST", "APPROACH", "OFFER_RECEIVED"]);
  assert.deepEqual(initialJourney.timeline.map(event => event.details.source && (event.details.source as Record<string, unknown>).eventId),
    ["interest-result-001", "formal-offer-result-002", "formal-offer-result-002"]);
  assert.equal(initialJourney.timeline.at(-1)?.type, "OFFER_RECEIVED");
  const approach = initialJourney.timeline.find(event => event.type === "APPROACH")!;
  const contact = approach.details.contact as { name: string; role: string; representativeId: string | null };
  assert.equal(contact.name, initial.terms.representative?.displayName ?? `${initial.terms.displayName} partnership team`);
  assert.match(String(approach.details.introduction), /Ayrshire Open/);

  const firstRequest = {
    requestKey: "spb-counter-round-one-001", expectedRevision: 0,
    change: { kind: "SIGNING_BONUS", amountPence: 20_000 } as const,
  };
  const counter = await finance.negotiateOffer(actor, save.id, initialId, firstRequest);
  assert.deepEqual([counter.outcome, counter.round, counter.revision], ["COUNTERED", 1, 1]);
  assert.ok(counter.offerId);
  const revised = (await finance.sponsors(actor, save.id)).offers.find(o => o.id === counter.offerId)!;
  assert.equal(revised.journey?.status, "NEGOTIATING");
  assert.equal(revised.terms.signingBonusPence, 15_000, "counter is bounded between original and requested terms");
  const replay = await finance.negotiateOffer(actor, save.id, initialId, firstRequest);
  assert.equal(replay.replayed, true);
  assert.equal(replay.offerId, counter.offerId);
  await rejectsStatus(finance.negotiateOffer(actor, save.id, initialId, {
    ...firstRequest, change: { kind: "SIGNING_BONUS", amountPence: 21_000 },
  }), 409);
  await rejectsStatus(finance.negotiateOffer(actor, save.id, initialId, {
    requestKey: "spb-stale-revision-001", expectedRevision: 0,
    change: { kind: "SIGNING_BONUS", amountPence: 16_000 },
  }), 409);

  const acceptedRequest = await finance.negotiateOffer(actor, save.id, String(revised.id), {
    requestKey: "spb-accept-round-two-01", expectedRevision: 1,
    change: { kind: "SIGNING_BONUS", amountPence: 16_000 },
  });
  assert.deepEqual([acceptedRequest.outcome, acceptedRequest.round, acceptedRequest.revision], ["ACCEPTED", 2, 2]);
  assert.ok(acceptedRequest.offerId);
  const finalOffer = (await finance.sponsors(actor, save.id)).offers.find(o => o.id === acceptedRequest.offerId)!;
  await rejectsStatus(finance.negotiateOffer(actor, save.id, String(finalOffer.id), {
    requestKey: "spb-counter-over-limit-003", expectedRevision: 2,
    change: { kind: "SIGNING_BONUS", amountPence: 22_000 },
  }), 409);
  assert.equal(finalOffer.journey?.negotiationRounds, 2);
  const finalOfferId = String(finalOffer.id);
  const signed = await finance.acceptOffer(actor, save.id, { offerId: finalOfferId });
  assert.equal(signed.created, true);
  assert.equal(signed.signingReveal?.terms.signingBonusPence, 16_000);
  assert.equal(signed.signingReveal?.contractId, signed.contractId);
  assert.ok(String(signed.signingReveal?.playerName).length > 0);
  assert.ok(signed.signingReveal?.category);
  assert.ok(signed.signingReveal?.representative?.displayName);
  assert.equal(signed.signingReveal?.terms.displayName, finalOffer.terms.displayName);
  assert.ok(signed.signingReveal?.terms.duration);
  const secondOpen = await finance.acceptOffer(actor, save.id, { offerId: finalOfferId });
  assert.equal(secondOpen.created, false);
  assert.equal(secondOpen.signingReveal, null, "a replay does not show a second signing event");
  assert.deepEqual((await ledger(save.id)).filter(row => row.category === "SPONSOR_SIGNING_BONUS").map(row => Number(row.amount_pence)), [16_000]);
  const journey = (await rows(sql`SELECT status, signed_contract_id FROM career_sponsor_journeys WHERE career_save_id = ${save.id} AND sponsor_key = 'forge-workwear'`))[0];
  assert.deepEqual([journey.status, journey.signed_contract_id], ["SIGNED", signed.contractId]);
  assert.deepEqual((await rows(sql`SELECT status FROM career_sponsor_offers WHERE career_save_id = ${save.id} AND id = ${initialId}`))[0].status, "COUNTERED");
});

test("SP-B negotiation rejects extreme asks, records sponsor rejection, and preserves walk-away state", async () => {
  Object.assign(fixture, { titles: 1, bestFinishByCircuit: { GRASSROOTS: 1 } });

  const withdrawnSave = await career();
  await createResultApproaches(withdrawnSave.id, "extreme-ask-result");
  const withdrawnOffer = (await finance.sponsors(actor, withdrawnSave.id)).offers.find(o => o.sponsorKey === "forge-workwear")!;
  const withdrawn = await finance.negotiateOffer(actor, withdrawnSave.id, String(withdrawnOffer.id), {
    requestKey: "spb-extreme-ask-000001", expectedRevision: 0,
    change: { kind: "SIGNING_BONUS", amountPence: 100_000 },
  });
  assert.equal(withdrawn.outcome, "WITHDRAWN");
  assert.deepEqual((await rows(sql`SELECT o.status, j.status AS journey_status FROM career_sponsor_offers o
    JOIN career_sponsor_journeys j ON j.career_save_id = o.career_save_id AND j.current_offer_id = o.id
    WHERE o.career_save_id = ${withdrawnSave.id} AND o.id = ${withdrawnOffer.id}`))[0], { status: "WITHDRAWN", journey_status: "WITHDRAWN" });

  const rejectedSave = await career(1, 2);
  await createResultApproaches(rejectedSave.id, "rejected-ask-result");
  const rejectedOffer = (await finance.sponsors(actor, rejectedSave.id)).offers.find(o => o.sponsorKey === "forge-workwear")!;
  const first = await finance.negotiateOffer(actor, rejectedSave.id, String(rejectedOffer.id), {
    requestKey: "spb-rejected-counter-001", expectedRevision: 0,
    change: { kind: "SIGNING_BONUS", amountPence: 20_000 },
  });
  assert.equal(first.outcome, "COUNTERED");
  const second = await finance.negotiateOffer(actor, rejectedSave.id, first.offerId!, {
    requestKey: "spb-rejected-final-0001", expectedRevision: 1,
    change: { kind: "SIGNING_BONUS", amountPence: 40_000 },
  });
  assert.equal(second.outcome, "REJECTED");
  assert.equal((await rows(sql`SELECT status FROM career_sponsor_journeys WHERE career_save_id = ${rejectedSave.id} AND sponsor_key = 'forge-workwear'`))[0].status, "REJECTED");
  assert.equal((await rows(sql`SELECT status_reason FROM career_sponsor_offers WHERE career_save_id = ${rejectedSave.id} AND id = ${first.offerId}`))[0].status_reason, "SPONSOR_REJECTED_NEGOTIATION");

  const walkedSave = await career(1, 3);
  await createResultApproaches(walkedSave.id, "walk-away-result");
  const walkedOffer = (await finance.sponsors(actor, walkedSave.id)).offers.find(o => o.sponsorKey === "forge-workwear")!;
  const walkedCounter = await finance.negotiateOffer(actor, walkedSave.id, String(walkedOffer.id), {
    requestKey: "spb-walk-away-counter-01", expectedRevision: 0,
    change: { kind: "SIGNING_BONUS", amountPence: 20_000 },
  });
  assert.equal(walkedCounter.outcome, "COUNTERED");
  await finance.declineOffer(actor, walkedSave.id, { offerId: walkedCounter.offerId! });
  assert.equal((await rows(sql`SELECT status FROM career_sponsor_journeys WHERE career_save_id = ${walkedSave.id} AND sponsor_key = 'forge-workwear'`))[0].status, "WALKED_AWAY");
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_sponsor_journey_events WHERE career_save_id = ${walkedSave.id} AND event_type = 'PLAYER_WALKED_AWAY'`))[0].n, 1);
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_sponsor_contracts WHERE career_save_id = ${walkedSave.id}`))[0].n, 0);
});

test("SP-B3 expiry is committed before errors and expired negotiation results replay safely", async () => {
  Object.assign(fixture, { titles: 1, bestFinishByCircuit: { GRASSROOTS: 1 } });

  const lateSigning = await career(1, 1);
  await finance.evaluateOffers(actor, lateSigning.id, { triggerKey: "late-signing" });
  const lateSigningOffer = (await finance.sponsors(actor, lateSigning.id)).offers.find(o => o.sponsorKey === "forge-workwear")!;
  await db.execute(sql`UPDATE career_saves SET current_week = 6 WHERE id = ${lateSigning.id}`);
  await rejectsStatus(finance.acceptOffer(actor, lateSigning.id, { offerId: String(lateSigningOffer.id) }), 409);
  assert.deepEqual((await rows(sql`SELECT o.status, j.status AS journey_status
    FROM career_sponsor_offers o JOIN career_sponsor_journeys j
      ON j.career_save_id=o.career_save_id AND j.current_offer_id=o.id
    WHERE o.career_save_id=${lateSigning.id} AND o.id=${lateSigningOffer.id}`))[0],
    { status: "EXPIRED", journey_status: "EXPIRED" },
    "the late-accept error must not roll the expired state back");
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_sponsor_contracts WHERE career_save_id=${lateSigning.id}`))[0].n, 0);
  assert.equal((await ledger(lateSigning.id)).some(row => String(row.category).startsWith("SPONSOR_")), false);

  const lateNegotiation = await career(1, 2);
  await finance.evaluateOffers(actor, lateNegotiation.id, { triggerKey: "late-negotiation" });
  const lateNegotiationOffer = (await finance.sponsors(actor, lateNegotiation.id)).offers.find(o => o.sponsorKey === "forge-workwear")!;
  await db.execute(sql`UPDATE career_saves SET current_week = 6 WHERE id = ${lateNegotiation.id}`);
  const request = {
    requestKey: "expired-negotiation-001", expectedRevision: 0,
    change: { kind: "SIGNING_BONUS", amountPence: 20_000 } as const,
  };
  const expired = await finance.negotiateOffer(actor, lateNegotiation.id, String(lateNegotiationOffer.id), request);
  assert.equal(expired.outcome, "EXPIRED");
  assert.equal(expired.offerId, null);
  assert.equal((await finance.negotiateOffer(actor, lateNegotiation.id, String(lateNegotiationOffer.id), request)).replayed, true);
  await rejectsStatus(finance.negotiateOffer(actor, lateNegotiation.id, String(lateNegotiationOffer.id), {
    ...request, change: { kind: "SIGNING_BONUS", amountPence: 21_000 },
  }), 409);
  assert.deepEqual((await rows(sql`SELECT o.status, j.status AS journey_status,
      (SELECT COUNT(*)::int FROM career_sponsor_offers x WHERE x.career_save_id=o.career_save_id
        AND x.sponsor_key=o.sponsor_key AND x.status='AVAILABLE') AS available,
      (SELECT COUNT(*)::int FROM career_sponsor_negotiations n WHERE n.career_save_id=o.career_save_id AND n.outcome='EXPIRED') AS expiry_requests
    FROM career_sponsor_offers o JOIN career_sponsor_journeys j
      ON j.career_save_id=o.career_save_id AND j.current_offer_id=o.id
    WHERE o.career_save_id=${lateNegotiation.id} AND o.id=${lateNegotiationOffer.id}`))[0],
    { status: "EXPIRED", journey_status: "EXPIRED", available: 0, expiry_requests: 1 });
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_sponsor_journey_events
    WHERE career_save_id=${lateNegotiation.id} AND event_type='OFFER_EXPIRED'`))[0].n, 1);
});

test("SP-B3 serializes concurrent negotiation/signing and idempotent retries", async () => {
  Object.assign(fixture, { titles: 1, bestFinishByCircuit: { GRASSROOTS: 1 } });
  const retrySave = await career(1, 1);
  await finance.evaluateOffers(actor, retrySave.id, { triggerKey: "concurrent-retry" });
  const retryOffer = (await finance.sponsors(actor, retrySave.id)).offers.find(o => o.sponsorKey === "forge-workwear")!;
  const request = {
    requestKey: "concurrent-negotiation-key", expectedRevision: 0,
    change: { kind: "SIGNING_BONUS", amountPence: 20_000 } as const,
  };
  const retries = await Promise.all([
    finance.negotiateOffer(actor, retrySave.id, String(retryOffer.id), request),
    finance.negotiateOffer(actor, retrySave.id, String(retryOffer.id), request),
  ]);
  assert.equal(retries.filter(result => result.replayed).length, 1);
  assert.equal(retries[0].outcome, retries[1].outcome);
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_sponsor_negotiations WHERE career_save_id=${retrySave.id}`))[0].n, 1);

  const raceSave = await career(1, 2);
  await finance.evaluateOffers(actor, raceSave.id, { triggerKey: "sign-negotiate-race" });
  const raceOffer = (await finance.sponsors(actor, raceSave.id)).offers.find(o => o.sponsorKey === "forge-workwear")!;
  const race = await Promise.allSettled([
    finance.negotiateOffer(actor, raceSave.id, String(raceOffer.id), {
      requestKey: "sign-negotiate-race-key", expectedRevision: 0,
      change: { kind: "SIGNING_BONUS", amountPence: 20_000 },
    }),
    finance.acceptOffer(actor, raceSave.id, { offerId: String(raceOffer.id) }),
  ]);
  assert.equal(race.filter(result => result.status === "fulfilled").length, 1,
    "root locking permits only one of signing or negotiating to transition the offer");
  assert.ok(Number((await rows(sql`SELECT COUNT(*)::int AS n FROM career_sponsor_contracts WHERE career_save_id=${raceSave.id}`))[0].n) <= 1);
  assert.ok(Number((await rows(sql`SELECT COUNT(*)::int AS n FROM career_finance_entries WHERE career_save_id=${raceSave.id}
    AND category='SPONSOR_SIGNING_BONUS'`))[0].n) <= 1);
});

test("SP-B3 season-length agreements signed mid-season receive their full promised duration", async () => {
  Object.assign(fixture, { titles: 3, bestFinishByCircuit: {} });
  const save = await career();
  await finance.evaluateOffers(actor, save.id, { triggerKey: "three-titles-for-season-agreement" });
  const offer = (await finance.sponsors(actor, save.id)).offers.find(candidate => candidate.sponsorKey === "ochre-darts")!;
  assert.deepEqual(offer.terms.duration, { kind: "SEASONS", seasons: 1 });
  await db.execute(sql`UPDATE career_saves SET current_week = 20 WHERE id = ${save.id}`);
  await db.execute(sql`UPDATE career_sponsor_offers SET offered_week = 20, expires_week = 24
    WHERE career_save_id = ${save.id} AND id = ${offer.id}`);
  const signed = await finance.acceptOffer(actor, save.id, { offerId: String(offer.id) });
  assert.deepEqual([signed.signingReveal?.start, signed.signingReveal?.end],
    [{ season: 1, week: 20 }, { season: 2, week: 19 }]);
});

test("SP-B3 zero-value terms are either rejected or removed explicitly, never posted as £0 ledger rows", async () => {
  Object.assign(fixture, { titles: 1, bestFinishByCircuit: { GRASSROOTS: 1 } });
  const save = await career();
  await finance.evaluateOffers(actor, save.id, { triggerKey: "zero-value-term-review" });
  const offer = (await finance.sponsors(actor, save.id)).offers.find(candidate => candidate.sponsorKey === "forge-workwear")!;
  await assert.rejects(finance.negotiateOffer(actor, save.id, String(offer.id), {
    requestKey: "zero-coverage-rejected", expectedRevision: 0,
    change: { kind: "COVERAGE_PERCENT", index: 0, percent: 0 },
  }));
  await assert.rejects(finance.negotiateOffer(actor, save.id, String(offer.id), {
    requestKey: "zero-performance-rejected", expectedRevision: 0,
    change: { kind: "PERFORMANCE_BONUS", key: "top-64", amountPence: 0 },
  }));
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_sponsor_negotiations WHERE career_save_id=${save.id}`))[0].n, 0);

  const noEventPayment = await finance.negotiateOffer(actor, save.id, String(offer.id), {
    requestKey: "remove-event-payment", expectedRevision: 0,
    change: { kind: "EVENT_PAYMENT", amountPence: 0 },
  });
  assert.equal(noEventPayment.outcome, "ACCEPTED");
  const revised = (await finance.sponsors(actor, save.id)).offers.find(candidate => candidate.id === noEventPayment.offerId)!;
  assert.equal(revised.terms.eventPayment, null, "zero means the payment is removed, not an active £0 term");
  await finance.acceptOffer(actor, save.id, { offerId: String(revised.id) });
  const event = (await events(save.id, { scope: "AVAILABLE" })).find(e => e.definitionKey === "friday-night-501" && e.finance.travelBand === "LOCAL")!;
  await finance.calendar.enter(actor, save.id, { eventId: event.id });
  await playThrough(save.id, event.dates.startWeek + 1, true, "no-event-payment");
  const eventPaymentRows = (await ledger(save.id)).filter(row => row.category === "SPONSOR_EVENT_PAYMENT");
  assert.equal(eventPaymentRows.length, 0);
  assert.equal((await ledger(save.id)).some(row => Number(row.amount_pence) === 0), false);
  assert.equal((await finance.summary(actor, save.id)).reconciled, true);
});

test("coverage caps, decline, expiry, contract end with renewal or loss, replacement and history", async () => {
  const contract = { id: "c", terms: { coverage: [{ costTypes: ["ENTRY_FEE"], percent: 50, perEventCapPence: 1000, seasonCapPence: 1500, circuits: ["GRASSROOTS"] }] } } as unknown as ContractRow;
  const usage = new Map<number, number>();
  assert.deepEqual([applyCoverage(contract, usage, "ENTRY_FEE", "GRASSROOTS", 4000).covered, applyCoverage(contract, usage, "ENTRY_FEE", "GRASSROOTS", 4000).covered,
    applyCoverage(contract, usage, "ENTRY_FEE", "GRASSROOTS", 4000).covered, applyCoverage(contract, usage, "TRAVEL", "GRASSROOTS", 4000).covered, applyCoverage(contract, usage, "ENTRY_FEE", "COUNTY", 4000).covered], [1000, 500, 0, 0, 0]);
  const save = await career();
  Object.assign(fixture, { titles: 1, bestFinishByCircuit: { GRASSROOTS: 1, COUNTY: 2 } });
  await finance.evaluateOffers(actor, save.id, { triggerKey: "local-form" });
  const offers = (await finance.sponsors(actor, save.id)).offers;
  assert.deepEqual(offers.map(o => o.sponsorKey).sort(), ["forge-workwear", "lochside-joinery"]);
  const lochside = offers.find(o => o.sponsorKey === "lochside-joinery")!;
  const directJourney = (await finance.sponsors(actor, save.id)).journeys.find(j => j.sponsorKey === "lochside-joinery")!;
  assert.equal(directJourney.status, "OFFERED");
  assert.deepEqual(directJourney.timeline.map(event => event.type), ["OFFER_RECEIVED"],
    "a direct formal offer is not given a fabricated earlier interest/approach history");
  assert.deepEqual(await finance.declineOffer(actor, save.id, { offerId: lochside.id }), { declined: true, created: true });
  assert.deepEqual(await finance.declineOffer(actor, save.id, { offerId: lochside.id }), { declined: true, created: false });
  assert.equal((await finance.sponsors(actor, save.id)).journeys.find(j => j.sponsorKey === "lochside-joinery")!.status, "DECLINED");
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS n FROM career_sponsor_journey_events
    WHERE career_save_id = ${save.id} AND event_type = 'PLAYER_DECLINED'`))[0].n, 1);
  await rejectsStatus(finance.acceptOffer(actor, save.id, { offerId: lochside.id }), 409);
  await rejectsStatus(finance.negotiateOffer(actor, save.id, String(lochside.id), {
    requestKey: "declined-offer-negotiation", expectedRevision: 0,
    change: { kind: "SIGNING_BONUS", amountPence: 20_000 },
  }), 409);
  assert.deepEqual((await finance.evaluateOffers(actor, save.id, { triggerKey: "local-form-again" })).created, [], "declined sponsor is not re-offered this season");
  // Forge expires after four weeks without acceptance.
  await withRoot(save.id, (tx, root) => advanceSponsorLifecycle(tx, root, async () => structuredClone(fixture), 1, 6));
  assert.equal((await finance.sponsors(actor, save.id)).offers.length, 0);
  const forge = offers.find(o => o.sponsorKey === "forge-workwear")!;
  await rejectsStatus(finance.acceptOffer(actor, save.id, { offerId: forge.id }), 409);
  // New season: renewal requirement met → COMPLETED + renewal offer; unmet → EXPIRED (sponsor lost).
  for (const [titles, expected] of [[1, "COMPLETED"], [0, "EXPIRED"]] as const) {
    const s = await career(1, titles ? 2 : 3);
    Object.assign(fixture, { titles: 1, bestFinishByCircuit: { GRASSROOTS: 1 } });
    await finance.evaluateOffers(actor, s.id, { triggerKey: "start" });
    const o = (await finance.sponsors(actor, s.id)).offers.find(x => x.sponsorKey === "forge-workwear")!;
    await finance.acceptOffer(actor, s.id, { offerId: o.id });
    Object.assign(fixture, { titles });
    await withRoot(s.id, (tx, root) => advanceSponsorLifecycle(tx, root, async () => structuredClone(fixture), 2, 1));
    const view = await finance.sponsors(actor, s.id);
    assert.equal(view.active, null);
    assert.equal(view.history.contracts[0].status, expected);
    assert.equal(view.offers.some(x => x.kind === "RENEWAL"), expected === "COMPLETED");
    assert.equal((await saves.read(1, s.id)).sponsor, null);
    await rejectsWith(db.execute(sql`UPDATE career_sponsor_contracts SET status = 'ACTIVE' WHERE career_save_id = ${s.id}`), /history/);
  }
  // Replacement: a higher-tier offer can replace the active contract; the old one stays in history.
  const r = await career(2, 1);
  Object.assign(fixture, { titles: 3, bestFinishByCircuit: { GRASSROOTS: 1, REGIONAL: 2 } });
  await finance.evaluateOffers({ playerId: 2 }, r.id, { triggerKey: "regional-final" });
  const pick = (await finance.sponsors({ playerId: 2 }, r.id)).offers;
  const local = pick.find(o => o.tier === "LOCAL") ?? null;
  const regional = pick.find(o => o.tier === "REGIONAL")!;
  const localContract=local?await finance.acceptOffer({ playerId: 2 }, r.id, { offerId: local.id }):null;
  await finance.acceptOffer({ playerId: 2 }, r.id, { offerId: regional.id,
    ...(localContract?{replaceContractIds:[localContract.contractId]}:{}) });
  const after = await finance.sponsors({ playerId: 2 }, r.id);
  assert.equal(after.active!.sponsorKey, "ochre-darts");
  if (local) assert.equal(after.history.contracts[0].endReason, "EXPLICITLY_REPLACED");
});

test("retention: only a KNOWN failed requirement terminates a professional contract", async () => {
  const save = await career();
  Object.assign(fixture, { tourCard: true, professionalStatus: "PROFESSIONAL" });
  await finance.evaluateOffers(actor, save.id, { triggerKey: "tour-card-fixture" });
  const iron = (await finance.sponsors(actor, save.id)).offers.find(o => o.sponsorKey === "ironflight")!;
  await finance.acceptOffer(actor, save.id, { offerId: iron.id });
  await withRoot(save.id, (tx, root) => advanceSponsorLifecycle(tx, root, async () => ({ ...structuredClone(fixture), tourCard: null }), 1, 1));
  assert.equal((await finance.sponsors(actor, save.id)).active!.sponsorKey, "ironflight", "unknown authority does not terminate");
  await withRoot(save.id, (tx, root) => advanceSponsorLifecycle(tx, root, async () => ({ ...structuredClone(fixture), tourCard: false }), 1, 1));
  const view = await finance.sponsors(actor, save.id);
  assert.equal(view.active, null);
  assert.equal(view.history.contracts[0].endReason, "RETENTION_REQUIREMENT_NOT_MET");
});

// ------------------------------------------------------------------ lifecycle / isolation / regression
test("save isolation, retirement (readable, inert) and restart (fresh £250, no sponsor history)", async () => {
  const a = await career(1, 1), b = await career(1, 2), c = await career(1, 3);
  Object.assign(fixture, { titles: 1, bestFinishByCircuit: { GRASSROOTS: 1 } });
  await finance.evaluateOffers(actor, a.id, { triggerKey: "iso" });
  await finance.acceptOffer(actor, a.id, { offerId: (await finance.sponsors(actor, a.id)).offers.find(o => o.sponsorKey === "forge-workwear")!.id });
  const local = (await events(a.id, { scope: "AVAILABLE" })).find(e => e.definitionKey === "friday-night-501")!;
  await finance.calendar.enter(actor, a.id, { eventId: local.id });
  for (const other of [b, c]) {
    const s = await finance.summary(actor, other.id);
    assert.deepEqual([s.balancePence, s.ledgerEntries, s.sponsor], [25000, 1, null]);
    assert.equal((await finance.sponsors(actor, other.id)).history.contracts.length, 0);
  }
  await rejectsStatus(finance.summary({ playerId: 2 }, a.id), 404);
  await rejectsStatus(finance.ledger({ playerId: 2 }, a.id), 404);
  await rejectsStatus(finance.acceptOffer({ playerId: 2 }, a.id, { offerId: (await finance.sponsors(actor, a.id)).active!.id as string }), 404);
  // Same seed ⇒ same deterministic event ids in both saves; each save still only sees its own finance facts.
  assert.equal((await finance.eventFinance(actor, a.id, local.id)).status, "ENTERED");
  assert.equal((await finance.eventFinance(actor, b.id, local.id)).status, "NOT_ENTERED");
  // Retirement: history readable, nothing new can happen.
  Object.assign(fixture, { titles: 5, bestFinishByCircuit: { REGIONAL: 1 } });
  await finance.evaluateOffers(actor, b.id, { triggerKey: "pre-retire" });
  const pending = (await finance.sponsors(actor, b.id)).offers[0];
  await saves.retire(1, b.id);
  assert.equal((await finance.summary(actor, b.id)).balancePence, 25000);
  await rejectsStatus(finance.acceptOffer(actor, b.id, { offerId: pending.id }), 409);
  await rejectsStatus(finance.evaluateOffers(actor, b.id, { triggerKey: "after-retire" }), 409);
  await rejectsStatus(finance.calendar.enter(actor, b.id, { eventId: local.id }), 409);
  // Restart: old universe (ledger, contract, offers, event costs) gone; fresh £250.
  Object.assign(fixture, { titles: 0, bestFinishByCircuit: {} });
  const restarted = await saves.restart(1, a.id);
  for (const t of ["career_finance_entries", "career_sponsor_contracts", "career_sponsor_offers", "career_event_finance", "career_finance_state"]) {
    assert.equal((await rows(sql`SELECT COUNT(*)::int n FROM ${sql.raw(t)} WHERE career_save_id = ${a.id}`))[0].n, 0, t);
  }
  await finance.initialize(actor, restarted.id);
  const fresh = await finance.summary(actor, restarted.id);
  assert.deepEqual([fresh.balancePence, fresh.ledgerEntries, fresh.sponsor, fresh.availableOffers], [25000, 1, null, 0]);
});

test("default facts come from A3 results only; Career money is isolated from TKDL coins and the Classic Tour", async () => {
  const save = await saves.create(1, { slot: 1 });
  await realFacts.initialize(actor, save.id);
  assert.deepEqual((await realFacts.sponsors(actor, save.id)).offers, [], "no fabricated facts → no offers at start");
  const sources = ["config", "engine", "ledger", "service", "router", "travel", "sponsors.catalogue"].map(n => readFileSync(new URL(`../../career/finance/${n}.ts`, import.meta.url), "utf8")).join("\n");
  assert.ok(!/coins|player_currency|currency_transactions|tour_events|tour_trophies|from ["'][^"']*tour/i.test(sources), "no coin/Tour coupling");
  assert.ok(!/Math\.random/.test(sources));
  assert.ok(!/(bet|casino|wager|gambl)/i.test(JSON.stringify(SPONSOR_CATALOGUE_V1)), "no gambling sponsors");
  const migration = readFileSync(new URL("../../db/migrations/create_career_finance.ts", import.meta.url), "utf8");
  assert.ok(!/tour_|player_currency/.test(migration));
});
