import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, playersTable, matchesTable, playerAchievementsTable, achievementsTable, seasonStandingsTable, seasonsTable } from "@workspace/db";
import {
  CreatePlayerBody,
  UpdatePlayerBody,
  GetPlayerParams,
  UpdatePlayerParams,
  DeletePlayerParams,
  GetPlayerStatsParams,
  GetPlayerAchievementsParams,
} from "@workspace/api-zod";

const router = Router();

function initials(name: string): string {
  return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
}

router.get("/players", async (req, res): Promise<void> => {
  const players = await db.select().from(playersTable).orderBy(playersTable.name);
  res.json(players);
});

router.post("/players", async (req, res): Promise<void> => {
  const parsed = CreatePlayerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, nickname } = parsed.data;
  const [player] = await db.insert(playersTable).values({
    name,
    nickname: nickname ?? null,
    avatarInitials: initials(name),
  }).returning();
  res.status(201).json(player);
});

router.get("/players/:id", async (req, res): Promise<void> => {
  const params = GetPlayerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, params.data.id));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  res.json(player);
});

router.patch("/players/:id", async (req, res): Promise<void> => {
  const params = UpdatePlayerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdatePlayerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [player] = await db.update(playersTable).set(parsed.data).where(eq(playersTable.id, params.data.id)).returning();
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  res.json(player);
});

router.delete("/players/:id", async (req, res): Promise<void> => {
  const params = DeletePlayerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [player] = await db.delete(playersTable).where(eq(playersTable.id, params.data.id)).returning();
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  res.sendStatus(204);
});

router.get("/players/:id/stats", async (req, res): Promise<void> => {
  const params = GetPlayerStatsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, params.data.id));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  const recentMatches = await db
    .select().from(matchesTable)
    .where(eq(matchesTable.winnerId, params.data.id))
    .orderBy(matchesTable.playedAt)
    .limit(10);

  const standings = await db
    .select({
      seasonId: seasonStandingsTable.seasonId,
      seasonName: seasonsTable.name,
      position: seasonStandingsTable.position,
      wins: seasonStandingsTable.wins,
      losses: seasonStandingsTable.losses,
      points: seasonStandingsTable.points,
      isChampion: seasonStandingsTable.isChampion,
    })
    .from(seasonStandingsTable)
    .innerJoin(seasonsTable, eq(seasonsTable.id, seasonStandingsTable.seasonId))
    .where(eq(seasonStandingsTable.playerId, params.data.id))
    .orderBy(seasonStandingsTable.seasonId);

  const playerAchievements = await db
    .select({
      achievement: achievementsTable,
      unlockedAt: playerAchievementsTable.unlockedAt,
    })
    .from(playerAchievementsTable)
    .innerJoin(achievementsTable, eq(achievementsTable.id, playerAchievementsTable.achievementId))
    .where(eq(playerAchievementsTable.playerId, params.data.id));

  res.json({
    player,
    seasonHistory: standings.map(s => ({ ...s, isChampion: s.isChampion === 1 })),
    recentMatches,
    achievements: playerAchievements,
  });
});

router.get("/players/:id/achievements", async (req, res): Promise<void> => {
  const params = GetPlayerAchievementsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const playerAchievements = await db
    .select({
      achievement: achievementsTable,
      unlockedAt: playerAchievementsTable.unlockedAt,
    })
    .from(playerAchievementsTable)
    .innerJoin(achievementsTable, eq(achievementsTable.id, playerAchievementsTable.achievementId))
    .where(eq(playerAchievementsTable.playerId, params.data.id))
    .orderBy(playerAchievementsTable.unlockedAt);

  res.json(playerAchievements);
});

export default router;
