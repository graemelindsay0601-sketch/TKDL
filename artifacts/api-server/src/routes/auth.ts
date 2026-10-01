import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, playersTable } from "@workspace/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { logger } from "../lib/logger";
import { requireAdminSession } from "../middleware/requireAdminSession";

const router = Router();

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8),
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Username and password required" }); return; }

  const { username, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username.toLowerCase().trim()));
  if (!user) { res.status(401).json({ error: "Invalid username or password" }); return; }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { res.status(401).json({ error: "Invalid username or password" }); return; }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, user.playerId));

  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  (req.session as any).userId   = user.id;
  (req.session as any).isAdmin  = user.isAdmin;
  (req.session as any).playerId = user.playerId;

  req.log.info({ userId: user.id, username: user.username }, "User logged in");
  res.json({
    id:       user.id,
    username: user.username,
    isAdmin:  user.isAdmin,
    playerId: user.playerId,
    playerName: player?.name ?? username,
  });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.clearCookie("tkdl.sid");
    res.sendStatus(204);
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(401).json({ error: "Session invalid" }); return; }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, user.playerId));

  res.json({
    id:          user.id,
    username:    user.username,
    isAdmin:     user.isAdmin,
    playerId:    user.playerId,
    playerName:  player?.name ?? user.username,
    lastLoginAt: user.lastLoginAt,
  });
});

// ── PATCH /api/auth/password ──────────────────────────────────────────────────
router.patch("/auth/password", async (req, res): Promise<void> => {
  const userId = (req.session as any).userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(401).json({ error: "Session invalid" }); return; }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) { res.status(400).json({ error: "Current password is incorrect" }); return; }

  const hash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, user.id));

  req.log.info({ userId: user.id }, "Password changed");
  res.json({ ok: true });
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get("/admin/users", requireAdminSession, async (req, res): Promise<void> => {
  const users = await db.select({
    id:          usersTable.id,
    username:    usersTable.username,
    playerId:    usersTable.playerId,
    isAdmin:     usersTable.isAdmin,
    lastLoginAt: usersTable.lastLoginAt,
    createdAt:   usersTable.createdAt,
  }).from(usersTable);

  const players = await db.select({ id: playersTable.id, name: playersTable.name }).from(playersTable);
  const pm = new Map(players.map(p => [p.id, p.name]));

  res.json(users.map(u => ({ ...u, playerName: pm.get(u.playerId) ?? "Unknown" })));
});

// ── POST /api/admin/users ─────────────────────────────────────────────────────
const CreateUserBody = z.object({
  playerId: z.number().int().positive(),
  password: z.string().min(8),
  isAdmin:  z.boolean().optional().default(false),
});

const OnboardPlayerBody = z.object({
  name:             z.string().trim().min(1).max(80),
  password:         z.string().min(8),
  isAdmin:          z.boolean().optional().default(false),
  isActive:         z.boolean().optional().default(true),
  practiceEnabled:  z.boolean().optional().default(true),
  tourEnabled:      z.boolean().optional().default(true),
  m501Enabled:      z.boolean().optional().default(true),
  shadowBotEnabled: z.boolean().optional().default(true),
});

// Create the league profile and login together. Previously the admin page made
// two separate requests, so a failed account insert left an orphaned player.
router.post("/admin/onboard-player", requireAdminSession, async (req, res): Promise<void> => {
  const parsed = OnboardPlayerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const result = await db.transaction(async tx => {
      // Serialise player-code allocation so two admins cannot both choose P012.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('tkdl-player-code'))`);

      const duplicate = await tx.execute(sql`
        SELECT id FROM players WHERE lower(trim(name)) = lower(${parsed.data.name}) LIMIT 1
      `);
      if (duplicate.rows.length > 0) throw new Error("PLAYER_NAME_EXISTS");

      const nextCode = await tx.execute(sql`
        SELECT COALESCE(MAX(
          CASE WHEN player_id ~ '^P[0-9]+$' THEN substring(player_id FROM 2)::integer ELSE 0 END
        ), 0) + 1 AS next_number
        FROM players
      `);
      const nextNumber = Number((nextCode.rows[0] as any)?.next_number ?? 1);
      const playerCode = `P${String(nextNumber).padStart(3, "0")}`;

      const [player] = await tx.insert(playersTable).values({
        name: parsed.data.name,
        playerId: playerCode,
        status: parsed.data.isActive ? "ACTIVE" : "INACTIVE",
        isActive: parsed.data.isActive,
        points: 25,
        peakPoints: 25,
        practiceEnabled: parsed.data.practiceEnabled,
        tourEnabled: parsed.data.tourEnabled,
        m501Enabled: parsed.data.m501Enabled,
        shadowBotEnabled: parsed.data.shadowBotEnabled,
      }).returning();

      const baseUsername = player.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || `player_${player.id}`;
      const usernameRows = await tx.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, baseUsername));
      const username = usernameRows.length > 0 ? `${baseUsername}_${player.id}` : baseUsername;
      const passwordHash = await bcrypt.hash(parsed.data.password, 12);
      const [user] = await tx.insert(usersTable).values({
        username,
        passwordHash,
        playerId: player.id,
        isAdmin: parsed.data.isAdmin,
      }).returning({ id: usersTable.id, username: usersTable.username, playerId: usersTable.playerId, isAdmin: usersTable.isAdmin });

      return { player, user };
    });

    logger.info({ playerId: result.player.id, userId: result.user.id }, "Player and account onboarded");
    res.status(201).json({ player: result.player, user: { ...result.user, playerName: result.player.name } });
  } catch (err) {
    if (err instanceof Error && err.message === "PLAYER_NAME_EXISTS") {
      res.status(409).json({ error: "A player with this name already exists" });
      return;
    }
    logger.error({ err }, "Player onboarding failed");
    res.status(500).json({ error: "Could not create the player and account. Nothing was added." });
  }
});

router.post("/admin/users", requireAdminSession, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, parsed.data.playerId));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  // A cheap, unlocked early-reject for the common case — not safe to build
  // the actual insert from: two admins (or a double-submit) could both
  // pass this check for the same player and both insert, giving one
  // player two accounts, since nothing previously stopped it. The insert
  // below is the real guard, via the player_id unique index added in
  // add_users_player_id_unique.ts.
  const existing = await db.select().from(usersTable).where(eq(usersTable.playerId, parsed.data.playerId));
  if (existing.length > 0) { res.status(400).json({ error: "This player already has an account" }); return; }

  const username = player.name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  const existingUsername = await db.select().from(usersTable).where(eq(usersTable.username, username));
  const finalUsername = existingUsername.length > 0 ? `${username}_${parsed.data.playerId}` : username;

  const hash = await bcrypt.hash(parsed.data.password, 12);
  const [user] = await db.insert(usersTable).values({
    username:     finalUsername,
    passwordHash: hash,
    playerId:     parsed.data.playerId,
    isAdmin:      parsed.data.isAdmin,
  })
    .onConflictDoNothing({ target: usersTable.playerId })
    .returning({ id: usersTable.id, username: usersTable.username, playerId: usersTable.playerId, isAdmin: usersTable.isAdmin });

  if (!user) {
    // Lost the race between the pre-check above and this insert — another
    // request for the same player committed first.
    res.status(400).json({ error: "This player already has an account" });
    return;
  }

  logger.info({ userId: user.id, username: user.username }, "Account created");
  res.status(201).json({ ...user, playerName: player.name });
});

// ── POST /api/admin/users/:id/reset-password ──────────────────────────────────
const ResetPasswordBody = z.object({ password: z.string().min(8) });

router.post("/admin/users/:id/reset-password", requireAdminSession, async (req, res): Promise<void> => {
  const userId = Number(req.params.id);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const hash = await bcrypt.hash(parsed.data.password, 12);
  await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, userId));

  logger.info({ userId }, "Password reset by admin");
  res.json({ ok: true, username: user.username });
});

export default router;
