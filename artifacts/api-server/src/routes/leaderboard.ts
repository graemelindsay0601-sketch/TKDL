import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";
import { calcTier } from "../lib/elo";
import { computeIdentity } from "../lib/identity";
import { seasonStandingsTable } from "@workspace/db";

const router = Router();

// ── Season leaderboard ──────────────────────────────────────────────────────
router.get("/leaderboard", async (_req, res): Promise<void> => {
  const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));

  const active     = players.filter(p => p.status !== "ELIMINATED");
  const eliminated = players.filter(p => p.status === "ELIMINATED");

  const sortByPoints = (a: typeof players[0], b: typeof players[0]) =>
    b.points - a.points || b.elo - a.elo;

  const sorted = [...active.sort(sortByPoints), ...eliminated.sort(sortByPoints)];

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
      position:      rank,
      positionChange: 0,
      playerId:      p.id,
      playerName:    p.name,
      wins:          p.seasonWins,
      losses:        p.seasonLosses,
      gamesPlayed:   games,
      points:        p.points,
      peakPoints:    p.peakPoints,
      elo:           p.elo,
      tier:          calcTier(p.elo),
      winRate:       games > 0 ? p.seasonWins / games : 0,
      currentStreak: p.currentWinStreak > 0 ? p.currentWinStreak : -p.currentLossStreak,
      status:        p.status,
      archetype:     identity.archetype,
      archetypeIcon: identity.archetypeIcon,
      aura:          identity.aura,
      auraColor:     identity.auraColor,
      title:         identity.title,
    };
  });

  res.json(leaderboard);
});

// ── Career / All-Time leaderboard ───────────────────────────────────────────
router.get("/leaderboard/career", async (req, res): Promise<void> => {
  const sortBy = (req.query.sortBy as string) ?? "wins";

  const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));

  const allStandings = await db.select().from(seasonStandingsTable).where(eq(seasonStandingsTable.isChampion, true));
  const titleCounts = new Map<number, number>();
  for (const s of allStandings) {
    titleCounts.set(s.playerId, (titleCounts.get(s.playerId) ?? 0) + 1);
  }

  const sortFn = (a: typeof players[0], b: typeof players[0]): number => {
    switch (sortBy) {
      case "wins":    return b.careerWins - a.careerWins || b.elo - a.elo;
      case "losses":  return b.careerLosses - a.careerLosses;
      case "elo":     return b.elo - a.elo;
      case "peakElo": return b.careerPeakElo - a.careerPeakElo;
      case "points":  return b.careerPoints - a.careerPoints;
      case "winRate": {
        const aRate = a.careerGamesPlayed > 0 ? a.careerWins / a.careerGamesPlayed : 0;
        const bRate = b.careerGamesPlayed > 0 ? b.careerWins / b.careerGamesPlayed : 0;
        return bRate - aRate;
      }
      default:        return b.careerWins - a.careerWins;
    }
  };

  const sorted = [...players].sort(sortFn);

  const result = sorted.map((p, i) => {
    const titles = titleCounts.get(p.id) ?? 0;
    const isChampion = titles > 0;
    const identity = computeIdentity(p, i + 1, isChampion);
    const wr = p.careerGamesPlayed > 0 ? Math.round((p.careerWins / p.careerGamesPlayed) * 100) : 0;
    return {
      position:          i + 1,
      playerId:          p.id,
      playerName:        p.name,
      careerWins:        p.careerWins,
      careerLosses:      p.careerLosses,
      careerGamesPlayed: p.careerGamesPlayed,
      careerPoints:      p.careerPoints,
      peakElo:           p.careerPeakElo,
      elo:               p.elo,
      tier:              calcTier(p.elo),
      winRate:           wr,
      titles:            titles,
      longestStreak:     p.longestWinStreak,
      status:            p.status,
      archetype:         identity.archetype,
      archetypeIcon:     identity.archetypeIcon,
      title:             identity.title,
    };
  });

  res.json(result);
});

export default router;
