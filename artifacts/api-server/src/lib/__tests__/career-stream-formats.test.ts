/** Stream formats: King of the Oche, the drills (checkouts, Bob's 27, the average challenge), chat's poll and the monthly sub goal. */
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
import { FORMATS, KING_ROUNDS, SUB_GOAL, VARIETY, goalBonus, pollFor, streamIncome } from "../../career/streaming/model.ts";
import { replayDrill } from "../../shared/darts-rules/drills.ts";
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
  id = (await saves.create(1, { slot: 1, careerName: "Formats", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });


const T20 = { segment: 20, multiplier: 3, value: 60 }, T19 = { segment: 19, multiplier: 3, value: 57 }, D12 = { segment: 12, multiplier: 2, value: 24 }, MISS = { segment: 0, multiplier: 1, value: 0 };
const S20 = { segment: 20, multiplier: 1, value: 20 };
const D = (n: number) => n === 25 ? { segment: 25, multiplier: 2, value: 50 } : { segment: n, multiplier: 2, value: n * 2 };
const max = [T20, T20, T20], out141 = [T20, T19, D12], blank = [MISS, MISS, MISS];
/** One leg you win throwing first (180, 180, 141; they miss). */
const legYouFirst = [...max, ...blank, ...max, ...blank, ...out141];
/** One leg you win with them throwing first. */
const legThemFirst = [...blank, ...max, ...blank, ...max, ...blank, ...out141];
/** One leg they win, you throwing first. */
const legLostYouFirst = [...blank, ...max, ...blank, ...max, ...blank, ...out141];
const ALL = [MISS, ...Array.from({ length: 20 }, (_, i) => [1, 2, 3].map(m => ({ segment: i + 1, multiplier: m, value: (i + 1) * m }))).flat(), { segment: 25, multiplier: 1, value: 25 }, D(25)];
/** A way to check out `t` in at most three darts, the last a double. */
function checkout(t: number) {
  for (const d of ALL.filter(x => x.multiplier === 2)) {
    if (d.value === t) return [d];
    for (const a of ALL) { if (a.value && a.value + d.value === t && t - a.value >= 2) return [a, d]; }
    for (const a of ALL) for (const b of ALL) if (a.value && b.value && a.value + b.value + d.value === t && t - a.value >= 2 && t - a.value - b.value >= 2) return [a, b, d];
  }
  throw new Error(`no checkout for ${t}`);
}
const freeNight = async () => (await streaming.read(actor, id)).freeNights[0];
/** Move this week's streams back a week, so there are nights free again (the three-a-week limit). */
const clearWeek = async () => { const s = await saves.read(1, id);
  await db.execute(sql`UPDATE career_streams SET week=week-1, day=day-7 WHERE career_save_id=${id} AND season=${s.currentSeason} AND week=${s.currentWeek}`); };

test("drill rules: Bob's 27, the checkout challenge and the average challenge, all from the darts", () => {
  const bobsAllMiss = replayDrill({ kind: "BOBS_27" }, Array(15).fill(MISS));
  assert.equal(bobsAllMiss.complete, true); assert.equal(bobsAllMiss.result, "LOST"); assert.equal(bobsAllMiss.score, 27 - 2 - 4 - 6 - 8 - 10);
  assert.equal(bobsAllMiss.visits.at(-1)!.note, "OUT");
  assert.throws(() => replayDrill({ kind: "BOBS_27" }, Array(18).fill(MISS)), /over/);
  const perfect = Array.from({ length: 21 }, (_, i) => [D(i < 20 ? i + 1 : 25), MISS, MISS]).flat();
  const bobs = replayDrill({ kind: "BOBS_27" }, perfect);
  assert.equal(bobs.result, "WON"); assert.equal(bobs.score, 27 + Array.from({ length: 20 }, (_, i) => (i + 1) * 2).reduce((a, b) => a + b, 0) + 50);
  const co = replayDrill({ kind: "CHECKOUTS", targets: [40, 81], visitsEach: 3 }, [MISS, MISS, D(20), ...blank, ...blank, ...blank]);
  assert.equal(co.complete, true); assert.equal(co.score, 1); assert.equal(co.result, "WON", "one of two is half");
  assert.deepEqual(co.visits.map(v => v.note), ["CHECKOUT", "SCORE", "SCORE", "FAILED"]);
  const bust = replayDrill({ kind: "CHECKOUTS", targets: [40], visitsEach: 3 }, [T20]);
  assert.equal(bust.visits[0].note, "BUST"); assert.equal(bust.remaining, 40, "a bust puts the score back");
  const sc = replayDrill({ kind: "SCORING", visits: 2, targetAverage: 60 }, [...max, S20, S20, S20]);
  assert.equal(sc.average, 120); assert.equal(sc.result, "WON");
});

test("King of the Oche: viewer after viewer, one leg each, until one beats you", async () => {
  await db.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${id}, 'FormatsDarts', 300)`);
  const s = await streaming.goLive(actor, id, { dayOfWeek: await freeNight(), format: "KING" });
  assert.equal(s.streamFormat, "KING"); assert.deepEqual(s.format, { startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: 1 }); assert.equal(s.round, 0); assert.equal(s.kingRounds, KING_ROUNDS);
  const first = s.challenger.name;
  const r1 = await streaming.darts(actor, id, s.id, { darts: legYouFirst });
  assert.equal(r1.session.status, "LIVE"); assert.equal(r1.session.round, 1); assert.deepEqual(r1.session.darts, [], "a fresh leg");
  assert.notEqual(r1.session.challenger.name, first); assert.equal(r1.session.firstThrower, 1, "the next viewer throws first");
  assert.ok(r1.session.challenger.avg > s.challenger.avg - 10);
  const r2 = await streaming.darts(actor, id, s.id, { darts: legThemFirst });
  assert.equal(r2.session.round, 2); assert.equal(r2.session.firstThrower, 0);
  const r3 = await streaming.darts(actor, id, s.id, { darts: legLostYouFirst });
  assert.equal(r3.session.status, "ENDED"); assert.equal(r3.session.result, "LOST");
  assert.deepEqual(r3.session.rounds.map(r => r.result), ["WON", "WON", "LOST"]);
  assert.ok(r3.session.followersGained! >= 4, "a bonus for each viewer seen off");
  assert.ok(r3.session.poll && r3.session.poll.options.length === FORMATS.length, "chat votes on the next stream");
  const v = await streaming.read(actor, id);
  assert.equal(v.videos[0].title, "King of the Oche"); assert.equal(v.lastFormat, "KING");
  assert.equal(v.pollPick, r3.session.poll!.winner);
  const king = v.formats.find(f => f.key === "KING")!;
  assert.equal(king.crowd, Math.round(1.25 * VARIETY.repeat * (v.pollPick === "KING" ? VARIETY.pollPick : 1) * 100) / 100, "the same again draws fewer");
});

test("the checkout challenge, Bob's 27 and the average challenge on stream (pledges pay only on a win)", async () => {
  const co = await streaming.goLive(actor, id, { dayOfWeek: await freeNight(), format: "CHECKOUTS" });
  assert.equal(co.drill!.kind, "CHECKOUTS"); assert.equal(co.challenger.bot, null);
  const targets = (co.drill as { targets: number[] }).targets;
  assert.equal(targets.length, 5); assert.ok(co.chat.some(e => e.kind === "CHAT" && e.text.includes(String(targets[0]))));
  const hits = targets.slice(0, 3).flatMap(checkout), misses = Array(18).fill(MISS);
  const done = await streaming.darts(actor, id, co.id, { darts: [...hits, ...misses] });
  assert.equal(done.session.status, "ENDED"); assert.equal(done.session.result, "WON");
  const bobs = await streaming.goLive(actor, id, { dayOfWeek: await freeNight(), format: "BOBS_27" });
  const out = await streaming.darts(actor, id, bobs.id, { darts: Array(15).fill(MISS) });
  assert.equal(out.session.result, "LOST");
  await clearWeek();
  await db.execute(sql`UPDATE career_stream_channels SET followers=900 WHERE career_save_id=${id}`);
  const sc = await streaming.goLive(actor, id, { dayOfWeek: await freeNight(), format: "SCORING" });
  assert.equal((sc.drill as { targetAverage: number }).targetAverage, 45, "a 45 average the first time");
  const won = await streaming.darts(actor, id, sc.id, { darts: Array.from({ length: 33 }, () => [T20, S20, MISS]).flat() });
  assert.equal(won.session.result, "WON");
  const t = won.session.tally;
  assert.equal(won.session.incomePence, streamIncome(t) + (t.pledgedPence ?? 0), "pledges paid on a win");
  const next = await streaming.goLive(actor, id, { dayOfWeek: await freeNight(), format: "SCORING" });
  assert.equal((next.drill as { targetAverage: number }).targetAverage, 82, "next time: a bit above what you managed");
  const lost = await streaming.darts(actor, id, next.id, { darts: Array.from({ length: 33 }, () => [S20, MISS, MISS]).flat() });
  assert.equal(lost.session.result, "LOST");
  assert.equal(lost.session.incomePence, streamIncome(lost.session.tally), "no pledges on a miss");
  assert.equal(pollFor("a".repeat(64), "x", "KING").options.reduce((n, o) => n + o.votes, 0) > 0, true);
});

test("the monthly sub goal: set once a month from Partner up, settled at the month's end, followers if you hit it", async () => {
  await status(streaming.setSubGoal(actor, id, { target: 5, promise: SUB_GOAL.promises[0] }), 409);
  await db.execute(sql`UPDATE career_stream_channels SET followers=1500 WHERE career_save_id=${id}`);
  await status(streaming.setSubGoal(actor, id, { target: 7, promise: SUB_GOAL.promises[0] }), 400);
  const v = await streaming.setSubGoal(actor, id, { target: 5, promise: SUB_GOAL.promises[1] });
  assert.equal(v.subGoal!.target, 5); assert.equal(v.subGoal!.status, "ON");
  await status(streaming.setSubGoal(actor, id, { target: 10, promise: SUB_GOAL.promises[1] }), 409);
  const s = await saves.read(1, id), month = v.subGoal!.month, end = month * 4;
  // Five subs from this month's streams.
  await db.execute(sql`UPDATE career_streams SET week=${end}, tally = tally || '{"subs":5}'::jsonb WHERE career_save_id=${id} AND id = (SELECT id FROM career_streams WHERE career_save_id=${id} AND status='ENDED' ORDER BY created_at DESC LIMIT 1)`);
  // Earlier streams' clips are settled already (a viral one would add followers here).
  await db.execute(sql`UPDATE career_stream_clips SET status='SETTLED' WHERE career_save_id=${id}`);
  const root = { id, world_seed: String((await rows(sql`SELECT world_seed FROM career_saves WHERE id=${id}`))[0].world_seed) };
  await settleStreamingWeek(db, root, s.currentSeason, end);
  await settleStreamingWeek(db, root, s.currentSeason, end);
  const ch = (await rows(sql`SELECT followers, sub_goal FROM career_stream_channels WHERE career_save_id=${id}`))[0];
  assert.equal((ch.sub_goal as { status: string }).status, "HIT");
  assert.equal(Number(ch.followers), 1500 + goalBonus(5), "followers once");
});
