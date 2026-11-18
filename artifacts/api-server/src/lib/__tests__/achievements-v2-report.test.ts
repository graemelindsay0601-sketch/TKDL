import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { leagueHistoryCredit, reportHtml, summarise } from "../achievements-v2/report.ts";

test("history credit report reads the league tables, saves nothing and summarises by metal", async () => {
  const pg = new PGlite(); const db = drizzle(pg);
  await pg.exec(`
    CREATE TABLE players (id int primary key, name text, career_peak_elo int, eliminations_count int, longest_win_streak int);
    CREATE TABLE seasons (id int primary key, start_date timestamptz, end_date timestamptz, is_active boolean, champion_id int);
    CREATE TABLE season_standings (season_id int, player_id int, position int, wins int, losses int, points int, is_champion boolean);
    CREATE TABLE matches (id serial primary key, season_id int, winner_id int, loser_id int, stake int, elo_change int, game_type text, played_at timestamptz,
      winner_darts int, winner_100s int, winner_140s int, winner_170s int, winner_180s int, winner_checkout_attempts int, winner_checkout_hits int,
      loser_darts int, loser_100s int, loser_140s int, loser_170s int, loser_180s int, loser_checkout_attempts int, loser_checkout_hits int);
    INSERT INTO players VALUES (1,'Alice',1180,3,4),(2,'Bob',1010,0,1),(3,'Cara',1000,0,0);
    INSERT INTO seasons VALUES (1,'2026-01-01','2026-01-31',false,1),(2,'2026-02-01',null,true,null);
    INSERT INTO season_standings VALUES (1,1,1,6,1,160,true),(1,2,2,1,4,60,false),(1,3,3,1,3,70,false);
    INSERT INTO matches (season_id,winner_id,loser_id,stake,elo_change,game_type,played_at,winner_darts,winner_180s,loser_darts,loser_180s)
      SELECT 1, 1, 2 + (g % 2), 10, 12, '501', '2026-01-05'::timestamptz + (g || ' hours')::interval, 40, 1, 42, 0 FROM generate_series(1, 6) g;
    INSERT INTO matches (season_id,winner_id,loser_id,stake,elo_change,game_type,played_at) VALUES (1,2,1,5,8,'301','2026-01-20'),(1,3,2,5,8,'501','2026-01-21'),(2,1,3,5,8,'501','2026-02-03');`);
  const players = await leagueHistoryCredit(db as never);
  assert.equal(players.length, 3);
  const alice = players.find(p => p.name === "Alice")!;
  const wins = alice.states.find(s => s.key === "league-wins"); assert.ok(wins?.kind === "TRACK"); assert.equal(wins.value, 7); assert.equal(wins.level, 2);
  const titles = alice.states.find(s => s.key === "titles"); assert.ok(titles?.kind === "TRACK"); assert.equal(titles.level, 1);
  const s = summarise(players);
  assert.equal(s.players, 3); assert.equal(s.ranked[0].name, "Alice");
  assert.equal(s.tracks.find(t => t.key === "league-180s")?.BRONZE, 1, "Alice: 6 scorer 180s is level 2 of 6 = Bronze");
  assert.match(reportHtml(s), /What history credit would give|what history credit would give/i);
  assert.equal(Number((await pg.query<{ n: number }>("SELECT count(*)::int AS n FROM matches")).rows[0].n), 9, "nothing written");
});
