/** The sponsor ladder: one headline sponsor at a time, from a local backer to a signature range. */
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
  id = (await saves.create(1, { slot: 1, careerName: "Ladder", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });

import { SPONSOR_LADDER, sponsorBrand, sponsorWeeklyPence } from "../../career/streaming/business.ts";

test("ladder rules: fees grow with the rung and the audience; a manager adds 20%; brands belong to their rung", () => {
  assert.equal(sponsorWeeklyPence(1, 0, false), SPONSOR_LADDER[0].basePence);
  assert.ok(sponsorWeeklyPence(4, 300, false) > sponsorWeeklyPence(3, 300, false));
  assert.ok(sponsorWeeklyPence(2, 400, false) > sponsorWeeklyPence(2, 40, false));
  assert.equal(sponsorWeeklyPence(3, 100, true), Math.round(sponsorWeeklyPence(3, 100, false) * 1.2 / 100) * 100);
  for (const r of SPONSOR_LADDER) for (let n = 0; n < 6; n++) assert.ok(r.brands.some(b => b.key === sponsorBrand(SEED, r.rung, n).key));
});

test("climbing the ladder: offers by tier, paid only for weeks you went live, banked with fans, decline and walk away", async () => {
  const root = { id, world_seed: String((await rows(sql`SELECT world_seed FROM career_saves WHERE id=${id}`))[0].world_seed) };
  const season = (await saves.read(1, id)).currentSeason;
  await db.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${id}, 'LadderDarts', 60)`);
  const live = (w: number) => db.execute(sql`INSERT INTO career_streams (career_save_id, id, season, week, day, status, challenger, first_thrower, tally)
    VALUES (${id}, gen_random_uuid(), ${season}, ${w}, ${w * 7}, 'ENDED', '{"name":"x"}'::jsonb, 0, '{}'::jsonb)`);
  const week = async (w: number) => { await db.execute(sql`UPDATE career_saves SET current_week=${w} WHERE id=${id}`); await settleStreamingWeek(db, root, season, w); await settleStreamingWeek(db, root, season, w); return streaming.read(actor, id); };
  let v = await week(1);
  assert.equal(v.business.sponsor.offer, null, "nobody sponsors a channel under 100 followers");
  assert.match(v.business.sponsor.why ?? "", /100 followers/);
  await db.execute(sql`UPDATE career_stream_channels SET followers=150 WHERE career_save_id=${id}`);
  v = await week(2);
  assert.equal(v.business.sponsor.offer?.rung, 1, "a local backer comes calling");
  // Turn it down: it comes back a few weeks later.
  v = await streaming.answerSponsor(actor, id, v.business.sponsor.offer!.id, { action: "DECLINE" });
  assert.equal(v.business.sponsor.offer, null);
  await status(streaming.answerSponsor(actor, id, (await rows(sql`SELECT id FROM career_stream_sponsors WHERE career_save_id=${id}`))[0].id as string, { action: "ACCEPT" }));
  for (let w = 3; w <= 5; w++) v = await week(w);
  assert.equal(v.business.sponsor.offer, null, "not straight back");
  v = await week(6);
  assert.equal(v.business.sponsor.offer?.rung, 1, "re-offered after four weeks");
  v = await streaming.answerSponsor(actor, id, v.business.sponsor.offer!.id, { action: "ACCEPT" });
  const weekly = v.business.sponsor.active!.weeklyPence;
  // Ten paid weeks needed; quiet weeks aren't paid. Go live every other week.
  let w = 7;
  for (; v.business.sponsor.active; w++) { if (w % 2 === 1) await live(w); v = await week(w); }
  assert.equal(v.business.sponsor.rungs[0].status, "BANKED");
  const paid = await rows(sql`SELECT COUNT(*)::int AS n, SUM(amount_pence)::bigint AS p FROM career_finance_entries WHERE career_save_id=${id} AND operation_key LIKE 'stream-sponsor:%'`);
  assert.equal(Number(paid[0].n), SPONSOR_LADDER[0].weeks, "paid once for each live week, never twice");
  assert.equal(Number(paid[0].p), weekly * SPONSOR_LADDER[0].weeks);
  assert.ok(w - 7 >= SPONSOR_LADDER[0].weeks * 2 - 1, "quiet weeks didn't count");
  const banked = await rows(sql`SELECT fans FROM career_stream_sponsors WHERE career_save_id=${id} AND status='COMPLETED'`);
  assert.equal(Number(banked[0].fans), SPONSOR_LADDER[0].fans, "fans for your darts career");
  // The regional rung needs 500 followers.
  for (let i = 0; i < 5; i++) v = await week(w++);
  assert.equal(v.business.sponsor.offer, null); assert.match(v.business.sponsor.why ?? "", /500 followers/);
  await db.execute(sql`UPDATE career_stream_channels SET followers=30000 WHERE career_save_id=${id}`);
  v = await week(w++);
  assert.equal(v.business.sponsor.offer?.rung, 2, "next rung up, never skipping one");
  v = await streaming.answerSponsor(actor, id, v.business.sponsor.offer!.id, { action: "ACCEPT" });
  await live(w); v = await week(w++);
  assert.equal(v.business.sponsor.active?.weeksPaid, 1);
  // Walk away: no penalty, the rung isn't banked, and it's offered again later.
  v = await streaming.answerSponsor(actor, id, v.business.sponsor.active!.id, { action: "END" });
  assert.equal(v.business.sponsor.active, null);
  assert.equal(v.business.sponsor.rungs[1].status, "NEXT");
  for (let i = 0; i < 4; i++) v = await week(w++);
  assert.equal(v.business.sponsor.offer?.rung, 2);
  // Offers lapse unanswered.
  for (let i = 0; i < 3; i++) v = await week(w++);
  assert.equal(v.business.sponsor.offer, null);
  await status(streaming.answerSponsor(actor, id, "00000000-0000-4000-8000-000000000000", { action: "ACCEPT" }), 404);
});
