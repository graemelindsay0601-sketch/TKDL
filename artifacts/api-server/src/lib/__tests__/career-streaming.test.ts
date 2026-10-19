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
import { STREAM, STREAM_MONEY, chatForVisit, dealFee, renewals, streamIncome, streamerCanBeInvited, subPayout, tierFor, type Tally } from "../../career/streaming/model.ts";
import { settleStreamingWeek } from "../../career/streaming/state.ts";
import { settleLifeCommitments } from "../../career/life/commitments.ts";

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
  assert.equal(s.status, "LIVE"); assert.ok(s.challenger.name && s.challenger.bot!.seed); assert.ok(s.tally.viewers >= 1);
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

test("phase 2 rules: subs renew monthly (fewer when you go quiet), Partner brand fees grow with followers, Stars get invitational invitations", () => {
  assert.equal(renewals(20, true), 17); assert.equal(renewals(20, false), 12);
  assert.equal(subPayout(8), 8 * 125);
  assert.equal(dealFee(1000), 5500); assert.equal(dealFee(25000), 77500);
  const inv = (circuit: string, definitionKey = "thursday-night-darts", takesInvitations = true) => ({ circuit, definitionKey, takesInvitations });
  assert.equal(streamerCanBeInvited("STAR", inv("INVITATIONAL")), true);
  assert.equal(streamerCanBeInvited("PARTNER", inv("INVITATIONAL")), false, "only Stars");
  assert.equal(streamerCanBeInvited("STAR", inv("INVITATIONAL", "world-cup-of-darts")), false, "national teams are picked, not invited");
  assert.equal(streamerCanBeInvited("STAR", inv("WORLD_SERIES")), false);
  assert.equal(streamerCanBeInvited("STAR", inv("INVITATIONAL", "champions-masters", false)), false);
});

test("a Partner channel: subs renew and pay at the month's end, a brand offers a deal, and it pays for each stream", async () => {
  const root = { id, world_seed: String((await rows(sql`SELECT world_seed FROM career_saves WHERE id=${id}`))[0].world_seed) };
  const s = await saves.read(1, id), month = Math.ceil(s.currentWeek / STREAM_MONEY.monthWeeks) * STREAM_MONEY.monthWeeks;
  await db.execute(sql`UPDATE career_stream_channels SET followers=1200, subscribers=10 WHERE career_save_id=${id}`);
  // Earlier streams' clips are settled already (a viral one would add followers here).
  await db.execute(sql`UPDATE career_stream_clips SET status='SETTLED' WHERE career_save_id=${id}`);
  // You streamed this month (the earlier tests), so most subs renew.
  await settleStreamingWeek(db, root, s.currentSeason, month);
  await settleStreamingWeek(db, root, s.currentSeason, month);
  const paid = await rows(sql`SELECT amount_pence FROM career_finance_entries WHERE career_save_id=${id} AND operation_key=${`stream-subs:${s.currentSeason}:${month}`}`);
  assert.equal(paid.length, 1, "paid once, however often the week is settled");
  assert.equal(Number(paid[0].amount_pence), subPayout(renewals(10, true)));
  let v = await streaming.read(actor, id);
  assert.equal(v.subscribers, renewals(10, true));
  assert.ok(v.dealOffer, "a Partner gets a brand offer");
  assert.equal(v.dealOffer!.perStreamPence, dealFee(1200)); assert.equal(v.dealOffer!.streamsTotal, STREAM_MONEY.dealStreams);
  await settleStreamingWeek(db, root, s.currentSeason, month);
  assert.equal(Number((await rows(sql`SELECT COUNT(*)::int AS n FROM career_stream_deals WHERE career_save_id=${id}`))[0].n), 1, "one offer at a time");
  v = await streaming.answerDeal(actor, id, v.dealOffer!.id, { accept: true });
  assert.equal(v.dealOffer, null); assert.equal(v.deal!.streamsDone, 0);
  await status(streaming.answerDeal(actor, id, v.deal!.id, { accept: false }), 409);
  // Move this week's streams back a week so there's a night free, then stream: the brand pays for it.
  await db.execute(sql`UPDATE career_streams SET week=week-1, day=day-7 WHERE career_save_id=${id} AND season=${s.currentSeason} AND week=${s.currentWeek}`);
  const live = await streaming.goLive(actor, id, { dayOfWeek: (await streaming.read(actor, id)).freeNights[0] });
  const done = await streaming.darts(actor, id, live.id, { darts: twoNil });
  const fee = await rows(sql`SELECT amount_pence, reason FROM career_finance_entries WHERE career_save_id=${id} AND operation_key=${`stream-deal:${live.id}`}`);
  assert.equal(Number(fee[0].amount_pence), dealFee(1200)); assert.match(String(fee[0].reason), /stream 1 of 6/);
  v = await streaming.read(actor, id);
  assert.equal(v.deal!.streamsDone, 1);
  assert.equal(v.subscribers, renewals(10, true) + done.session.tally.subs, "new subs join the monthly list");
  // An offer nobody answers lapses after three weeks.
  await db.execute(sql`UPDATE career_stream_deals SET status='OFFERED', expires_week=${month + 1} WHERE career_save_id=${id}`);
  await settleStreamingWeek(db, root, s.currentSeason, month + 1);
  assert.equal((await rows(sql`SELECT status FROM career_stream_deals WHERE career_save_id=${id}`))[0].status, "EXPIRED");
});

test("a DartCast Star is invited to the televised invitationals, without a manager", async () => {
  const invitational = (evs: any[]) => evs.filter(e => e.circuit === "INVITATIONAL" && e.definitionKey !== "world-cup-of-darts");
  const before = invitational((await career.calendar.calendar(actor, id, {})).events as any[]);
  assert.ok(before.length && before.every(e => !e.human.streamInvite));
  await db.execute(sql`UPDATE career_stream_channels SET followers=25000 WHERE career_save_id=${id}`);
  const after = invitational((await career.calendar.calendar(actor, id, {})).events as any[]);
  const invited = after.filter(e => e.human.streamInvite);
  assert.ok(invited.length, "invitations come in");
  assert.ok(invited.every(e => e.human.eligible && e.human.managerInvite === null));
  await db.execute(sql`UPDATE career_stream_channels SET followers=1200 WHERE career_save_id=${id}`);
});

test("choosing DartCast focus reserves the selected weekly frequency and lets the player start a reserved stream", async () => {
  await db.execute(sql`UPDATE career_saves SET current_week=current_week+1 WHERE id=${id}`);
  const selected = await streaming.setPathway(actor, id, { focus: "DARTCAST", weeklyFrequency: 2 });
  assert.equal(selected.pathway.focus, "DARTCAST");
  assert.equal(selected.pathway.weeklyFrequency, 2);
  assert.equal(selected.pathway.scheduledNights.length, 2);
  for (const day of selected.pathway.scheduledNights) assert.ok(!selected.freeNights.includes(day), "a scheduled night is reserved");
  const day = selected.pathway.scheduledNights[0];
  const live = await streaming.goLive(actor, id, { dayOfWeek: day });
  assert.equal(live.status, "LIVE", "the player can start a previously reserved stream");
  assert.ok(!(await streaming.read(actor, id)).pathway.scheduledNights.includes(day), "the live stream replaces the reservation");
  await streaming.end(actor, id, live.id);
  const seasonWeek = await saves.read(1, id);
  await settleLifeCommitments(db, { id, world_seed: SEED }, seasonWeek.currentSeason, seasonWeek.currentWeek);
  const missed = await rows(sql`SELECT id FROM career_life_commitments WHERE career_save_id=${id} AND family='DARTCAST' AND status='ACCEPTED'`);
  assert.equal(missed.length, 0, "an unplayed reserved stream is released when its week passes");
  const lowerFrequency = await streaming.setPathway(actor, id, { focus: "DARTCAST", weeklyFrequency: 1 });
  assert.equal(lowerFrequency.pathway.weeklyFrequency, 1);
  assert.equal(lowerFrequency.pathway.scheduledNights.length, 0, "the completed stream satisfies a one-night weekly target");
  const stopped = await streaming.setPathway(actor, id, { focus: "OPEN", weeklyFrequency: 0 });
  assert.equal(stopped.pathway.focus, "OPEN");
  assert.deepEqual(stopped.pathway.scheduledNights, []);
});

test("using the weekly stream limit releases unused reserved nights and Continue can advance", async () => {
  const save = await saves.create(1, { slot: 3, careerName: "Stream limit", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" });
  await career.initialize(actor, save.id);
  const selected = await streaming.setPathway(actor, save.id, { focus: "DARTCAST", weeklyFrequency: 1 });
  const reservedDay = selected.pathway.scheduledNights[0];
  const freeDays = selected.freeNights.slice(0, STREAM.perWeek);
  assert.equal(freeDays.length, STREAM.perWeek);
  for (const dayOfWeek of freeDays) {
    const live = await streaming.goLive(actor, save.id, { dayOfWeek });
    await streaming.end(actor, save.id, live.id);
  }
  const afterLimit = await streaming.read(actor, save.id);
  assert.equal(afterLimit.streamsThisWeek, STREAM.perWeek);
  assert.deepEqual(afterLimit.pathway.scheduledNights, [], "surplus scheduled streams are released once the weekly cap is reached");

  // A reservation left behind by an older save must not keep Continue trapped either.
  await db.execute(sql`INSERT INTO career_life_commitments (career_save_id,id,family,title,season,day,fee_pence,status)
    VALUES (${save.id},'7af79385-bb11-49fb-916f-c035751ea15e','DARTCAST','DartCast stream',${save.currentSeason},
      ${(save.currentWeek - 1) * 7 + reservedDay},0,'ACCEPTED')`);
  const advanced = await career.calendar.advance(actor, save.id, { operationKey: "stream-cap-continue",
    expectedSeason: save.currentSeason, expectedWeek: save.currentWeek, target: { kind: "WEEKS", weeks: 1 } }) as { stop: { reason: string } };
  assert.notEqual(advanced.stop.reason, "STREAM_PENDING");
  assert.equal(Number((await rows(sql`SELECT COUNT(*)::int AS n FROM career_life_commitments
    WHERE career_save_id=${save.id} AND family='DARTCAST' AND status='ACCEPTED'`))[0].n), 0);
});

test("a new Career stores the chosen streamer focus and weekly frequency", async () => {
  const created = await saves.create(1, { slot: 2, careerName: "DartCast route", dateOfBirth: "1998-03-02", homeLocality: "ayrshire",
    careerPathway: { focus: "DARTCAST", weeklyFrequency: 2 } });
  const row = (await rows(sql`SELECT settings_snapshot->'careerPathway' AS pathway FROM career_saves WHERE id=${created.id}`))[0];
  assert.deepEqual(row.pathway, { focus: "DARTCAST", weeklyFrequency: 2 });
});
