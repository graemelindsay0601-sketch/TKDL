import { and, eq, sql } from "drizzle-orm";
import { db, playersTable, seasonsTable } from "@workspace/db";
import { logger } from "./logger";

export interface RankablePlayer {
  id: number;
  points: number;
  elo: number;
  status: string;
}

/**
 * Mirrors GET /leaderboard's sort (routes/leaderboard.ts): active players
 * (status !== "ELIMINATED") sorted by points desc, elo desc as a tiebreak;
 * eliminated players sorted the same way and appended after. Rank is the
 * 1-indexed position in that combined list — the same number the season
 * leaderboard shows as `position`.
 *
 * This is a pure function over an already-fetched player list so callers
 * can compute a "before" and "after" ranking from one query (see
 * routes/matches.ts, where only the two players in a match actually change
 * points/elo/status — reusing the same fetched roster with those two
 * fields patched avoids a second DB round trip).
 */
export function rankPlayersByPoints(players: RankablePlayer[]): Map<number, number> {
  const active     = players.filter(p => p.status !== "ELIMINATED");
  const eliminated = players.filter(p => p.status === "ELIMINATED");
  const sortByPoints = (a: RankablePlayer, b: RankablePlayer) => b.points - a.points || b.elo - a.elo;
  const sorted = [...active.sort(sortByPoints), ...eliminated.sort(sortByPoints)];

  const ranks = new Map<number, number>();
  sorted.forEach((p, i) => ranks.set(p.id, i + 1));
  return ranks;
}

/**
 * Convenience wrapper that fetches the current active roster and ranks it —
 * for callers that just want "everyone's rank right now" rather than a
 * before/after diff.
 */
export async function computeLeaderboardRanks(): Promise<Map<number, number>> {
  const players = await db
    .select({ id: playersTable.id, points: playersTable.points, elo: playersTable.elo, status: playersTable.status })
    .from(playersTable)
    .where(eq(playersTable.isActive, true));
  return rankPlayersByPoints(players);
}

export interface RankableDoublesTeam {
  id: number;
  points: number;
  elo: number;
  isEliminated: boolean;
}

/**
 * Mirrors GET /seasons/:id/doubles/teams's sort (routes/doubles.ts): teams
 * still in the event (isEliminated === false) sorted by points desc, elo
 * desc as a tiebreak; eliminated teams sorted by points desc alone (that
 * route doesn't tiebreak eliminated teams on elo — kept identical here so
 * "rank" always means the same number that page shows) and appended after.
 */
export function rankDoublesTeams(teams: RankableDoublesTeam[]): Map<number, number> {
  const active     = teams.filter(t => !t.isEliminated).sort((a, b) => b.points - a.points || b.elo - a.elo);
  const eliminated = teams.filter(t => t.isEliminated).sort((a, b) => b.points - a.points);
  const sorted = [...active, ...eliminated];

  const ranks = new Map<number, number>();
  sorted.forEach((t, i) => ranks.set(t.id, i + 1));
  return ranks;
}

export interface RankableShiftWarsTeam {
  id: number;
  points: number;
  name: string;
}

/**
 * Mirrors GET /shift-wars/teams's sort (routes/shift-wars.ts): the 3 fixed
 * department teams ordered by points desc, name asc as a tiebreak — no
 * elimination concept here, Shift Wars is a standing competition rather
 * than a season bracket.
 */
export function rankShiftWarsTeams(teams: RankableShiftWarsTeam[]): Map<number, number> {
  const sorted = [...teams].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  const ranks = new Map<number, number>();
  sorted.forEach((t, i) => ranks.set(t.id, i + 1));
  return ranks;
}

// ── Daily rank snapshots — power the dashboard/season/stats positionChange
// arrows (see db/migrations/add_player_rank_snapshots.ts for the table and
// services/rankSnapshotScheduler.ts for the nightly cron job that calls
// snapshotTodaysRanks()). This is a different question from the per-match
// diff above: that's "did this one match move you," this is "where were
// you yesterday versus right now" — the two share the same sort logic but
// not the same data source.

/**
 * Records every active player's current singles rank/points/elo as today's
 * snapshot row. Idempotent — safe to call more than once in the same day
 * (the scheduler's own retry, or a manual backfill), since the unique
 * (player_id, snapshot_date) constraint makes a repeat call just overwrite
 * today's row via ON CONFLICT rather than duplicate it.
 */
export async function snapshotTodaysRanks(): Promise<{ playerCount: number }> {
  const players = await db
    .select({ id: playersTable.id, points: playersTable.points, elo: playersTable.elo, status: playersTable.status })
    .from(playersTable)
    .where(eq(playersTable.isActive, true));
  const ranks = rankPlayersByPoints(players);

  const [activeSeason] = await db.select().from(seasonsTable)
    .where(and(eq(seasonsTable.isActive, true), eq(seasonsTable.leagueType, "singles")))
    .limit(1);

  for (const p of players) {
    const rank = ranks.get(p.id);
    if (rank === undefined) continue;
    await db.execute(sql`
      INSERT INTO player_rank_snapshots (player_id, season_id, rank, points, elo, snapshot_date)
      VALUES (${p.id}, ${activeSeason?.id ?? null}, ${rank}, ${p.points}, ${p.elo}, CURRENT_DATE)
      ON CONFLICT (player_id, snapshot_date)
      DO UPDATE SET rank = EXCLUDED.rank, points = EXCLUDED.points, elo = EXCLUDED.elo, season_id = EXCLUDED.season_id
    `);
  }

  return { playerCount: players.length };
}

/**
 * Diffs a live ranking (as produced by rankPlayersByPoints/
 * computeLeaderboardRanks) against each player's most recent snapshot
 * strictly before today — "yesterday", or however many days ago the
 * scheduler last actually ran, which degrades gracefully rather than
 * breaking if a night was missed. A player with no snapshot yet (brand
 * new, or the scheduler hasn't run since they joined) is simply absent
 * from the returned map, and callers should treat that as 0 — exactly the
 * old hardcoded stub's behavior, so a missing snapshot never looks like a
 * fabricated "no change."
 *
 * Wrapped in try/catch and returns an empty map on any failure (including
 * the table not existing yet, pre-migration) — this runs inside the
 * leaderboard/dashboard/stats request path, and those pages must keep
 * rendering even if the snapshot side is broken or not yet deployed.
 */
export async function getPositionChanges(currentRanks: Map<number, number>): Promise<Map<number, number>> {
  const changes = new Map<number, number>();
  if (currentRanks.size === 0) return changes;

  try {
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (player_id) player_id, rank
      FROM player_rank_snapshots
      WHERE snapshot_date < CURRENT_DATE
      ORDER BY player_id, snapshot_date DESC
    `);
    for (const row of rows.rows as { player_id: number; rank: number }[]) {
      const id = Number(row.player_id);
      const newRank = currentRanks.get(id);
      if (newRank === undefined) continue;
      changes.set(id, Number(row.rank) - newRank);
    }
  } catch (err) {
    logger.error({ err }, "Failed to compute position changes from rank snapshots");
  }

  return changes;
}
