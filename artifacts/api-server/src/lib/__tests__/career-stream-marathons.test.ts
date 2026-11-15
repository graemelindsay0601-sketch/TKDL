/** Subathons, charity marathons and the Creator Awards. */
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
  id = (await saves.create(1, { slot: 1, careerName: "Marathon", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });

import { MARATHON, marathonVisit, startMarathon } from "../../career/streaming/marathon.ts";
import { AWARDS, judgeAwards } from "../../career/streaming/awards.ts";
import { loadFanFollowing } from "../../career/fans/service.ts";
import type { ChatEvent, Tally } from "../../career/streaming/model.ts";

const T20 = { segment: 20, multiplier: 3, value: 60 }, T19 = { segment: 19, multiplier: 3, value: 57 }, D12 = { segment: 12, multiplier: 2, value: 24 }, MISS = { segment: 0, multiplier: 1, value: 0 };
/** One leg you win with a nine-darter (you throw first when `meFirst`). */
const leg = (meFirst: boolean) => { const me = [[T20, T20, T20], [T20, T20, T20], [T20, T19, D12]], out: unknown[] = [];
  for (let i = 0; i < 3; i++) { if (meFirst) out.push(...me[i], ...(i < 2 ? [MISS, MISS, MISS] : [])); else out.push(MISS, MISS, MISS, ...me[i]); } return out; };
const base = (kind: "SUBATHON" | "MARATHON"): Tally => ({ viewers: 50, peak: 50, hype: 1, followersGained: 0, followerCarry: 0, bitsPence: 0, superchatsPence: 0, subs: 0,
  ov: { marathon: startMarathon(kind, "PARTNER") } });

test("the marathon clock: your visits run it down, support winds it back (capped), goals unlock once each", () => {
  let t = base("SUBATHON");
  t = marathonVisit(SEED, "m", 0, true, t, [], 1).tally;
  assert.equal(t.ov!.marathon!.visitsLeft, MARATHON.startVisits - 1);
  assert.equal(marathonVisit(SEED, "m", 1, false, t, [], 1).tally.ov!.marathon!.visitsLeft, MARATHON.startVisits - 1, "their visits don't count down");
  const sub: ChatEvent = { kind: "SUB", user: "a", months: 1 };
  let goals = 0;
  for (let i = 0; i < 60; i++) { const r = marathonVisit(SEED, "m", 2 + i, true, t, [sub, sub], 1); t = r.tally; goals += r.events.filter(e => e.kind === "ALERT" && e.alert === "GOAL").length; }
  assert.equal(t.ov!.marathon!.extended, MARATHON.maxExtension, "extensions are capped");
  assert.equal(goals, MARATHON.goals.length, "every goal once");
  assert.ok(t.followersGained > 0);
  // Charity: creators chip in at each quarter, and the target is a moment.
  let c = base("MARATHON"); const target = c.ov!.marathon!.targetPence!;
  c = { ...c, bitsPence: target };
  const r = marathonVisit(SEED, "c", 0, true, c, [], 1);
  assert.equal(r.events.filter(e => e.kind === "ALERT" && e.alert === "DONATION").length, 4);
  assert.ok(r.tally.ov!.marathon!.targetHit);
});

test("a subathon night: leg after leg (losses don't end it), until the clock runs out", async () => {
  await db.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${id}, 'MarathonDarts', 120)`);
  let v = await streaming.read(actor, id);
  assert.ok(v.marathons.subathon.open, v.marathons.subathon.why ?? "");
  const s = await streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "SUBATHON" });
  assert.equal(s.format.unit === "LEGS" && s.format.bestOfLegs, 1, "one-leg games");
  let session = s, legs = 0;
  while (session.status === "LIVE" && legs < 40) {
    const out = await streaming.darts(actor, id, s.id, { darts: leg(session.firstThrower === 0) });
    session = out.session; legs++;
  }
  assert.equal(session.status, "ENDED", "the clock ran out");
  assert.ok(legs >= Math.floor(MARATHON.startVisits / 3), `played ${legs} legs`);
  assert.equal(session.rounds.length, legs);
  v = await streaming.read(actor, id);
  assert.equal(v.marathons.subathon.open, false, "once a season");
  await status(streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "SUBATHON" }));
});

test("the Creator Awards: judged on your season, once, with trophies and fans for a win", async () => {
  const results = judgeAwards(SEED, 1, { STREAMER: 0, BREAKTHROUGH: 100000, CLIP: 0, CHARITY: 0, CUP_KING: 50, COLLAB: 0, COMMUNITY: 0, ROOKIE: 0 }, "Me");
  assert.equal(results.length, AWARDS.length);
  assert.ok(results.find(r => r.key === "BREAKTHROUGH")!.youWon); assert.ok(results.find(r => r.key === "CUP_KING")!.youWon);
  assert.ok(!results.find(r => r.key === "STREAMER")!.youNominated, "no followers gained, no nomination");
  assert.deepEqual(results, judgeAwards(SEED, 1, { STREAMER: 0, BREAKTHROUGH: 100000, CLIP: 0, CHARITY: 0, CUP_KING: 50, COLLAB: 0, COMMUNITY: 0, ROOKIE: 0 }, "Me"));
  const root = { id, world_seed: String((await rows(sql`SELECT world_seed FROM career_saves WHERE id=${id}`))[0].world_seed) };
  const season = (await saves.read(1, id)).currentSeason;
  const fansBefore = (await loadFanFollowing(db, id)).total;
  await settleStreamingWeek(db, root, season, 52); await settleStreamingWeek(db, root, season, 52);
  const v = await streaming.read(actor, id);
  assert.equal(v.awards.seasons.length, 1); assert.equal(v.awards.seasons[0].results.length, AWARDS.length, "held once");
  const won = v.awards.trophies;
  assert.ok(v.awards.seasons[0].results.some(r => r.youNominated), "a first-season streamer gets a nod somewhere");
  if (won) assert.ok((await loadFanFollowing(db, id)).total > fansBefore);
});
