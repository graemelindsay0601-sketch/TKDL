/** Managers: signed on facts, take their cut of prize money, and get you bigger sponsor signing bonuses and more offers. */
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
import { MANAGERS, boosted, commissionOn } from "../../career/manager/model.ts";
import { lockRoot } from "../../career/world/service.ts";
import { post } from "../../career/finance/ledger.ts";
import { evaluateOffers } from "../../career/finance/engine.ts";
import { MAX_OFFERS_PER_EVALUATION } from "../../career/finance/config.ts";
import type { RootRow } from "../../career/calendar/engine.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db), managers = createCareerManagerService(db);
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

test("your manager takes their cut of a cash prize, next to it in the ledger", async () => {
  const night = ((await career.calendar.calendar(actor, id, { scope: "AVAILABLE" })).events as any[])
    .filter(e => e.capability.executable && e.human?.canEnter && !e.series && e.finance?.travelBand === "LOCAL" && e.finance.topPrizePence > 0 && e.dates.startDay === e.dates.endDay)
    .sort((a, b) => a.dates.startDay - b.dates.startDay)[0];
  assert.equal((await career.calendar.enter(actor, id, { eventId: night.id })).entered, true);
  for (let i = 0; i < 60; i++) {
    const s = await saves.read(1, id);
    if ((await rows(sql`SELECT 1 FROM career_finance_entries WHERE career_save_id=${id} AND event_id=${night.id} AND category='PRIZE'`)).length) break;
    const r = await career.calendar.advance(actor, id, { operationKey: `managed-${i}`, expectedSeason: s.currentSeason, expectedWeek: s.currentWeek, target: { kind: "WEEKS", weeks: 1 } }) as any;
    if (r.stop.reason === "HUMAN_MATCH_PENDING") for (const matchId of r.stop.detail.matchIds) {
      const m = (await rows(sql`SELECT best_of FROM career_tournament_matches WHERE career_save_id=${id} AND id=${matchId}`))[0];
      const target = (Number(m.best_of) + 1) / 2;
      await career.calendar.recordHumanMatchResult(actor, id, { matchId, humanLegs: target, opponentLegs: 0, humanThrewFirst: true });
    }
  }
  const prize = (await rows(sql`SELECT amount_pence FROM career_finance_entries WHERE career_save_id=${id} AND event_id=${night.id} AND category='PRIZE'`))[0];
  assert.ok(prize, "won the night");
  const cut = (await rows(sql`SELECT amount_pence, detail FROM career_finance_entries WHERE career_save_id=${id} AND event_id=${night.id} AND category='MANAGER_COMMISSION'`))[0];
  const backroom = MANAGERS.find(m => m.key === "backroom")!;
  assert.equal(Number(cut.amount_pence), -commissionOn(Number(prize.amount_pence), backroom));
  assert.equal(commissionOn(2500, backroom), 250);
  const v = await managers.read(actor, id);
  assert.equal(v.current!.commissionThisSeasonPence, commissionOn(Number(prize.amount_pence), backroom));
});

test("a manager adds to sponsor signing bonuses and brings one more offer; leaving is free but they will not take you back this season", async () => {
  await db.execute(sql`UPDATE career_saves SET has_tour_card = true WHERE id = ${id}`);
  const elite = await managers.sign(actor, id, { managerKey: "oche-elite" });
  assert.equal(elite.current?.key, "oche-elite");
  assert.equal(elite.firms.find(f => f.key === "backroom")!.leftThisSeason, true, "signing a new firm ends the old one");
  const facts = { careerStarted: true, titles: 20, professionalStatus: "PROFESSIONAL" as const, tourCard: true, worldRanking: 8, qualifications: [], bestFinishByCircuit: {} };
  const s = await saves.read(1, id);
  await withRoot((tx, root) => evaluateOffers(tx, root, facts, "manager-test", s.currentSeason, s.currentWeek));
  const offers = await rows(sql`SELECT terms, source FROM career_sponsor_offers WHERE career_save_id=${id} AND operation_key LIKE 'offer:manager-test:%'`);
  assert.ok(offers.length > 0 && offers.length <= MAX_OFFERS_PER_EVALUATION + 1);
  assert.ok(offers.some(o => (o.source as any).managerPremium), "at least one offer carries the manager's premium");
  for (const o of offers) {
    const premium = (o.source as any).managerPremium, terms = o.terms as any;
    if (!premium) { assert.equal(terms.signingBonusPence, 0); continue; }
    assert.equal(premium.managerKey, "oche-elite");
    assert.equal(terms.signingBonusPence, boosted(premium.beforePence, 0.5));
  }
  const left = await managers.leave(actor, id);
  assert.equal(left.current, null);
  await status(managers.sign(actor, id, { managerKey: "oche-elite" }));
  assert.equal((await managers.read(actor, id)).firms.find(f => f.key === "northgate")!.available, false, "Northgate still wants £3,000 in prize money");
});
