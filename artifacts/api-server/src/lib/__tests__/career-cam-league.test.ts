/** Webcam leagues: a division of eight from around the world, a match a week on a night you book, promotion and relegation, prizes. */
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
import { createCareerCamLeagueService, settleCamWeek } from "../../career/camleague/service.ts";
import { createMatch, throwDart } from "../../shared/darts-rules/x01.ts";
import { CAM, DIVISIONS, divisionFor, movement, prizeFor, roundRobin, tableFrom } from "../../career/camleague/model.ts";
import { settleStreamingWeek } from "../../career/streaming/state.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db), cam = createCareerCamLeagueService(db);
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
  id = (await saves.create(1, { slot: 1, careerName: "Cammer", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });



const T20 = { segment: 20, multiplier: 3, value: 60 }, T19 = { segment: 19, multiplier: 3, value: 57 }, D12 = { segment: 12, multiplier: 2, value: 24 }, MISS = { segment: 0, multiplier: 1, value: 0 };
/** A whole match you win in nine-darters (they miss everything). */
function winningDarts(format: any, first: 0 | 1) {
  let state = createMatch(format, first); const darts: unknown[] = [];
  for (let guard = 0; !state.complete; guard++) {
    assert.ok(guard < 2000);
    const start = state.visit?.startScore ?? state.scores[0];
    const dart = state.turn !== 0 ? MISS : start === 141 ? [T20, T19, D12][state.visit?.darts.length ?? 0] : T20;
    darts.push(dart); state = throwDart(state, dart).state;
  }
  return darts;
}
const rootOf = async () => (await rows(sql`SELECT * FROM career_saves WHERE id=${id}`))[0] as any;

test("webcam league rules: everyone plays everyone once, the table, up and down, prizes", () => {
  const rr = roundRobin();
  assert.equal(rr.length, CAM.rounds);
  const pairs = new Set<string>();
  for (const round of rr) { assert.equal(new Set(round.flat()).size, CAM.size, "everyone plays each round"); for (const [a, b] of round) pairs.add([a, b].sort().join("-")); }
  assert.equal(pairs.size, CAM.size * (CAM.size - 1) / 2, "every pairing once");
  const t = tableFrom(["A", "B", "C"], [{ a: "A", b: "B", legsA: 3, legsB: 1 }, { a: "B", b: "C", legsA: 3, legsB: 0 }, { a: "C", b: "A", legsA: 3, legsB: 2 }, { a: "A", b: "C", legsA: null, legsB: null }]);
  assert.deepEqual(t.map(r => [r.key, r.points]), [["A", 2], ["B", 2], ["C", 2]], "level on points and leg difference (+1 each): A won more legs (5 to 4)");
  assert.equal(movement(3, 1), 2); assert.equal(movement(3, 8), 4); assert.equal(movement(1, 1), 1); assert.equal(movement(5, 8), 5); assert.equal(movement(3, 4), 3);
  assert.equal(prizeFor(1, 1), DIVISIONS[0].fee * 4); assert.equal(prizeFor(3, 4), 0);
  assert.ok(CAM.prizeMultiple.reduce((sum,multiple)=>sum+multiple,0)<=CAM.size,"cash prizes are fully covered by league fees");
  assert.equal(divisionFor(45), 4); assert.equal(divisionFor(72), 1); assert.equal(divisionFor(20), 5);
});

test("join a league: seven others from around the world at your level, a fixture a week, the fee paid", async () => {
  await db.execute(sql`UPDATE career_saves SET balance_pence = 100000 WHERE id=${id}`);
  let v = await cam.read(actor, id);
  assert.equal(v.league, null); assert.equal(v.join.ok, true);
  v = await cam.join(actor, id);
  const l = v.league!;
  assert.equal(l.table.length, CAM.size); assert.ok(l.table.some(r => r.you));
  assert.ok(new Set(l.table.filter(r => !r.you).map(r => r.country)).size >= 3, "from several countries");
  assert.equal(l.fixtures.length, CAM.rounds); assert.deepEqual(l.fixtures.map(f => f.week), Array.from({ length: CAM.rounds }, (_, i) => l.weekStart + i));
  assert.ok(l.thisWeek && l.thisWeek.status === "SCHEDULED");
  const fee = await rows(sql`SELECT amount_pence, category FROM career_finance_entries WHERE career_save_id=${id} AND operation_key=${`cam-fee:${l.id}`}`);
  assert.equal(Number(fee[0].amount_pence), -v.division.feePence); assert.equal(fee[0].category, "CAM_LEAGUE_FEE");
  await status(cam.join(actor, id), 409);
});

test("book this week's match on a free night, play it on the scorer (the server replays the darts), and the table counts it", async () => {
  let v = await cam.read(actor, id);
  const f = v.league!.thisWeek!, night = v.freeNights[0];
  await status(cam.session(actor, id, f.id), 409);
  v = await cam.book(actor, id, { fixtureId: f.id, dayOfWeek: night });
  assert.equal(v.league!.thisWeek!.status, "BOOKED"); assert.ok(!v.freeNights.includes(night), "the night is taken");
  const s = await cam.session(actor, id, f.id);
  assert.deepEqual(s.format, { startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: 5 }); assert.ok(s.opponent.bot.seed);
  await status(cam.darts(actor, id, f.id, { darts: [{ segment: 25, multiplier: 3, value: 75 }] }), 400);
  const done = await cam.darts(actor, id, f.id, { darts: winningDarts(s.format, s.firstThrower) });
  assert.equal(done.status, "PLAYED"); assert.deepEqual(done.legs, [3, 0]); assert.equal(done.won, true);
  v = await cam.read(actor, id);
  const me = v.league!.table.find(r => r.you)!;
  assert.equal(me.points, CAM.pointsForWin); assert.equal(me.legsFor, 3);
});

test("the week settles: the round plays out, an unplayed match is forfeited, a quick-sim counts; after round seven, prizes and a new division", async () => {
  const root = await rootOf(), season = Number(root.current_season);
  let v = await cam.read(actor, id);
  const start = v.league!.weekStart;
  await settleCamWeek(db, root, season, start);
  v = await cam.read(actor, id);
  assert.equal(v.league!.table.reduce((n, r) => n + r.played, 0), CAM.size, "all four matches of round one played");
  // Round two: nothing done, so it's forfeited.
  await settleCamWeek(db, root, season, start + 1);
  v = await cam.read(actor, id);
  assert.deepEqual(v.league!.fixtures[1].legs, [0, 3]); assert.equal(v.league!.fixtures[1].status, "FORFEIT");
  // Round three: book it and let it play out at your level.
  await db.execute(sql`UPDATE career_saves SET current_week=${start + 2} WHERE id=${id}`);
  v = await cam.read(actor, id);
  const f3 = v.league!.thisWeek!;
  await cam.book(actor, id, { fixtureId: f3.id, dayOfWeek: v.freeNights[0] });
  v = await cam.simulate(actor, id, f3.id);
  assert.equal(v.league!.fixtures[2].status, "PLAYED"); assert.equal(v.league!.fixtures[2].source, "SIM");
  for (let w = start + 2; w <= start + CAM.rounds - 1; w++) await settleCamWeek(db, { ...root, current_week: w }, season, w);
  await settleCamWeek(db, root, season, start + CAM.rounds - 1);
  await db.execute(sql`UPDATE career_saves SET current_week=${start + CAM.rounds} WHERE id=${id}`);
  v = await cam.read(actor, id);
  assert.equal(v.league, null, "the league is over");
  const h = v.history[0];
  assert.ok(h.position >= 1 && h.position <= CAM.size);
  assert.equal(h.nextLevel, movement(h.level, h.position)); assert.equal(v.division.level, h.nextLevel, "next time you start there");
  const prize = await rows(sql`SELECT amount_pence FROM career_finance_entries WHERE career_save_id=${id} AND category='CAM_LEAGUE_PRIZE'`);
  assert.equal(prize.length ? Number(prize[0].amount_pence) : 0, prizeFor(h.level, h.position), "prize money once, for the top three");
  assert.equal(h.prizePence, prizeFor(h.level, h.position));
});

test("an active league's next-week fixture can be booked without changing the current fixture", async () => {
  const futureSave = (await saves.create(1, { slot: 2, careerName: "Future Webcam", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, futureSave);
  await db.execute(sql`UPDATE career_saves SET balance_pence=100000 WHERE id=${futureSave}`);
  const current = await cam.join(actor, futureSave), nextWeek = current.week + 1;
  const future = await cam.read(actor, futureSave, nextWeek), fixture = future.league!.thisWeek!, dayOfWeek = future.freeNights[0];
  assert.equal(fixture.week, nextWeek);
  assert.equal(fixture.status, "SCHEDULED");
  assert.ok(dayOfWeek);
  const booked = await cam.book(actor, futureSave, { fixtureId: fixture.id, dayOfWeek, week: nextWeek });
  assert.equal(booked.week, nextWeek);
  assert.equal(booked.league!.thisWeek!.status, "BOOKED");
  assert.equal((await cam.read(actor, futureSave)).league!.thisWeek!.status, "SCHEDULED");
});
