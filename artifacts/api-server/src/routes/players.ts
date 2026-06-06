import { Router } from "express";
import { eq, or, desc } from "drizzle-orm";
import { db, playersTable, matchesTable, playerAchievementsTable, achievementsTable, seasonStandingsTable, seasonsTable } from "@workspace/db";
import { z } from "zod";
import { computeIdentity } from "../lib/identity";
import { calcTier } from "../lib/elo";

const CreatePlayerBody = z.object({
  name:     z.string().min(1),
  playerId: z.string().optional(),
});
const UpdatePlayerBody = z.object({
  name:     z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  status:   z.string().optional(),
});
const IdParam = z.object({ id: z.coerce.number().int().positive() });

const router = Router();

router.get("/players", async (_req, res): Promise<void> => {
  const players = await db.select().from(playersTable).orderBy(playersTable.name);
  res.json(players);
});

router.post("/players", async (req, res): Promise<void> => {
  const parsed = CreatePlayerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, playerId } = parsed.data;
  const count = await db.select({ id: playersTable.id }).from(playersTable);
  const autoId = `P${String(count.length + 1).padStart(3, "0")}`;
  const [player] = await db.insert(playersTable).values({
    name,
    playerId: playerId ?? autoId,
    status: "ACTIVE",
    points: 25,
    peakPoints: 25,
  }).returning();
  res.status(201).json(player);
});

router.get("/players/:id", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, params.data.id));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  res.json(player);
});

router.patch("/players/:id", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdatePlayerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [player] = await db.update(playersTable).set(parsed.data).where(eq(playersTable.id, params.data.id)).returning();
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  res.json(player);
});

router.delete("/players/:id", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [player] = await db.delete(playersTable).where(eq(playersTable.id, params.data.id)).returning();
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  res.sendStatus(204);
});

router.get("/players/:id/stats", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = params.data.id;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, id));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  // Recent matches (as winner or loser)
  const recentMatches = await db.select().from(matchesTable)
    .where(or(eq(matchesTable.winnerId, id), eq(matchesTable.loserId, id)))
    .orderBy(desc(matchesTable.playedAt))
    .limit(10);

  // Season history
  const standings = await db.select({
    seasonId:   seasonStandingsTable.seasonId,
    seasonName: seasonsTable.name,
    position:   seasonStandingsTable.position,
    wins:       seasonStandingsTable.wins,
    losses:     seasonStandingsTable.losses,
    points:     seasonStandingsTable.points,
    elo:        seasonStandingsTable.elo,
    isChampion: seasonStandingsTable.isChampion,
  })
    .from(seasonStandingsTable)
    .innerJoin(seasonsTable, eq(seasonsTable.id, seasonStandingsTable.seasonId))
    .where(eq(seasonStandingsTable.playerId, id))
    .orderBy(seasonStandingsTable.seasonId);

  // Achievements
  const playerAchievements = await db.select({
    achievement: achievementsTable,
    unlockedAt:  playerAchievementsTable.unlockedAt,
  })
    .from(playerAchievementsTable)
    .innerJoin(achievementsTable, eq(achievementsTable.id, playerAchievementsTable.achievementId))
    .where(eq(playerAchievementsTable.playerId, id))
    .orderBy(playerAchievementsTable.unlockedAt);

  // Head-to-head stats
  const allMatches = await db.select().from(matchesTable)
    .where(or(eq(matchesTable.winnerId, id), eq(matchesTable.loserId, id)));
  const h2h = new Map<number, { wins: number; losses: number; name: string }>();
  const allPlayers = await db.select({ id: playersTable.id, name: playersTable.name }).from(playersTable);
  const nameMap = new Map(allPlayers.map(p => [p.id, p.name]));

  for (const m of allMatches) {
    if (m.winnerId === id) {
      const entry = h2h.get(m.loserId) ?? { wins: 0, losses: 0, name: nameMap.get(m.loserId) ?? "Unknown" };
      entry.wins++;
      h2h.set(m.loserId, entry);
    } else {
      const entry = h2h.get(m.winnerId) ?? { wins: 0, losses: 0, name: nameMap.get(m.winnerId) ?? "Unknown" };
      entry.losses++;
      h2h.set(m.winnerId, entry);
    }
  }
  const headToHead = [...h2h.entries()]
    .map(([opponentId, v]) => ({ opponentId, opponentName: v.name, wins: v.wins, losses: v.losses }))
    .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));

  // Identity
  const isChampion = standings.some(s => s.isChampion);
  const rank = 0; // approximate — full rank calc is in leaderboard
  const identity = computeIdentity(player, rank, isChampion);

  res.json({
    player,
    seasonHistory: standings,
    recentMatches,
    achievements: playerAchievements,
    headToHead,
    identity,
  });
});

router.get("/players/:id/achievements", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const playerAchievements = await db.select({
    achievement: achievementsTable,
    unlockedAt:  playerAchievementsTable.unlockedAt,
  })
    .from(playerAchievementsTable)
    .innerJoin(achievementsTable, eq(achievementsTable.id, playerAchievementsTable.achievementId))
    .where(eq(playerAchievementsTable.playerId, params.data.id))
    .orderBy(playerAchievementsTable.unlockedAt);
  res.json(playerAchievements);
});

router.get("/players/:id/achievement-progress", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = params.data.id;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, id));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  const allAchievements = await db.select().from(achievementsTable).orderBy(achievementsTable.priority, achievementsTable.id);
  const unlocked = await db.select({ achievementId: playerAchievementsTable.achievementId, unlockedAt: playerAchievementsTable.unlockedAt })
    .from(playerAchievementsTable).where(eq(playerAchievementsTable.playerId, id));
  const unlockedMap = new Map(unlocked.map(u => [u.achievementId, u.unlockedAt]));

  // Load season standings for season-based progress
  const standings = await db.select().from(seasonStandingsTable).where(eq(seasonStandingsTable.playerId, id));
  const maxSeasonWins   = standings.reduce((m, s) => Math.max(m, s.wins), 0);
  const maxSeasonPoints = standings.reduce((m, s) => Math.max(m, s.points), 0);
  const seasonsPlayed   = standings.length;
  const seasonsWon      = standings.filter(s => s.isChampion).length;

  // Load matches for match-based progress
  const allMatches = await db.select().from(matchesTable)
    .where(or(eq(matchesTable.winnerId, id), eq(matchesTable.loserId, id)));
  const wins = allMatches.filter(m => m.winnerId === id);
  const highStakeWins25 = wins.filter(m => (m.stake ?? 0) >= 25).length;
  const highStakeWins10 = wins.filter(m => (m.stake ?? 0) >= 10).length;
  const highStakeMatches10 = allMatches.filter(m => (m.stake ?? 0) >= 10).length;

  // Max wins vs same opponent
  const oppWins = new Map<number, number>();
  for (const m of wins) oppWins.set(m.loserId, (oppWins.get(m.loserId) ?? 0) + 1);
  const maxSameOppWins = Math.max(0, ...[...oppWins.values()]);

  const totalGames = player.careerGamesPlayed;
  const winRate = totalGames > 0 ? (player.careerWins / totalGames) * 100 : 0;

  function getProgress(criteriaType: string, criteriaValue: number, secondaryCriteria: string | null, secondaryValue: number | null): number {
    switch (criteriaType) {
      case "CAREER_WINS":          return player.careerWins;
      case "CAREER_GAMES":         return player.careerGamesPlayed;
      case "WIN_STREAK":           return player.longestWinStreak;
      case "PEAK_ELO":             return player.careerPeakElo;
      case "WIN_RATE":             return Math.round(winRate);
      case "CAREER_POINTS":        return player.careerPoints;
      case "ELIMINATIONS":         return player.eliminationsCount;
      case "TOTAL_ACHIEVEMENTS":   return unlocked.length;
      case "NEVER_ELIMINATED":     return player.eliminationsCount === 0 ? 1 : 0;
      case "HIGH_STAKE_WIN":       return criteriaValue >= 25 ? highStakeWins25 : highStakeWins10;
      case "HIGH_STAKES_TOTAL":    return highStakeMatches10;
      case "HIGH_STAKES_MATCHES":  return highStakeMatches10;
      case "SAME_OPPONENT_WINS":   return maxSameOppWins;
      case "SEASON_WINS":          return maxSeasonWins;
      case "SEASON_POINTS":        return maxSeasonPoints;
      case "MULTI_SEASON_PLAYS":   return seasonsPlayed;
      case "SEASON_CHAMPION_COUNT":return seasonsWon;
      case "SEASON_POINTS_LEADER": return seasonsWon > 0 ? 1 : 0;
      default:                     return 0;
    }
  }

  const result = allAchievements.map(a => {
    const isUnlocked = unlockedMap.has(a.id);
    const currentProgress = getProgress(a.criteriaType, a.criteriaValue, a.secondaryCriteria ?? null, a.secondaryValue ?? null);
    const pct = Math.min(100, Math.round((currentProgress / a.criteriaValue) * 100));
    return {
      ...a,
      isUnlocked,
      unlockedAt: isUnlocked ? unlockedMap.get(a.id) : null,
      currentProgress,
      progressPct: pct,
    };
  });

  res.json(result);
});

export default router;
