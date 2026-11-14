/** Your community (named regulars, loyalty, mods and VIPs) and the wider DartCast scene. */
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
  id = (await saves.create(1, { slot: 1, careerName: "Community", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });

import { COMMUNITY, STREAMERS, activeStreamers, chatForMoment, personaLine } from "../../career/streaming/model.ts";
import { activeRegulars, attendStream, modViewerBonus, settleCommunity } from "../../career/streaming/community.ts";

test("the scene: about 40 creators across six regions, rookies debut in later seasons and a few retire", () => {
  assert.ok(STREAMERS.length >= 40);
  assert.equal(new Set(STREAMERS.map(s => s.key)).size, STREAMERS.length, "unique keys");
  assert.equal(new Set(STREAMERS.map(s => s.region)).size, 6);
  assert.ok(activeStreamers(1).length < activeStreamers(4).length, "rookies arrive");
  assert.ok(STREAMERS.some(s => "retire" in s), "someone retires");
  for (const k of ["checkout-chloe", "the-arrows-guy"]) if (STREAMERS.some(s => s.key === k)) assert.ok(activeStreamers(1).some(s => s.key === k), "original roster from season one");
});

test("regulars talk in chat in their own voice, and an empty community changes nothing", () => {
  const tally = { viewers: 6, peak: 6, hype: 1, followersGained: 0, followerCarry: 0, bitsPence: 0, superchatsPence: 0, subs: 0 };
  const plain = chatForMoment(SEED, "s1", 3, "YOU_180", tally, "AFFILIATE");
  assert.deepEqual(chatForMoment(SEED, "s1", 3, "YOU_180", tally, "AFFILIATE", false, []), plain, "no regulars: same chat as before");
  const regulars = [{ name: "DartDad77", persona: "HYPE" as const, role: "MOD" as const }, { name: "NumbersNerd", persona: "STATS" as const, role: "NONE" as const }];
  let named = 0, modBadge = 0;
  for (let i = 0; i < 40; i++) for (const e of chatForMoment(SEED, `s${i}`, i, "YOU_180", tally, "AFFILIATE", false, regulars).events)
    if ("user" in e && (e.user === "DartDad77" || e.user === "NumbersNerd")) { named++; if ("role" in e && e.role === "MOD") modBadge++; }
  assert.ok(named > 20, `regulars speak up (${named})`);
  assert.ok(modBadge > 0, "a mod's line carries the badge");
  assert.ok(personaLine("COMEDIAN", "YOU_BUST", () => 0));
});

test("regulars join as you stream, grow loyal, fade when you vanish, and can be made mods or VIPs", async () => {
  const root = { id, world_seed: String((await rows(sql`SELECT world_seed FROM career_saves WHERE id=${id}`))[0].world_seed) };
  await db.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${id}, 'CommunityDarts', 60)`);
  for (let i = 0; i < 10; i++) await attendStream(db, root, 1, 2, 60);
  let v = await streaming.read(actor, id);
  assert.equal(v.community.size, COMMUNITY.size.AFFILIATE, "an Affiliate keeps six regulars");
  assert.equal(v.community.modSlots, 1); assert.equal(v.community.vipSlots, 2);
  assert.ok(v.scene.creators.length >= 30 && v.scene.creators.every(c => c.relationship === "NEW"));
  const top = v.community.members[0];
  assert.ok(top.loyalty >= COMMUNITY.modLoyalty && top.canMod, `loyal after ten shows (${top.loyalty})`);
  // A new joiner can't be modded yet.
  const fresh = v.community.members.find(m => m.loyalty < COMMUNITY.vipLoyalty);
  if (fresh) await status(streaming.setRegularRole(actor, id, fresh.key, { role: "VIP" }));
  v = await streaming.setRegularRole(actor, id, top.key, { role: "MOD" });
  assert.equal(v.community.mods, 1); assert.equal(v.community.viewerBonusPercent, 3);
  assert.equal(await modViewerBonus(db, id), COMMUNITY.modViewerBonus);
  const second = v.community.members.find(m => m.key !== top.key && m.loyalty >= COMMUNITY.modLoyalty);
  if (second) await status(streaming.setRegularRole(actor, id, second.key, { role: "MOD" }), 409);
  await status(streaming.setRegularRole(actor, id, "r999", { role: "VIP" }), 404);
  await status(streaming.setRegularRole(actor, id, "bad key", { role: "VIP" }), 404);
  assert.equal((await activeRegulars(db, id))[0].role, "MOD", "mods lead the room");
  // Gone quiet: no stream on record, so nothing fades (a brand-new channel isn't punished).
  await settleCommunity(db, id, 1, 30);
  assert.equal((await streaming.read(actor, id)).community.size, 6);
  // With a stream long ago, loyalty fades week by week until regulars drift away (mods hold on longest).
  await db.execute(sql`INSERT INTO career_streams (career_save_id, id, season, week, day, status, challenger, first_thrower, tally) VALUES
    (${id}, gen_random_uuid(), 1, 2, 9, 'ENDED', '{"name":"x"}'::jsonb, 0, '{}'::jsonb)`);
  for (let w = 5; w < 40; w++) await settleCommunity(db, id, 1, w);
  v = await streaming.read(actor, id);
  assert.ok(v.community.size < 6, "some drifted away");
  assert.ok(v.community.recentlyLeft.length > 0);
  // Back streaming: new regulars join again.
  await attendStream(db, root, 1, 41, 60);
  assert.ok((await streaming.read(actor, id)).community.size > v.community.size);
});
