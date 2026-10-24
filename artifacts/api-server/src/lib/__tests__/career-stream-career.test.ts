/** Streaming and the rest of your career: the DartCast Invitational, charity streams, streaming a real match from the venue, form and fans. */
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
import { FOLLOWER_FANS, INVITATIONAL, charityFans, collabFollowers, creatorSeriesCollabFit, invitationalPrize, streamIncome } from "../../career/streaming/model.ts";
import { loadFanFollowing } from "../../career/fans/service.ts";
import { createCareerLiveMatchService } from "../../career/live/service.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";
import { createMatch, throwDart } from "../../shared/darts-rules/x01.ts";
import { settleStreamingWeek } from "../../career/streaming/state.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db), streaming = createCareerStreamingService(db), live = createCareerLiveMatchService(db, career.calendar);
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
  id = (await saves.create(1, { slot: 1, careerName: "Career", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await db.execute(sql`UPDATE career_saves SET world_seed = ${HARNESS_SEED}, event_database_version = 2, player_database_version = 1 WHERE id = ${id}`);
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });



const T20 = { segment: 20, multiplier: 3, value: 60 }, T19 = { segment: 19, multiplier: 3, value: 57 }, D12 = { segment: 12, multiplier: 2, value: 24 }, MISS = { segment: 0, multiplier: 1, value: 0 };
const max = [T20, T20, T20], out141 = [T20, T19, D12], blank = [MISS, MISS, MISS];
/** First to 2: you win both legs with nine-darters, whoever throws first. */
const winYouFirst = [...max, ...blank, ...max, ...blank, ...out141, ...blank, ...max, ...blank, ...max, ...blank, ...out141];
const winThemFirst = [...blank, ...max, ...blank, ...max, ...blank, ...out141, ...max, ...blank, ...max, ...blank, ...out141];
/** First to 2: they win both legs (you throw first in leg 1). */
const loseYouFirst = [...blank, ...max, ...blank, ...max, ...blank, ...out141, ...max, ...blank, ...max, ...blank, ...out141];
let op = 0;

test("the DartCast Invitational: from week 40 for Partners, the season's top streamers knockout, prize money by round", async () => {
  await db.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${id}, 'CareerDarts', 300)`);
  let v = await streaming.read(actor, id);
  assert.equal(v.invitational.open, false); assert.equal(v.invitational.why, "For Partners and Stars");
  assert.equal(v.invitational.field.length, INVITATIONAL.field); assert.equal(v.invitational.field[0].handle, "TheOcheShow");
  await db.execute(sql`UPDATE career_stream_channels SET followers=1500 WHERE career_save_id=${id}`);
  assert.equal((await streaming.read(actor, id)).invitational.why, `Opens in week ${INVITATIONAL.fromWeek}`);
  const s0 = await saves.read(1, id);
  await db.execute(sql`UPDATE career_saves SET current_week=40 WHERE id=${id}`);
  v = await streaming.read(actor, id);
  assert.equal(v.invitational.open, true);
  const s = await streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "INVITATIONAL" });
  assert.equal(s.challenger.name, v.invitational.field[6].handle, "the lowest seed first"); assert.equal(s.kingRounds, 3);
  const qf = await streaming.darts(actor, id, s.id, { darts: winYouFirst });
  assert.equal(qf.session.round, 1); assert.equal(qf.session.challenger.name, v.invitational.field[3].handle); assert.equal(qf.session.firstThrower, 1);
  const sf = await streaming.darts(actor, id, s.id, { darts: winThemFirst });
  assert.equal(sf.session.round, 2); assert.equal(sf.session.challenger.name, "TheOcheShow", "the biggest in the final");
  const final = await streaming.darts(actor, id, s.id, { darts: loseYouFirst });
  assert.equal(final.session.status, "ENDED"); assert.equal(final.session.result, "LOST");
  const prize = (await rows(sql`SELECT amount_pence, reason FROM career_finance_entries WHERE career_save_id=${id} AND operation_key=${`stream-invitational:${s.id}`}`))[0];
  assert.equal(Number(prize.amount_pence), invitationalPrize(2)); assert.match(String(prize.reason), /out in the final/);
  v = await streaming.read(actor, id);
  assert.deepEqual(v.invitational.result, { wins: 2, prizePence: invitationalPrize(2) }); assert.equal(v.invitational.open, false);
  await status(streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "INVITATIONAL" }), 409);
  await db.execute(sql`UPDATE career_saves SET current_week=${s0.currentWeek} WHERE id=${id}`);
});

test("a charity stream: every cheer goes to the cause, more followers, fans who remember it; once a month", async () => {
  const fansBefore = (await loadFanFollowing(db, id)).total;
  const v = await streaming.read(actor, id);
  const s = await streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "CHARITY" });
  assert.ok(s.chat.some(e => e.kind === "CHAT" && /charity/i.test(e.text)));
  const done = await streaming.darts(actor, id, s.id, { darts: winYouFirst });
  const t = done.session.tally;
  assert.equal(done.session.incomePence, 0, "nothing for you");
  assert.equal(t.raisedPence, streamIncome(t));
  assert.equal((await rows(sql`SELECT 1 FROM career_finance_entries WHERE career_save_id=${id} AND operation_key=${`stream-income:${s.id}`}`)).length, 0);
  const after = await streaming.read(actor, id);
  assert.equal(after.charity.doneThisMonth, true); assert.equal(after.charity.raisedPence, t.raisedPence);
  await status(streaming.goLive(actor, id, { dayOfWeek: after.freeNights[0], format: "CHARITY" }), 409);
  const fans = (await loadFanFollowing(db, id)).total;
  assert.ok(fans >= fansBefore + Math.floor(done.session.followersGained! * FOLLOWER_FANS * 0.4) + Math.floor(charityFans(t.raisedPence!) * 0.4) - 1, "followers and goodwill bring fans");
});

test("streaming counts as practice: your stream darts feed your form", async () => {
  const form = await career.calendar.form(actor, id);
  assert.ok(form.practice.sessions >= 2, "this week's streams count"); assert.ok(form.practice.darts > 0);
  assert.ok(form.practice.darts >= 60, "every dart you threw on stream");
});

test("stream your real match from the venue: chat follows the match's own darts; never a televised match", async () => {
  await db.execute(sql`UPDATE career_streams SET week=week-2, day=day-14 WHERE career_save_id=${id}`);
  const events = ((await career.calendar.calendar(actor, id, { scope: "AVAILABLE" })).events as any[])
    .filter(e => e.definitionKey === "friday-night-501" && e.capability.executable && e.human.canEnter);
  assert.ok(events.length, "an enterable Friday Night 501");
  assert.equal((await career.calendar.enter(actor, id, { eventId: events[0].id })).entered, true);
  let matchId = "";
  for (let i = 0; i < 30 && !matchId; i++) {
    const sv = await saves.read(1, id);
    const r = await career.calendar.advance(actor, id, { operationKey: `stream-career-op-${++op}`, expectedSeason: sv.currentSeason, expectedWeek: sv.currentWeek, target: { kind: "NEXT_MEANINGFUL" } }) as any;
    if (r.stop.reason === "HUMAN_MATCH_PENDING") matchId = r.stop.detail.matchIds[0];
  }
  assert.ok(matchId, "a match to play");
  assert.equal((await streaming.matchStream(actor, id, matchId, false)).why, "Open the match first");
  const session = await live.open(actor, id, matchId) as any;
  const check = await streaming.matchStream(actor, id, matchId, false);
  assert.equal(check.eligible, true); assert.equal(check.session, null);
  const started = await streaming.matchStream(actor, id, matchId, true);
  assert.equal(started.session!.streamFormat, "MATCH"); assert.equal(started.session!.status, "LIVE");
  assert.ok(started.session!.formatName.startsWith("Live from the event"));
  // Throw the match (written straight into the live session's log): you win every leg in nine darts.
  const row = (await rows(sql`SELECT format, first_thrower FROM career_match_sessions WHERE career_save_id=${id} AND match_id=${matchId}`))[0];
  const first = (row.first_thrower ?? 0) as 0 | 1;
  let state = createMatch(row.format as never, first);
  const darts: unknown[] = [];
  for (let guard = 0; !state.complete; guard++) {
    assert.ok(guard < 2000, "the scripted match finishes");
    const mine = state.turn === 0, start = state.visit?.startScore ?? state.scores[0];
    const dart = !mine ? MISS : start === 141 ? [T20, T19, D12][state.visit?.darts.length ?? 0] : T20;
    darts.push(dart); state = throwDart(state, dart).state;
  }
  await db.execute(sql`UPDATE career_match_sessions SET darts=${JSON.stringify(darts)}::jsonb, first_thrower=${first}, status='IN_PLAY' WHERE career_save_id=${id} AND match_id=${matchId}`);
  const synced = await streaming.matchStream(actor, id, matchId, true);
  assert.ok(synced.events.length > 0, "chat reacts to the real darts");
  assert.equal(synced.session!.status, "ENDED"); assert.equal(synced.session!.result, "WON");
  const v = await streaming.read(actor, id);
  assert.equal(v.live, null, "a match stream is never 'your stream' to go back to");
  assert.equal(v.streamsThisWeek, 0, "and doesn't use up a stream night");
  assert.ok(v.videos.find(x => x.format === "MATCH")!.title.startsWith("Live from the event"));
  void session;
});

test("a creator season series tracks one matching show per quarter and rewards the finale", async () => {
  await db.execute(sql`UPDATE career_saves SET current_week=14 WHERE id=${id}`);
  let v = await streaming.read(actor, id);
  const selected = await streaming.chooseCreatorSeries(actor, id, { seriesKey: "HEADLINER" });
  assert.equal(selected.creatorSeries.selected?.key, "HEADLINER");
  assert.equal(selected.creatorSeries.availableChapters, 3, "a mid-season start has three chapters remaining");
  assert.equal(selected.collabs.find(c => c.key === "the-maximiser")?.seriesFit, true);
  assert.equal(creatorSeriesCollabFit("HEADLINER", "the-maximiser"), true);
  assert.ok(collabFollowers(1000, true, true) > collabFollowers(1000, true), "on-brand collaborations transfer a larger audience share");
  const chapterWeeks = [14, 27, 40];
  for (const week of chapterWeeks) {
    await db.execute(sql`UPDATE career_saves SET current_week=${week} WHERE id=${id}`);
    v = await streaming.read(actor, id);
    const stream = await streaming.goLive(actor, id, { dayOfWeek: v.freeNights[0], format: "CHALLENGER" });
    const done = await streaming.darts(actor, id, stream.id, { darts: winYouFirst });
    assert.equal(done.session.status, "ENDED");
    assert.ok((done.session.followersGained ?? 0) >= 15, "the episode adds its creator-series follower reward");
    v = await streaming.read(actor, id);
    assert.equal(v.creatorSeries.chapters[Math.ceil(week / 13) - 1].status, "DONE");
  }
  assert.equal(v.creatorSeries.finale, "COMPLETE");
  assert.equal(v.creatorSeries.completed, 3);
  assert.equal(v.creatorSeries.chapters[0].status, "NOT_STARTED", "a mid-season start does not penalize earlier quarters");
  await status(streaming.chooseCreatorSeries(actor, id, { seriesKey: "SKILL_LAB" }));
});

test("a creator series shapes the next sponsor campaign without changing its audience-based fee", async () => {
  await db.execute(sql`UPDATE career_stream_campaigns SET status='DECLINED' WHERE career_save_id=${id} AND status IN ('OFFERED','ACTIVE','IN_PROGRESS')`);
  await db.execute(sql`UPDATE career_stream_channels SET followers=1500 WHERE career_save_id=${id}`);
  await db.transaction(tx => settleStreamingWeek(tx, { id, world_seed: HARNESS_SEED }, 1, 17));
  const v = await streaming.read(actor, id);
  assert.equal(v.campaignOffer?.seriesKey, "HEADLINER");
  assert.ok(["CHALLENGER", "KING"].includes(v.campaignOffer!.requiredFormat), "the brief fits the channel's series identity");
  assert.match(v.campaignOffer!.brief, /The Headliner/);
  assert.ok(v.campaignOffer!.rewardPence >= 5000, "sponsorship still pays from recent live audience");
});
