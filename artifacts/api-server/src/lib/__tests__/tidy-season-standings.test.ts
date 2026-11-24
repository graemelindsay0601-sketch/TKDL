import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { tidySinglesSeasonStandings } from "../tidy-season-standings.ts";

test("finished Singles seasons drop 0–0 players, renumber the rest, keep a backup, and leave other seasons alone", async () => {
  const pg = new PGlite(); const db = drizzle(pg);
  await pg.exec(`
    CREATE TABLE seasons (id int primary key, is_active boolean, league_type text);
    CREATE TABLE season_standings (id serial primary key, season_id int, player_id int, position int, wins int, losses int, points int, elo int, is_champion boolean);
    INSERT INTO seasons VALUES (3,false,'singles'),(4,false,'doubles'),(5,true,'singles');
    INSERT INTO season_standings (season_id,player_id,position,wins,losses,points,elo,is_champion) VALUES
      (3,10,1,5,0,49,1100,true),(3,11,2,1,1,26,1000,false),(3,12,3,0,0,25,1000,false),(3,13,4,0,0,25,1000,false),(3,14,5,1,1,24,1000,false),(3,15,6,0,1,23,1000,false),
      (4,12,1,0,0,25,1000,false),
      (5,12,1,0,0,25,1000,false);`);
  const r = await tidySinglesSeasonStandings(db as never);
  assert.deepEqual(r.removed.map(x => x.playerId), [12, 13]);
  const rows = (await pg.query<{ player_id: number; position: number }>("SELECT player_id, position FROM season_standings WHERE season_id=3 ORDER BY position")).rows;
  assert.deepEqual(rows.map(x => [x.player_id, x.position]), [[10, 1], [11, 2], [14, 3], [15, 4]]);
  assert.deepEqual(r.moved, [{ seasonId: 3, playerId: 14, from: 5, to: 3 }, { seasonId: 3, playerId: 15, from: 6, to: 4 }]);
  assert.equal((await pg.query<{ n: number }>("SELECT count(*)::int n FROM season_standings_removed")).rows[0].n, 2);
  assert.equal((await pg.query<{ n: number }>("SELECT count(*)::int n FROM season_standings WHERE season_id IN (4,5)")).rows[0].n, 2, "doubles and the live season untouched");
  const again = await tidySinglesSeasonStandings(db as never);
  assert.equal(again.removed.length + again.moved.length, 0, "second run changes nothing");
});
