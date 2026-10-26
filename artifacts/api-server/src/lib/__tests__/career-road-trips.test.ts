/** Road trips: other towns' locals for money, champions who only play a stranger with a name, reputation, and visitors at your club. */
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
import { createCareerRoadTripService, type RoadTripsView } from "../../career/roadtrip/service.ts";
import { ROAD, appetiteBoost, destinationsFrom, reputationFor, tripCostTo } from "../../career/roadtrip/model.ts";
import { MONEY } from "../../career/money/model.ts";
import { settleStreamingWeek } from "../../career/streaming/state.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db), road = createCareerRoadTripService(db);
const actor = { playerId: 1 };
let id = "";
const SEED = "a".repeat(64);
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows;
const status = (p: Promise<unknown>, n = 409) => assert.rejects(p, (e: { status?: number }) => e.status === n);
const T20 = { segment: 20, multiplier: 3, value: 60 }, T19 = { segment: 19, multiplier: 3, value: 57 }, D12 = { segment: 12, multiplier: 2, value: 24 }, MISS = { segment: 0, multiplier: 1, value: 0 };
const nineDarter = [T20, T20, T20, MISS, MISS, MISS, T20, T20, T20, MISS, MISS, MISS, T20, T19, D12];
const nineDarterWhenOtherStarts = [MISS, MISS, MISS, T20, T20, T20, MISS, MISS, MISS, T20, T20, T20, MISS, MISS, MISS, T20, T19, D12];
const fourLegs = [...nineDarter, ...nineDarterWhenOtherStarts, ...nineDarter, ...nineDarterWhenOtherStarts];

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
    createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
  await repairCareerSchema(db);
  id = (await saves.create(1, { slot: 1, careerName: "Hustler", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });


test("road trip rules: towns in your part of the world, the cost of getting there, and a name that grows", () => {
  const towns = destinationsFrom("ayrshire");
  assert.ok(!towns.some(t => t.key === "ayrshire"), "not your own town");
  assert.ok(towns.some(t => t.city === "Glasgow") && towns.some(t => t.city === "Cork"), "Scotland and over the water");
  assert.ok(!towns.some(t => t.country === "NLD"), "the continent is another road");
  const glasgow = tripCostTo("ayrshire", { country: "GBR", city: "Glasgow" }), cork = tripCostTo("ayrshire", { country: "IRL", city: "Cork" });
  assert.ok(glasgow.pence > 0 && glasgow.pence < 2000 && !glasgow.overnight, "a short drive");
  assert.ok(cork.pence > glasgow.pence * 5, "a flight costs more");
  assert.equal(reputationFor(0).title, "Unknown on the road"); assert.equal(reputationFor(1).title, "Known on the circuit"); assert.equal(reputationFor(7).title, "Legend of the road");
  assert.equal(appetiteBoost(0), 1); assert.equal(appetiteBoost(3), 1.3); assert.equal(appetiteBoost(50), 2);
});

test("a road trip: book a night, pay the travel, play the locals; the champion only plays a stranger who's beaten a local", async () => {
  await db.execute(sql`UPDATE career_saves SET balance_pence = 500000 WHERE id=${id}`);
  let v = await road.read(actor, id);
  assert.equal(v.home, "Kilbirnie"); assert.equal(v.trip, null); assert.equal(v.canTravel, true);
  assert.equal(v.reputation.title, "Unknown on the road");
  const town = v.towns.find(t => t.champion && t.city === "Glasgow") ?? v.towns.find(t => t.champion)!;
  const night = v.freeNights[0];
  v = await road.go(actor, id, { localityKey: town.key, dayOfWeek: night });
  assert.equal(v.trip!.town, town.city); assert.equal(v.trip!.dayOfWeek, night);
  assert.ok(!v.freeNights.includes(night), "the night is booked");
  const travel = await rows(sql`SELECT amount_pence, category FROM career_finance_entries WHERE career_save_id=${id} AND operation_key=${`road-trip:${v.trip!.id}`}`);
  assert.equal(Number(travel[0].amount_pence), -town.costPence); assert.equal(travel[0].category, "TRAVEL");
  await status(road.go(actor, id, { localityKey: town.key, dayOfWeek: v.freeNights[0] }), 409);
  const champ = v.trip!.opponents.find(o => o.role === "CHAMPION")!;
  assert.match(champ.locked!, /locals first/);
  await status(road.play(actor, id, { opponentKey: champ.key, stakePence: champ.askingPence }), 409);
  // Haggling as at your club: a silly offer gets their own figure back, three asks and they walk.
  const local = v.trip!.opponents.find(o => o.role === "LOCAL")!;
  v = await road.offer(actor, id, { opponentKey: local.key, stakePence: local.askingPence + 100000 });
  let talk = v.trip!.opponents.find(o => o.key === local.key)!.talk!;
  assert.equal(talk.status, "OPEN"); assert.equal(talk.theirOfferPence, local.askingPence);
  await status(road.play(actor, id, { opponentKey: local.key, stakePence: local.askingPence + 100000 }), 409);
  // Starting a match creates no result; every leg is settled only from the live scorer's replayed darts.
  const me = v.trip!.opponents.find(o => o.key === local.key)!;
  const live = await road.play(actor, id, { opponentKey: local.key, stakePence: me.talk?.theirOfferPence ?? me.askingPence });
  assert.equal(live.session.status, "LIVE");
  assert.equal((await road.read(actor, id)).trip!.opponents.find(o => o.key === local.key)!.result, null);
  const checkpoint = await road.darts(actor, id, live.session.id, { darts: [T20] });
  assert.deepEqual(checkpoint.darts, [T20], "an unfinished game can be resumed");
  const done = await road.darts(actor, id, live.session.id, { darts: fourLegs });
  assert.equal(done.status, "PLAYED"); assert.equal(done.won, true); assert.deepEqual(done.legs, [4, 0]);
  await road.darts(actor, id, live.session.id, { darts: fourLegs });
  v = await road.read(actor, id);
  const leagueRows = await rows(sql`SELECT COUNT(*)::int AS n FROM career_finance_entries WHERE career_save_id=${id} AND operation_key=${`road-match:${live.session.id}`}`);
  assert.equal(Number(leagueRows[0].n), 1, "retrying a completed scorer submission cannot settle the stake twice");
  const beat = v.trip!.opponents.some(o => o.role === "LOCAL" && o.result?.won);
  const champNow = v.trip!.opponents.find(o => o.role === "CHAMPION")!;
  assert.equal(champNow.locked === null, beat, "the champion plays you once you've beaten a local");
  const money = await rows(sql`SELECT SUM(amount_pence)::int AS n FROM career_finance_entries WHERE career_save_id=${id} AND operation_key LIKE 'road-match:%'`);
  assert.equal(Number(money[0].n), v.trip!.opponents.reduce((n, o) => n + (o.result ? (o.result.won ? 1 : -1) * o.result.stakePence : 0), 0), "every stake through the ledger");
  assert.equal(v.record.played, v.trip!.played);
});

test("a road trip night is booked like any other: no event that night", async () => {
  const v = await road.read(actor, id), s = await saves.read(1, id);
  const tripDay = v.trip!.dayOfWeek;
  const clash = ((await career.calendar.calendar(actor, id, { fromWeek: s.currentWeek, toWeek: s.currentWeek })).events as any[])
    .find(e => e.human && e.dates.startWeek === s.currentWeek && e.dates.startDay === e.dates.endDay && e.dates.startDayOfWeek === tripDay);
  if (clash) { assert.equal(clash.human.canEnter, false); assert.deepEqual(clash.human.commercialConflicts, ["Road trip"]); }
});

test("beat a town's champion: it's conquered, your name grows, and its players come to your club to win their money back", async () => {
  const v0 = await road.read(actor, id);
  const town = v0.towns.find(t => t.champion && !t.conquered)!;
  // A champion beaten on an earlier trip (written straight in).
  const s = await saves.read(1, id);
  const champKey = (await rows(sql`SELECT id FROM career_world_players WHERE career_save_id=${id} AND first_name || ' ' || surname = ${town.champion!.name} LIMIT 1`))[0].id;
  await db.execute(sql`INSERT INTO career_road_matches (career_save_id, id, season, week, locality_key, opponent_key, role, status, stake_pence, won, legs_you, legs_them, detail)
    VALUES (${id}, gen_random_uuid(), ${s.currentSeason}, 1, ${town.key}, ${champKey}, 'CHAMPION', 'PLAYED', 5000, true, 4, 2, '{}'::jsonb)`);
  let v = await road.read(actor, id);
  assert.equal(v.reputation.towns, 1); assert.equal(v.reputation.title, "Known on the circuit");
  assert.ok(v.towns.find(t => t.key === town.key)!.conquered); assert.ok(v.record.conquered.includes(town.city));
  // No visitor in a week you're away; in other weeks, now and then.
  assert.equal(v.visitor, null, "you're on the road this week");
  let found: RoadTripsView["visitor"] = null;
  for (let w = s.currentWeek + 1; w < s.currentWeek + 30 && !found; w++) {
    await db.execute(sql`UPDATE career_saves SET current_week=${w} WHERE id=${id}`);
    found = (await road.read(actor, id)).visitor;
  }
  assert.ok(found, "someone turns up within a few weeks");
  assert.equal(found!.role, "VISITOR"); assert.equal(found!.town, town.city);
  assert.ok(found!.askingPence >= MONEY.minimumPence);
  const live = await road.play(actor, id, { opponentKey: found!.key, stakePence: found!.askingPence });
  assert.equal(live.session.status, "LIVE");
  const played = await road.darts(actor, id, live.session.id, { darts: fourLegs });
  assert.equal(played.status, "PLAYED", "the visitor match is manually scored");
  v = await road.read(actor, id);
  assert.ok(v.visitor!.result, "played at your club");
  assert.equal(v.trip, null);
  await db.execute(sql`UPDATE career_saves SET current_week=${s.currentWeek} WHERE id=${id}`);
});

test("an unfinished live road match becomes missed at week end without a result or stake", async () => {
  const saveId = (await saves.create(1, { slot: 3, careerName: "Missed Road", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, saveId);
  await db.execute(sql`UPDATE career_saves SET balance_pence=500000 WHERE id=${saveId}`);
  const start = await road.read(actor, saveId), town = start.towns.find(t => t.champion)!;
  let v = await road.go(actor, saveId, { localityKey: town.key, dayOfWeek: start.freeNights[0] });
  const local = v.trip!.opponents.find(o => o.role === "LOCAL")!;
  const live = await road.play(actor, saveId, { opponentKey: local.key, stakePence: local.askingPence });
  assert.equal(live.session.status, "LIVE");
  await db.execute(sql`UPDATE career_saves SET current_week=current_week+1 WHERE id=${saveId}`);
  await road.read(actor, saveId);
  const missed = await road.session(actor, saveId, live.session.id);
  assert.equal(missed.status, "MISSED");
  const record = await rows(sql`SELECT status,won FROM career_road_matches WHERE career_save_id=${saveId} AND id=${live.session.id}`);
  assert.equal(record[0].status, "MISSED"); assert.equal(record[0].won, null);
  const ledger = await rows(sql`SELECT COUNT(*)::int AS n FROM career_finance_entries WHERE career_save_id=${saveId} AND operation_key=${`road-match:${live.session.id}`}`);
  assert.equal(Number(ledger[0].n), 0);
});

test("a road trip can be booked next week while this week's plan stays unchanged", async () => {
  const futureSave = (await saves.create(1, { slot: 2, careerName: "Future Road", dateOfBirth: "1998-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, futureSave);
  await db.execute(sql`UPDATE career_saves SET balance_pence=500000 WHERE id=${futureSave}`);
  const current = await road.read(actor, futureSave), week = current.week + 1, future = await road.read(actor, futureSave, week);
  const town = future.towns.find(t => t.champion)!;
  const dayOfWeek = future.freeNights[0];
  assert.ok(town && dayOfWeek);
  const booked = await road.go(actor, futureSave, { localityKey: town.key, dayOfWeek, week });
  assert.equal(booked.week, week);
  assert.equal(booked.trip?.town, town.city);
  assert.equal((await road.read(actor, futureSave)).trip, null);
  await status(road.read(actor, futureSave, week + 1), 400);
});
