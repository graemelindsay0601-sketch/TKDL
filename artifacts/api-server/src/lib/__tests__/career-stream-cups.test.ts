/** Creator Cups, celebration streams, the full-time creator focus and sub anniversaries. */
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
  id = (await saves.create(1, { slot: 1, careerName: "Cups", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });

import { CUPS, bracket, cupField, cupOpponent, cupPrize, cupThisWeek, nextCup, roundsFor, seedOrder } from "../../career/streaming/cups.ts";
import { STREAM } from "../../career/streaming/model.ts";
import { arrivals, attendStream } from "../../career/streaming/community.ts";
import { loadFanFollowing } from "../../career/fans/service.ts";

const T20 = { segment: 20, multiplier: 3, value: 60 }, T19 = { segment: 19, multiplier: 3, value: 57 }, D12 = { segment: 12, multiplier: 2, value: 24 }, MISS = { segment: 0, multiplier: 1, value: 0 };
/** A match you win `legs`-nil with nine-darters; legs alternate who throws first, starting with `first`. */
function winMatch(legs: number, first: 0 | 1) {
  const out: unknown[] = [];
  for (let l = 0; l < legs; l++) {
    const meFirst = (first + l) % 2 === 0, me = [[T20, T20, T20], [T20, T20, T20], [T20, T19, D12]];
    for (let i = 0; i < 3; i++) { if (meFirst) out.push(...me[i], ...(i < 2 ? [MISS, MISS, MISS] : [])); else out.push(MISS, MISS, MISS, ...me[i]); }
  }
  return out;
}

test("cup rules: four a season, seeded brackets, real results for the matches you're not in", () => {
  assert.deepEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  assert.equal(seedOrder(16).length, 16); assert.deepEqual([...seedOrder(16)].sort((a, b) => a - b), Array.from({ length: 16 }, (_, i) => i + 1));
  assert.equal(cupThisWeek(10)?.name, "Spring Cup"); assert.equal(cupThisWeek(11)?.n, 1); assert.equal(cupThisWeek(12), null);
  assert.equal(nextCup(12)?.name, "Summer Cup"); assert.equal(nextCup(51), null);
  const field = cupField(SEED, 1, 1, 10, { key: "you", handle: "Me", avg: 0, followers: 300 }, 8);
  assert.equal(field.length, 8); assert.equal(field.filter(f => f.you).length, 1);
  assert.equal(new Set(field.map(f => f.key)).size, 8);
  const cup = { n: 1, name: "Spring Cup", season: 1, size: 8, field };
  const a = bracket(SEED, cup, [true, true, true]), b = bracket(SEED, cup, [true, true, true]);
  assert.deepEqual(a, b, "deterministic");
  assert.ok(a.champion?.you, "win every round and you're the champion");
  const out = bracket(SEED, cup, [false]);
  assert.ok(out.champion && !out.champion.you, "lose and someone else lifts it");
  for (let r = 0; r < 3; r++) { const opp = cupOpponent(SEED, cup, r, [true, true]); const m = a.rounds[r].matches.find(x => x.you)!; assert.equal(opp?.key, (m.a!.you ? m.b! : m.a!).key); }
  assert.ok(cupPrize("PARTNER", 16, 4) > cupPrize("PARTNER", 16, 3) && cupPrize("PARTNER", 16, 0) > 0);
  assert.equal(cupPrize("AFFILIATE", 8, 3), CUPS.winnerPrize.AFFILIATE);
});

test("a Creator Cup night: extra to your stream nights, round by round, and a champion's rewards", async () => {
  await db.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${id}, 'CupsDarts', 300)`);
  await db.execute(sql`UPDATE career_saves SET current_week=10 WHERE id=${id}`);
  let v = await streaming.read(actor, id);
  assert.ok(v.cups.current?.open, v.cups.current?.why ?? "no cup");
  assert.equal(v.cups.current!.size, 8); assert.equal(v.cups.current!.rounds, 3);
  assert.ok(v.cups.current!.callout, "someone calls you out");
  const fansBefore = (await loadFanFollowing(db, id)).total;
  const s = await streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "CUP" });
  assert.equal(s.kingRounds, 3); assert.equal(s.format.bestOfLegs, 5, "first to 3");
  assert.equal((await streaming.read(actor, id)).streamsThisWeek, 0, "a cup doesn't use a stream night");
  let session = s;
  for (let r = 0; r < 3; r++) {
    const legs = r === 2 ? CUPS.finalLegsToWin : CUPS.legsToWin;
    assert.equal(session.format.bestOfLegs, legs * 2 - 1, `round ${r} length`);
    const out = await streaming.darts(actor, id, s.id, { darts: winMatch(legs, session.firstThrower) });
    session = out.session;
  }
  assert.equal(session.status, "ENDED"); assert.equal(session.result, "WON");
  v = await streaming.read(actor, id);
  assert.equal(v.cups.trophies, 1); assert.ok(v.cups.history[0].won); assert.equal(v.cups.history[0].prizePence, cupPrize("AFFILIATE", 8, 3));
  assert.equal(v.cups.current!.open, false, "one entry per cup");
  await status(streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "CUP" }));
  const paid = await rows(sql`SELECT amount_pence FROM career_finance_entries WHERE career_save_id=${id} AND operation_key=${`stream-cup:${s.id}`}`);
  assert.equal(Number(paid[0].amount_pence), CUPS.winnerPrize.AFFILIATE);
  assert.ok((await loadFanFollowing(db, id)).total >= fansBefore + CUPS.winnerFans[8], "a cup win brings darts fans");
  const metOnce = v.scene.creators.filter(c => c.cupMeetings > 0);
  assert.equal(metOnce.length, 3, "you met three creators");
});

test("celebration streams: one per follower milestone", async () => {
  await db.execute(sql`UPDATE career_saves SET current_week=14 WHERE id=${id}`);
  await db.execute(sql`UPDATE career_stream_channels SET followers=1200, celebrated=100 WHERE career_save_id=${id}`);
  let v = await streaming.read(actor, id);
  assert.equal(v.celebration?.milestone, 1000);
  const s = await streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "CELEBRATION" });
  assert.ok(s.chat.some(e => e.kind === "ALERT" && e.alert === "MILESTONE"));
  const done = await streaming.darts(actor, id, s.id, { darts: winMatch(2, 0) });
  assert.equal(done.session.status, "ENDED");
  v = await streaming.read(actor, id);
  assert.equal(v.celebration, null, "celebrated");
  await status(streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "CELEBRATION" }));
});

test("full-time creator: up to five stream nights a week", async () => {
  await status(streaming.setPathway(actor, id, { focus: "DARTCAST", weeklyFrequency: 5 }), 400);
  const v = await streaming.setPathway(actor, id, { focus: "CREATOR", weeklyFrequency: 5 });
  assert.equal(v.perWeek, STREAM.creatorPerWeek); assert.equal(v.pathway.focus, "CREATOR");
  assert.equal((await streaming.setPathway(actor, id, { focus: "OPEN", weeklyFrequency: 0 })).perWeek, STREAM.perWeek);
});

test("subscribed regulars celebrate their sub anniversaries once", async () => {
  const root = { id, world_seed: String((await rows(sql`SELECT world_seed FROM career_saves WHERE id=${id}`))[0].world_seed) };
  await db.execute(sql`UPDATE career_stream_regulars SET loyalty=80 WHERE career_save_id=${id}`);
  for (let i = 0; i < 4; i++) await attendStream(db, root, 1, 1, 1500);
  for (let i = 0; i < 30 && !(await rows(sql`SELECT 1 FROM career_stream_regulars WHERE career_save_id=${id} AND subbed_week IS NOT NULL`)).length; i++)
    await attendStream(db, root, 1, 2 + i, 1500);
  const subbed = await rows(sql`SELECT name, subbed_week FROM career_stream_regulars WHERE career_save_id=${id} AND subbed_week IS NOT NULL`);
  assert.ok(subbed.length > 0, "a loyal regular subscribes at Partner");
  const at = Number(subbed[0].subbed_week) + 13;
  const first = await arrivals(db, id, 1, at);
  assert.ok(first.some(e => e.kind === "ALERT" && e.text.includes("resubscribed: 3 months")), JSON.stringify(first));
  assert.ok(!(await arrivals(db, id, 1, at)).some(e => e.kind === "ALERT" && e.text.includes("resubscribed")), "only once");
  assert.ok((await streaming.read(actor, id)).community.members.some(m => m.subMonths !== null));
});
