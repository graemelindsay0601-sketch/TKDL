import { Router } from "express";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db, playersTable, matchesTable, seasonsTable, seasonStandingsTable, achievementsTable, playerAchievementsTable } from "@workspace/db";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { checkStatAchievements, checkMatchAchievements, retroactiveSweep } from "../lib/achievements";
import { applyEloChange, calcTier } from "../lib/elo";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { createAnnouncement, getNotificationAnalytics } from "../services/notificationService";
import { drawDoublesTeams } from "../lib/doublesDraw";

const router = Router();

// ── PIN verification (stateless — PIN set via env var ADMIN_PIN, default 0601) ──
const ADMIN_PIN = process.env.ADMIN_PIN ?? "0601";

const pinRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many PIN attempts — try again in 15 minutes" },
  keyGenerator: (req) => (req.ip ?? "unknown"),
  skip: () => process.env.NODE_ENV !== "production",
});

router.post("/admin/verify-pin", pinRateLimit, (req, res): void => {
  const { pin } = req.body ?? {};
  if (pin === ADMIN_PIN) {
    (req.session as any).isAdmin = true;
    req.session.save(() => {});
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: "Incorrect PIN" });
  }
});

// ── All routes below require admin session ─────────────────────────────────────
router.use(/^\/admin\/(?!verify-pin)/, requireAdminSession);

// Clears the admin session flag. Used by the "Lock" button in the admin UI —
// without this, clicking Lock only hid the client-side UI while the server
// session (and therefore every admin API call) stayed authorized until it
// naturally expired.
router.post("/admin/lock", (req, res): void => {
  (req.session as any).isAdmin = false;
  req.session.save(() => res.json({ ok: true }));
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

  const existing = await db.select().from(seasonStandingsTable)
    .where(and(eq(seasonStandingsTable.seasonId, seasonId), eq(seasonStandingsTable.playerId, playerId)));

  if (existing.length > 0) {
    await db.update(seasonStandingsTable)
      .set({ position, wins, losses, points, elo, ...(isChampion !== undefined ? { isChampion } : {}) })
      .where(and(eq(seasonStandingsTable.seasonId, seasonId), eq(seasonStandingsTable.playerId, playerId)));
  } else {
    await db.insert(seasonStandingsTable).values({ seasonId, playerId, position, wins, losses, points, elo, isChampion: isChampion ?? false });
  }

  if (isChampion) {
    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
    if (player) {
      await db.update(seasonsTable).set({ championId: playerId, championName: player.name }).where(eq(seasonsTable.id, seasonId));
    }
    await db.update(seasonStandingsTable)
      .set({ isChampion: false })
      .where(and(eq(seasonStandingsTable.seasonId, seasonId)));
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

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }

  const stake = parsed.data.stake ?? match.stake;

  const allIds = [...new Set([match.winnerId, match.loserId, winnerId, loserId])];
  const rows = await db.select().from(playersTable).where(inArray(playersTable.id, allIds));
  if (rows.length < allIds.length) { res.status(404).json({ error: "One or more players not found" }); return; }

  const pm = new Map(rows.map(p => [p.id, { ...p }]));

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

  await db.execute(sql`DELETE FROM player_achievements        WHERE player_id = ${playerId}`);
  await db.execute(sql`DELETE FROM season_standings           WHERE player_id = ${playerId}`);
  await db.execute(sql`DELETE FROM player_titles              WHERE player_id = ${playerId}`);
  await db.execute(sql`DELETE FROM shadow_bot_achievements    WHERE player_id = ${playerId}`);
  await db.execute(sql`DELETE FROM player_tour_achievements   WHERE player_id = ${playerId}`);
  await db.execute(sql`DELETE FROM tour_trophies              WHERE player_id = ${playerId}`);
  await db.execute(sql`DELETE FROM player_tour_runs           WHERE player_id = ${playerId}`);
  await db.execute(sql`DELETE FROM practice_sessions          WHERE player1_id = ${playerId} OR player2_id = ${playerId}`);
  await db.execute(sql`DELETE FROM users                      WHERE player_id = ${playerId}`);

  await db.delete(matchesTable).where(eq(matchesTable.winnerId, playerId));
  await db.delete(matchesTable).where(eq(matchesTable.loserId, playerId));

  await db.execute(sql`UPDATE seasons SET champion_id = NULL, champion_name = NULL WHERE champion_id = ${playerId}`);

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

// ── Get all seasons with standings for admin (3 queries total, not N+1) ───────
router.get("/admin/seasons", async (_req, res): Promise<void> => {
  const seasons = await db.select().from(seasonsTable).orderBy(seasonsTable.id);
  if (seasons.length === 0) { res.json([]); return; }

  const seasonIds = seasons.map(s => s.id);
  const [allStandings, allPlayers] = await Promise.all([
    db.select().from(seasonStandingsTable).where(inArray(seasonStandingsTable.seasonId, seasonIds)),
    db.select({ id: playersTable.id, name: playersTable.name }).from(playersTable),
  ]);

  const playerMap = new Map(allPlayers.map(p => [p.id, p.name]));
  const standingsBySeason = new Map<number, typeof allStandings>();
  for (const s of allStandings) {
    if (!standingsBySeason.has(s.seasonId)) standingsBySeason.set(s.seasonId, []);
    standingsBySeason.get(s.seasonId)!.push(s);
  }

  const result = seasons.map(season => ({
    ...season,
    standings: (standingsBySeason.get(season.id) ?? [])
      .map(s => ({ ...s, playerName: playerMap.get(s.playerId) ?? "Unknown" }))
      .sort((a, b) => a.position - b.position),
  }));

  res.json(result);
});

// ── Admin announcements — push a message to all (or specific) players ───────
// The delivery pipeline (createAnnouncement -> createNotification -> real
// push + in-app notification row) already existed in notificationService.ts;
// it just never had a route in front of it, and was silently failing until
// the notifications table above got its missing columns (see seedCommunityTables).
const CREATE_ANNOUNCEMENT_ADMIN_ID = 1; // Graeme — the one real admin, matches the convention already used by /admin/test-comms below

const AnnouncementBody = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  target_players: z.array(z.number().int().positive()).nullable().optional(),
  critical: z.boolean().optional(),
});

router.post("/admin/announcements", requireAdminSession, async (req, res): Promise<void> => {
  const parsed = AnnouncementBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { title, body, target_players, critical } = parsed.data;
  try {
    const announcementId = await createAnnouncement(
      CREATE_ANNOUNCEMENT_ADMIN_ID, title, body, target_players ?? null, critical ?? false
    );
    res.json({ ok: true, id: announcementId });
  } catch (err) {
    req.log.error({ err }, "POST /admin/announcements failed");
    res.status(500).json({ error: "Failed to send announcement" });
  }
});

// ── Notification analytics — open/click rates over the last 30 days ─────────
router.get("/admin/notifications/analytics", requireAdminSession, async (req, res): Promise<void> => {
  try {
    const stats = await getNotificationAnalytics();
    res.json({
      total_sent:    Number(stats?.total_sent ?? 0),
      total_opened:  Number(stats?.total_opened ?? 0),
      open_rate:     Number(stats?.open_rate ?? 0),
      total_clicked: Number(stats?.total_clicked ?? 0),
      click_rate:    Number(stats?.click_rate ?? 0),
    });
  } catch (err) {
    req.log.error({ err }, "GET /admin/notifications/analytics failed");
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

// ── Test comms: fire fake DM + notifications to Graeme (player 1) ────────────
router.post("/admin/test-comms", async (req, res): Promise<void> => {
  const GRAEME_ID = 1;
  const SEAN_ID   = 2;

  await db.execute(sql`
    INSERT INTO settings (key, value) VALUES
      ('messaging_enabled',    'true'),
      ('notifications_enabled','true'),
      ('community_enabled',    'true')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `);

  const dmResult = await db.execute(sql`
    INSERT INTO direct_messages (sender_id, receiver_id, content)
    VALUES (${SEAN_ID}, ${GRAEME_ID}, '🎯 Test message — comms are working! Nice game today.')
    RETURNING id
  `);
  const dmId = (dmResult.rows[0] as any).id as number;

  await db.execute(sql`
    INSERT INTO notifications (player_id, type, actor_id, entity_id, entity_type, message)
    VALUES (
      ${GRAEME_ID}, 'dm_received', ${SEAN_ID}, ${dmId}, 'message',
      'New message from Sean'
    )
  `);

  await db.execute(sql`
    INSERT INTO notifications (player_id, type, actor_id, entity_id, entity_type, message)
    VALUES (
      ${GRAEME_ID}, 'post_liked', ${SEAN_ID}, NULL, 'post',
      'Sean reacted 🎯 to your post'
    )
  `);

  const postResult = await db.execute(sql`
    INSERT INTO community_posts (player_id, content, post_type, status)
    VALUES (${SEAN_ID}, '🎯 Test post — community feed working!', 'manual', 'approved')
    RETURNING id
  `);
  const postId = (postResult.rows[0] as any).id as number;

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

// ── Full data export (JSON backup) — requires admin session ───────────────────
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

// ── Doubles event: random team draw for a season ───────────────────────────────
// Draw logic itself lives in lib/doublesDraw.ts, shared with the automatic
// reroll that happens at the start of every new season (see seasonReset.ts) —
// this route is now just the manual "reroll" trigger from the admin panel.
const DoublesDrawBody = z.object({ force: z.boolean().optional().default(false) });

router.post("/admin/seasons/:id/doubles/draw", async (req, res): Promise<void> => {
  const seasonId = Number(req.params.id);
  if (isNaN(seasonId)) { res.status(400).json({ error: "Invalid season id" }); return; }
  const parsed = DoublesDrawBody.safeParse(req.body ?? {});
  const force = parsed.success ? parsed.data.force : false;

  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, seasonId));
  if (!season) { res.status(404).json({ error: "Season not found" }); return; }

  const result = await drawDoublesTeams(seasonId, { force });
  if (!result.ok) {
    const status = result.error.startsWith("Doubles teams already exist") ? 409 : 400;
    res.status(status).json({ error: result.error });
    return;
  }
  res.status(201).json({ teams: result.teams });
});

export default router;
