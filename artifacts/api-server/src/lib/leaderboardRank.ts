import { eq } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";

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
