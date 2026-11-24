import { sql } from "drizzle-orm";

/**
 * Past Singles season tables used to include everyone on the roster, even
 * players who never played a match that season (0 wins, 0 losses), and they
 * took real places (a 0–0 player on the starting 25 points could sit 3rd).
 * The season close now leaves them out (finalStandingsOrder); this applies the
 * same rule to seasons already closed:
 *  - 0–0 rows of finished Singles seasons are copied to
 *    season_standings_removed, then removed from season_standings
 *  - the remaining rows are renumbered 1..n in their existing order
 * A champion row is never removed. Safe to run on every boot: once a season
 * is tidy there is nothing left to change.
 */
type Db = { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }> };

export type TidyResult = { removed: { seasonId: number; playerId: number; position: number }[]; moved: { seasonId: number; playerId: number; from: number; to: number }[] };

export async function tidySinglesSeasonStandings(db: Db): Promise<TidyResult> {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS season_standings_removed (
    season_id integer NOT NULL, player_id integer NOT NULL, position integer, wins integer, losses integer,
    points integer, elo integer, is_champion boolean, removed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (season_id, player_id))`);

  const doomed = (await db.execute(sql`
    SELECT ss.season_id, ss.player_id, ss.position
    FROM season_standings ss JOIN seasons s ON s.id = ss.season_id
    WHERE s.is_active = false AND COALESCE(s.league_type, 'singles') = 'singles'
      AND COALESCE(ss.wins, 0) + COALESCE(ss.losses, 0) = 0 AND COALESCE(ss.is_champion, false) = false
    ORDER BY ss.season_id, ss.position`)).rows as { season_id: number; player_id: number; position: number }[];
  if (doomed.length === 0) return { removed: [], moved: [] };

  const seasons = [...new Set(doomed.map(r => Number(r.season_id)))];
  const before = new Map<string, number>();
  for (const sid of seasons) {
    const rows = (await db.execute(sql`SELECT player_id, position FROM season_standings WHERE season_id = ${sid}`)).rows as { player_id: number; position: number }[];
    for (const r of rows) before.set(`${sid}:${r.player_id}`, Number(r.position));
  }

  for (const r of doomed) {
    await db.execute(sql`INSERT INTO season_standings_removed (season_id, player_id, position, wins, losses, points, elo, is_champion)
      SELECT season_id, player_id, position, wins, losses, points, elo, is_champion FROM season_standings
      WHERE season_id = ${r.season_id} AND player_id = ${r.player_id}
      ON CONFLICT (season_id, player_id) DO NOTHING`);
    await db.execute(sql`DELETE FROM season_standings WHERE season_id = ${r.season_id} AND player_id = ${r.player_id}`);
  }

  const moved: TidyResult["moved"] = [];
  for (const sid of seasons) {
    await db.execute(sql`UPDATE season_standings ss SET position = r.rn
      FROM (SELECT player_id, ROW_NUMBER() OVER (ORDER BY position, player_id) AS rn FROM season_standings WHERE season_id = ${sid}) r
      WHERE ss.season_id = ${sid} AND ss.player_id = r.player_id AND ss.position IS DISTINCT FROM r.rn`);
    const rows = (await db.execute(sql`SELECT player_id, position FROM season_standings WHERE season_id = ${sid}`)).rows as { player_id: number; position: number }[];
    for (const r of rows) {
      const from = before.get(`${sid}:${r.player_id}`);
      if (from !== undefined && from !== Number(r.position)) moved.push({ seasonId: sid, playerId: Number(r.player_id), from, to: Number(r.position) });
    }
  }
  return { removed: doomed.map(r => ({ seasonId: Number(r.season_id), playerId: Number(r.player_id), position: Number(r.position) })), moved };
}
