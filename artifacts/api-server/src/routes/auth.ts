import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, playersTable } from "@workspace/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { logger } from "../lib/logger";

const router = Router();

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(6),
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

  (req.session as any).userId = user.id;
  (req.session as any).isAdmin = user.isAdmin;

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

// ── Admin auth guard ──────────────────────────────────────────────────────────
// Accepts EITHER a valid admin session OR the X-Admin-Pin header (same PIN
// used by the admin UI and by the seasons routes).
const ADMIN_PIN = process.env.ADMIN_PIN ?? "0601";
function requireAdmin(req: any, res: any): boolean {
  const pinHeader = req.headers["x-admin-pin"];
  if (pinHeader && pinHeader === ADMIN_PIN) return true;

  const userId = (req.session as any).userId;
  const isAdmin = (req.session as any).isAdmin;
  if (!userId || !isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get("/admin/users", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
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
  password: z.string().min(4),
  isAdmin:  z.boolean().optional().default(false),
});

router.post("/admin/users", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, parsed.data.playerId));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

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
  }).returning({ id: usersTable.id, username: usersTable.username, playerId: usersTable.playerId, isAdmin: usersTable.isAdmin });

  logger.info({ userId: user.id, username: user.username }, "Account created");
  res.status(201).json({ ...user, playerName: player.name });
});

// ── POST /api/admin/users/:id/reset-password ──────────────────────────────────
const ResetPasswordBody = z.object({ password: z.string().min(4) });

router.post("/admin/users/:id/reset-password", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
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
