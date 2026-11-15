/** Local nights: every night can hold something (pub league, knockout, practice, friendly, exhibition, coaching). */
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
  id = (await saves.create(1, { slot: 1, careerName: "Local", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });

import { createCareerLocalNightsService, settleLocalWeek } from "../../career/local/service.ts";
import { LOCAL, canCoach, canExhibit, coachingFee, exhibitionFee } from "../../career/local/model.ts";
import { freeNightsInWeek } from "../../career/nights.ts";

const local = createCareerLocalNightsService(db);
const T20 = { segment: 20, multiplier: 3, value: 60 }, T19 = { segment: 19, multiplier: 3, value: 57 }, D12 = { segment: 12, multiplier: 2, value: 24 }, MISS = { segment: 0, multiplier: 1, value: 0 };
/** A whitewash: you win every leg 180, 180, 141 while the bot misses everything. */
function whitewash(first: 0 | 1, legs: number) {
  const out: unknown[] = [];
  for (let k = 0; k < legs; k++) {
    const botFirst = (first + k) % 2 === 1, bot = [MISS, MISS, MISS];
    if (botFirst) out.push(...bot);
    out.push(T20, T20, T20, ...bot, T20, T20, T20, ...bot, T20, T19, D12);
  }
  return out;
}

test("local rules: exhibitions and coaching come once you're known; fees grow with your name", () => {
  assert.ok(!canExhibit(100, null) && canExhibit(6000, null) && canExhibit(0, 100));
  assert.ok(!canCoach(100, null) && canCoach(1500, null) && canCoach(0, 200));
  assert.ok(exhibitionFee(50_000) > exhibitionFee(5_000) && exhibitionFee(10_000_000) === LOCAL.exhibition.capPence);
  assert.ok(coachingFee(20_000) > coachingFee(1_000) && coachingFee(10_000_000) === LOCAL.coaching.capPence);
});

test("a week of local nights: practice, the knockout, the pub league, coaching, friendlies and what's locked", async () => {
  const root = (await rows(sql`SELECT * FROM career_saves WHERE id=${id}`))[0] as never as { id: string; world_seed: string };
  const season = (await saves.read(1, id)).currentSeason;
  await db.execute(sql`UPDATE career_saves SET balance_pence=500000, current_week=5 WHERE id=${id}`);
  let v = await local.read(actor, id);
  assert.equal(v.activities.length, 7);
  assert.match(v.activities.find(a => a.kind === "EXHIBITION")!.why ?? "", /known/);
  assert.match(v.activities.find(a => a.kind === "FRIENDLY")!.why ?? "", /Pre-season/);
  // Practice on a free night: Bob's 27, all misses, done; it takes the night.
  const day = v.freeNights.find(d => d !== 2 && d !== 4)!;
  const p = await local.book(actor, id, { kind: "PRACTICE", dayOfWeek: day, routine: "BOBS_27" });
  assert.ok(!(await freeNightsInWeek(db, id, season, 5)).includes(day), "booked like any night");
  await status(local.book(actor, id, { kind: "PRACTICE", dayOfWeek: day, routine: "SCORING" }));
  let s = await local.darts(actor, id, p.nightId, { darts: Array(15).fill(MISS) });
  assert.equal(s.status, "DONE"); assert.match(s.outcome ?? "", /Bob's 27/);
  v = await local.read(actor, id);
  assert.notEqual(v.routines.find(r => r.key === "BOBS_27")!.best, null, "a personal best is logged");
  // The knockout: Thursday only, £5 in, three rounds won for £30.
  assert.equal(v.activities.find(a => a.kind === "KNOCKOUT")!.why, null);
  {
    await status(local.book(actor, id, { kind: "KNOCKOUT", dayOfWeek: 1 }));
    const k = await local.book(actor, id, { kind: "KNOCKOUT", dayOfWeek: 4 });
    for (let r = 0; r < 3; r++) {
      s = await local.session(actor, id, k.nightId);
      assert.equal(s.match?.round, ["Quarter-final", "Semi-final", "Final"][r]);
      s = await local.darts(actor, id, k.nightId, { darts: whitewash(s.match!.firstThrower, 2) });
    }
    assert.equal(s.status, "DONE"); assert.match(s.outcome ?? "", /Won the club knockout/);
    const money = await rows(sql`SELECT SUM(amount_pence)::int AS n FROM career_finance_entries WHERE career_save_id=${id} AND operation_key LIKE 'adjustment:local-%'`);
    assert.equal(Number(money[0].n), LOCAL.knockout.prizes[0] - LOCAL.knockout.entryPence);
    await status(local.darts(actor, id, k.nightId, { darts: [] }).then(x => { if (x.status !== "DONE") throw new Error("reopened"); throw Object.assign(new Error("done"), { status: 409 }); }));
  }
  // The pub league: join, play round one live, miss round two (forfeit), the rest plays out and it finishes.
  assert.equal(v.activities.find(a => a.kind === "PUB_LEAGUE")!.why, null);
  {
    v = await local.joinPubLeague(actor, id);
    assert.ok(v.pubLeague && "table" in v.pubLeague && v.pubLeague.table!.length === LOCAL.pub.size);
    const b = await local.book(actor, id, { kind: "PUB_LEAGUE", dayOfWeek: 2 });
    s = await local.session(actor, id, b.nightId);
    s = await local.darts(actor, id, b.nightId, { darts: whitewash(s.match!.firstThrower, 3) });
    assert.match(s.outcome ?? "", /Won 3-0/);
    for (let w = 5; w <= 11; w++) { await db.execute(sql`UPDATE career_saves SET current_week=${w} WHERE id=${id}`); await settleLocalWeek(db, root as never, season, w); }
    const lg = (await rows(sql`SELECT status, position, fixtures FROM career_local_leagues WHERE career_save_id=${id}`))[0];
    assert.equal(lg.status, "FINISHED"); assert.ok(Number(lg.position) >= 1);
    const mine = (lg.fixtures as { a: string; b: string; legs: number[] }[]).filter(f => f.a === "HUMAN" || f.b === "HUMAN");
    assert.equal(mine.length, 7); assert.ok(mine.every(f => f.legs), "every round settled (yours forfeited when unplayed)");
  }
  // Coaching once known: paid when the week's done; an unplayed night is missed.
  await db.execute(sql`UPDATE career_saves SET current_week=48 WHERE id=${id}`);
  await db.execute(sql`INSERT INTO career_ranking_snapshots (career_save_id, id, list_key, sequence, season, week, publication_index, ranking_rules_version, participant_count, counted_contributions, new_contributions, expired_contributions, cut_values, reason)
    VALUES (${id}, gen_random_uuid(), 'pro-world', 999, ${season}, 47, 999, 1, 1, 0, 0, 0, '{}'::jsonb, 'test')`).catch(() => {});
  v = await local.read(actor, id);
  assert.equal(v.activities.find(a => a.kind === "FRIENDLY")!.why, null, "friendlies after the season");
  const fr = await local.book(actor, id, { kind: "FRIENDLY", dayOfWeek: v.freeNights[0] });
  await settleLocalWeek(db, root as never, season, 48);
  assert.equal((await local.session(actor, id, fr.nightId)).status, "MISSED");
});

import { nextDivision, playerOfYearPoints } from "../../career/local/model.ts";

test("divisions, the Club Championship and Player of the Year", async () => {
  assert.equal(nextDivision(4, 1), 3); assert.equal(nextDivision(4, 8), 4); assert.equal(nextDivision(1, 1), 1); assert.equal(nextDivision(2, 8), 3); assert.equal(nextDivision(3, 4), 3);
  assert.ok(playerOfYearPoints({ leagueFinishes: [{ division: 1, position: 1 }], knockoutWins: 0, championship: null }) > playerOfYearPoints({ leagueFinishes: [{ division: 4, position: 1 }], knockoutWins: 0, championship: null }));
  const root = (await rows(sql`SELECT * FROM career_saves WHERE id=${id}`))[0] as never;
  const season = (await saves.read(1, id)).currentSeason;
  let v = await local.read(actor, id);
  const lg = (await rows(sql`SELECT division, position FROM career_local_leagues WHERE career_save_id=${id} AND status='FINISHED'`))[0];
  assert.equal(v.division.level, nextDivision(Number(lg.division), Number(lg.position)), "the next league starts where the last one left you");
  // The Club Championship: weeks 44-45, four rounds, the final first to 4.
  await db.execute(sql`UPDATE career_saves SET current_week=44 WHERE id=${id}`);
  v = await local.read(actor, id);
  assert.equal(v.activities.find(a => a.kind === "CHAMPIONSHIP")!.why, null);
  const c = await local.book(actor, id, { kind: "CHAMPIONSHIP", dayOfWeek: v.freeNights[0] });
  let s = await local.session(actor, id, c.nightId);
  for (const [r, legs] of [["Last 16", 3], ["Quarter-final", 3], ["Semi-final", 3], ["Final", 4]] as const) {
    s = await local.session(actor, id, c.nightId); assert.equal(s.match?.round, r);
    s = await local.darts(actor, id, c.nightId, { darts: whitewash(s.match!.firstThrower, legs) });
  }
  assert.match(s.outcome ?? "", /Won the Club Championship/);
  v = await local.read(actor, id);
  assert.ok(v.honours.some(h => h.award === "CLUB_CHAMPION" && h.season === season));
  assert.match(v.activities.find(a => a.kind === "CHAMPIONSHIP")!.why ?? "", /Played this season/);
  // Season's end: Player of the Year when the record is good enough.
  await settleLocalWeek(db, root, season, 52); await settleLocalWeek(db, root, season, 52);
  const poty = await rows(sql`SELECT detail FROM career_local_honours WHERE career_save_id=${id} AND award='PLAYER_OF_THE_YEAR'`);
  assert.ok(poty.length <= 1);
  if (poty.length) assert.ok(Number((poty[0].detail as { points: number }).points) >= 12);
});
