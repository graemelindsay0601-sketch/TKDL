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
import { createCareerService } from "../../career/service.ts";
import { createCareerFinanceService } from "../../career/finance/service.ts";
import { post } from "../../career/finance/ledger.ts";
import { advanceSponsorLifecycle, applyCoverage, evaluateOffers, profileFor, type ContractRow, type SponsorFactsProvider } from "../../career/finance/engine.ts";
import { groupTrips, travelBand, tripCost } from "../../career/finance/travel.ts";
import { evaluateRequirement, SPONSOR_CATALOGUE_V1, type SportingFacts } from "../../career/finance/sponsors.catalogue.ts";
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
  await createCareerFinance(db); await createCareerFinance(db); // idempotent re-run
});
beforeEach(async () => {
  await pg.exec("DELETE FROM career_saves; UPDATE feature_flags SET enabled = true");
  Object.assign(fixture, { titles: 0, bestFinishByCircuit: {}, qualifications: [], professionalStatus: "AMATEUR", tourCard: false, worldRanking: null });
});
after(async () => { await pg.close(); });

async function career(player = 1, slot = 1) {
  const save = await saves.create(player, { slot });
  // Original A4 catalogue/NPC fixtures, not a silent upgrade to the A8.2 content universe.
  await db.execute(sql`UPDATE career_saves SET world_seed = ${HARNESS_SEED},event_database_version=1,player_database_version=1 WHERE id = ${save.id}`);
  await finance.initialize({ playerId: player }, save.id);
  return save;
}
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows;
const rejectsStatus = (p: Promise<unknown>, status: number) => assert.rejects(p, (e: unknown) => (e as { status?: number }).status === status);
const rejectsWith = (p: Promise<unknown>, pattern: RegExp) => assert.rejects(p, (error: unknown) => {
  for (let e = error as { message?: string; cause?: unknown } | undefined, d = 0; e && d < 5; e = e.cause as typeof e, d++) if (pattern.test(String(e.message))) return true;
  return false;
});
async function events(saveId: string, query: Record<string, unknown> = {}) { return (await finance.calendar.calendar(actor, saveId, query)).events as Ev[]; }
async function withRoot<T>(saveId: string, work: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], root: RootRow) => Promise<T>) {
  return db.transaction(async tx => work(tx, await lockRoot(tx, actor, saveId) as RootRow));
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
  assert.deepEqual(await finance.declineOffer(actor, save.id, { offerId: lochside.id }), { declined: true, created: true });
  await rejectsStatus(finance.acceptOffer(actor, save.id, { offerId: lochside.id }), 409);
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
