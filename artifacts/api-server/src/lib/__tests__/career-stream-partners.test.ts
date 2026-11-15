/** Brand partners: category sponsors in several kinds of deal, alongside the headline sponsor. */
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
import { createCareerStreamingService } from "../../career/streaming/service.ts";
import { settleStreamingWeek } from "../../career/streaming/state.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db), streaming = createCareerStreamingService(db);
const actor = { playerId: 1 };
let id = "";
const SEED = "a".repeat(64);
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows;
const status = (p: Promise<unknown>, n = 409) => assert.rejects(p, (e: { status?: number }) => e.status === n);

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
    createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
  await repairCareerSchema(db);
  id = (await saves.create(1, { slot: 1, careerName: "Partners", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });

import { BRAND_ROSTER, PARTNERS, PARTNER_MANAGER, dealTerms, nextOffer, retainerPence, trustBonus, upcomingCup } from "../../career/streaming/partners.ts";
import { MANAGER_FEES, SPONSOR_LADDER } from "../../career/streaming/business.ts";

test("partner rules: a bigger roster, one brand per category, trust raises fees, ambassadors only for brands that know you", () => {
  assert.ok(BRAND_ROSTER.length >= 25 && new Set(BRAND_ROSTER.map(b => b.key)).size === BRAND_ROSTER.length);
  assert.equal(PARTNER_MANAGER, MANAGER_FEES);
  for (const r of SPONSOR_LADDER) assert.ok(r.brands.length >= 3, `${r.name} has a pool of brands`);
  assert.ok(retainerPence("PARTNER", 100, 3, false) > retainerPence("PARTNER", 100, 0, false));
  assert.equal(trustBonus(99), PARTNERS.trustCap);
  assert.ok(dealTerms("AMBASSADOR", "STAR", 300, 2, false).feePence > dealTerms("RETAINER", "STAR", 300, 2, false).feePence);
  assert.equal(dealTerms("SEEDING", "STAR", 300, 0, true).feePence, 0);
  assert.deepEqual(upcomingCup(8), { n: 1, name: "Spring Cup", opens: 10, closes: 11 }); assert.equal(upcomingCup(11), null);
  const kinds = new Set<string>();
  for (let n = 0; n < 200; n++) {
    const o = nextOffer(SEED, n, "PARTNER", 20, new Set(["DRINKS"]), new Map())!;
    assert.notEqual(o.brand.category, "DRINKS", "never a blocked category");
    assert.notEqual(o.brand.minTier, "STAR", "only brands that work with your size");
    assert.notEqual(o.kind, "AMBASSADOR", "no ambassadorship from a stranger");
    if (o.kind === "CUP_TITLE") assert.equal(o.cup?.n, 2);
    kinds.add(o.kind);
  }
  assert.deepEqual([...kinds].sort(), ["APPEARANCE", "CUP_TITLE", "GIVEAWAY", "RETAINER", "SEEDING"]);
  const known = new Map([["oche-energy", 3]]);
  assert.ok(Array.from({ length: 200 }, (_, n) => nextOffer(SEED, n, "PARTNER", 1, new Set(), known)!).some(o => o.kind === "AMBASSADOR" && o.brand.key === "oche-energy"));
  assert.equal(nextOffer(SEED, 0, "NEWCOMER", 1, new Set(["FOOD", "LOCAL"]), new Map()), null);
});

test("brand partners through the week and the service: slots, clashes, every kind of deal paying its way", async () => {
  const root = { id, world_seed: String((await rows(sql`SELECT world_seed FROM career_saves WHERE id=${id}`))[0].world_seed) };
  const season = (await saves.read(1, id)).currentSeason;
  await db.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${id}, 'PartnerDarts', 20)`);
  const live = (w: number) => db.execute(sql`INSERT INTO career_streams (career_save_id, id, season, week, day, status, challenger, first_thrower, tally)
    VALUES (${id}, gen_random_uuid(), ${season}, ${w}, ${w * 7}, 'ENDED', '{"name":"x"}'::jsonb, 0, '{}'::jsonb)`);
  const week = async (w: number) => { await db.execute(sql`UPDATE career_saves SET current_week=${w} WHERE id=${id}`);
    await settleStreamingWeek(db, root, season, w); await settleStreamingWeek(db, root, season, w); return streaming.read(actor, id); };
  let v = await week(1);
  assert.equal(v.business.partners.slots, 0); assert.match(v.business.partners.why ?? "", /Affiliate/);
  await db.execute(sql`UPDATE career_stream_channels SET followers=5000 WHERE career_save_id=${id}`);
  v = await week(2);
  assert.equal(v.business.partners.slots, 2); assert.equal(v.business.partners.offers.length, 1);
  // Seed each kind of deal directly so every path is exercised, then play the weeks.
  await db.execute(sql`DELETE FROM career_stream_partner_deals WHERE career_save_id=${id}`);
  const deal = (n: number, brand: string, category: string, kind: string, fee: number, weeks: number, extra: { followers?: number; cup?: number } = {}) =>
    db.execute(sql`INSERT INTO career_stream_partner_deals (career_save_id, id, n, brand_key, brand_name, category, kind, season, week, fee_pence, weeks_total, followers, cup_season, cup_no, status)
      VALUES (${id}, gen_random_uuid(), ${n}, ${brand}, ${brand}, ${category}, ${kind}, ${season}, 3, ${fee}, ${weeks}, ${extra.followers ?? 0}, ${extra.cup ? season : null}, ${extra.cup ?? null}, 'OFFERED')`);
  await deal(0, "oche-energy", "DRINKS", "RETAINER", 10_000, 2);
  await deal(1, "fizz-rocket", "DRINKS", "GIVEAWAY", 9_000, 1, { followers: 150 });
  await deal(2, "pixel-mic", "GEAR", "APPEARANCE", 5_000, 1, { followers: 40 });
  await deal(3, "flightdeck", "DARTS", "SEEDING", 0, 2);
  await db.execute(sql`UPDATE career_saves SET current_week=3 WHERE id=${id}`);
  v = await streaming.read(actor, id);
  const offer = (brand: string) => v.business.partners.offers.find(o => o.brand === brand)!;
  v = await streaming.answerPartner(actor, id, offer("oche-energy").id, { action: "ACCEPT" });
  assert.match(offer("fizz-rocket").clash ?? "", /already have oche-energy/, "one brand per category");
  await status(streaming.answerPartner(actor, id, offer("fizz-rocket").id, { action: "ACCEPT" }));
  // An appearance pays there and then.
  const before = (await rows(sql`SELECT followers FROM career_stream_channels WHERE career_save_id=${id}`))[0].followers as number;
  v = await streaming.answerPartner(actor, id, offer("pixel-mic").id, { action: "ACCEPT" });
  assert.equal((await rows(sql`SELECT followers FROM career_stream_channels WHERE career_save_id=${id}`))[0].followers, before + 40);
  assert.equal(v.business.partners.used, 1, "an appearance doesn't hold a slot");
  v = await streaming.answerPartner(actor, id, offer("flightdeck").id, { action: "ACCEPT" });
  assert.equal(v.business.partners.used, 2);
  assert.match(v.business.partners.offers[0].clash ?? "", /full|already/, "slots full");
  // The retainer pays only for live weeks; gifted kit runs regardless and then counts as trust.
  v = await week(3); await live(4); v = await week(4); await live(5); v = await week(5);
  const paid = await rows(sql`SELECT operation_key, amount_pence FROM career_finance_entries WHERE career_save_id=${id} AND operation_key LIKE 'stream-partner:%' ORDER BY operation_key`);
  assert.equal(paid.length, 3, "appearance + two live retainer weeks");
  assert.equal(paid.reduce((n, r) => n + Number(r.amount_pence), 0), 5_000 + 2 * 10_000);
  assert.equal(v.business.partners.active.length, 0, "retainer and kit both finished");
  const flight = v.business.partners.brands.find(b => b.brand === "FlightDeck")!;
  assert.equal(flight.deals, 2); assert.equal(flight.ambassador, true, "gifted kit makes a brand know you");
  // A cup title pays when you play the cup; an unplayed one lapses after the cup closes.
  await db.execute(sql`DELETE FROM career_stream_partner_deals WHERE career_save_id=${id} AND status IN ('OFFERED')`);
  await deal(10, "gripline", "DARTS", "CUP_TITLE", 20_000, 1, { cup: 1 });
  await deal(11, "hot-slice", "FOOD", "CUP_TITLE", 20_000, 1, { cup: 2 });
  await db.execute(sql`UPDATE career_stream_partner_deals SET status='ACTIVE' WHERE career_save_id=${id} AND n IN (10, 11)`);
  await db.execute(sql`INSERT INTO career_stream_cups (career_save_id, season, cup_no, name, size, champion, stream_id) VALUES (${id}, ${season}, 1, 'Spring Cup', 8, 'You', gen_random_uuid())`);
  v = await week(10);
  assert.equal((await rows(sql`SELECT status FROM career_stream_partner_deals WHERE career_save_id=${id} AND n=10`))[0].status, "COMPLETED");
  for (let w = 11; w <= 25; w++) v = await week(w);
  assert.equal((await rows(sql`SELECT status FROM career_stream_partner_deals WHERE career_save_id=${id} AND n=11`))[0].status, "EXPIRED");
  // Giveaways pay and bring followers on your next live week; end a deal early with no penalty.
  await deal(20, "fizz-rocket", "DRINKS", "GIVEAWAY", 9_000, 1, { followers: 150 });
  await db.execute(sql`UPDATE career_stream_partner_deals SET status='ACTIVE' WHERE career_save_id=${id} AND n=20`);
  const f0 = Number((await rows(sql`SELECT followers FROM career_stream_channels WHERE career_save_id=${id}`))[0].followers);
  await live(26); v = await week(26);
  assert.equal(Number((await rows(sql`SELECT followers FROM career_stream_channels WHERE career_save_id=${id}`))[0].followers), f0 + 150);
  await deal(21, "shieldnet-vpn", "TECH", "RETAINER", 8_000, 8);
  await db.execute(sql`UPDATE career_stream_partner_deals SET status='ACTIVE' WHERE career_save_id=${id} AND n=21`);
  v = await streaming.read(actor, id);
  v = await streaming.answerPartner(actor, id, v.business.partners.active.find(a => a.brand === "shieldnet-vpn")!.id, { action: "END" });
  assert.ok(!v.business.partners.active.some(a => a.brand === "shieldnet-vpn"));
  await status(streaming.answerPartner(actor, id, "00000000-0000-4000-8000-000000000000", { action: "ACCEPT" }), 404);
});
