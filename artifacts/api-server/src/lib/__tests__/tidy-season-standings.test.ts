import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { checkSinglesSeasonTables, tidySinglesSeasonTables, restoreRemovedStandings } from "../tidy-season-standings.ts";

async function setup() {
  const pg = new PGlite(); const db = drizzle(pg);
  await pg.exec(`
    CREATE TABLE players (id int primary key, name text);
    CREATE TABLE seasons (id int primary key, name text, start_date timestamptz, end_date timestamptz, is_active boolean, league_type text);
    CREATE TABLE season_standings (id serial primary key, season_id int, player_id int, position int, wins int, losses int, points int, elo int, is_champion boolean);
    CREATE TABLE matches (id serial primary key, season_id int, winner_id int, loser_id int, played_at timestamptz);
    INSERT INTO players VALUES (10,'Sean'),(11,'Rob'),(12,'Graeme'),(13,'Idle'),(14,'Scott'),(15,'Kyle');
    INSERT INTO seasons VALUES (3,'June','2026-06-01','2026-06-30',false,'singles'),(4,'Doubles','2026-06-01','2026-06-30',false,'doubles'),(5,'Now','2026-07-01',null,true,'singles');
    -- June's table says Graeme is 0-0, but he has match rows in June: he must stay (and is flagged as a mismatch).
    INSERT INTO season_standings (season_id,player_id,position,wins,losses,points,elo,is_champion) VALUES
      (3,10,1,5,0,49,1100,true),(3,11,2,1,1,26,1000,false),(3,12,3,0,0,25,1000,false),(3,13,4,0,0,25,1000,false),(3,14,5,1,1,24,1000,false),(3,15,6,0,1,23,1000,false),
      (4,13,1,0,0,25,1000,false),(5,13,1,0,0,25,1000,false);
    INSERT INTO matches (season_id,winner_id,loser_id,played_at) VALUES (3,10,11,'2026-06-02'),(3,12,14,'2026-06-03'),(NULL,12,15,'2026-06-04');`);
  return { pg, db };
}

test("only players with a 0-0 row AND no match rows come off; match rows win over a wrong table; restore undoes it", async () => {
  const { pg, db } = await setup();
  const check = await checkSinglesSeasonTables(db as never);
  assert.equal(check.length, 1, "only finished singles seasons");
  const june = check[0];
  assert.deepEqual(june.remove, [13], "Idle never played; Graeme has June matches so stays");
  assert.ok(june.mismatches.includes(12), "Graeme's 0-0 row disagrees with his 2 June wins");
  assert.equal(june.rows.find(r => r.playerId === 12)?.matchWins, 2, "untagged match inside June's dates counts");
  const r = await tidySinglesSeasonTables(db as never);
  assert.deepEqual(r.removed, [{ seasonId: 3, playerId: 13 }]);
  const rows = (await pg.query<{ player_id: number; position: number }>("SELECT player_id, position FROM season_standings WHERE season_id=3 ORDER BY position")).rows;
  assert.deepEqual(rows.map(x => [x.player_id, x.position]), [[10, 1], [11, 2], [12, 3], [14, 4], [15, 5]]);
  assert.equal((await tidySinglesSeasonTables(db as never)).removed.length, 0, "second run changes nothing");
  assert.equal(await restoreRemovedStandings(db as never), 1);
  const back = (await pg.query<{ player_id: number; position: number }>("SELECT player_id, position FROM season_standings WHERE season_id=3 ORDER BY position")).rows;
  assert.deepEqual(back.map(x => [x.player_id, x.position]), [[10, 1], [11, 2], [12, 3], [13, 4], [14, 5], [15, 6]], "restore puts it back exactly");
});
