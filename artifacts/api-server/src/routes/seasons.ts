import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, seasonsTable, playersTable, seasonStandingsTable } from "@workspace/db";
import { z } from "zod";
import { performSeasonReset } from "../lib/seasonReset";
import { calcTier } from "../lib/elo";
import { computeIdentity } from "../lib/identity";

const GetSeasonParams  = z.object({ id: z.coerce.number().int().positive() });
const ResetSeasonBody  = z.object({ name: z.string().optional() });

const router = Router();

router.get("/seasons", async (_req, res): Promise<void> => {
  const seasons = await db.select().from(seasonsTable).orderBy(desc(seasonsTable.id));
  const allPlayers = await db.select({ id: playersTable.id, name: playersTable.name }).from(playersTable);
  const playerMap = new Map(allPlayers.map(p => [p.id, p.name]));
  const enriched = seasons.map(s => ({
    ...s,
    championName: s.championId ? (playerMap.get(s.championId) ?? null) : null,
  }));
  res.json(enriched);
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

// ── Playoff endpoints ──────────────────────────────────────────────────────────

const ADMIN_PIN = process.env.ADMIN_PIN ?? "0601";

function requireAdmin(req: any, res: any): boolean {
  const pin = req.headers["x-admin-pin"] ?? req.body?.adminPin;
  if (pin !== ADMIN_PIN) {
    res.status(401).json({ error: "Admin PIN required" });
    return false;
  }
  return true;
}

const PlayoffMatchBody = z.object({
  player1Id: z.number().int().positive(),
  player2Id: z.number().int().positive(),
  winnerId:  z.number().int().positive().optional(),
  round:     z.string().default("final"),
  gameType:  z.string().default("Best of 3"),
  notes:     z.string().optional(),
});

router.get("/seasons/:id/playoff", async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db.execute(
    sql`SELECT pm.*, 
        p1.name as player1_name, p2.name as player2_name, 
        pw.name as winner_name
        FROM playoff_matches pm
        JOIN players p1 ON p1.id = pm.player1_id
        JOIN players p2 ON p2.id = pm.player2_id
        LEFT JOIN players pw ON pw.id = pm.winner_id
        WHERE pm.season_id = ${params.data.id}
        ORDER BY pm.played_at ASC`
  );
  res.json(rows.rows);
});

router.post("/seasons/:id/playoff", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const params = GetSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = PlayoffMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { player1Id, player2Id, winnerId, round, gameType, notes } = parsed.data;
  const [row] = await db.execute(
    sql`INSERT INTO playoff_matches (season_id, player1_id, player2_id, winner_id, round, game_type, notes)
        VALUES (${params.data.id}, ${player1Id}, ${player2Id}, ${winnerId ?? null}, ${round}, ${gameType}, ${notes ?? null})
        RETURNING *`
  ) as any;

  // If we have a winner and this is the final, crown them as season champion
  if (winnerId && round === "final") {
    await db.update(seasonsTable)
      .set({ championId: winnerId, playoffPending: false } as any)
      .where(eq(seasonsTable.id, params.data.id));
    // Update standings isChampion
    await db.execute(sql`UPDATE season_standings SET is_champion = false WHERE season_id = ${params.data.id}`);
    await db.execute(sql`UPDATE season_standings SET is_champion = true WHERE season_id = ${params.data.id} AND player_id = ${winnerId}`);
  }

  res.status(201).json(row);
});

router.patch("/seasons/:id/playoff/:matchId", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const params = GetSeasonParams.safeParse(req.params);
  const matchId = parseInt((req.params as any).matchId, 10);
  if (!params.success || isNaN(matchId)) { res.status(400).json({ error: "Invalid params" }); return; }
  const parsed = PlayoffMatchBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const sets: string[] = [];
  const vals: any[] = [];
  if (parsed.data.winnerId !== undefined) { sets.push(`winner_id = $${sets.length+1}`); vals.push(parsed.data.winnerId); }
  if (parsed.data.notes !== undefined) { sets.push(`notes = $${sets.length+1}`); vals.push(parsed.data.notes); }
  if (parsed.data.round !== undefined) { sets.push(`round = $${sets.length+1}`); vals.push(parsed.data.round); }
  if (sets.length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }

  await db.execute(sql`UPDATE playoff_matches SET winner_id = ${parsed.data.winnerId ?? null} WHERE id = ${matchId} AND season_id = ${params.data.id}`);

  // Crown champion if final match has winner
  if (parsed.data.winnerId && (parsed.data.round === "final" || !parsed.data.round)) {
    const [match] = (await db.execute(sql`SELECT round FROM playoff_matches WHERE id = ${matchId}`)).rows as any[];
    if (match?.round === "final") {
      await db.update(seasonsTable).set({ championId: parsed.data.winnerId, playoffPending: false } as any).where(eq(seasonsTable.id, params.data.id));
      await db.execute(sql`UPDATE season_standings SET is_champion = false WHERE season_id = ${params.data.id}`);
      await db.execute(sql`UPDATE season_standings SET is_champion = true WHERE season_id = ${params.data.id} AND player_id = ${parsed.data.winnerId}`);
    }
  }

  res.json({ ok: true });
});

router.delete("/seasons/:id/playoff/:matchId", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const params = GetSeasonParams.safeParse(req.params);
  const matchId = parseInt((req.params as any).matchId, 10);
  if (!params.success || isNaN(matchId)) { res.status(400).json({ error: "Invalid params" }); return; }
  await db.execute(sql`DELETE FROM playoff_matches WHERE id = ${matchId} AND season_id = ${params.data.id}`);
  res.json({ ok: true });
});

export default router;
