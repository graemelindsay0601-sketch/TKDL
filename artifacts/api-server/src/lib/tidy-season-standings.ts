import { sql } from "drizzle-orm";

/**
 * Past Singles season tables: check, then tidy on request (Admin › Past season
 * tables). Nothing here runs by itself.
 *
 * A player is only taken off a finished season's table when BOTH the table
 * says they played no games (0 wins, 0 losses) AND there are no league match
 * rows for them in that season: tagged with it, or played inside its dates
 * whatever season they were tagged with (a season's dates can be edited after
 * matches were recorded, so the tag alone isn't trusted). A champion is never removed. Removed rows are copied to
 * season_standings_removed first (restorable), and the rest are renumbered
 * 1..n in order.
 *
 * The check also lists every row where the table's wins/losses differ from
 * the match rows, so a wrong snapshot shows up before anything changes.
 */
type Db = { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }> };

export type SeasonRow = {
  playerId: number; name: string; position: number; wins: number; losses: number; points: number; isChampion: boolean;
  matchWins: number; matchLosses: number;
};
export type SeasonCheck = {
  seasonId: number; name: string; startDate: string | null; endDate: string | null;
  rows: SeasonRow[];
  remove: number[];
  moves: { playerId: number; from: number; to: number }[];
  mismatches: number[];
  matchesInSeason: number;
};

const BACKUP_TABLE = sql`CREATE TABLE IF NOT EXISTS season_standings_removed (
  season_id integer NOT NULL, player_id integer NOT NULL, position integer, wins integer, losses integer,
  points integer, elo integer, is_champion boolean, removed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, player_id))`;

export async function checkSinglesSeasonTables(db: Db): Promise<SeasonCheck[]> {
  const seasons = (await db.execute(sql`
    SELECT id, name, start_date, end_date FROM seasons
    WHERE is_active = false AND COALESCE(league_type, 'singles') = 'singles'
    ORDER BY start_date NULLS LAST, id`)).rows as { id: number; name: string; start_date: unknown; end_date: unknown }[];
  const out: SeasonCheck[] = [];
  for (const s of seasons) {
    const sid = Number(s.id);
    const start = s.start_date ? new Date(String(s.start_date)) : null;
    const end = s.end_date ? new Date(String(s.end_date)) : null;
    const inSeason = start && end
      ? sql`(m.season_id = ${sid} OR (m.played_at >= ${start.toISOString()} AND m.played_at < (${end.toISOString()}::timestamptz + interval '1 day')))`
      : sql`m.season_id = ${sid}`;
    const counts = (await db.execute(sql`
      SELECT pid, SUM(w)::int AS w, SUM(l)::int AS l FROM (
        SELECT m.winner_id AS pid, 1 AS w, 0 AS l FROM matches m WHERE ${inSeason}
        UNION ALL SELECT m.loser_id AS pid, 0 AS w, 1 AS l FROM matches m WHERE ${inSeason}
      ) x WHERE pid IS NOT NULL GROUP BY pid`)).rows as { pid: number; w: number; l: number }[];
    const byPlayer = new Map(counts.map(c => [Number(c.pid), { w: Number(c.w), l: Number(c.l) }]));
    const total = (await db.execute(sql`SELECT count(*)::int AS n FROM matches m WHERE ${inSeason}`)).rows as { n: number }[];
    const rows = ((await db.execute(sql`
      SELECT ss.player_id, COALESCE(p.name, '#' || ss.player_id) AS name, ss.position, COALESCE(ss.wins,0) AS wins, COALESCE(ss.losses,0) AS losses,
             COALESCE(ss.points,0) AS points, COALESCE(ss.is_champion,false) AS is_champion
      FROM season_standings ss LEFT JOIN players p ON p.id = ss.player_id
      WHERE ss.season_id = ${sid} ORDER BY ss.position, ss.player_id`)).rows as Record<string, unknown>[]).map(r => {
      const m = byPlayer.get(Number(r.player_id)) ?? { w: 0, l: 0 };
      return { playerId: Number(r.player_id), name: String(r.name), position: Number(r.position), wins: Number(r.wins), losses: Number(r.losses),
        points: Number(r.points), isChampion: r.is_champion === true, matchWins: m.w, matchLosses: m.l } satisfies SeasonRow;
    });
    const remove = rows.filter(r => r.wins + r.losses === 0 && r.matchWins + r.matchLosses === 0 && !r.isChampion).map(r => r.playerId);
    const kept = rows.filter(r => !remove.includes(r.playerId));
    const moves = kept.map((r, i) => ({ playerId: r.playerId, from: r.position, to: i + 1 })).filter(m => m.from !== m.to);
    const mismatches = rows.filter(r => r.matchWins + r.matchLosses > 0 && (r.wins !== r.matchWins || r.losses !== r.matchLosses)).map(r => r.playerId);
    out.push({ seasonId: sid, name: String(s.name), startDate: start?.toISOString() ?? null, endDate: end?.toISOString() ?? null,
      rows, remove, moves, mismatches, matchesInSeason: Number(total[0]?.n ?? 0) });
  }
  return out;
}

export async function tidySinglesSeasonTables(db: Db): Promise<{ removed: { seasonId: number; playerId: number }[]; moved: { seasonId: number; playerId: number; from: number; to: number }[] }> {
  await db.execute(BACKUP_TABLE);
  const plan = await checkSinglesSeasonTables(db);
  const removed: { seasonId: number; playerId: number }[] = [];
  const moved: { seasonId: number; playerId: number; from: number; to: number }[] = [];
  for (const s of plan) {
    if (s.remove.length === 0) continue;
    for (const pid of s.remove) {
      await db.execute(sql`INSERT INTO season_standings_removed (season_id, player_id, position, wins, losses, points, elo, is_champion)
        SELECT season_id, player_id, position, wins, losses, points, elo, is_champion FROM season_standings
        WHERE season_id = ${s.seasonId} AND player_id = ${pid} ON CONFLICT (season_id, player_id) DO NOTHING`);
      await db.execute(sql`DELETE FROM season_standings WHERE season_id = ${s.seasonId} AND player_id = ${pid}`);
      removed.push({ seasonId: s.seasonId, playerId: pid });
    }
    for (const m of s.moves) {
      await db.execute(sql`UPDATE season_standings SET position = ${m.to} WHERE season_id = ${s.seasonId} AND player_id = ${m.playerId}`);
      moved.push({ seasonId: s.seasonId, ...m });
    }
  }
  return { removed, moved };
}

/** Undo: put every removed row back at its old place. */
export async function restoreRemovedStandings(db: Db): Promise<number> {
  await db.execute(BACKUP_TABLE);
  const rows = (await db.execute(sql`SELECT * FROM season_standings_removed ORDER BY season_id, position`)).rows as Record<string, unknown>[];
  for (const r of rows) {
    const sid = Number(r.season_id), pos = Number(r.position);
    await db.execute(sql`UPDATE season_standings SET position = position + 1 WHERE season_id = ${sid} AND position >= ${pos}`);
    await db.execute(sql`INSERT INTO season_standings (season_id, player_id, position, wins, losses, points, elo, is_champion)
      VALUES (${sid}, ${Number(r.player_id)}, ${pos}, ${Number(r.wins)}, ${Number(r.losses)}, ${Number(r.points)}, ${r.elo == null ? null : Number(r.elo)}, ${r.is_champion === true})`);
    await db.execute(sql`DELETE FROM season_standings_removed WHERE season_id = ${sid} AND player_id = ${Number(r.player_id)}`);
  }
  return rows.length;
}
