import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";
import { calcTier } from "../lib/elo";
import { computeIdentity } from "../lib/identity";
import { seasonStandingsTable, seasonsTable } from "@workspace/db";

const router = Router();

router.get("/leaderboard", async (_req, res): Promise<void> => {
  const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));

  // Sort: ACTIVE first by points desc, ELO tiebreak; ELIMINATED at bottom
  const active      = players.filter(p => p.status !== "ELIMINATED");
  const eliminated  = players.filter(p => p.status === "ELIMINATED");

  const sortByPoints = (a: typeof players[0], b: typeof players[0]) =>
    b.points - a.points || b.elo - a.elo;

  const sorted = [...active.sort(sortByPoints), ...eliminated.sort(sortByPoints)];

  // Get season titles per player
  const allStandings = await db.select().from(seasonStandingsTable).where(eq(seasonStandingsTable.isChampion, true));
  const titleCounts = new Map<number, number>();
  for (const s of allStandings) {
    titleCounts.set(s.playerId, (titleCounts.get(s.playerId) ?? 0) + 1);
  }

  const leaderboard = sorted.map((p, i) => {
    const rank = i + 1;
    const isChampion = (titleCounts.get(p.id) ?? 0) > 0;
    const identity = computeIdentity(p, rank, isChampion);
    const games = p.seasonWins + p.seasonLosses;
    return {
      position:     rank,
      positionChange: 0,
      playerId:     p.id,
      playerName:   p.name,
      wins:         p.seasonWins,
      losses:       p.seasonLosses,
      gamesPlayed:  games,
      points:       p.points,
      peakPoints:   p.peakPoints,
      elo:          p.elo,
      tier:         calcTier(p.elo),
      winRate:      games > 0 ? p.seasonWins / games : 0,
      currentStreak: p.currentWinStreak > 0 ? p.currentWinStreak : -p.currentLossStreak,
      status:       p.status,
      archetype:    identity.archetype,
      archetypeIcon: identity.archetypeIcon,
      aura:         identity.aura,
      auraColor:    identity.auraColor,
      title:        identity.title,
    };
  });

  res.json(leaderboard);
});

export default router;
