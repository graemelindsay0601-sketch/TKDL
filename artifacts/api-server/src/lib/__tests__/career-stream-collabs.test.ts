/** Collabs with other streamers, and clips that can go viral (followers on DartCast, fans for your darts). */
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
import { createCareerHostingService } from "../../career/hosting/service.ts";
import { CLIPS, COLLAB, clipFor, clipOutcome, collabAnswer, collabFollowers, streamerFollowers } from "../../career/streaming/model.ts";
import { loadFanFollowing } from "../../career/fans/service.ts";
import { settleStreamingWeek } from "../../career/streaming/state.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db), streaming = createCareerStreamingService(db), hosting = createCareerHostingService(db);
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
  id = (await saves.create(1, { slot: 1, careerName: "Collabs", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });



const T20 = { segment: 20, multiplier: 3, value: 60 }, T19 = { segment: 19, multiplier: 3, value: 57 }, D12 = { segment: 12, multiplier: 2, value: 24 }, MISS = { segment: 0, multiplier: 1, value: 0 };
const max = [T20, T20, T20], out141 = [T20, T19, D12], blank = [MISS, MISS, MISS];
/** You win 2-0, each leg a nine-darter (180, 180, 141). */
const twoNil = [...max, ...blank, ...max, ...blank, ...out141, ...blank, ...max, ...blank, ...max, ...blank, ...out141];
const S20 = { segment: 20, multiplier: 1, value: 20 };
/** A leg won the slow way, nothing worth clipping: 140, 140, 140, then 81 (T19, D12). */
const slowLeg = [T20, T20, S20, T20, T20, S20, T20, T20, S20, T19, D12];

test("collab and clip rules", () => {
  assert.deepEqual(collabAnswer(500, 30, false), { ok: false, why: "Get to Affiliate first" });
  assert.equal(collabAnswer(9000, 1000, false).ok, false, "too big");
  assert.equal(collabAnswer(150, 1000, false).ok, false, "too small");
  assert.equal(collabAnswer(3000, 1000, false).ok, true);
  assert.equal(collabAnswer(3000, 1000, true).ok, false, "once a season");
  assert.ok(streamerFollowers(1000, 3, 10) > streamerFollowers(1000, 1, 10), "streamers grow");
  assert.equal(collabFollowers(10000, true), 200); assert.equal(collabFollowers(10000, false), 50);
  assert.equal(clipFor({ points: 141, checkout: true, startScore: 141, dartsInLeg: 9 }), "NINE");
  assert.equal(clipFor({ points: 170, checkout: true, startScore: 170, dartsInLeg: 18 }), "BIG_FISH");
  assert.equal(clipFor({ points: 121, checkout: true, startScore: 121, dartsInLeg: 15 }), "BIG_FINISH");
  assert.equal(clipFor({ points: 180, checkout: false, startScore: 501 }), "MAX");
  assert.equal(clipFor({ points: 60, checkout: false, startScore: 501 }), null);
  const a = clipOutcome("a".repeat(64), "c1", "NINE", 100, 2000), b = clipOutcome("a".repeat(64), "c1", "NINE", 100, 2000);
  assert.deepEqual(a, b, "the same clip always has the same fate");
  let viral = 0; for (let i = 0; i < 200; i++) if (clipOutcome("a".repeat(64), `m${i}`, "MAX", 20, 500).viral) viral++;
  assert.ok(viral < 30, "a 180 rarely goes viral");
  assert.ok(a.viral ? a.followers > CLIPS.NINE.followers && a.fans === a.followers * 2 : a.followers === 0);
});

test("a collab: their viewers tune in, you play them on stream, and the winner takes a share of the other's audience", async () => {
  await db.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${id}, 'CollabsDarts', 2000)`);
  const v = await streaming.read(actor, id);
  const big = v.collabs.find(c => c.key === "oche-official")!, small = v.collabs.find(c => c.key === "doubletrouble")!;
  assert.equal(big.ok, false); assert.equal(big.why, "Too big for you yet"); assert.equal(small.why, "Too small for your channel");
  const partner = v.collabs.find(c => c.ok && c.key === "checkoutqueen")!;
  assert.ok(partner, "a streamer near your size says yes");
  await status(streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "COLLAB" }), 400);
  await status(streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "COLLAB", streamer: "oche-official" }), 409);
  const s = await streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "COLLAB", streamer: "checkoutqueen" });
  assert.equal(s.challenger.name, "CheckoutQueen"); assert.equal(s.challenger.avg, 66); assert.equal(s.formatName, "Collab with CheckoutQueen");
  assert.ok(s.tally.viewers >= Math.round(partner.followers * COLLAB.tuneIn), "her viewers tune in");
  const done = await streaming.darts(actor, id, s.id, { darts: twoNil });
  assert.equal(done.session.result, "WON");
  assert.ok(done.session.followersGained! >= collabFollowers(partner.followers, true), "a share of her audience");
  const after = await streaming.read(actor, id);
  assert.equal(after.collabs.find(c => c.key === "checkoutqueen")!.why, "Already collabed this season");
  assert.equal(after.videos[0].title, "Collab with CheckoutQueen");
});

test("clips: each stream's best moment is clipped, and at the end of the week it may go viral (followers and fans)", async () => {
  // The collab's legs were nine-darters: that's the clip.
  const clip = (await rows(sql`SELECT * FROM career_stream_clips WHERE career_save_id=${id}`))[0];
  assert.equal(clip.kind, "NINE"); assert.equal(clip.status, "NEW"); assert.equal(clip.title, CLIPS.NINE.title);
  // A slower stream: only a 180-free win, no clip.
  const free = (await streaming.read(actor, id)).freeNights[0];
  const s = await streaming.goLive(actor, id, { dayOfWeek: free });
  const legThem = [...blank]; // they throw first in leg 2
  const darts = [...slowLeg.slice(0, 3), ...blank, ...slowLeg.slice(3, 6), ...blank, ...slowLeg.slice(6, 9), ...blank, ...slowLeg.slice(9, 12),
    ...legThem, ...slowLeg.slice(0, 3), ...blank, ...slowLeg.slice(3, 6), ...blank, ...slowLeg.slice(6, 9), ...blank, ...slowLeg.slice(9, 12)];
  const done = await streaming.darts(actor, id, s.id, { darts });
  assert.equal(done.session.result, "WON");
  assert.equal((await rows(sql`SELECT 1 FROM career_stream_clips WHERE career_save_id=${id} AND stream_id=${s.id}`)).length, 0, "nothing worth clipping");
  const before = (await streaming.read(actor, id)).followers, fansBefore = (await loadFanFollowing(db, id)).total;
  const sv = await saves.read(1, id);
  const root = { id, world_seed: String((await rows(sql`SELECT world_seed FROM career_saves WHERE id=${id}`))[0].world_seed) };
  const expected = clipOutcome(root.world_seed, String(clip.id), "NINE", Number(clip.peak), before);
  await settleStreamingWeek(db, root, sv.currentSeason, sv.currentWeek);
  await settleStreamingWeek(db, root, sv.currentSeason, sv.currentWeek);
  const settled = (await rows(sql`SELECT * FROM career_stream_clips WHERE career_save_id=${id}`))[0];
  assert.equal(settled.status, expected.viral ? "VIRAL" : "SETTLED"); assert.equal(Number(settled.views), expected.views);
  const v = await streaming.read(actor, id);
  assert.equal(v.followers, before + expected.followers, "followers once");
  assert.equal(v.clips[0].title, CLIPS.NINE.title);
  assert.equal((await loadFanFollowing(db, id)).total, fansBefore + (expected.viral ? expected.fans : 0), "viral fans join your following");
});
