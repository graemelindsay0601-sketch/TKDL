/** Managers: signed on facts; they earn only from what they bring (sponsor deals they set up, invitations they get you). */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import { createCareerSponsorshipFoundation } from "../../db/migrations/create_career_sponsorship_foundation.ts";
import { createCareerNpcSponsorMarketSPF } from "../../db/migrations/create_career_npc_sponsor_market_spf.ts";
import { createCareerCalendar } from "../../db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../../db/migrations/create_career_finance.ts";
import { createCareerSponsorJourneysSPB } from "../../db/migrations/create_career_sponsor_journeys_spb.ts";
import { createCareerSponsorJourneysSPB3 } from "../../db/migrations/create_career_sponsor_journeys_spb3.ts";
import { createCareerFinanceSPC } from "../../db/migrations/create_career_finance_spc.ts";
import { createCareerSponsorHQSPD } from "../../db/migrations/create_career_sponsor_hq_spd.ts";
import { createCareerSponsorContractActionsSPE2 } from "../../db/migrations/create_career_sponsor_contract_actions_spe2.ts";
import { createCareerSporting } from "../../db/migrations/create_career_sporting.ts";
import { createShadowObservations } from "../../db/migrations/create_shadow_observations_sb21a.ts";
import { repairCareerSchema } from "../../db/migrations/repair_career_schema.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerSportingService } from "../../career/sporting/service.ts";
import { createCareerManagerService } from "../../career/manager/service.ts";
import { MANAGERS, boosted, canInvite, commissionOn, managerByKey } from "../../career/manager/model.ts";
import { createCareerFinanceService } from "../../career/finance/service.ts";
import { lockRoot } from "../../career/world/service.ts";
import { post } from "../../career/finance/ledger.ts";
import { evaluateOffers } from "../../career/finance/engine.ts";
import { MAX_OFFERS_PER_EVALUATION } from "../../career/finance/config.ts";
import type { RootRow } from "../../career/calendar/engine.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db), managers = createCareerManagerService(db);
const facts = { careerStarted: true, titles: 20, professionalStatus: "PROFESSIONAL" as const, tourCard: true, worldRanking: 20, qualifications: [], bestFinishByCircuit: {} };
const finance = createCareerFinanceService(db, { facts: { id: "TEST_FIXTURE", facts: async () => structuredClone(facts) } });
const actor = { playerId: 1 };
let id = "";
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows;
const status = (p: Promise<unknown>, n = 409) => assert.rejects(p, (e: { status?: number }) => e.status === n);
const withRoot = <T,>(work: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0], root: RootRow) => Promise<T>) =>
  db.transaction(async tx => work(tx, await lockRoot(tx, actor, id) as RootRow));

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
    createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
  await repairCareerSchema(db);
  id = (await saves.create(1, { slot: 1, careerName: "Managed", dateOfBirth: "1992-07-07", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
  await db.execute(sql`UPDATE career_saves SET balance_pence = 50000 WHERE id = ${id}`);
});
after(async () => { await pg.close(); });

test("firms sign you on facts only: prize money won, then a Tour Card", async () => {
  const v = await managers.read(actor, id);
  assert.equal(v.current, null);
  assert.ok(v.firms.every(f => !f.available && f.unmet.length), "nobody signs a player who has won nothing");
  await status(managers.sign(actor, id, { managerKey: "backroom" }));
  await status(managers.sign(actor, id, { managerKey: "nobody" }), 404);
  await withRoot((tx, root) => post(tx, root, { operationKey: "prize:fixture", category: "PRIZE", amountPence: 30000, reason: "fixture prize", season: 1, week: 1 }));
  const signed = await managers.sign(actor, id, { managerKey: "backroom" });
  assert.equal(signed.current?.key, "backroom");
  assert.deepEqual(signed.firms.find(f => f.key === "northgate")!.unmet, ["Win £3,000 in prize money"]);
  assert.deepEqual(signed.firms.find(f => f.key === "oche-elite")!.unmet, ["Hold a Tour Card"]);
  await status(managers.sign(actor, id, { managerKey: "northgate" }));
  assert.equal((await managers.sign(actor, id, { managerKey: "backroom" })).current?.key, "backroom", "signing your own manager again changes nothing");
});

test("which doors a firm can open: invitationals within reach of your ranking, never ranking events or national teams", () => {
  const ev = (circuit: string, definitionKey: string, invitationCount: number | null, takesInvitations = true) => ({ circuit, definitionKey, invitationCount, takesInvitations });
  const [local, regional, top] = ["backroom", "northgate", "oche-elite"].map(k => managerByKey(k)!);
  assert.equal(canInvite(local, ev("WORLD_SERIES", "world-dart-series", 8), 1), false, "a local agent does sponsor deals only");
  assert.equal(canInvite(regional, ev("WORLD_SERIES", "world-dart-series", 8), 30), true);
  assert.equal(canInvite(regional, ev("WORLD_SERIES", "world-dart-series", 8), 40), false, "out of reach of the invitation list");
  assert.equal(canInvite(regional, ev("WORLD_SERIES", "world-dart-series", 8), undefined), false, "unranked: nobody can sell you");
  assert.equal(canInvite(regional, ev("INVITATIONAL", "thursday-night-darts", 8), 5), false, "television is the top firm's");
  assert.equal(canInvite(top, ev("INVITATIONAL", "thursday-night-darts", 8), 25), true);
  assert.equal(canInvite(top, ev("INVITATIONAL", "world-cup-of-darts", null), 1), false, "national teams are not for sale");
  assert.equal(canInvite(top, ev("MAJOR", "double-crown", 32), 1), false, "ranking majors are not for sale");
  assert.equal(canInvite(top, ev("INVITATIONAL", "champions-masters", 24, false), 1), false, "only events that take invitations");
});

/** Enter a local night and win it, deciding every match; returns its prize. */
async function winLocalNight(tag: string, skip = new Set<string>()) {
  const night = ((await career.calendar.calendar(actor, id, { scope: "AVAILABLE" })).events as any[])
    .filter(e => e.capability.executable && e.human?.canEnter && !e.series && !skip.has(e.id) && e.finance?.travelBand === "LOCAL" && e.finance.topPrizePence > 0 && e.dates.startDay === e.dates.endDay)
    .sort((a, b) => a.dates.startDay - b.dates.startDay)[0];
  return night;
}
async function playUntilPaid(eventId: string, tag: string) {
  for (let i = 0; i < 60; i++) {
    if ((await rows(sql`SELECT 1 FROM career_finance_entries WHERE career_save_id=${id} AND event_id=${eventId} AND category='PRIZE'`)).length) return;
    const s = await saves.read(1, id);
    const r = await career.calendar.advance(actor, id, { operationKey: `manager-test-${tag}-${i}`, expectedSeason: s.currentSeason, expectedWeek: s.currentWeek, target: { kind: "WEEKS", weeks: 1 } }) as any;
    if (r.stop.reason === "HUMAN_MATCH_PENDING") for (const matchId of r.stop.detail.matchIds) {
      const m = (await rows(sql`SELECT best_of FROM career_tournament_matches WHERE career_save_id=${id} AND id=${matchId}`))[0];
      const target = (Number(m.best_of) + 1) / 2;
      await career.calendar.recordHumanMatchResult(actor, id, { matchId, humanLegs: target, opponentLegs: 0, humanThrewFirst: true });
    }
  }
  assert.fail("the event never paid");
}
const commissionOnEvent = async (eventId: string) => rows(sql`SELECT amount_pence, detail FROM career_finance_entries WHERE career_save_id=${id} AND event_id=${eventId} AND category='MANAGER_COMMISSION'`);

test("no cut of prize money from an event you entered yourself; their cut of one they got you into", async () => {
  const own = await winLocalNight("own");
  assert.equal(own.human.managerInvite, null, "you got in on your own");
  assert.equal((await career.calendar.enter(actor, id, { eventId: own.id })).entered, true);
  await playUntilPaid(own.id, "own");
  assert.equal((await commissionOnEvent(own.id)).length, 0, "your manager takes nothing from an event they had no part in");
  // An event your manager got you into (recorded at entry): their cut of its prize, next to it in the ledger.
  const next = await winLocalNight("invited", new Set([own.id]));
  assert.equal((await career.calendar.enter(actor, id, { eventId: next.id })).entered, true);
  const contract = (await rows(sql`SELECT id FROM career_manager_contracts WHERE career_save_id=${id} AND status='ACTIVE'`))[0].id;
  await db.execute(sql`INSERT INTO career_manager_invites (career_save_id,event_id,manager_key,manager_contract_id) VALUES (${id},${next.id},'backroom',${contract})`);
  await playUntilPaid(next.id, "invited");
  const prize = Number((await rows(sql`SELECT amount_pence FROM career_finance_entries WHERE career_save_id=${id} AND event_id=${next.id} AND category='PRIZE'`))[0].amount_pence);
  const [cut] = await commissionOnEvent(next.id);
  assert.equal(Number(cut.amount_pence), -commissionOn(prize, MANAGERS[0]));
  assert.equal((cut.detail as any).source, "INVITATION");
  const v = await managers.read(actor, id);
  assert.equal(v.earned.fromInvitationsPence, commissionOn(prize, MANAGERS[0]));
  assert.equal(v.earned.invitations[0].eventId, next.id);
});

test("the top firm gets a ranked player into an invitational, and the entry is recorded as theirs", async () => {
  await db.execute(sql`UPDATE career_saves SET has_tour_card = true WHERE id = ${id}`);
  await db.execute(sql`UPDATE career_ranking_participants SET current_position = 25 WHERE career_save_id=${id} AND participant_key='HUMAN' AND list_key='pro-world'`);
  if (!(await rows(sql`SELECT 1 FROM career_ranking_participants WHERE career_save_id=${id} AND participant_key='HUMAN' AND list_key='pro-world'`)).length)
    await db.execute(sql`INSERT INTO career_ranking_participants (career_save_id,list_key,participant_key,current_position,current_value_pence,participant_kind,career_high_position,career_high_index,first_ranked_index,updated_index)
      VALUES (${id},'pro-world','HUMAN',25,0,'HUMAN',25,1,1,1)`);
  const before = ((await career.calendar.calendar(actor, id, {})).events as any[]).filter(e => e.circuit === "INVITATIONAL" && e.definitionKey !== "world-cup-of-darts");
  assert.ok(before.length && before.every(e => e.human?.managerInvite === null && !e.human.eligible), "no way in before signing the top firm");
  const elite = await managers.sign(actor, id, { managerKey: "oche-elite" });
  assert.equal(elite.firms.find(f => f.key === "backroom")!.leftThisSeason, true, "signing a new firm ends the old one");
  const open = ((await career.calendar.calendar(actor, id, {})).events as any[]).filter(e => e.human?.managerInvite);
  assert.ok(open.length, "the top firm opens invitational doors");
  assert.ok(open.every(e => ["INVITATIONAL", "WORLD_SERIES"].includes(e.circuit) && e.human.eligible));
  const enterable = open.find(e => e.human.canEnter);
  if (enterable) {
    assert.equal((await career.calendar.enter(actor, id, { eventId: enterable.id })).entered, true);
    assert.equal((await rows(sql`SELECT manager_key FROM career_manager_invites WHERE career_save_id=${id} AND event_id=${enterable.id}`))[0]?.manager_key, "oche-elite");
  }
});

test("a sponsor deal the manager set up pays them their cut of every payment; leaving is free but the deal's cut is still theirs", async () => {
  const s = await saves.read(1, id);
  await withRoot((tx, root) => evaluateOffers(tx, root, facts, "manager-test", s.currentSeason, s.currentWeek));
  const offers = await rows(sql`SELECT id, terms, source FROM career_sponsor_offers WHERE career_save_id=${id} AND operation_key LIKE 'offer:manager-test:%'`);
  assert.ok(offers.length > 0 && offers.length <= MAX_OFFERS_PER_EVALUATION + 1);
  assert.ok(offers.every(o => (o.source as any).manager?.key === "oche-elite"), "every offer they bring carries their name");
  const bonusOffer = offers.find(o => (o.terms as any).signingBonusPence > 0);
  assert.ok(bonusOffer, "an offer with a signing bonus");
  const premium = (bonusOffer.source as any).managerPremium;
  assert.equal((bonusOffer.terms as any).signingBonusPence, boosted(premium.beforePence, 0.5));
  await finance.acceptOffer(actor, id, { offerId: String(bonusOffer.id) });
  const bonus = Number((bonusOffer.terms as any).signingBonusPence);
  const cut = (await rows(sql`SELECT amount_pence, detail FROM career_finance_entries WHERE career_save_id=${id} AND category='MANAGER_COMMISSION' AND detail->>'source'='SPONSOR_DEAL'`));
  assert.ok(cut.some(c => Number(c.amount_pence) === -commissionOn(bonus, managerByKey("oche-elite")!)), "their cut of the signing bonus");
  const v = await managers.read(actor, id);
  assert.ok(v.earned.fromDealsPence >= commissionOn(bonus, managerByKey("oche-elite")!));
  assert.ok(v.earned.deals.length >= 1 && v.earned.extraSigningBonusPence > 0);
  const left = await managers.leave(actor, id);
  assert.equal(left.current, null);
  assert.equal(left.earned.totalPence, v.earned.totalPence, "what they earned stays on the record");
  await status(managers.sign(actor, id, { managerKey: "oche-elite" }));
});
