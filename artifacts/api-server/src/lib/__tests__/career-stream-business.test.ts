/** Business: merch drops, affiliate codes, the team and the platform offer. */
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
  id = (await saves.create(1, { slot: 1, careerName: "Business", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });

import { MERCH, MERCH_ITEMS, TEAM, affiliatePayout, merchSales, platformOfferPence } from "../../career/streaming/business.ts";

test("business rules: merch sells to your loyal fans and fades, codes pay by audience, the platform pays big", () => {
  assert.equal(merchSales(SEED, "d", 0, "SHIRT", 1000, 10, 0, 50), 0);
  assert.equal(merchSales(SEED, "d", MERCH.weeks + 1, "SHIRT", 1000, 10, 0, 50), 0);
  assert.ok(merchSales(SEED, "d", 1, "SHIRT", 5000, 20, 2, 500) > merchSales(SEED, "d", 3, "SHIRT", 5000, 20, 2, 500), "launch week sells most");
  assert.ok(merchSales(SEED, "d", 1, "SHIRT", 100000, 30, 3, 5) <= 5, "never more than the stock");
  assert.ok(affiliatePayout(SEED, "a", 20000, 4, true) > affiliatePayout(SEED, "a", 20000, 4, false), "a manager negotiates a better cut");
  assert.equal(affiliatePayout(SEED, "a", 20000, 0, false), 0, "no streams that month, no sales");
  assert.ok(platformOfferPence(30000) >= 500_000);
});

test("merch, the team, affiliate codes and the platform offer through the service and the week", async () => {
  const root = { id, world_seed: String((await rows(sql`SELECT world_seed FROM career_saves WHERE id=${id}`))[0].world_seed) };
  const s = await saves.read(1, id), season = s.currentSeason;
  await db.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${id}, 'BizDarts', 30)`);
  let v = await streaming.read(actor, id);
  assert.equal(v.business.merch.open, false, "merch from 50 followers");
  await status(streaming.dropMerch(actor, id, { item: "SHIRT", units: 25 }));
  await db.execute(sql`UPDATE career_stream_channels SET followers=30000 WHERE career_save_id=${id}`);
  await db.execute(sql`UPDATE career_saves SET balance_pence=5000000 WHERE id=${id}`);
  await status(streaming.dropMerch(actor, id, { item: "SHIRT", units: 7 }), 400);
  v = await streaming.dropMerch(actor, id, { item: "FLIGHTS", units: 100 });
  assert.equal(v.business.merch.drops[0].units, 100); assert.equal(v.business.merch.open, false, "one drop at a time");
  // The team: hired from the right tier; wages each week.
  v = await streaming.setTeam(actor, id, { role: "EDITOR", hire: true });
  v = await streaming.setTeam(actor, id, { role: "MANAGER", hire: true });
  assert.ok(v.business.team.every(t => t.hired));
  // A month of weeks: merch sells, wages are paid, an affiliate offer turns up and pays once accepted, the platform offers at week 20.
  for (let w = 1; w <= 21; w++) {
    await settleStreamingWeek(db, root, season, w); await settleStreamingWeek(db, root, season, w);
    v = await streaming.read(actor, id);
    if (v.business.affiliate.offer) v = await streaming.answerAffiliate(actor, id, v.business.affiliate.offer.id, { action: "ACCEPT" });
    if (w % 4 === 0) await db.execute(sql`INSERT INTO career_streams (career_save_id, id, season, week, day, status, challenger, first_thrower, tally)
      VALUES (${id}, gen_random_uuid(), ${season}, ${w + 1}, ${(w + 1) * 7}, 'ENDED', '{"name":"x"}'::jsonb, 0, '{}'::jsonb)`);
  }
  const drop = v.business.merch.drops[0];
  assert.ok(drop.sold > 0 && drop.revenuePence === drop.sold * MERCH_ITEMS.find(m => m.key === "FLIGHTS")!.pricePence);
  const wages = await rows(sql`SELECT COUNT(*)::int AS n, SUM(amount_pence)::bigint AS p FROM career_finance_entries WHERE career_save_id=${id} AND operation_key LIKE 'adjustment:stream-wage:%'`);
  assert.equal(Number(wages[0].n), 42, "both wages, every week, once"); assert.equal(Number(wages[0].p), -21 * (TEAM.EDITOR.wagePence + TEAM.MANAGER.wagePence));
  assert.ok(v.business.affiliate.active, "accepted code is running");
  assert.ok(v.business.affiliate.active!.paidPence > 0, "and it has paid");
  assert.ok(v.business.platform.offer && v.business.platform.offer > 0, "a Star gets the platform offer");
  v = await streaming.answerPlatform(actor, id, { accept: true });
  assert.equal(v.business.platform.active, true);
  assert.ok(v.collabs.every(c => !c.ok), "no collabs while exclusive");
  await status(streaming.answerPlatform(actor, id, { accept: false }));
  v = await streaming.answerAffiliate(actor, id, v.business.affiliate.active!.id, { action: "END" });
  assert.equal(v.business.affiliate.active, null);
  v = await streaming.setTeam(actor, id, { role: "MANAGER", hire: false });
  assert.ok(!v.business.team.find(t => t.role === "MANAGER")!.hired);
});
