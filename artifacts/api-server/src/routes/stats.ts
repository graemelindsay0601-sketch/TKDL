import { Router } from "express";
import { eq, desc, count, inArray } from "drizzle-orm";
import { db, playersTable, matchesTable, seasonsTable, seasonStandingsTable, matchParticipantsTable } from "@workspace/db";
import { sql as drizzleSql } from "drizzle-orm";
import { calcTier } from "../lib/elo";
import { computeIdentity } from "../lib/identity";
import { buildNarrativeCards } from "../lib/narrative";

const router = Router();

router.get("/stats/summary", async (_req, res): Promise<void> => {
  const allPlayers   = await db.select().from(playersTable);
  const activePlayers = allPlayers.filter(p => p.isActive);
  const [currentSeason] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
  const completedSeasons = await db.select({ id: seasonsTable.id }).from(seasonsTable).where(eq(seasonsTable.isActive, false));
  const [lastMatch] = await db.select().from(matchesTable).orderBy(desc(matchesTable.playedAt)).limit(1);

  let currentSeasonMatches = 0;
  if (currentSeason) {
    const m = await db.select({ id: matchesTable.id }).from(matchesTable).where(eq(matchesTable.seasonId, currentSeason.id));
    currentSeasonMatches = m.length;
  }

  const allMatches = await db.select({ id: matchesTable.id }).from(matchesTable);
  const sorted = [...activePlayers]
    .filter(p => p.status !== "ELIMINATED")
    .sort((a, b) => b.points - a.points || b.elo - a.elo);
  const topElo = [...activePlayers].sort((a, b) => b.elo - a.elo)[0] ?? null;
  const leader = sorted[0];
  const eliminatedCount = activePlayers.filter(p => p.status === "ELIMINATED").length;

  const allStandings = await db.select().from(seasonStandingsTable).where(eq(seasonStandingsTable.isChampion, true));
  const titleCounts = new Map<number, number>();
  for (const s of allStandings) titleCounts.set(s.playerId, (titleCounts.get(s.playerId) ?? 0) + 1);

  let currentLeader = null;
  if (leader) {
    const isChampion = (titleCounts.get(leader.id) ?? 0) > 0;
    const identity = computeIdentity(leader, 1, isChampion);
    const games = leader.seasonWins + leader.seasonLosses;
    currentLeader = {
      position: 1, positionChange: 0,
      playerId: leader.id, playerName: leader.name,
      wins: leader.seasonWins, losses: leader.seasonLosses, gamesPlayed: games,
      points: leader.points, peakPoints: leader.peakPoints,
      elo: leader.elo, tier: calcTier(leader.elo),
      winRate: games > 0 ? leader.seasonWins / games : 0,
      currentStreak: leader.currentWinStreak,
      status: leader.status, ...identity,
    };
  }

  res.json({
    totalPlayers: activePlayers.length,
    activePlayers: activePlayers.filter(p => p.status === "ACTIVE").length,
    eliminatedCount,
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
  const standings = await db.select().from(seasonStandingsTable).where(eq(seasonStandingsTable.isChampion, true));
  const titleCounts = new Map<number, number>();
  for (const s of standings) titleCounts.set(s.playerId, (titleCounts.get(s.playerId) ?? 0) + 1);

  const leaders = [...players]
    .sort((a, b) => b.careerWins - a.careerWins || b.careerPeakElo - a.careerPeakElo)
    .map(p => ({
      player: p,
      careerWins: p.careerWins,
      careerWinRate: p.careerGamesPlayed > 0 ? p.careerWins / p.careerGamesPlayed : 0,
      elo: p.elo,
      seasonTitles: titleCounts.get(p.id) ?? 0,
    }));

  res.json(leaders);
});

router.get("/stats/recent-activity", async (_req, res): Promise<void> => {
  const matches = await db.select().from(matchesTable).orderBy(desc(matchesTable.playedAt)).limit(15);
  const matchIds = matches.map(m => m.id);
  const teamMatchIdSet = new Set<number>();
  if (matchIds.length > 0) {
    const participants = await db.selectDistinct({ matchId: matchParticipantsTable.matchId })
      .from(matchParticipantsTable)
      .where(inArray(matchParticipantsTable.matchId, matchIds));
    for (const p of participants) teamMatchIdSet.add(p.matchId);
  }
  const activity = matches.map(m => ({
    matchId:     m.id,
    winnerId:    m.winnerId,
    loserId:     m.loserId,
    winnerName:  m.winnerName,
    loserName:   m.loserName,
    stake:       m.stake,
    eloChange:   m.eloChange,
    gameType:    m.gameType,
    isTeamMatch: teamMatchIdSet.has(m.id),
    playedAt:    m.playedAt,
    seasonId:    m.seasonId,
  }));
  res.json(activity);
});

router.get("/stats/narrative", async (_req, res): Promise<void> => {
  const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));
  const [currentSeason] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
  const recentMatches = currentSeason
    ? await db.select().from(matchesTable)
        .where(eq(matchesTable.seasonId, currentSeason.id))
        .orderBy(desc(matchesTable.playedAt)).limit(10)
    : [];
  const cards = buildNarrativeCards(players, recentMatches);
  res.json(cards);
});

router.get("/stats/rivalries", async (_req, res): Promise<void> => {
  const rows = await db.execute(drizzleSql`
    SELECT
      LEAST(m.winner_id, m.loser_id)          AS p1_id,
      GREATEST(m.winner_id, m.loser_id)       AS p2_id,
      p1.name                                 AS p1_name,
      p2.name                                 AS p2_name,
      COUNT(*)::int                           AS total_matches,
      SUM(CASE WHEN m.winner_id = LEAST(m.winner_id, m.loser_id)     THEN 1 ELSE 0 END)::int AS p1_wins,
      SUM(CASE WHEN m.winner_id = GREATEST(m.winner_id, m.loser_id)  THEN 1 ELSE 0 END)::int AS p2_wins,
      MAX(m.played_at)                        AS last_played_at
    FROM matches m
    JOIN players p1 ON p1.id = LEAST(m.winner_id, m.loser_id)
    JOIN players p2 ON p2.id = GREATEST(m.winner_id, m.loser_id)
    WHERE m.winner_id IS NOT NULL AND m.loser_id IS NOT NULL
    GROUP BY LEAST(m.winner_id, m.loser_id), GREATEST(m.winner_id, m.loser_id), p1.name, p2.name
    HAVING COUNT(*) >= 3
    ORDER BY COUNT(*) DESC, MAX(m.played_at) DESC
    LIMIT 8
  `);
  res.json(rows.rows);
});

export default router;
