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
  // Play every local at their figure until one is beaten (or the night's three games are gone).
  for (const o of v.trip!.opponents.filter(o => o.role === "LOCAL")) {
    const now = (await road.read(actor, id)).trip!;
    if (now.played >= ROAD.matchesPerTrip || now.opponents.some(x => x.role === "LOCAL" && x.result?.won)) break;
    const me = now.opponents.find(x => x.key === o.key)!;
    v = await road.play(actor, id, { opponentKey: o.key, stakePence: me.talk?.theirOfferPence ?? me.askingPence });
  }
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
  v = await road.play(actor, id, { opponentKey: found!.key, stakePence: found!.askingPence });
  assert.ok(v.visitor!.result, "played at your club");
  assert.equal(v.trip, null);
  await db.execute(sql`UPDATE career_saves SET current_week=${s.currentWeek} WHERE id=${id}`);
});
