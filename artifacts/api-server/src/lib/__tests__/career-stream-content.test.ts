/** Content: VODs, Shorts, the podcast, watch-alongs and studio sets. */
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
  id = (await saves.create(1, { slot: 1, careerName: "Content", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });

import { CONTENT, guestAnswer, setBonus, shortOutcome, vodPence, vodViews } from "../../career/streaming/content.ts";

test("content rules: VODs fade over four weeks, Shorts grow more than they pay, guests and sets", () => {
  assert.equal(vodViews(50, 40, 0), 0); assert.equal(vodViews(50, 40, CONTENT.vodWeeks + 1), 0);
  assert.ok(vodViews(50, 40, 1) > vodViews(50, 40, 2) && vodViews(50, 40, 2) > vodViews(50, 40, 4));
  assert.ok(vodPence(10_000) > 0);
  const a = shortOutcome(SEED, "s1", "MAX", 500, false), b = shortOutcome(SEED, "s1", "MAX", 500, true);
  assert.deepEqual(a, shortOutcome(SEED, "s1", "MAX", 500, false), "deterministic");
  assert.ok(b.views > a.views, "a boost reaches more people");
  assert.ok(shortOutcome(SEED, "s2", "NINE", 500, false).views > shortOutcome(SEED, "s2", "MAX", 500, false).views);
  assert.ok(a.followers > 0 && a.pence < a.views);
  assert.ok(guestAnswer("FRIEND", 100000, 10).ok); assert.ok(!guestAnswer("NEW", 100000, 10).ok); assert.ok(guestAnswer("NEW", 25, 10).ok);
  assert.ok(guestAnswer("KNOWN", 100, 10).ok); assert.ok(!guestAnswer("KNOWN", 1000, 10).ok);
  assert.equal(setBonus([], "CHALLENGER"), 0); assert.equal(setBonus(["PUB"], "CHALLENGER"), 0.1); assert.equal(setBonus(["PUB"], "SCORING"), 0);
});

test("Shorts, VOD income, the podcast and studio sets through the service", async () => {
  const root = { id, world_seed: String((await rows(sql`SELECT world_seed FROM career_saves WHERE id=${id}`))[0].world_seed) };
  const s = await saves.read(1, id), season = s.currentSeason, week = s.currentWeek;
  await db.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${id}, 'ContentDarts', 400)`);
  // A clip to cut, and last week's stream for the VOD.
  await db.execute(sql`INSERT INTO career_stream_clips (career_save_id, id, stream_id, season, week, kind, title, peak, status) VALUES
    (${id}, '00000000-0000-4000-8000-0000000000c1', gen_random_uuid(), ${season}, ${week}, 'MAX', 'Maximum!', 40, 'SETTLED'),
    (${id}, '00000000-0000-4000-8000-0000000000c2', gen_random_uuid(), ${season}, ${week}, 'BIG_FINISH', 'Ton-plus finish', 40, 'SETTLED')`);
  let v = await streaming.read(actor, id);
  assert.equal(v.content.shorts.makeable.length, 2);
  v = await streaming.makeShort(actor, id, { clipId: "00000000-0000-4000-8000-0000000000c1", boost: true });
  assert.equal(v.content.shorts.boostUsed, true);
  await status(streaming.makeShort(actor, id, { clipId: "00000000-0000-4000-8000-0000000000c1" }), 409);
  await status(streaming.makeShort(actor, id, { clipId: "00000000-0000-4000-8000-0000000000c2", boost: true }), 409);
  v = await streaming.makeShort(actor, id, { clipId: "00000000-0000-4000-8000-0000000000c2" });
  const before = v.followers;
  await settleStreamingWeek(db, root, season, week); await settleStreamingWeek(db, root, season, week);
  v = await streaming.read(actor, id);
  assert.ok(v.content.shorts.list.every(x => x.status === "SETTLED" && x.views > 0));
  assert.ok(v.followers > before, "Shorts bring followers");
  const paid = await rows(sql`SELECT COUNT(*)::int AS n FROM career_finance_entries WHERE career_save_id=${id} AND operation_key LIKE 'stream-short:%'`);
  assert.equal(Number(paid[0].n), 2, "each Short paid once");
  // VOD: a stream from this week earns next week, once however often the week is settled.
  await db.execute(sql`INSERT INTO career_streams (career_save_id, id, season, week, day, status, challenger, first_thrower, tally, processed_visits)
    VALUES (${id}, gen_random_uuid(), ${season}, ${week}, ${week * 7}, 'ENDED', '{"name":"x"}'::jsonb, 0, '{"peak":120}'::jsonb, 30)`);
  await settleStreamingWeek(db, root, season, week + 1); await settleStreamingWeek(db, root, season, week + 1);
  const vod = await rows(sql`SELECT amount_pence FROM career_finance_entries WHERE career_save_id=${id} AND operation_key=${`stream-vod:${season}:${week + 1}`}`);
  assert.equal(vod.length, 1); assert.ok(Number(vod[0].amount_pence) > 0);
  assert.ok((await streaming.read(actor, id)).content.vods.viewsThisSeason >= vodViews(120, 30, 1));
  // Podcast: a giant won't come on yet; someone your size will; one a week.
  v = await streaming.read(actor, id);
  const no = v.content.podcast.guests.find(g => !g.ok), yes = v.content.podcast.guests.find(g => g.ok)!;
  if (no) await status(streaming.recordPodcast(actor, id, { guest: no.key, topic: "STORY" }), 409);
  v = await streaming.recordPodcast(actor, id, { guest: yes.key, topic: "QA" });
  assert.ok(v.content.podcast.thisWeek && v.content.podcast.thisWeek.listeners > 0);
  await status(streaming.recordPodcast(actor, id, { guest: yes.key, topic: "STORY" }), 409);
  assert.notEqual(v.scene.creators.find(c => c.key === yes.key)!.relationship, "NEW", "a guest spot builds the friendship");
  // Studio sets: bought once with your money.
  await db.execute(sql`UPDATE career_saves SET balance_pence = 1000000 WHERE id=${id}`);
  v = await streaming.buySet(actor, id, { set: "PUB" });
  assert.ok(v.content.sets.find(x => x.key === "PUB")!.owned);
  await status(streaming.buySet(actor, id, { set: "PUB" }), 409);
  await status(streaming.watchAlong(actor, id, { eventId: "00000000-0000-4000-8000-0000000000e1", dayOfWeek: v.freeNights[0] ?? 1 }), 404);
});
