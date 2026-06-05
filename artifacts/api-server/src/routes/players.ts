import { Router } from "express";
import { eq, or, desc } from "drizzle-orm";
import { db, playersTable, matchesTable, playerAchievementsTable, achievementsTable, seasonStandingsTable, seasonsTable } from "@workspace/db";
import { z } from "zod/v4";
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

export default router;
