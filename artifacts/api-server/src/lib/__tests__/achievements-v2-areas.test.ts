import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { evaluateDoubles, evaluateShiftWars, evaluatePractice, evaluateMaster501, evaluateModes, shadowLevel } from "../achievements-v2/areas.ts";
import { evaluate, catalogueFor } from "../achievements-v2/evaluate.ts";
import { CATALOGUE } from "../achievements-v2/catalogue.ts";
import { allHistoryCredit, reportHtml, seasonFinder } from "../achievements-v2/report.ts";

const at = (d: string) => new Date(d + "T19:00:00Z");

test("every catalogue key is unique and every non-league metric is produced by an evaluator", () => {
  const keys = CATALOGUE.map(d => d.key); assert.equal(new Set(keys).size, keys.length);
  const produced = new Set([
    ...Object.keys(evaluateDoubles({ playerId: 1, teams: [], results: [], finishedSeasons: new Set() }).metrics),
    ...Object.keys(evaluateShiftWars({ departmentId: 1, results: [], championMonths: [], seasonsOnRota: 0 }, () => 1).metrics),
    ...Object.keys(evaluatePractice([], () => 1).metrics), ...Object.keys(evaluateMaster501([]).metrics), ...Object.keys(evaluateModes([], [], [], new Date()).metrics),
  ]);
  for (const d of CATALOGUE.filter(d => d.kind === "TRACK" && d.area !== "LEAGUE")) assert.ok(produced.has(d.metric), `${d.key} uses ${d.metric}`);
});

test("doubles: partners, teams beaten, the solo side, a run of 5 and a table-topping season", () => {
  const teams = [
    { id: 1, seasonId: 1, players: [10, 11], points: 120, wins: 6, losses: 0, isEliminated: false },
    { id: 2, seasonId: 1, players: [12, 13], points: 40, wins: 0, losses: 5, isEliminated: false },
    { id: 3, seasonId: 1, players: [14, 15], points: 30, wins: 0, losses: 1, isEliminated: false },
  ];
  const results = [1, 2, 3, 4, 5].map(i => ({ teamId: 1, opponentTeamIds: [2], won: true, stake: i === 5 ? 20 : 5, playedAt: at(`2026-01-0${i}`), kind: "MATCH" as const, seasonId: 1 }));
  results.push({ teamId: 1, opponentTeamIds: [2, 3], won: true, stake: 5, playedAt: at("2026-01-09"), kind: "COMBINED_SOLO" as never, seasonId: 1 });
  const f = evaluateDoubles({ playerId: 10, teams, results, finishedSeasons: new Set([1]) });
  assert.deepEqual([f.metrics.teamWins, f.metrics.partnersWonWith, f.metrics.teamsBeaten, f.metrics.teamSeasons], [6, 1, 2, 1]);
  for (const k of ["inSync", "safePair", "loneWolf", "topPair", "neverSplit"]) assert.ok(f.feats[k], k);
  assert.equal(f.seasons.get(1)?.seasonTeamWins, 6);
});

test("shift wars credits the department, keyed by league season; no department means nothing", () => {
  const results = [0, 1, 2].map(i => ({ won: i !== 1, stake: i === 2 ? 25 : 5, playedAt: new Date(Date.UTC(2026, 0, 6, 18 + i)), opponentTeamIds: [2 + (i % 2)], kind: (i === 0 ? "MULTI" : "MATCH") as "MULTI" | "MATCH" }));
  const f = evaluateShiftWars({ departmentId: 1, results, championMonths: [{ seasonId: 1, at: at("2026-01-31") }], seasonsOnRota: 1 }, () => 1);
  assert.deepEqual([f.metrics.deptWins, f.metrics.deptMatches, f.metrics.deptsBeaten], [2, 3, 1]);
  for (const k of ["nightShift", "bigShift", "overtime", "employeeOfMonth"]) assert.ok(f.feats[k], k);
  assert.deepEqual(f.seasons.get(1), { monthMatches: 3, monthWeeks: 1 });
  assert.deepEqual(evaluateShiftWars({ departmentId: null, results, championMonths: [], seasonsOnRota: 0 }, () => 1).metrics, {});
});

test("practice: streaks, last-100 checkout rate, Shadow level and season goals", () => {
  const sessions = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-05", "2026-02-02"].map((d, i) => ({ gameTypeKey: i % 2 ? "501" : "atc", darts: i === 4 ? 300 : 60,
    score: i === 4 ? 6000 : 1000, s180: 1, checkoutAttempts: 25, checkoutHits: i === 4 ? 10 : 5, won: null, createdAt: at(d) }));
  const f = evaluatePractice(sessions, d => (d.getUTCMonth() === 0 ? 1 : 2));
  assert.deepEqual([f.metrics.practiceSessions, f.metrics.practiceDays, f.metrics.practiceStreak, f.metrics.practiceGames], [5, 5, 3, 2]);
  assert.equal(f.metrics.practiceCheckoutRate, 25, "most recent sessions until 100 darts at a double: 25/100");
  assert.equal(f.metrics.shadowLevel, shadowLevel(540, 10000)); assert.equal(shadowLevel(540, 10000), 1, "55.6 average"); assert.equal(shadowLevel(150, 4100), 3, "82 average");
  assert.ok(f.feats.longSession);
  assert.equal(f.seasons.get(2)?.seasonRateUp, 0, "season 2 has under 30 attempts, so no comparison");
  assert.equal(f.seasons.get(1)?.seasonPracticeDays, 4);
});

test("master-501: ladder position, best run and feats", () => {
  const runs = [[1, 1, 3, 2, 0], [1, 2, 3, 2, 1], [1, 3, 5, 3, 0], [2, 1, 5, 1, 3]].map(([tier, round, legsFormat, legsWon, legsLost], i) => ({
    tier, round, legsFormat, legsWon, legsLost, result: legsWon > legsLost ? "win" : "loss", completedAt: at(`2026-01-0${i + 1}`) }));
  const f = evaluateMaster501(runs);
  assert.deepEqual([f.metrics.m501Ladder, f.metrics.m501Runs, f.metrics.m501Wins, f.metrics.m501Run], [3, 4, 3, 3]);
  assert.ok(f.feats.flawless); assert.ok(f.feats.lastGasp); assert.ok(f.feats.cleanTier); assert.equal(f.feats.worldChampion, undefined);
  const states = evaluate(catalogueFor("MASTER501"), f);
  const ladder = states.find(s => s.key === "m501-ladder"); assert.ok(ladder?.kind === "TRACK"); assert.equal(ladder.level, 3); assert.equal(ladder.metal, "BRONZE");
});

test("board curse and boss battle from their totals", () => {
  const now = new Date("2026-11-18T00:00:00Z");
  const f = evaluateModes([{ format: "bot", wins: 3, losses: 1 }, { format: "local", wins: 1, losses: 0 }], [{ bestVisits: 11, bestStreak: 7 }],
    [{ bossId: "rookie-wall", attempts: 1, wins: 1, cleanSweep: true, highestAscension: 2 }, { bossId: "old-jinx", attempts: 6, wins: 1, cleanSweep: false, highestAscension: 0 }], now);
  assert.deepEqual([f.metrics.bcWins, f.metrics.bcStreak, f.metrics.bossesDefeated, f.metrics.bossAscension], [4, 7, 2, 2]);
  for (const k of ["quickClear", "bothSides", "firstTime", "neverGaveUp", "bossCleanSweep"]) assert.equal(f.feats[k]?.getTime(), now.getTime(), k);
});

test("seasonFinder puts a date in the season it falls in, with the active season open-ended", () => {
  const find = seasonFinder([{ id: 1, startDate: at("2026-01-01"), endDate: at("2026-01-31"), isActive: false }, { id: 2, startDate: at("2026-02-01"), endDate: null, isActive: true }]);
  assert.equal(find(at("2026-01-15")), 1); assert.equal(find(at("2026-03-15")), 2); assert.equal(find(at("2025-12-15")), null);
});

test("the full report reads every area's tables, saves nothing and gives one section per area", async () => {
  const pg = new PGlite(); const db = drizzle(pg);
  await pg.exec(`
    CREATE TABLE players (id int primary key, name text, career_peak_elo int, eliminations_count int, longest_win_streak int, shift_wars_team_id int);
    CREATE TABLE seasons (id int primary key, start_date timestamptz, end_date timestamptz, is_active boolean, champion_id int);
    CREATE TABLE season_standings (season_id int, player_id int, position int, wins int, losses int, points int, is_champion boolean);
    CREATE TABLE matches (id serial primary key, season_id int, winner_id int, loser_id int, stake int, elo_change int, game_type text, played_at timestamptz,
      winner_darts int, winner_100s int, winner_140s int, winner_170s int, winner_180s int, winner_checkout_attempts int, winner_checkout_hits int,
      loser_darts int, loser_100s int, loser_140s int, loser_170s int, loser_180s int, loser_checkout_attempts int, loser_checkout_hits int);
    CREATE TABLE doubles_teams (id int primary key, season_id int, player1_id int, player2_id int, player3_id int, team_name text, points int, peak_points int, elo int, wins int, losses int, is_eliminated boolean);
    CREATE TABLE doubles_matches (id serial primary key, season_id int, winner_team_id int, loser_team_id int, stake int, elo_change int, game_type text, played_at timestamptz);
    CREATE TABLE doubles_combined_matches (id serial primary key, season_id int, played_at timestamp, solo_team_id int, solo_won boolean, stake int);
    CREATE TABLE doubles_combined_match_sides (id serial primary key, match_id int, team_id int);
    CREATE TABLE doubles_multi_matches (id serial primary key, season_id int, played_at timestamp, winner_team_id int, stake int);
    CREATE TABLE doubles_multi_match_participants (id serial primary key, match_id int, team_id int, is_winner boolean);
    CREATE TABLE shift_wars_matches (id serial primary key, winner_team_id int, loser_team_id int, stake int, played_at timestamptz);
    CREATE TABLE shift_wars_multi_matches (id serial primary key, season_id int, played_at timestamp, winner_team_id int, stake int);
    CREATE TABLE shift_wars_multi_match_participants (id serial primary key, match_id int, team_id int, is_winner boolean);
    CREATE TABLE shift_wars_combined_matches (id serial primary key, played_at timestamp, solo_team_id int, solo_won boolean, stake int);
    CREATE TABLE shift_wars_combined_match_sides (id serial primary key, match_id int, team_id int);
    CREATE TABLE shift_wars_season_history (id serial primary key, season_id int, team_id int, is_champion boolean, recorded_at timestamptz);
    CREATE TABLE practice_sessions (id serial primary key, player1_id int, game_type_key text, p1_darts int, p1_score int, p1_180s int, p1_checkout_attempts int, p1_checkout_hits int, winner_idx int, created_at timestamptz);
    CREATE TABLE master501_runs (id serial primary key, player_id int, tier int, round int, dart_limit int, legs_format int, legs_won int, legs_lost int, result text, completed_at timestamptz);
    CREATE TABLE board_curse_records (player_id int, format text, wins int, losses int);
    CREATE TABLE board_curse_best (player_id int, game_type text, best_visits int, best_streak int);
    CREATE TABLE boss_battle_stats (player_id int, boss_id text, attempts int, wins int, best_seconds int, clean_sweep boolean, highest_ascension int);
    INSERT INTO players VALUES (1,'Alice',1100,0,2,1),(2,'Bob',1000,0,0,2),(3,'Cara',1000,0,0,null),(4,'Dan',1000,0,0,null);
    INSERT INTO seasons VALUES (1,'2026-01-01','2026-01-31',false,1),(2,'2026-02-01',null,true,null);
    INSERT INTO matches (season_id,winner_id,loser_id,stake,elo_change,game_type,played_at) VALUES (1,1,2,5,8,'501','2026-01-05');
    INSERT INTO doubles_teams VALUES (1,1,1,3,null,'A',90,90,1000,2,0,false),(2,1,2,4,null,'B',40,50,1000,0,2,false);
    INSERT INTO doubles_matches (season_id,winner_team_id,loser_team_id,stake,played_at) VALUES (1,1,2,5,'2026-01-06'),(1,1,2,5,'2026-01-07');
    INSERT INTO shift_wars_matches (winner_team_id,loser_team_id,stake,played_at) VALUES (1,2,20,'2026-01-08');
    INSERT INTO shift_wars_season_history (season_id,team_id,is_champion,recorded_at) VALUES (1,1,true,'2026-01-31'),(1,2,false,'2026-01-31');
    INSERT INTO practice_sessions (player1_id,game_type_key,p1_darts,p1_score,p1_180s,p1_checkout_attempts,p1_checkout_hits,created_at) VALUES (3,'501',60,1200,1,10,3,'2026-01-10');
    INSERT INTO master501_runs (player_id,tier,round,dart_limit,legs_format,legs_won,legs_lost,result,completed_at) VALUES (4,1,1,30,3,2,0,'win','2026-01-11');
    INSERT INTO board_curse_records VALUES (2,'bot',2,1);
    INSERT INTO boss_battle_stats VALUES (2,'rookie-wall',1,1,90,false,0);`);
  const reports = await allHistoryCredit(db as never);
  assert.deepEqual(reports.map(r => r.area), ["LEAGUE", "TEAMS", "PRACTICE", "MASTER501", "MODES"]);
  const teams = reports.find(r => r.area === "TEAMS")!.summary;
  assert.equal(teams.players, 4, "Alice and Bob by department and doubles, Cara and Dan by doubles");
  assert.equal(teams.feats.find(f => f.key === "employee-of-the-month")?.earned, 1);
  assert.equal(teams.feats.find(f => f.key === "big-shift")?.earned, 1);
  assert.equal(teams.tracks.find(t => t.key === "doubles-wins")?.BRONZE, 2, "Alice and Cara: 2 wins");
  assert.equal(reports.find(r => r.area === "PRACTICE")!.summary.players, 1);
  assert.equal(reports.find(r => r.area === "MASTER501")!.summary.ranked[0].name, "Dan");
  assert.equal(reports.find(r => r.area === "MODES")!.summary.feats.find(f => f.key === "first-time")?.earned, 1);
  const html = reportHtml(reports);
  for (const id of ["league", "teams", "practice", "master501", "modes"]) assert.ok(html.includes(`id="${id}"`), id);
  assert.equal(Number((await pg.query<{ n: number }>("SELECT count(*)::int AS n FROM doubles_matches")).rows[0].n), 2, "nothing written");
});

test("teams fun ones: Inseparable, Three's company, Reunited, debut, Friday feeling and Full rota", () => {
  const teams = [
    { id: 1, seasonId: 1, players: [10, 11, 12], points: 120, wins: 3, losses: 0, isEliminated: false },
    { id: 2, seasonId: 1, players: [13, 14], points: 40, wins: 0, losses: 3, isEliminated: false },
    { id: 3, seasonId: 2, players: [10, 11], points: 60, wins: 1, losses: 1, isEliminated: false },
  ];
  const results = [1, 2, 3].map(i => ({ teamId: 1, opponentTeamIds: [2], won: true, stake: 5, playedAt: at(`2026-01-0${i}`), kind: "MATCH" as const, seasonId: 1 }));
  results.push({ teamId: 3, opponentTeamIds: [2], won: true, stake: 5, playedAt: at("2026-02-03"), kind: "MATCH" as const, seasonId: 2 });
  const f = evaluateDoubles({ playerId: 10, teams, results, finishedSeasons: new Set([1]) });
  for (const k of ["inseparable", "threesCompany", "reunited", "doublesDebut"]) assert.ok(f.feats[k], k);
  const g = evaluateDoubles({ playerId: 13, teams, results: results.map(r => ({ ...r, teamId: 2, won: false })), finishedSeasons: new Set([1]) });
  assert.equal(g.feats.inseparable, undefined); assert.equal(g.feats.doublesDebut, undefined);

  // a Friday (2026-01-09) win, and a match in each of the three weeks of season 1
  const shift = ["2026-01-05", "2026-01-09", "2026-01-14", "2026-01-19"].map((d, i) => ({ won: i === 1, stake: 5, playedAt: at(d), opponentTeamIds: [2], kind: "MATCH" as const }));
  const s = evaluateShiftWars({ departmentId: 1, results: shift, championMonths: [], seasonsOnRota: 1, seasonWeeks: new Map([[1, 3]]) }, () => 1);
  assert.ok(s.feats.fridayFeeling); assert.ok(s.feats.fullRota);
  const s2 = evaluateShiftWars({ departmentId: 1, results: shift.slice(0, 2), championMonths: [], seasonsOnRota: 1, seasonWeeks: new Map([[1, 3]]) }, () => 1);
  assert.equal(s2.feats.fullRota, undefined, "missed a week");
});

test("seasonWeeks counts the Monday-start weeks a finished season touched", async () => {
  const { seasonWeeks } = await import("../achievements-v2/report.ts");
  const w = seasonWeeks([{ id: 1, startDate: at("2026-01-01"), endDate: at("2026-01-31"), isActive: false }, { id: 2, startDate: at("2026-02-01"), endDate: null, isActive: true }]);
  assert.equal(w.get(1), 5); assert.equal(w.has(2), false);
});
