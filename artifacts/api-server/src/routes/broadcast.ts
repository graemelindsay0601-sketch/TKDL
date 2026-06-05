import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, playersTable, matchesTable, seasonsTable } from "@workspace/db";

const router = Router();

router.get("/broadcast", async (_req, res): Promise<void> => {
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
  const recentMatches = await db.select().from(matchesTable).orderBy(desc(matchesTable.playedAt)).limit(5);

  const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));
  const sorted = [...players].sort((a, b) =>
    b.currentSeasonPoints - a.currentSeasonPoints || b.currentSeasonWins - a.currentSeasonWins
  );

  const leaderboard = sorted.map((p, i) => ({
    position: i + 1,
    positionChange: 0,
    playerId: p.id,
    playerName: p.name,
    playerNickname: p.nickname,
    wins: p.currentSeasonWins,
    losses: p.currentSeasonLosses,
    gamesPlayed: p.currentSeasonWins + p.currentSeasonLosses,
    points: p.currentSeasonPoints,
    elo: p.elo,
    tier: p.tier,
    winRate: (p.currentSeasonWins + p.currentSeasonLosses) > 0
      ? p.currentSeasonWins / (p.currentSeasonWins + p.currentSeasonLosses)
      : 0,
    currentStreak: p.currentWinStreak,
  }));

  // Featured = current leader
  const featured = sorted[0] ?? null;

  // Next season reset: first day of next month
  const now = new Date();
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  res.json({
    season: season ?? { id: 0, name: "No Active Season", startDate: new Date().toISOString().split("T")[0], endDate: null, isActive: false, championId: null, championName: null, totalMatches: 0 },
    leaderboard,
    recentMatches,
    featuredPlayer: featured,
    nextSeasonReset: nextReset.toISOString(),
  });
});

export default router;
