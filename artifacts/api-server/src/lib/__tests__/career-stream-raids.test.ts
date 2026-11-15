/** Raids, emotes, go-live notifications, Clip of the Week, community nights and VIP perks. */
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
  id = (await saves.create(1, { slot: 1, careerName: "Raids", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });

import { CLIP_OF_WEEK, EMOTES, activeStreamers, chatForMoment, emotePrefix, raidIn } from "../../career/streaming/model.ts";
import { attendStream } from "../../career/streaming/community.ts";
import { VIP_GIFT, overlayVisit } from "../../career/streaming/overlay.ts";

const root = async () => ({ id, world_seed: String((await rows(sql`SELECT world_seed FROM career_saves WHERE id=${id}`))[0].world_seed) });

test("raid rules: a creator you raided is far likelier to raid you back; big creators rarely raid tiny channels", () => {
  const scene = [{ key: "a", handle: "A", followers: 500, owed: false }, { key: "b", handle: "B", followers: 500, owed: false }];
  let cold = 0, owed = 0, giant = 0;
  for (let i = 0; i < 2000; i++) {
    if (raidIn(SEED, `k${i}`, 200, scene)) cold++;
    const r = raidIn(SEED, `k${i}`, 200, [{ ...scene[0], owed: true }, scene[1]]); if (r) { owed++; assert.equal(r.key, "a", "the owed creator comes back"); }
    if (raidIn(SEED, `k${i}`, 5, [{ key: "g", handle: "G", followers: 120000, owed: false }])) giant++;
  }
  assert.ok(owed > cold * 3, `owed ${owed} vs cold ${cold}`);
  assert.ok(giant < cold, `giant ${giant}`);
  assert.deepEqual(raidIn(SEED, "x", 100, scene), raidIn(SEED, "x", 100, scene), "deterministic");
});

test("emotes: chat spams your emotes on big moments, and chat without emotes is unchanged", () => {
  const tally = { viewers: 30, peak: 30, hype: 1, followersGained: 0, followerCarry: 0, bitsPence: 0, superchatsPence: 0, subs: 0 };
  assert.deepEqual(chatForMoment(SEED, "e", 1, "YOU_180", tally, "PARTNER", false, [], []), chatForMoment(SEED, "e", 1, "YOU_180", tally, "PARTNER"));
  let used = 0;
  for (let i = 0; i < 30; i++) for (const e of chatForMoment(SEED, `e${i}`, i, "YOU_180", tally, "PARTNER", false, [], ["ayrdHype"]).events) if (e.kind === "CHAT" && e.text.includes("ayrdHype")) used++;
  assert.ok(used > 10, `used ${used}`);
  for (let i = 0; i < 30; i++) for (const e of chatForMoment(SEED, `q${i}`, i, "IDLE", tally, "PARTNER", false, [], ["ayrdHype"]).events) assert.ok(e.kind !== "CHAT" || !e.text.includes("ayrdHype"), "not on quiet moments");
  assert.equal(emotePrefix("AyrDarts"), "ayrd");
});

test("VIPs at Partner gift subs now and then", () => {
  const base = { viewers: 400, peak: 400, hype: 1, followersGained: 0, followerCarry: 0, bitsPence: 0, superchatsPence: 0, subs: 0 };
  const visit = { you: true, points: 60, bust: false, checkout: false, startScore: 501, legEnded: false, legNo: 1, streamOver: false };
  let gifts = 0, subs = 0;
  for (let i = 0; i < 400; i++) {
    const r = overlayVisit(SEED, "g", i, visit, base, "PARTNER", [], { drill: false, regulars: [{ name: "BigVip", persona: "BIG_SPENDER", role: "VIP" }] });
    if (r.events.some(e => e.kind === "ALERT" && e.alert === "GIFT")) { gifts++; subs += r.tally.subs; }
  }
  assert.ok(gifts > 0 && gifts < 400 * VIP_GIFT.chance * 3, `gifts ${gifts}`);
  assert.ok(subs >= gifts);
  const none = overlayVisit(SEED, "g", 1, visit, base, "AFFILIATE", [], { drill: false, regulars: [{ name: "BigVip", persona: "BIG_SPENDER", role: "VIP" }] });
  assert.equal(none.tally.subs, 0, "no gifted subs below Partner");
});

test("emote slots open with subscribers and are named once each", async () => {
  await db.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${id}, 'RaidsDarts', 60)`);
  let v = await streaming.read(actor, id);
  assert.equal(v.emotes.slots.length, EMOTES.thresholds.length); assert.ok(v.emotes.slots.every(s => !s.unlocked));
  await status(streaming.nameEmote(actor, id, { slot: 0, name: "Hype" }));
  await db.execute(sql`UPDATE career_stream_channels SET subscribers=30 WHERE career_save_id=${id}`);
  v = await streaming.nameEmote(actor, id, { slot: 0, name: "hype" });
  assert.equal(v.emotes.slots[0].code, "raidHype"); assert.ok(v.emotes.slots[1].unlocked); assert.ok(!v.emotes.slots[2].unlocked);
  await status(streaming.nameEmote(actor, id, { slot: 1, name: "HYPE" }), 409);
  await assert.rejects(streaming.nameEmote(actor, id, { slot: 1, name: "no spaces" }), "letters and numbers only");
  v = await streaming.nameEmote(actor, id, { slot: 1, name: "Tops" });
  assert.equal(v.emotes.slots[1].code, "raidTops");
});

test("community night: needs three regulars, a regular steps up, and the room grows more loyal", async () => {
  const r = await root();
  await status(streaming.goLive(actor, id, { dayOfWeek: 7, format: "COMMUNITY" }));
  for (let i = 0; i < 3; i++) await attendStream(db, r, 1, 1, 60);
  const v = await streaming.read(actor, id);
  assert.equal(v.formats.find(f => f.key === "COMMUNITY")!.why, null);
  const s = await streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "COMMUNITY" });
  assert.ok(v.community.members.some(m => m.name === s.challenger.name), "a regular is the opponent");
  const before = (await streaming.read(actor, id)).community.members.reduce((n, m) => n + m.loyalty, 0);
  const T20 = { segment: 20, multiplier: 3, value: 60 }, T19 = { segment: 19, multiplier: 3, value: 57 }, D12 = { segment: 12, multiplier: 2, value: 24 }, MISS = { segment: 0, multiplier: 1, value: 0 };
  const leg = (meFirst: boolean) => { const me = [[T20, T20, T20], [T20, T20, T20], [T20, T19, D12]], them = [MISS, MISS, MISS]; const out = [];
    for (let i = 0; i < 3; i++) { if (meFirst) out.push(...me[i], ...(i < 2 ? them : [])); else out.push(...them, ...me[i]); } return out; };
  const done = await streaming.darts(actor, id, s.id, { darts: [...leg(true), ...leg(false)] });
  assert.equal(done.session.status, "ENDED");
  const after = (await streaming.read(actor, id)).community.members.slice(0, 3).reduce((n, m) => n + m.loyalty, 0);
  assert.ok(after >= before + 3 * 8, `loyalty ${before} -> ${after}`);
  // Raid out from the finished stream: once, to an active creator, and it shows in the scene.
  const target = activeStreamers(1)[3];
  await status(streaming.raid(actor, id, s.id, { streamer: "nobody" }), 404);
  const raided = await streaming.raid(actor, id, s.id, { streamer: target.key });
  assert.equal(raided.tally.ov!.raidOut!.key, target.key);
  assert.ok(raided.chat.some(e => e.kind === "ALERT" && e.alert === "RAID"));
  await status(streaming.raid(actor, id, s.id, { streamer: target.key }));
  const c = (await streaming.read(actor, id)).scene.creators.find(x => x.key === target.key)!;
  assert.equal(c.raidsOut, 1); assert.equal(c.relationship, "KNOWN");
});

test("Clip of the Week: at most one a week, and a win brings followers", async () => {
  const r = await root();
  let wins = 0;
  for (let w = 1; w <= 20; w++) {
    await db.execute(sql`INSERT INTO career_stream_clips (career_save_id, id, stream_id, season, week, kind, title, peak, status, views)
      VALUES (${id}, gen_random_uuid(), gen_random_uuid(), 9, ${w}, 'MAX', 'A 180', 40, 'VIRAL', 3000), (${id}, gen_random_uuid(), gen_random_uuid(), 9, ${w}, 'MAX', 'Another', 40, 'SETTLED', 10)`);
    // This test is about the clip spotlight: the month's follower drift is marked done so it doesn't blur the gain.
    await db.execute(sql`UPDATE career_stream_channels SET churned_through=${`9:${w}`} WHERE career_save_id=${id}`);
    const before = Number((await rows(sql`SELECT followers FROM career_stream_channels WHERE career_save_id=${id}`))[0].followers);
    await settleStreamingWeek(db, r, 9, w); await settleStreamingWeek(db, r, 9, w);
    const won = await rows(sql`SELECT views FROM career_stream_clips WHERE career_save_id=${id} AND season=9 AND week=${w} AND clip_of_week`);
    assert.ok(won.length <= 1, "one winner a week, however often the week is settled");
    const after = Number((await rows(sql`SELECT followers FROM career_stream_channels WHERE career_save_id=${id}`))[0].followers);
    if (won.length) { wins++; assert.ok(after - before >= Math.max(CLIP_OF_WEEK.minFollowers, 30), `spotlight ${after - before}`); assert.equal(Number(won[0].views), 3000, "the best clip is the entry"); }
  }
  assert.ok(wins > 3 && wins < 20, `wins ${wins}`);
  assert.ok((await streaming.read(actor, id)).clips.some(c => c.clipOfWeek));
});
