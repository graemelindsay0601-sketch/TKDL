/** Club team nights: a home-and-away league of your nation's clubs, six singles a side, and real events always come first. */
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
import { createCareerTeamNightsService, playTeamNights } from "../../career/club/team-service.ts";
import { TEAMS, fixturesFor, leagueTable, teamNightDay } from "../../career/club/teams.ts";
import { lockRoot } from "../../career/world/service.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db), teams = createCareerTeamNightsService(db);
const actor = { playerId: 1 };
let id = "";
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows;
const play = (week: number) => db.transaction(async tx => playTeamNights(tx, await lockRoot(tx, actor, id) as never, 1, week));

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
    createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
  await repairCareerSchema(db);
  id = (await saves.create(1, { slot: 1, careerName: "Team player", dateOfBirth: "1990-03-02", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
});
after(async () => { await pg.close(); });

test("fixtures: every club meets every other home and away, one fixture a club a round, inside the league weeks", () => {
  const clubs = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const f = fixturesFor(clubs);
  assert.equal(f.length, 8 * 7, "56 fixtures");
  for (const x of clubs) for (const y of clubs) if (x !== y) assert.equal(f.filter(g => g.home === x && g.away === y).length, 1, `${x} hosts ${y} once`);
  for (let r = 1; r <= 14; r++) { const round = f.filter(g => g.round === r); assert.equal(new Set(round.flatMap(g => [g.home, g.away])).size, round.length * 2); }
  assert.ok(f.every(g => g.week >= TEAMS.firstWeek && g.week <= TEAMS.lastWeek));
  assert.equal(new Set(f.map(g => g.week)).size, 14, "a round a fixture week");
  const odd = fixturesFor(["a", "b", "c"]);
  assert.equal(odd.length, 6, "three clubs: one sits out each round");
  assert.deepEqual(fixturesFor(["solo"]), [], "one club: no league");
  const table = leagueTable(["a", "b", "c"], [{ round: 1, week: 4, home: "a", away: "b", homeScore: 4, awayScore: 2 }, { round: 2, week: 7, home: "c", away: "a", homeScore: 3, awayScore: 3 }]);
  assert.deepEqual(table.map(t => [t.club, t.points, t.played]), [["a", 3, 2], ["c", 1, 1], ["b", 0, 1]]);
});

test("a team night: six singles for each side, you play when you're free", async () => {
  const first = fixturesFor((await teams.read(actor, id)).table.map(t => t.club)).filter(f => f.home === "ayrshire" || f.away === "ayrshire")[0];
  const before = await teams.read(actor, id);
  assert.ok(before.available && before.table.length >= 2, "Scotland has a league");
  assert.equal(before.next!.week, first.week); assert.equal(before.next!.youFree, true);
  await play(first.week);
  await play(first.week);
  const fixtures = await rows(sql`SELECT * FROM career_club_fixtures WHERE career_save_id=${id} AND week=${first.week}`);
  assert.equal(fixtures.length, fixturesFor(before.table.map(t => t.club)).filter(f => f.week === first.week).length, "every fixture that week, once");
  for (const f of fixtures) assert.equal(Number(f.home_score) + Number(f.away_score), TEAMS.singles);
  const ours = fixtures.find(f => f.home_key === "ayrshire" || f.away_key === "ayrshire")!;
  assert.equal(ours.you_played, true);
  const v = await teams.read(actor, id);
  assert.equal(v.last!.week, first.week);
  assert.equal(v.last!.singles.length, TEAMS.singles);
  assert.equal(v.last!.singles.filter(s => s.you).length, 1, "you play one singles");
  assert.equal(v.you.played, 1);
  assert.equal(v.table.reduce((n, t) => n + t.played, 0), fixtures.length * 2);
});

test("real events come first: booked elsewhere that night, you sit it out and a clubmate plays; booked members sit out too", async () => {
  const lg = (await teams.read(actor, id)).table.map(t => t.club);
  const second = fixturesFor(lg).filter(f => (f.home === "ayrshire" || f.away === "ayrshire"))[1];
  const event = (await rows(sql`SELECT id FROM career_event_instances WHERE career_save_id=${id} LIMIT 1`))[0].id;
  await db.execute(sql`INSERT INTO career_participant_bookings (career_save_id,season,participant_key,day,event_id) VALUES (${id},1,'HUMAN',${teamNightDay(second.week)},${event})`);
  const next = (await teams.read(actor, id)).next!;
  assert.equal(next.week, second.week); assert.equal(next.youFree, false); assert.ok(next.clash, "says what you're booked into");
  await play(second.week);
  const ours = (await rows(sql`SELECT * FROM career_club_fixtures WHERE career_save_id=${id} AND week=${second.week} AND (home_key='ayrshire' OR away_key='ayrshire')`))[0];
  assert.equal(ours.you_played, false); assert.equal(ours.you_unavailable, true);
  assert.ok(!(ours.rubbers as any[]).some(r => r.home === "HUMAN" || r.away === "HUMAN"));
  const v = await teams.read(actor, id);
  assert.equal(v.last!.youUnavailable, true);
  assert.equal(v.you.played, 1, "your record only counts the nights you played");
});
