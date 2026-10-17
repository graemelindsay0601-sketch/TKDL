/** Streaming: a channel that grows with your darts, chat that reacts to every visit, and a stream night booked like any other. */
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
import { STREAM, chatForVisit, streamIncome, tierFor, type Tally } from "../../career/streaming/model.ts";

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
  id = (await saves.create(1, { slot: 1, careerName: "Streamer", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });

const tally = (viewers: number): Tally => ({ viewers, peak: viewers, hype: 0.6, followersGained: 0, followerCarry: 0, bitsPence: 0, superchatsPence: 0, subs: 0 });
const T20 = { segment: 20, multiplier: 3, value: 60 }, T19 = { segment: 19, multiplier: 3, value: 57 }, D12 = { segment: 12, multiplier: 2, value: 24 }, MISS = { segment: 0, multiplier: 1, value: 0 };
const max = [T20, T20, T20], out141 = [T20, T19, D12], blank = [MISS, MISS, MISS];
/** You win 2-0 with 180, 180, 141 each leg; the challenger misses everything. Leg 1 you throw first, leg 2 they do. */
const twoNil = [...max, ...blank, ...max, ...blank, ...out141, ...blank, ...max, ...blank, ...max, ...blank, ...out141];

test("rules: the streamer route by followers, chat that reacts, and cheers only once you're an Affiliate", () => {
  assert.deepEqual([0, 49, 50, 999, 1000, 25000].map(f => tierFor(f).key), ["NEWCOMER", "NEWCOMER", "AFFILIATE", "AFFILIATE", "PARTNER", "STAR"]);
  const v180 = { thrower: 0 as const, points: 180, bust: false, checkout: false, startScore: 501, legNo: 1 };
  const a = chatForVisit(SEED, "s", 3, v180, tally(200), "PARTNER", null), b = chatForVisit(SEED, "s", 3, v180, tally(200), "PARTNER", null);
  assert.deepEqual(a, b, "the same visit always gets the same chat");
  assert.ok(a.events.some(e => e.kind === "CHAT"));
  assert.ok(a.tally.hype > 0.6, "a 180 lifts the room");
  let newcomer = tally(300), partner = tally(300);
  for (let i = 0; i < 200; i++) { newcomer = chatForVisit(SEED, "n", i, v180, newcomer, "NEWCOMER", null).tally; partner = chatForVisit(SEED, "p", i, v180, partner, "PARTNER", null).tally; }
  assert.equal(newcomer.bitsPence + newcomer.superchatsPence + newcomer.subs, 0, "newcomers can't be cheered");
  assert.ok(partner.bitsPence > 0 && partner.subs > 0, "partners get bits and subs");
  assert.ok(newcomer.followersGained > 0, "anyone can win followers");
  assert.equal(streamIncome({ bitsPence: 500, superchatsPence: 1000, subs: 2 }), 500 + 1000 + 250);
});

test("going live: a free night this week, a challenger from chat, chat for every visit, and the stream pays when the match is won", async () => {
  await db.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${id}, 'StreamerDarts', 400)`);
  const v = await streaming.read(actor, id);
  assert.equal(v.tier.key, "AFFILIATE"); assert.equal(v.next!.name, "Partner"); assert.equal(v.freeNights.length, 7);
  const s = await streaming.goLive(actor, id, { dayOfWeek: 5 });
  assert.equal(s.status, "LIVE"); assert.ok(s.challenger.name && s.challenger.bot.seed); assert.ok(s.tally.viewers >= 1);
  await status(streaming.goLive(actor, id, { dayOfWeek: 6 }), 409);
  const after = await streaming.read(actor, id);
  assert.equal(after.live, s.id); assert.ok(!after.freeNights.includes(5), "the night is taken");
  const half = await streaming.darts(actor, id, s.id, { darts: twoNil.slice(0, 9) });
  assert.ok(half.events.length > 0, "chat reacts to the first visits");
  const again = await streaming.darts(actor, id, s.id, { darts: twoNil.slice(0, 9) });
  assert.equal(again.events.length, 0, "the same darts again: no more chat");
  await status(streaming.darts(actor, id, s.id, { darts: [{ segment: 25, multiplier: 3, value: 75 }] }), 400);
  const done = await streaming.darts(actor, id, s.id, { darts: twoNil });
  assert.equal(done.session.status, "ENDED"); assert.equal(done.session.result, "WON");
  const ch = (await rows(sql`SELECT followers FROM career_stream_channels WHERE career_save_id=${id}`))[0];
  assert.equal(Number(ch.followers), 400 + done.session.followersGained!, "followers banked");
  assert.ok(done.session.followersGained! > 0);
  const income = (await rows(sql`SELECT amount_pence FROM career_finance_entries WHERE career_save_id=${id} AND category='STREAM_INCOME'`))[0];
  assert.equal(income ? Number(income.amount_pence) : 0, done.session.incomePence, "the stream's money, through the ledger");
  const end = await streaming.read(actor, id);
  assert.equal(end.live, null); assert.equal(end.videos[0].result, "WON"); assert.equal(end.totals.streams, 1);
});

test("a stream night is booked like any other: an event that night can't be entered, and three streams a week at most", async () => {
  const s = await saves.read(1, id);
  const free = (await streaming.read(actor, id)).freeNights;
  // An event you could enter on a free night this week...
  const open = ((await career.calendar.calendar(actor, id, { scope: "AVAILABLE", fromWeek: s.currentWeek, toWeek: s.currentWeek })).events as any[])
    .find(e => e.human?.canEnter && e.dates.startWeek === s.currentWeek && e.dates.startDay === e.dates.endDay && free.includes(e.dates.startDayOfWeek));
  assert.ok(open, "an event this week on a free night");
  const live = await streaming.goLive(actor, id, { dayOfWeek: open.dates.startDayOfWeek });
  await streaming.end(actor, id, live.id);
  // ...is off once you've streamed that night.
  const after = ((await career.calendar.calendar(actor, id, { fromWeek: s.currentWeek, toWeek: s.currentWeek })).events as any[]).find(e => e.id === open.id);
  assert.equal(after.human.canEnter, false);
  assert.ok(after.human.denials.includes("SCHEDULE_CONFLICT"));
  assert.deepEqual(after.human.commercialConflicts, ["Streaming night"]);
  assert.equal((await career.calendar.enter(actor, id, { eventId: open.id })).entered, false);
  const v = await streaming.read(actor, id);
  assert.equal(v.streamsThisWeek, STREAM.perWeek - 1);
  const last = await streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0] });
  await streaming.end(actor, id, last.id);
  await status(streaming.goLive(actor, id, { dayOfWeek: (await streaming.read(actor, id)).freeNights[0] ?? 1 }), 409);
});
