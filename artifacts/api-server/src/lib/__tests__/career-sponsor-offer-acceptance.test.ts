/**
 * F2 register P1-2: Sponsor HQ listed offers that the signing endpoint then refused
 * (required appearances had no non-overlapping schedule). Listing and signing now share
 * assessOfferAcceptance; these tests pin that the listed signability always agrees with
 * the real signing result, for valid and invalid offers, without weakening any rule.
 */
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import { createCareerSponsorshipFoundation } from "../../db/migrations/create_career_sponsorship_foundation.ts";
import { createCareerNpcSponsorMarketSPF } from "../../db/migrations/create_career_npc_sponsor_market_spf.ts";
import { createCareerSporting } from "../../db/migrations/create_career_sporting.ts";
import { createCareerCalendar } from "../../db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../../db/migrations/create_career_finance.ts";
import { createCareerSponsorJourneysSPB } from "../../db/migrations/create_career_sponsor_journeys_spb.ts";
import { createCareerSponsorJourneysSPB3 } from "../../db/migrations/create_career_sponsor_journeys_spb3.ts";
import { createCareerFinanceSPC } from "../../db/migrations/create_career_finance_spc.ts";
import { createCareerSponsorHQSPD } from "../../db/migrations/create_career_sponsor_hq_spd.ts";
import { addContractConcludedSponsorEventSPE1 } from "../../db/migrations/add_contract_concluded_sponsor_event_spe1.ts";
import { addScheduledSponsorRenewalsSPE1B } from "../../db/migrations/add_scheduled_sponsor_renewals_spe1b.ts";
import { createCareerSponsorContractActionsSPE2 } from "../../db/migrations/create_career_sponsor_contract_actions_spe2.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerFinanceService } from "../../career/finance/service.ts";
import { evaluateOffers, type SponsorFactsProvider } from "../../career/finance/engine.ts";
import type { SponsorApproachSource } from "../../career/finance/sponsor-journey.ts";
import type { SportingFacts } from "../../career/finance/sponsors.catalogue.ts";
import { lockRoot } from "../../career/world/service.ts";
import type { RootRow } from "../../career/calendar/engine.ts";

const pg = new PGlite();
const db = drizzle(pg);
const saves = createCareerService(db);
const fixture: SportingFacts = { careerStarted: true, titles: 3, bestFinishByCircuit: { GRASSROOTS: 1, COUNTY: 1 }, qualifications: [], professionalStatus: "AMATEUR", tourCard: false, worldRanking: null };
const facts: SponsorFactsProvider = { id: "TEST_FIXTURE", facts: async () => structuredClone(fixture) };
const finance = createCareerFinanceService(db, { facts });
const actor = { playerId: 1 };
type Offer = { id: string; sponsorKey: string; kind: string; conflictingContractIds: string[]; portfolioFull: boolean;
  terms: { contractFoundation?: { activitySpecification?: { required: unknown[] } } };
  acceptance: { signable: boolean; code: string | null; reason: string | null } | null };

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  await createCareerSaves(db); await createCareerWorld(db); await createCareerSponsorshipFoundation(db); await createCareerNpcSponsorMarketSPF(db);
  await createCareerCalendar(db); await createCareerFinance(db); await createCareerSponsorJourneysSPB(db); await createCareerSponsorJourneysSPB3(db);
  await createCareerFinanceSPC(db); await createCareerSponsorHQSPD(db); await addContractConcludedSponsorEventSPE1(db);
  await addScheduledSponsorRenewalsSPE1B(db); await createCareerSponsorContractActionsSPE2(db); await createCareerSporting(db);
});
beforeEach(async () => { await pg.exec("DELETE FROM career_saves"); });
after(async () => { await pg.close(); });

const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows;
async function saveWithOffers() {
  const save = await saves.create(1, { slot: 1 });
  await finance.initialize(actor, save.id);
  const r = await saves.read(1, save.id);
  for (const [i, circuit] of (["GRASSROOTS", "COUNTY"] as const).entries()) {
    const source: Extract<SponsorApproachSource, { kind: "RESULT" }> = { kind: "RESULT", eventId: `fixture-${i}`, eventName: "Fixture Open", circuit,
      season: r.currentSeason, week: r.currentWeek, finishingPosition: 1, isChampion: true };
    await db.transaction(async tx => evaluateOffers(tx, await lockRoot(tx, actor, save.id) as RootRow, structuredClone(fixture), `event:fixture-${i}`, r.currentSeason, r.currentWeek, source));
  }
  return save.id as string;
}
const listed = async (saveId: string) => (await finance.sponsors(actor, saveId)).offers as unknown as Offer[];
/** Sign through the real service (the same call the HTTP route makes). */
async function trySign(saveId: string, offer: Offer) {
  try {
    await finance.acceptOffer(actor, saveId, { offerId: offer.id, ...(offer.conflictingContractIds.length ? { replaceContractIds: offer.conflictingContractIds } : {}) });
    return { ok: true } as const;
  } catch (e) { return { ok: false, status: (e as { status?: number }).status, message: (e as Error).message } as const; }
}
async function snapshot(saveId: string) {
  return { contracts: Number((await rows(sql`SELECT COUNT(*)::int n FROM career_sponsor_contracts WHERE career_save_id=${saveId}`))[0]!.n),
    balance: Number((await rows(sql`SELECT balance_pence FROM career_saves WHERE id=${saveId}`))[0]!.balance_pence) };
}
/** Fill every free week of the season with a confirmed booking: no sponsor appearance can be scheduled. */
async function fillCalendar(saveId: string, season: number) {
  for (let week = 1; week <= 52; week++)
    await db.execute(sql`INSERT INTO career_sponsor_week_bookings (career_save_id,season,week,activity_id,activity_kind,status)
      VALUES (${saveId},${season},${week},${randomUUID()},'OPPORTUNITY','CONFIRMED') ON CONFLICT DO NOTHING`);
}

test("valid offers are listed as signable and the signing endpoint accepts them", async () => {
  const saveId = await saveWithOffers();
  const offers = await listed(saveId);
  assert.ok(offers.length > 0, "fixture produced sponsor offers");
  const signable = offers.filter(o => o.acceptance?.signable && !o.portfolioFull);
  assert.ok(signable.length > 0, JSON.stringify(offers.map(o => [o.sponsorKey, o.acceptance])));
  const before = await snapshot(saveId);
  const result = await trySign(saveId, signable[0]!);
  assert.deepEqual(result, { ok: true });
  assert.equal((await snapshot(saveId)).contracts, before.contracts + 1);
});

test("offers whose required appearances cannot be scheduled are listed as unsignable, and signing refuses them with the same reason", async () => {
  const saveId = await saveWithOffers();
  const r = await saves.read(1, saveId);
  const withDuties = (await listed(saveId)).filter(o => (o.terms.contractFoundation?.activitySpecification?.required.length ?? 0) > 0);
  assert.ok(withDuties.length > 0, "the current catalogue offers include required appearance clauses");
  await fillCalendar(saveId, r.currentSeason);
  const after = (await listed(saveId)).filter(o => withDuties.some(d => d.id === o.id));
  for (const offer of after) {
    assert.equal(offer.acceptance?.signable, false, `${offer.sponsorKey} must not be presented as signable`);
    assert.equal(offer.acceptance?.code, "ACTIVITY_SCHEDULE_UNAVAILABLE");
    const before = await snapshot(saveId);
    const result = await trySign(saveId, offer);
    assert.equal(result.ok, false); assert.equal((result as { status?: number }).status, 409);
    assert.equal((result as { message: string }).message, offer.acceptance?.reason, "listing reason = signing refusal");
    assert.deepEqual(await snapshot(saveId), before, "a refused signing changes nothing");
  }
  // Freeing the calendar makes the same offers signable again: nothing was weakened or cached.
  await db.execute(sql`DELETE FROM career_sponsor_week_bookings WHERE career_save_id=${saveId}`);
  assert.ok((await listed(saveId)).filter(o => withDuties.some(d => d.id === o.id)).every(o => o.acceptance?.signable));
});

test("an offer whose sponsor requirement is no longer met is listed as unsignable and refused", async () => {
  const saveId = await saveWithOffers();
  const original = structuredClone(fixture);
  try {
    Object.assign(fixture, { careerStarted: false, titles: 0, bestFinishByCircuit: {} });
    const offers = await listed(saveId);
    const unmet = offers.filter(o => o.acceptance?.code === "REQUIREMENT_UNMET");
    assert.ok(unmet.length > 0, JSON.stringify(offers.map(o => o.acceptance)));
    for (const offer of unmet) {
      assert.equal(offer.acceptance?.signable, false);
      const result = await trySign(saveId, offer);
      assert.equal(result.ok, false); assert.equal((result as { message: string }).message, offer.acceptance?.reason);
    }
  } finally { Object.assign(fixture, original); }
});

test("an expired offer that is still AVAILABLE is listed as unsignable", async () => {
  const saveId = await saveWithOffers();
  const [offer] = await listed(saveId);
  await db.execute(sql`UPDATE career_saves SET current_week = 52 WHERE id=${saveId}`);
  await db.execute(sql`UPDATE career_sponsor_offers SET expires_week = 2 WHERE career_save_id=${saveId} AND id=${offer!.id}`);
  const after = (await listed(saveId)).find(o => o.id === offer!.id)!;
  assert.deepEqual([after.acceptance?.signable, after.acceptance?.code], [false, "EXPIRED"]);
});

test("listed signability agrees with the signing endpoint for every listed offer", async () => {
  // Each offer is signed on its own fresh save (same fixture, partially booked calendar), so one
  // signing never changes the state another offer is judged against.
  let checked = 0, unsignable = 0;
  for (let i = 0; ; i++) {
    await pg.exec("DELETE FROM career_saves");
    const saveId = await saveWithOffers();
    const r = await saves.read(1, saveId);
    for (let week = r.currentWeek + 1; week <= 52; week++) if (week % 3)
      await db.execute(sql`INSERT INTO career_sponsor_week_bookings (career_save_id,season,week,activity_id,activity_kind,status)
        VALUES (${saveId},${r.currentSeason},${week},${randomUUID()},'OPPORTUNITY','CONFIRMED') ON CONFLICT DO NOTHING`);
    const offers = (await listed(saveId)).sort((a, b) => a.sponsorKey.localeCompare(b.sponsorKey));
    if (i >= offers.length) break;
    const offer = offers[i]!;
    if (offer.portfolioFull) continue;
    const result = await trySign(saveId, offer);
    if (offer.acceptance?.signable) assert.deepEqual(result, { ok: true }, `${offer.sponsorKey}: listed signable but refused: ${JSON.stringify(result)}`);
    else { unsignable++; assert.equal(result.ok, false, `${offer.sponsorKey}: listed unsignable but signed`); assert.equal((result as { message: string }).message, offer.acceptance?.reason); }
    checked++;
  }
  assert.ok(checked > 0);
  console.log(`# agreement checked ${checked} offers (${unsignable} unsignable)`);
});
