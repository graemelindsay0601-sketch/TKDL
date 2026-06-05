import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, seasonsTable, playersTable, seasonStandingsTable } from "@workspace/db";
import { z } from "zod/v4";
import { performSeasonReset } from "../lib/seasonReset";
import { calcTier } from "../lib/elo";
import { computeIdentity } from "../lib/identity";

const GetSeasonParams  = z.object({ id: z.coerce.number().int().positive() });
const ResetSeasonBody  = z.object({ name: z.string().optional() });

const router = Router();

router.get("/seasons", async (_req, res): Promise<void> => {
  const seasons = await db.select().from(seasonsTable).orderBy(desc(seasonsTable.id));
  res.json(seasons);
});

router.get("/seasons/current", async (_req, res): Promise<void> => {
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
  res.json(season ?? null);
});

router.post("/seasons/reset", async (req, res): Promise<void> => {
  const parsed = ResetSeasonBody.safeParse(req.body ?? {});
  const overrideName = parsed.success ? parsed.data.name : undefined;
  const newSeason = await performSeasonReset(overrideName);
  res.status(201).json(newSeason);
});

router.get("/seasons/:id", async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, params.data.id));
  if (!season) { res.status(404).json({ error: "Season not found" }); return; }

  const allPlayers = await db.select().from(playersTable);
  const playerMap = new Map(allPlayers.map(p => [p.id, p]));

  const allStandings = await db.select().from(seasonStandingsTable).where(eq(seasonStandingsTable.isChampion, true));
  const titleCounts = new Map<number, number>();
  for (const s of allStandings) titleCounts.set(s.playerId, (titleCounts.get(s.playerId) ?? 0) + 1);

  let standings;
  if (season.isActive) {
    const players = allPlayers.filter(p => p.isActive);
    const active = players.filter(p => p.status !== "ELIMINATED");
    const eliminated = players.filter(p => p.status === "ELIMINATED");
    const sorted = [...active.sort((a,b) => b.points-a.points || b.elo-a.elo), ...eliminated.sort((a,b) => b.points-a.points)];
    standings = sorted.map((p, i) => {
      const isChampion = (titleCounts.get(p.id) ?? 0) > 0;
      const identity = computeIdentity(p, i+1, isChampion);
      const games = p.seasonWins + p.seasonLosses;
      return {
        position: i+1, positionChange: 0,
        playerId: p.id, playerName: p.name,
        wins: p.seasonWins, losses: p.seasonLosses, gamesPlayed: games,
        points: p.points, peakPoints: p.peakPoints,
        elo: p.elo, tier: calcTier(p.elo),
        winRate: games > 0 ? p.seasonWins/games : 0,
        currentStreak: p.currentWinStreak, status: p.status, ...identity,
      };
    });
  } else {
    const rows = await db.select().from(seasonStandingsTable)
      .where(eq(seasonStandingsTable.seasonId, params.data.id))
      .orderBy(seasonStandingsTable.position);
    standings = rows.map(r => {
      const p = playerMap.get(r.playerId);
      const games = r.wins + r.losses;
      return {
        position: r.position, positionChange: 0,
        playerId: r.playerId, playerName: p?.name ?? "Unknown",
        wins: r.wins, losses: r.losses, gamesPlayed: games,
        points: r.points, peakPoints: r.points,
        elo: r.elo, tier: calcTier(r.elo),
        winRate: games > 0 ? r.wins/games : 0,
        currentStreak: 0, status: r.isChampion ? "CHAMPION" : "ACTIVE",
        archetype: "COMPETITOR", archetypeIcon: "🎲",
        aura: "BALANCED", auraColor: "#888899", title: r.isChampion ? "The Champion" : "—",
      };
    });
  }

  res.json({ season, standings });
});

export default router;
