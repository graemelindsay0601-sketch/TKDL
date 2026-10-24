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
import { playCountyFixtures } from "../../career/club/county-team-service.ts";
import { createCareerCountyLiveService } from "../../career/club/county-live-service.ts";
import { clubTrialRecord, ensureCountyTrialInvitation } from "../../career/club/county-trials.ts";
import { countyCupFixtures, countyTables } from "../../career/club/county-squads.ts";
import { createCareerClubService } from "../../career/club/service.ts";
import { CLUB } from "../../career/club/model.ts";
import { TEAMS, fixturesFor, leagueTable, playoffFixtures, teamNightDay } from "../../career/club/teams.ts";
import { loadNpcs } from "../../career/world/repository.ts";
import { lockRoot } from "../../career/world/service.ts";
import { localityByRegion } from "../../career/calendar/geography.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db), teams = createCareerTeamNightsService(db);
const clubs = createCareerClubService(db);
const countyLive = createCareerCountyLiveService(db);
const actor = { playerId: 1 };
let id = "";
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows;
const play = (week: number) => db.transaction(async tx => playTeamNights(tx, await lockRoot(tx, actor, id) as never, 1, week));
const playCounty = (season: number, week: number) => db.transaction(async tx => playCountyFixtures(tx, await lockRoot(tx, actor, id) as never, season, week));

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

test("county cup is a staged knockout, advances aggregate-set winners, and never runs two stages in one week", () => {
  const counties = ["a", "b", "c", "d", "e"];
  const first = countyCupFixtures(counties, []);
  assert.equal(first.length, 2, "five counties produce two ties and one bye");
  assert.ok(first.every(f => f.round === 101 && f.week === 48));
  const completedFirst = first.map((f, i) => ({ ...f, status: "COMPLETED", matches: [{ homeSets: i ? 1 : 4, awaySets: i ? 3 : 0 }] }));
  const second = countyCupFixtures(counties, completedFirst);
  assert.equal(second.length, 1);
  assert.equal(second[0].week, 49);
  const completedSecond = [...completedFirst, { ...second[0], week: 51, status: "COMPLETED", matches: [{ homeSets: 3, awaySets: 1 }] }];
  const final = countyCupFixtures(counties, completedSecond);
  assert.equal(final.length, 1);
  assert.equal(final[0].round, 103);
  assert.equal(final[0].week, 52, "catch-up fixtures schedule the next round after the actual previous round");
});

test("top four enter seeded semi-finals and a final; tied knockouts go to the higher seed", () => {
  const clubs = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const regular = fixturesFor(clubs).map(f => ({ ...f, homeScore: 4, awayScore: 2 }));
  assert.deepEqual(playoffFixtures(clubs, regular.slice(1)), [], "playoffs wait until the league is complete");
  const semis = playoffFixtures(clubs, regular);
  assert.equal(semis.length, 2);
  assert.ok(semis.every(f => f.week === 48 && f.round === 15));
  const completed = [...regular, ...semis.map(f => ({ ...f, homeScore: 3, awayScore: 3 }))];
  const final = playoffFixtures(clubs, completed);
  assert.equal(final.length, 1);
  assert.equal(final[0].week, 50);
  assert.equal(final[0].round, 16);
  assert.equal(final[0].home, semis[0].home, "higher regular-season seed wins a tied semi");
});

test("an older save keeps its team results when the current schema is repaired repeatedly", async () => {
  await db.execute(sql`ALTER TABLE career_club_fixtures DROP COLUMN status`);
  await db.execute(sql`DROP TABLE career_club_team_memberships`);
  const legacyRubbers = [{ home: "legacy-player", away: "legacy-rival", homeLegs: 3, awayLegs: 1, averages: [70, 65] }];
  await db.execute(sql`INSERT INTO career_club_fixtures(career_save_id,season,round,week,home_key,away_key,home_score,away_score,rubbers)
    VALUES (${id},99,1,4,'legacy-home','legacy-away',1,0,${JSON.stringify(legacyRubbers)}::jsonb)`);
  await repairCareerSchema(db);
  await repairCareerSchema(db);
  const saved = (await rows(sql`SELECT status,home_score,rubbers FROM career_club_fixtures WHERE career_save_id=${id} AND season=99`))[0];
  assert.equal(saved.status, "COMPLETED", "pre-feature team history is treated as already settled");
  assert.equal(Number(saved.home_score), 1);
  assert.deepEqual(saved.rubbers, legacyRubbers);
  assert.ok((await rows(sql`SELECT to_regclass('career_club_team_memberships') AS table_name`))[0].table_name);
});

test("a team night: six singles for each side, you play when you're free", async () => {
  const first = fixturesFor((await teams.read(actor, id)).table.map(t => t.club)).filter(f => f.home === "ayrshire" || f.away === "ayrshire")[0];
  const before = await teams.read(actor, id);
  assert.ok(before.available && before.table.length >= 2, "Scotland has a league");
  assert.equal(before.next!.week, first.week); assert.equal(before.next!.youFree, false, "availability is only relevant after joining");
  await teams.join(actor, id);
  assert.equal((await teams.read(actor, id)).next!.youFree, true);
  const matchId = await play(first.week);
  assert.ok(matchId, "a joined, available player receives a live single");
  assert.equal(await play(first.week), matchId, "re-entering the same week returns the same live match");
  const session = await teams.liveMatch(actor, id, matchId);
  assert.equal(session.status, "LIVE");
  assert.equal((await teams.read(actor, id)).you.played, 0, "a pending match is not a personal appearance yet");
  const miss = { segment: 0, multiplier: 1 as const, value: 0 };
  const t20 = { segment: 20, multiplier: 3 as const, value: 60 };
  const t19 = { segment: 19, multiplier: 3 as const, value: 57 };
  const d12 = { segment: 12, multiplier: 2 as const, value: 24 };
  const darts = Array.from({ length: 3 }, (_, leg) => [
    ...(leg % 2 ? Array(3).fill(miss) : []),
    ...Array(3).fill(t20), ...Array(3).fill(miss),
    ...Array(3).fill(t20), ...Array(3).fill(miss), t20, t19, d12,
  ]).flat();
  const finished = await teams.darts(actor, id, matchId, { darts });
  assert.equal(finished.status, "PLAYED");
  assert.equal(finished.won, true);
  const fixtures = await rows(sql`SELECT * FROM career_club_fixtures WHERE career_save_id=${id} AND season=1 AND week=${first.week}`);
  assert.equal(fixtures.length, fixturesFor(before.table.map(t => t.club)).filter(f => f.week === first.week).length, "every fixture that week, once");
  for (const f of fixtures) assert.equal(Number(f.home_score) + Number(f.away_score), TEAMS.singles);
  const ours = fixtures.find(f => f.home_key === "ayrshire" || f.away_key === "ayrshire")!;
  assert.equal(ours.you_played, true);
  const v = await teams.read(actor, id);
  assert.equal(v.last!.week, first.week);
  assert.equal(v.last!.singles.length, TEAMS.singles);
  assert.equal(v.last!.singles.filter(s => s.you).length, 1, "you play one singles");
  assert.equal(v.you.played, 1);
  assert.equal(v.you.won, 1);
  assert.equal(v.table.reduce((n, t) => n + t.played, 0), fixtures.length * 2);
});

test("real events come first: booked elsewhere that night, you sit it out and a clubmate plays; booked members sit out too", async () => {
  const lg = (await teams.read(actor, id)).table.map(t => t.club);
  const second = fixturesFor(lg).filter(f => (f.home === "ayrshire" || f.away === "ayrshire"))[1];
  await db.execute(sql`UPDATE career_saves SET current_week=${second.week} WHERE id=${id}`);
  const event = (await rows(sql`SELECT id FROM career_event_instances WHERE career_save_id=${id} LIMIT 1`))[0].id;
  await db.execute(sql`INSERT INTO career_participant_bookings (career_save_id,season,participant_key,day,event_id) VALUES (${id},1,'HUMAN',${teamNightDay(second.week)},${event})`);
  const next = (await teams.read(actor, id)).next!;
  assert.equal(next.week, second.week); assert.equal(next.youFree, false); assert.ok(next.clash, "says what you're booked into");
  await play(second.week);
  const ours = (await rows(sql`SELECT * FROM career_club_fixtures WHERE career_save_id=${id} AND season=1 AND week=${second.week} AND (home_key='ayrshire' OR away_key='ayrshire')`))[0];
  assert.equal(ours.you_played, false); assert.equal(ours.you_unavailable, true);
  assert.ok(!(ours.rubbers as any[]).some(r => r.home === "HUMAN" || r.away === "HUMAN"));
  const v = await teams.read(actor, id);
  assert.equal(v.last!.youUnavailable, true);
  assert.equal(v.you.played, 1, "your record only counts the nights you played");
});

test("county rounds persist a season schedule, play four separate squads once, and build standings from match results", async () => {
  await playCounty(2, 1);
  const scheduled = await rows(sql`SELECT * FROM career_county_fixtures WHERE career_save_id=${id} AND season=2 ORDER BY round`);
  assert.ok(scheduled.length > 0, "full county schedule is saved ahead of play");
  const first = scheduled.find(r => Number(r.week) === 4)!;
  assert.ok(first, "first county round is in the calendar");
  assert.equal(first.status, "SCHEDULED");
  await playCounty(2, 4);
  await playCounty(2, 4);
  const played = (await rows(sql`SELECT * FROM career_county_fixtures WHERE career_save_id=${id} AND season=2 AND week=4`));
  assert.equal(played.length, scheduled.filter(r => Number(r.week) === 4).length);
  assert.ok(played.every(r => r.status === "COMPLETED"), "week progression completes each fixture");
  for (const fixture of played) {
    const matches = fixture.matches as { category: string; team: string }[];
    assert.deepEqual(matches.map(m => `${m.category}:${m.team}`).sort(), ["MEN:A", "MEN:B", "WOMEN:A", "WOMEN:B"]);
  }
  const all = played.flatMap(r => r.matches as never[]);
  assert.ok(countyTables(["ayrshire", "highlands", "north-east", "midlands", "south-wales"], all as never).length > 0);
});

test("County Cup fixtures persist on an existing save and advance to the next week only after ties complete", async () => {
  await playCounty(7, 48);
  const opening = await rows(sql`SELECT round,week,status FROM career_county_fixtures
    WHERE career_save_id=${id} AND season=7 AND round>=100 ORDER BY round`);
  assert.ok(opening.length > 0, "opening knockout ties were saved");
  assert.ok(opening.every(r => Number(r.round) === 101 && Number(r.week) === 48 && r.status === "COMPLETED"));
  await playCounty(7, 49);
  const nextRound = await rows(sql`SELECT round,week,status FROM career_county_fixtures
    WHERE career_save_id=${id} AND season=7 AND round>=100 ORDER BY round`);
  assert.ok(nextRound.some(r => Number(r.round) === 102 && Number(r.week) === 49 && r.status === "COMPLETED"));
});

test("calendar-generated county single selects you from last season and opens the live scorer", async () => {
  const save = await saves.create(1, { slot: 2, careerName: "County Test", dateOfBirth: "1990-01-01", homeLocality: "ayrshire" });
  await career.initialize(actor, save.id);
  await clubs.setCountyCategory(actor, save.id, { category: "MEN" });
  await db.transaction(async tx => playCountyFixtures(tx, await lockRoot(tx, actor, save.id) as never, 2, 1));
  const fixture = (await rows(sql`SELECT * FROM career_county_fixtures WHERE career_save_id=${save.id} AND season=2 AND week=4
    AND (home_key='ayrshire' OR away_key='ayrshire') LIMIT 1`))[0];
  assert.ok(fixture, "the county calendar generated Ayrshire's week-four fixture");
  const awayLocality = String(fixture.home_key) === "ayrshire" ? String(fixture.away_key) : String(fixture.home_key);
  const npcs = await loadNpcs(db as never, save.id, { activeOnly: true, nationality: "GBR" });
  const men = npcs.filter(n => !n.worldKey.startsWith("women:"));
  const sameCounty = men.find(n => localityByRegion(n.homeRegion)?.key === "ayrshire");
  const opponent = men.find(n => localityByRegion(n.homeRegion)?.key === awayLocality);
  assert.ok(sameCounty && opponent, "the selected counties have active men's players");

  const event = (await rows(sql`SELECT id,start_week FROM career_event_instances WHERE career_save_id=${save.id} AND season=1
    AND country='GBR' AND circuit=${CLUB.circuits[0]} AND classification<>'QUALIFIER' LIMIT 1`))[0];
  assert.ok(event, "a prior-season county-points event exists");
  const eventId = String(event.id);
  const transitions = ["REGISTRATION_OPEN","REGISTRATION_CLOSED","DRAW_PENDING","DRAWN","IN_PROGRESS","COMPLETED"];
  await db.execute(sql`UPDATE career_event_instances SET status='REGISTRATION_OPEN' WHERE career_save_id=${save.id} AND id=${eventId}`);
  for (const status of transitions.slice(1, -2))
    await db.execute(sql`UPDATE career_event_instances SET status=${status} WHERE career_save_id=${save.id} AND id=${eventId}`);
  for (const [key, kind, npcId, source] of [
    ["HUMAN","HUMAN",null,"HUMAN_ENTRY"],
    [sameCounty.id,"NPC",sameCounty.id,"SELECTION"],
    [opponent.id,"NPC",opponent.id,"SELECTION"],
  ] as const) {
    await db.execute(sql`INSERT INTO career_event_entries
      (career_save_id,event_id,participant_key,participant_kind,npc_id,source,status,entered_season,entered_week)
      VALUES (${save.id},${eventId},${key},${kind},${npcId},${source},'CONFIRMED',1,${Number(event.start_week)})`);
  }
  await db.execute(sql`UPDATE career_event_instances SET status='IN_PROGRESS' WHERE career_save_id=${save.id} AND id=${eventId}`);
  await db.execute(sql`UPDATE career_event_instances SET status='COMPLETED',champion_participant_key='HUMAN'
    WHERE career_save_id=${save.id} AND id=${eventId}`);
  for (const [key, kind, npcId, position] of [
    ["HUMAN","HUMAN",null,1],
    [sameCounty.id,"NPC",sameCounty.id,2],
    [opponent.id,"NPC",opponent.id,3],
  ] as const) {
    await db.execute(sql`INSERT INTO career_event_results
      (career_save_id,event_id,participant_key,participant_kind,npc_id,season,definition_key,finishing_position,stage_reached,is_champion,
       matches_played,wins,losses,legs_for,legs_against,metadata)
      VALUES (${save.id},${eventId},${key},${kind},${npcId},1,'county-points-fixture',${position},'FINAL',${position===1},
       3,${position===1?3:1},${position===1?0:2},6,4,'{}'::jsonb)`);
  }

  await db.transaction(async tx => playCountyFixtures(tx, await lockRoot(tx, actor, save.id) as never, 2, 4));
  const played = (await rows(sql`SELECT status,matches FROM career_county_fixtures WHERE career_save_id=${save.id} AND season=2
    AND week=4 AND (home_key='ayrshire' OR away_key='ayrshire') LIMIT 1`))[0];
  assert.equal(played.status, "IN_PROGRESS");
  const single = (played.matches as {category:string;team:string;humanMatch?:{id:string;status:string}}[])
    .find(m => m.category === "MEN" && m.team === "A" && m.humanMatch);
  assert.ok(single?.humanMatch, "calendar selection generated a human A-squad single");
  const session = await countyLive.read(actor, save.id, single.humanMatch.id);
  assert.equal(session.status, "LIVE");
  assert.ok(session.opponent.name);
});

test("county squad category is save-scoped and the season schedule is visible before round one", async () => {
  const before = await clubs.read(actor, id);
  assert.equal(before.county?.category, null);
  assert.ok((before.county?.fixtures.length ?? 0) > 0, "future fixtures appear when the player opens the club page");
  await clubs.setCountyCategory(actor, id, { category: "WOMEN" });
  assert.equal((await clubs.read(actor, id)).county?.category, "WOMEN");
  await playCounty(1, 4);
  await assert.rejects(() => clubs.setCountyCategory(actor, id, { category: "MEN" }), /cannot be changed after your county season has started/);
});

test("county singles use the live scorer log, update the fixture once, and then release Career advance", async () => {
  const matchId = "00000000-0000-4000-8000-000000000001";
  const match = { category: "MEN", team: "A", home: "ayrshire", away: "highlands", homeSets: 0, awaySets: 0,
    homeLegs: 0, awayLegs: 0, homeAverage: 0, awayAverage: 0, youPlayed: true,
    humanMatch: { id: matchId, category: "MEN", team: "A", homeSide: true, opponentKey: "npc", opponentName: "County Opponent",
      bot: { avg: 60, sd: 12, checkoutPct: 0.4, hitAcc: 0.6 }, seed: "county-bot-seed", bestOf: 1, darts: [], status: "LIVE" } };
  await db.execute(sql`INSERT INTO career_county_fixtures (career_save_id,season,round,week,home_key,away_key,status,matches)
    VALUES (${id},9,99,999,'ayrshire','highlands','IN_PROGRESS',${JSON.stringify([match])}::jsonb)`);
  const session = await countyLive.read(actor, id, matchId);
  assert.equal(session.status, "LIVE");
  assert.equal(session.format.unit, "LEGS");
  assert.equal(session.opponent.name, "County Opponent");
  const t20 = { segment: 20, multiplier: 3, value: 60 }, t19 = { segment: 19, multiplier: 3, value: 57 };
  const miss = { segment: 0, multiplier: 1, value: 0 }, d12 = { segment: 12, multiplier: 2, value: 24 };
  const darts = [t20,t20,t20, miss,miss,miss, t20,t20,t20, miss,miss,miss, t20,t19,d12];
  const done = await countyLive.darts(actor, id, matchId, { darts });
  assert.equal(done.status, "PLAYED"); assert.equal(done.won, true);
  const row = (await rows(sql`SELECT status,matches FROM career_county_fixtures WHERE career_save_id=${id} AND season=9 AND round=99`))[0];
  const finalMatches = row.matches as { homeSets: number; humanMatch: { status: string } }[];
  assert.equal(row.status, "COMPLETED");
  assert.equal(finalMatches[0].homeSets, 1);
  assert.equal(finalMatches[0].humanMatch.status, "PLAYED");
  await countyLive.darts(actor, id, matchId, { darts });
  const again = (await rows(sql`SELECT matches FROM career_county_fixtures WHERE career_save_id=${id} AND season=9 AND round=99`))[0];
  assert.equal((again.matches as { homeSets: number }[])[0].homeSets, 1, "retrying the completed scorer log cannot add a second set");
});

test("Continue pauses for a live club single, resumes the same week, and records it once", async () => {
  const save = await saves.create(1, { slot: 3, careerName: "Team calendar", dateOfBirth: "1990-03-02", homeLocality: "ayrshire" });
  await career.initialize(actor, save.id);
  await teams.join(actor, save.id);
  const next = (await teams.read(actor, save.id)).next!;
  assert.equal(next.youFree, true, "the fresh save can play its first scheduled club night");

  let request: { operationKey: string; expectedSeason: number; expectedWeek: number; target: { kind: "WEEKS"; weeks: number } } | undefined;
  let blocked: any;
  for (let weekGuard = 0; weekGuard < 52 && !blocked; weekGuard++) {
    const current = await saves.read(1, save.id);
    request = {
      operationKey: `team-calendar-${save.id}-${current.currentSeason}-${current.currentWeek}`,
      expectedSeason: current.currentSeason,
      expectedWeek: current.currentWeek,
      target: { kind: "WEEKS", weeks: 1 },
    };
    for (let retry = 0; retry < 12; retry++) {
      const result = await career.calendar.advance(actor, save.id, request) as any;
      if (result.stop.reason === "HUMAN_MATCH_PENDING") {
        for (const matchId of result.stop.detail.matchIds as string[]) {
          const row = (await rows(sql`SELECT event_id FROM career_tournament_matches WHERE career_save_id=${save.id} AND id=${matchId}`))[0];
          await career.calendar.quickSimMatch(actor, save.id, String(row.event_id), { matchId, confirmation: "QUICK_SIM" });
        }
        continue;
      }
      if (result.stop.reason === "TEAM_MATCH_PENDING") blocked = result;
      else {
        const current = await saves.read(1, save.id);
        const fixtures = await rows(sql`SELECT week,status,you_played,rubbers FROM career_club_fixtures WHERE career_save_id=${save.id} AND season=1`);
        assert.ok(current.currentWeek <= next.week, `advance must not skip the first team night (stop=${result.stop.reason}, current=${current.currentWeek}, fixture=${next.week}, teamRows=${JSON.stringify(fixtures)})`);
      }
      break;
    }
  }
  assert.ok(blocked, "the calendar reaches the player's live team single");
  assert.equal(blocked.stop.reason, "TEAM_MATCH_PENDING");
  assert.equal(blocked.to.week, next.week, "the calendar remains on the fixture week");
  const matchId = String(blocked.stop.detail.matchId);
  const repeatedBlock = await career.calendar.advance(actor, save.id, request!) as any;
  assert.equal(repeatedBlock.stop.reason, "TEAM_MATCH_PENDING");
  assert.equal(repeatedBlock.stop.detail.matchId, matchId, "retrying while live returns the same single");

  const miss = { segment: 0, multiplier: 1 as const, value: 0 };
  const t20 = { segment: 20, multiplier: 3 as const, value: 60 };
  const t19 = { segment: 19, multiplier: 3 as const, value: 57 };
  const d12 = { segment: 12, multiplier: 2 as const, value: 24 };
  const darts = Array.from({ length: 3 }, (_, leg) => [
    ...(leg % 2 ? Array(3).fill(miss) : []),
    ...Array(3).fill(t20), ...Array(3).fill(miss),
    ...Array(3).fill(t20), ...Array(3).fill(miss), t20, t19, d12,
  ]).flat();
  const played = await teams.darts(actor, save.id, matchId, { darts });
  assert.equal(played.status, "PLAYED");

  const resumed = await career.calendar.advance(actor, save.id, request!) as any;
  const after = await saves.read(1, save.id);
  assert.equal(after.currentWeek, next.week + 1, "finishing the single releases exactly that calendar week");
  assert.equal(resumed.to.week, after.currentWeek);
  const again = await career.calendar.advance(actor, save.id, request!) as any;
  assert.equal(again.to.week, after.currentWeek, "retrying a completed advance is idempotent");
  assert.equal((await saves.read(1, save.id)).currentWeek, after.currentWeek);

  const record = await teams.read(actor, save.id);
  assert.equal(record.you.played, 1, "the real player receives exactly one appearance");
  const fixture = (await rows(sql`SELECT you_played,status FROM career_club_fixtures
    WHERE career_save_id=${save.id} AND season=1 AND week=${next.week} AND (home_key='ayrshire' OR away_key='ayrshire')`))[0];
  assert.equal(fixture.you_played, true);
  assert.equal(fixture.status, "COMPLETED");
});

test("county trial invitations count only completed singles the player actually played and persist once", async () => {
  await db.execute(sql`INSERT INTO career_club_team_memberships(career_save_id,season,club_key,joined_week)
    VALUES (${id},100,'ayrshire',1)`);
  const addRubber = async (round: number, humanMatch?: { status: string; won?: boolean }) => {
    const rubbers = [{ home: "HUMAN", away: "npc", homeLegs: 3, awayLegs: 1, averages: [70, 65], ...(humanMatch ? { humanMatch } : {}) }];
    await db.execute(sql`INSERT INTO career_club_fixtures(career_save_id,season,round,week,home_key,away_key,home_score,away_score,rubbers,status)
      VALUES (${id},100,${round},${round + 3},'ayrshire','other',1,0,${JSON.stringify(rubbers)}::jsonb,'COMPLETED')`);
  };
  await addRubber(1, { status: "PLAYED", won: true });
  await addRubber(2, { status: "PLAYED", won: true });
  await addRubber(3, { status: "PLAYED", won: false });
  await addRubber(4, { status: "PLAYED", won: false });
  await addRubber(5); // team-mate cover must not count as the player's appearance
  const short = await db.transaction(tx => ensureCountyTrialInvitation(tx, id, 101));
  assert.equal(short.status, "NOT_EARNED");
  assert.deepEqual(await clubTrialRecord(db, id, 100), { appearances: 4, wins: 2 });
  await addRubber(6, { status: "PLAYED", won: true });
  const invited = await db.transaction(tx => ensureCountyTrialInvitation(tx, id, 101));
  assert.equal(invited.status, "INVITED");
  assert.equal(invited.appearances, 5);
  assert.equal(invited.wins, 3);
  await db.execute(sql`UPDATE career_county_trials SET status='LIVE' WHERE career_save_id=${id} AND season=101`);
  assert.equal((await db.transaction(tx => ensureCountyTrialInvitation(tx, id, 101))).status, "LIVE", "re-reading an invitation must not reset an in-progress trial");
  await repairCareerSchema(db);
  assert.ok((await rows(sql`SELECT to_regclass('career_county_trials') AS table_name`))[0].table_name);
});
