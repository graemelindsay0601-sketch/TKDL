import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, playersTable, matchesTable, seasonsTable, seasonStandingsTable, playerAchievementsTable } from "@workspace/db";
import { z } from "zod";
import { checkStatAchievements, checkMatchAchievements } from "../lib/achievements";

const router = Router();

// ── PIN verification (stateless — PIN set via env var ADMIN_PIN, default 1234) ──
const ADMIN_PIN = process.env.ADMIN_PIN ?? "1234";

router.post("/admin/verify-pin", (req, res): void => {
  const { pin } = req.body ?? {};
  if (pin === ADMIN_PIN) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: "Incorrect PIN" });
  }
});

// ── Fix / update standings for a specific season ──────────────────────────────
const UpdateStandingBody = z.object({
  playerId:   z.number().int().positive(),
  position:   z.number().int().positive(),
  wins:       z.number().int().min(0),
  losses:     z.number().int().min(0),
  points:     z.number().int().min(0),
  elo:        z.number().int().min(800),
  isChampion: z.boolean().optional(),
});

router.patch("/admin/seasons/:id/standings/:playerId", async (req, res): Promise<void> => {
  const seasonId = Number(req.params.id);
  const playerId = Number(req.params.playerId);
  if (isNaN(seasonId) || isNaN(playerId)) { res.status(400).json({ error: "Invalid params" }); return; }

  const parsed = UpdateStandingBody.safeParse({ ...req.body, playerId });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { position, wins, losses, points, elo, isChampion } = parsed.data;

  // Upsert standing
  const existing = await db.select().from(seasonStandingsTable)
    .where(and(eq(seasonStandingsTable.seasonId, seasonId), eq(seasonStandingsTable.playerId, playerId)));

  if (existing.length > 0) {
    await db.update(seasonStandingsTable)
      .set({ position, wins, losses, points, elo, ...(isChampion !== undefined ? { isChampion } : {}) })
      .where(and(eq(seasonStandingsTable.seasonId, seasonId), eq(seasonStandingsTable.playerId, playerId)));
  } else {
    await db.insert(seasonStandingsTable).values({ seasonId, playerId, position, wins, losses, points, elo, isChampion: isChampion ?? false });
  }

  // If setting champion, update the season row too
  if (isChampion) {
    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
    if (player) {
      await db.update(seasonsTable).set({ championId: playerId, championName: player.name }).where(eq(seasonsTable.id, seasonId));
    }
    // Clear other champions in this season
    await db.update(seasonStandingsTable)
      .set({ isChampion: false })
      .where(and(eq(seasonStandingsTable.seasonId, seasonId)));
    // Re-set this one
    await db.update(seasonStandingsTable)
      .set({ isChampion: true })
      .where(and(eq(seasonStandingsTable.seasonId, seasonId), eq(seasonStandingsTable.playerId, playerId)));
  }

  res.json({ ok: true });
});

// ── Update season meta (name, format, playoffPending, notes, champion) ────────
const UpdateSeasonBody = z.object({
  name:           z.string().min(1).optional(),
  format:         z.string().optional(),
  playoffPending: z.boolean().optional(),
  notes:          z.string().optional(),
  championId:     z.number().int().optional().nullable(),
  championName:   z.string().optional().nullable(),
});

router.patch("/admin/seasons/:id", async (req, res): Promise<void> => {
  const seasonId = Number(req.params.id);
  if (isNaN(seasonId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateSeasonBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [updated] = await db.update(seasonsTable).set(parsed.data).where(eq(seasonsTable.id, seasonId)).returning();
  if (!updated) { res.status(404).json({ error: "Season not found" }); return; }
  res.json(updated);
});

// ── Fix match result (correct winner/loser for an existing match) ─────────────
const FixMatchBody = z.object({
  winnerId:   z.number().int().positive(),
  loserId:    z.number().int().positive(),
  winnerName: z.string().optional(),
  loserName:  z.string().optional(),
  stake:      z.number().int().min(1).optional(),
  notes:      z.string().optional(),
});

router.patch("/admin/matches/:id", async (req, res): Promise<void> => {
  const matchId = Number(req.params.id);
  if (isNaN(matchId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = FixMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { winnerId, loserId, stake, notes } = parsed.data;
  const [winner] = await db.select().from(playersTable).where(eq(playersTable.id, winnerId));
  const [loser]  = await db.select().from(playersTable).where(eq(playersTable.id, loserId));
  if (!winner || !loser) { res.status(404).json({ error: "Player not found" }); return; }

  const [updated] = await db.update(matchesTable).set({
    winnerId,
    loserId,
    winnerName: winner.name,
    loserName:  loser.name,
    ...(stake !== undefined ? { stake } : {}),
    ...(notes !== undefined ? { notes } : {}),
  }).where(eq(matchesTable.id, matchId)).returning();

  if (!updated) { res.status(404).json({ error: "Match not found" }); return; }
  res.json(updated);
});

// ── Retroactive achievement sweep ─────────────────────────────────────────────
router.post("/admin/sweep-achievements", async (_req, res): Promise<void> => {
  const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));
  let totalGranted = 0;

  for (const player of players) {
    // Count achievements before
    const before = await db.select().from(playerAchievementsTable).where(eq(playerAchievementsTable.playerId, player.id));
    await checkStatAchievements(player.id);
    const after = await db.select().from(playerAchievementsTable).where(eq(playerAchievementsTable.playerId, player.id));
    totalGranted += after.length - before.length;
  }

  res.json({ ok: true, totalGranted, playersChecked: players.length });
});

// ── Get all seasons with standings for admin ──────────────────────────────────
router.get("/admin/seasons", async (_req, res): Promise<void> => {
  const seasons = await db.select().from(seasonsTable).orderBy(seasonsTable.id);
  const result = [];
  for (const season of seasons) {
    const standings = await db.select().from(seasonStandingsTable).where(eq(seasonStandingsTable.seasonId, season.id));
    const players = await db.select({ id: playersTable.id, name: playersTable.name }).from(playersTable);
    const playerMap = new Map(players.map(p => [p.id, p.name]));
    const standingsWithNames = standings.map(s => ({
      ...s,
      playerName: playerMap.get(s.playerId) ?? "Unknown",
    })).sort((a, b) => a.position - b.position);
    result.push({ ...season, standings: standingsWithNames });
  }
  res.json(result);
});

export default router;
