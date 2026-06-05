import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";

const router = Router();

router.get("/leaderboard", async (_req, res): Promise<void> => {
  const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));
  const sorted = [...players].sort((a, b) =>
    b.currentSeasonPoints - a.currentSeasonPoints ||
    b.currentSeasonWins - a.currentSeasonWins ||
    b.elo - a.elo
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

  res.json(leaderboard);
});

export default router;
