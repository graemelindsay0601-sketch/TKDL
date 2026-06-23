import { Router } from "express";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db, playersTable, matchesTable, seasonsTable, seasonStandingsTable, achievementsTable, playerAchievementsTable } from "@workspace/db";
import { z } from "zod";
import { checkStatAchievements, checkMatchAchievements, retroactiveSweep } from "../lib/achievements";
import { applyEloChange, calcTier } from "../lib/elo";
import { getBatchingStats } from "../services/batchingService";
import { logger } from "../lib/logger";

const router = Router();

// ── PIN verification (stateless — PIN set via env var ADMIN_PIN, default 0601) ──
const ADMIN_PIN = process.env.ADMIN_PIN ?? "0601";

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

// ── Fix match result + auto-recalculate Elo/points/stats ─────────────────────
const FixMatchBody = z.object({
  winnerId: z.number().int().positive(),
  loserId:  z.number().int().positive(),
  stake:    z.number().int().min(0).optional(),
  notes:    z.string().optional(),
});

router.patch("/admin/matches/:id", async (req, res): Promise<void> => {
  const matchId = Number(req.params.id);
  if (isNaN(matchId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = FixMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { winnerId, loserId, notes } = parsed.data;
  if (winnerId === loserId) { res.status(400).json({ error: "Winner and loser must be different" }); return; }

  // Fetch original match
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }

  const stake = parsed.data.stake ?? match.stake;

  // Fetch all involved players (original + new, de-duped)
  const allIds = [...new Set([match.winnerId, match.loserId, winnerId, loserId])];
  const rows = await db.select().from(playersTable).where(inArray(playersTable.id, allIds));
  if (rows.length < allIds.length) { res.status(404).json({ error: "One or more players not found" }); return; }

  // Mutable copies keyed by player ID
  const pm = new Map(rows.map(p => [p.id, { ...p }]));

  // ── Step 1: Reverse original match effects ──────────────────────────────────
  const origW = pm.get(match.winnerId)!;
  const origL = pm.get(match.loserId)!;

  const loserWasElim = origL.status === "ELIMINATED" && (origL.points + match.stake) > 0;

  origW.elo               = Math.max(800, origW.elo - match.eloChange);
  origW.points            = Math.max(0, origW.points - match.stake);
  origW.seasonWins        = Math.max(0, origW.seasonWins - 1);
  origW.seasonGamesPlayed = Math.max(0, origW.seasonGamesPlayed - 1);
  origW.careerWins        = Math.max(0, origW.careerWins - 1);
  origW.careerGamesPlayed = Math.max(0, origW.careerGamesPlayed - 1);
  origW.careerPoints      = origW.careerPoints - match.stake;

  origL.elo               = origL.elo + match.eloChange;
  origL.points            = origL.points + match.stake;
  origL.seasonLosses      = Math.max(0, origL.seasonLosses - 1);
  origL.seasonGamesPlayed = Math.max(0, origL.seasonGamesPlayed - 1);
  origL.careerLosses      = Math.max(0, origL.careerLosses - 1);
  origL.careerGamesPlayed = Math.max(0, origL.careerGamesPlayed - 1);
  if (loserWasElim) origL.status = "ACTIVE";

  // ── Step 2: Apply new match result using reversed state ─────────────────────
  const newW = pm.get(winnerId)!;
  const newL = pm.get(loserId)!;

  const { newWinnerElo, newLoserElo, change: newEloChange } = applyEloChange(newW.elo, newL.elo);
  const newLoserPts    = Math.max(0, newL.points - stake);
  const newLoserElim   = newLoserPts === 0;

  newW.elo               = newWinnerElo;
  newW.points            = newW.points + stake;
  newW.seasonWins        = newW.seasonWins + 1;
  newW.seasonGamesPlayed = newW.seasonGamesPlayed + 1;
  newW.careerWins        = newW.careerWins + 1;
  newW.careerGamesPlayed = newW.careerGamesPlayed + 1;
  newW.careerPoints      = newW.careerPoints + stake;

  newL.elo               = newLoserElo;
  newL.points            = newLoserPts;
  newL.seasonLosses      = newL.seasonLosses + 1;
  newL.seasonGamesPlayed = newL.seasonGamesPlayed + 1;
  newL.careerLosses      = newL.careerLosses + 1;
  newL.careerGamesPlayed = newL.careerGamesPlayed + 1;
  newL.careerPoints      = newL.careerPoints - stake;
  if (newLoserElim) newL.status = "ELIMINATED";

  // ── Step 3: Persist all affected players ───────────────────────────────────
  for (const p of pm.values()) {
    await db.update(playersTable).set({
      elo:               p.elo,
      points:            p.points,
      seasonWins:        p.seasonWins,
      seasonLosses:      p.seasonLosses,
      seasonGamesPlayed: p.seasonGamesPlayed,
      careerWins:        p.careerWins,
      careerLosses:      p.careerLosses,
      careerGamesPlayed: p.careerGamesPlayed,
      careerPoints:      p.careerPoints,
      status:            p.status,
    }).where(eq(playersTable.id, p.id));
  }

  // ── Step 4: Update match record ─────────────────────────────────────────────
  const newWPlayer = pm.get(winnerId)!;
  const newLPlayer = pm.get(loserId)!;
  const [updated] = await db.update(matchesTable).set({
    winnerId,
    loserId,
    winnerName: newWPlayer.name,
    loserName:  newLPlayer.name,
    eloChange:  newEloChange,
    stake,
    ...(notes !== undefined ? { notes } : {}),
  }).where(eq(matchesTable.id, matchId)).returning();

  res.json({ match: updated, eloChange: newEloChange });
});

// ── Delete player (cascade all related data) ──────────────────────────────────
router.delete("/admin/players/:id", async (req, res): Promise<void> => {
  const playerId = Number(req.params.id);
  if (isNaN(playerId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [player] = await db.select({ id: playersTable.id, name: playersTable.name })
    .from(playersTable).where(eq(playersTable.id, playerId));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  // Cascade delete everything related to this player (raw SQL for non-Drizzle tables)
  await db.execute(sql`DELETE FROM player_achievements        WHERE player_id = ${playerId}`);
  await db.execute(sql`DELETE FROM season_standings           WHERE player_id = ${playerId}`);
  await db.execute(sql`DELETE FROM player_titles              WHERE player_id = ${playerId}`);
  await db.execute(sql`DELETE FROM shadow_bot_achievements    WHERE player_id = ${playerId}`);
  await db.execute(sql`DELETE FROM player_tour_achievements   WHERE player_id = ${playerId}`);
  await db.execute(sql`DELETE FROM tour_trophies              WHERE player_id = ${playerId}`);
  await db.execute(sql`DELETE FROM player_tour_runs           WHERE player_id = ${playerId}`);
  await db.execute(sql`DELETE FROM practice_sessions          WHERE player1_id = ${playerId} OR player2_id = ${playerId}`);
  await db.execute(sql`DELETE FROM users                      WHERE player_id = ${playerId}`);

  // Delete matches they appeared in (both as winner and loser)
  await db.delete(matchesTable).where(eq(matchesTable.winnerId, playerId));
  await db.delete(matchesTable).where(eq(matchesTable.loserId, playerId));

  // Update seasons if they were champion
  await db.execute(sql`UPDATE seasons SET champion_id = NULL, champion_name = NULL WHERE champion_id = ${playerId}`);

  // Finally delete the player
  await db.delete(playersTable).where(eq(playersTable.id, playerId));

  req.log.info({ playerId, name: player.name }, "Player deleted by admin");
  res.json({ ok: true, deleted: player.name });
});

// ── Override player Elo ────────────────────────────────────────────────────────
const EloOverrideBody = z.object({ elo: z.number().int().min(800).max(2000) });

router.patch("/admin/players/:id/elo", async (req, res): Promise<void> => {
  const playerId = Number(req.params.id);
  if (isNaN(playerId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = EloOverrideBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { elo } = parsed.data;
  const tier = elo >= 1400 ? "Diamond" : elo >= 1250 ? "Platinum" : elo >= 1100 ? "Gold" : elo >= 950 ? "Silver" : "Bronze";

  const [updated] = await db.update(playersTable)
    .set({ elo })
    .where(eq(playersTable.id, playerId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Player not found" }); return; }
  res.json({ ok: true, elo, tier });
});

// ── Retroactive achievement sweep ─────────────────────────────────────────────
router.post("/admin/achievement-sweep", async (_req, res): Promise<void> => {
  const result = await retroactiveSweep();
  res.json({ ok: true, ...result });
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

// ── Get all players (id + name) for admin dropdowns ────────────────────────────
router.get("/admin/players-list", async (_req, res): Promise<void> => {
  const players = await db.select({ id: playersTable.id, name: playersTable.name }).from(playersTable).orderBy(playersTable.name);
  res.json(players);
});

// ── Test comms: fire fake DM + notifications to Graeme (player 1) ────────────
router.post("/admin/test-comms", async (req, res): Promise<void> => {
  const GRAEME_ID = 1;
  const SEAN_ID   = 2;

  // Ensure messaging + notifications are enabled
  await db.execute(sql`
    INSERT INTO settings (key, value) VALUES
      ('messaging_enabled',    'true'),
      ('notifications_enabled','true'),
      ('community_enabled',    'true')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `);

  // 1. Fake DM from Sean → Graeme
  const dmResult = await db.execute(sql`
    INSERT INTO direct_messages (sender_id, receiver_id, content)
    VALUES (${SEAN_ID}, ${GRAEME_ID}, '🎯 Test message — comms are working! Nice game today.')
    RETURNING id
  `);
  const dmId = (dmResult.rows[0] as any).id as number;

  // 2. DM notification for Graeme
  await db.execute(sql`
    INSERT INTO notifications (player_id, type, actor_id, entity_id, entity_type, message)
    VALUES (
      ${GRAEME_ID}, 'dm_received', ${SEAN_ID}, ${dmId}, 'message',
      'New message from Sean'
    )
  `);

  // 3. Fake post_liked notification (as if Sean liked a post by Graeme)
  await db.execute(sql`
    INSERT INTO notifications (player_id, type, actor_id, entity_id, entity_type, message)
    VALUES (
      ${GRAEME_ID}, 'post_liked', ${SEAN_ID}, NULL, 'post',
      'Sean reacted 🎯 to your post'
    )
  `);

  // 4. Fake community post from Sean (auto-approved so it appears in feed)
  const postResult = await db.execute(sql`
    INSERT INTO community_posts (player_id, content, post_type, status)
    VALUES (${SEAN_ID}, '🎯 Test post — community feed working!', 'manual', 'approved')
    RETURNING id
  `);
  const postId = (postResult.rows[0] as any).id as number;

  // 5. post_commented notification — as if Sean commented on a post by Graeme
  await db.execute(sql`
    INSERT INTO notifications (player_id, type, actor_id, entity_id, entity_type, message)
    VALUES (
      ${GRAEME_ID}, 'post_commented', ${SEAN_ID}, ${postId}, 'comment',
      'Sean commented on your post'
    )
  `);

  res.json({
    ok: true,
    sent: {
      dm: { id: dmId, from: "Sean", to: "Graeme", content: "🎯 Test message — comms are working!" },
      notifications: 3,
      communityPost: { id: postId, status: "approved" },
    },
  });
});

// ── Test Coach Tips (manually trigger) ────────────────────────────────────────
router.post("/admin/test-coach-tips", async (req, res): Promise<void> => {
  try {
    // Get global test function (set by coachTipsScheduler)
    const testFn = (global as any).TKDL_testCoachTips;
    
    if (!testFn) {
      res.status(500).json({
        error: "Coach tips scheduler not initialized"
      });
      return;
    }

    // Run the coach tips generator immediately
    await testFn();

    res.json({
      ok: true,
      message: "Coach tips generated and sent to eligible players",
      triggered_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error("Error in test-coach-tips", { error });
    res.status(500).json({
      error: "Failed to generate coach tips",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// ── Notification Batching Stats ──────────────────────────────────────────────
router.get("/admin/batching-stats", async (_req, res): Promise<void> => {
  try {
    const stats = await getBatchingStats();
    res.json({
      ok: true,
      batching: stats,
      quiet_hours: {
        start: "23:00",
        end: "08:00",
        description: "11 PM to 8 AM UTC"
      },
      daily_limit: 3,
      note: "Critical notifications (threat_alert, announcement) bypass all batching rules"
    });
  } catch (error) {
    logger.error("Error getting batching stats", { error });
    res.status(500).json({
      error: "Failed to fetch batching stats",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// ── Full data export (JSON backup) ────────────────────────────────────────────
router.get("/admin/export", async (_req, res): Promise<void> => {
  const [players, matches, seasons, standings, achievements, playerAchievements] = await Promise.all([
    db.select().from(playersTable),
    db.select().from(matchesTable),
    db.select().from(seasonsTable),
    db.select().from(seasonStandingsTable),
    db.select().from(achievementsTable),
    db.select().from(playerAchievementsTable),
  ]);
  const filename = `tkdl-backup-${new Date().toISOString().split("T")[0]}.json`;
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.json({
    exportedAt: new Date().toISOString(),
    version: "1.0",
    data: { players, matches, seasons, standings, achievements, playerAchievements },
  });
});

// ── Feature Flags Management (admin only) ──────────────────────────────────────
import {
  getAllFeatureFlags,
  getFeatureStatus,
  enableFeatureForAll,
  disableFeature,
  setAdminTestMode,
  initializeFeatureFlags,
} from "../services/feature-flags-service";

router.get("/admin/feature-flags", verifyAdminPin, async (_req, res): Promise<void> => {
  const flags = await getAllFeatureFlags();
  res.json(flags);
});

router.post("/admin/feature-flags/:feature/enable-all", verifyAdminPin, async (req, res): Promise<void> => {
  const { feature } = req.params;
  const success = await enableFeatureForAll(feature);
  if (success) {
    res.json({ ok: true, message: `Feature ${feature} enabled for all users` });
  } else {
    res.status(500).json({ ok: false, error: "Failed to enable feature" });
  }
});

router.post("/admin/feature-flags/:feature/disable", verifyAdminPin, async (req, res): Promise<void> => {
  const { feature } = req.params;
  const success = await disableFeature(feature);
  if (success) {
    res.json({ ok: true, message: `Feature ${feature} disabled` });
  } else {
    res.status(500).json({ ok: false, error: "Failed to disable feature" });
  }
});

router.post("/admin/feature-flags/:feature/admin-test", verifyAdminPin, async (req, res): Promise<void> => {
  const { feature } = req.params;
  const { enabled } = req.body;
  const success = await setAdminTestMode(feature, enabled === true);
  if (success) {
    res.json({
      ok: true,
      message: `Feature ${feature} admin test mode set to ${enabled}`,
    });
  } else {
    res.status(500).json({ ok: false, error: "Failed to update admin test mode" });
  }
});

router.post("/admin/feature-flags/initialize", verifyAdminPin, async (_req, res): Promise<void> => {
  await initializeFeatureFlags();
  res.json({ ok: true, message: "Feature flags initialized" });
});

export default router;
