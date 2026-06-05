import { Router } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, playersTable, matchesTable, seasonsTable, seasonStandingsTable } from "@workspace/db";

const router = Router();

router.get("/stats/summary", async (_req, res): Promise<void> => {
  const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));
  const allMatches = await db.select({ id: matchesTable.id }).from(matchesTable);
  const [currentSeason] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
  const completedSeasons = await db.select({ id: seasonsTable.id }).from(seasonsTable).where(eq(seasonsTable.isActive, false));

  const [lastMatch] = await db.select().from(matchesTable).orderBy(desc(matchesTable.playedAt)).limit(1);

  let currentSeasonMatches = 0;
  if (currentSeason) {
    const m = await db.select({ id: matchesTable.id }).from(matchesTable).where(eq(matchesTable.seasonId, currentSeason.id));
    currentSeasonMatches = m.length;
  }

  const sorted = [...players].sort((a, b) =>
    b.currentSeasonPoints - a.currentSeasonPoints || b.currentSeasonWins - a.currentSeasonWins
  );
  const topElo = [...players].sort((a, b) => b.elo - a.elo)[0] ?? null;
  const leader = sorted[0];

  const currentLeader = leader ? {
    position: 1,
    positionChange: 0,
    playerId: leader.id,
    playerName: leader.name,
    playerNickname: leader.nickname,
    wins: leader.currentSeasonWins,
    losses: leader.currentSeasonLosses,
    gamesPlayed: leader.currentSeasonWins + leader.currentSeasonLosses,
    points: leader.currentSeasonPoints,
    elo: leader.elo,
    tier: leader.tier,
    winRate: (leader.currentSeasonWins + leader.currentSeasonLosses) > 0
      ? leader.currentSeasonWins / (leader.currentSeasonWins + leader.currentSeasonLosses)
      : 0,
    currentStreak: leader.currentWinStreak,
  } : null;

  res.json({
    totalPlayers: players.length,
    totalMatches: allMatches.length,
    currentSeasonMatches,
    currentSeasonName: currentSeason?.name ?? "No active season",
    currentLeader,
    topEloPlayer: topElo,
    lastMatch: lastMatch ?? null,
    seasonsCompleted: completedSeasons.length,
  });
});

router.get("/stats/career-leaders", async (_req, res): Promise<void> => {
  const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));

  // Count season titles per player
  const standings = await db.select().from(seasonStandingsTable).where(eq(seasonStandingsTable.isChampion, 1));
  const titleCounts = new Map<number, number>();
  for (const s of standings) {
    titleCounts.set(s.playerId, (titleCounts.get(s.playerId) ?? 0) + 1);
  }

  const leaders = players
    .sort((a, b) => b.careerWins - a.careerWins || b.elo - a.elo)
    .map(p => ({
      player: p,
      careerWins: p.careerWins,
      careerWinRate: p.careerWinRate,
      elo: p.elo,
      seasonTitles: titleCounts.get(p.id) ?? 0,
    }));

  res.json(leaders);
});

router.get("/stats/recent-activity", async (_req, res): Promise<void> => {
  const matches = await db
    .select()
    .from(matchesTable)
    .orderBy(desc(matchesTable.playedAt))
    .limit(10);

  const activity = matches.map(m => ({
    matchId: m.id,
    winnerName: m.winnerName,
    loserName: m.loserName,
    pointsAwarded: m.pointsAwarded,
    eloChange: m.eloChange,
    playedAt: m.playedAt,
  }));

  res.json(activity);
});

export default router;
