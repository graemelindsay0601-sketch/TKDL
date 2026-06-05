import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, seasonsTable, playersTable, seasonStandingsTable } from "@workspace/db";
import { GetSeasonParams, ResetSeasonBody } from "@workspace/api-zod";
import { performSeasonReset } from "../lib/seasonReset";

const router = Router();

router.get("/seasons", async (_req, res): Promise<void> => {
  const seasons = await db.select().from(seasonsTable).orderBy(desc(seasonsTable.id));
  res.json(seasons);
});

router.get("/seasons/current", async (_req, res): Promise<void> => {
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
  if (!season) { res.json(null); return; }
  res.json(season);
});

router.post("/seasons/reset", async (req, res): Promise<void> => {
  const parsed = ResetSeasonBody.safeParse(req.body ?? {});
  const overrideName = parsed.success ? parsed.data.name : undefined;
  const newSeason = await performSeasonReset(overrideName);
  res.status(201).json(newSeason);
});

router.get("/seasons/:id", async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, params.data.id));
  if (!season) { res.status(404).json({ error: "Season not found" }); return; }

  let standings;
  if (season.isActive) {
    // Live standings from player data
    const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));
    const sorted = [...players].sort((a, b) => b.currentSeasonPoints - a.currentSeasonPoints || b.currentSeasonWins - a.currentSeasonWins);
    standings = sorted.map((p, i) => ({
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
      winRate: p.careerGamesPlayed > 0 ? p.currentSeasonWins / (p.currentSeasonWins + p.currentSeasonLosses || 1) : 0,
      currentStreak: p.currentWinStreak,
    }));
  } else {
    // Historical standings snapshot
    const rows = await db
      .select()
      .from(seasonStandingsTable)
      .where(eq(seasonStandingsTable.seasonId, params.data.id))
      .orderBy(seasonStandingsTable.position);

    const playerIds = rows.map(r => r.playerId);
    const allPlayers = await db.select().from(playersTable);
    const playerMap = new Map(allPlayers.map(p => [p.id, p]));

    standings = rows.map(r => {
      const p = playerMap.get(r.playerId);
      const games = r.wins + r.losses;
      return {
        position: r.position,
        positionChange: 0,
        playerId: r.playerId,
        playerName: p?.name ?? "Unknown",
        playerNickname: p?.nickname ?? null,
        wins: r.wins,
        losses: r.losses,
        gamesPlayed: games,
        points: r.points,
        elo: p?.elo ?? 1000,
        tier: p?.tier ?? "Bronze",
        winRate: games > 0 ? r.wins / games : 0,
        currentStreak: 0,
      };
    });
  }

  res.json({ season, standings });
});

export default router;
