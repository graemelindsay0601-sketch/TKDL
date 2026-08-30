/**
 * Boss Battle Mode routes.
 *
 * Pure arcade progress tracking — which bosses a player has beaten, so the
 * ladder screen knows what's unlocked. Never touches matches/Elo/stats;
 * matches played here aren't submitted anywhere else.
 *
 * - GET  /api/boss-battles/progress/:playerId - list of defeated boss IDs
 * - POST /api/boss-battles/complete           - record a boss defeat
 */

import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/boss-battles/progress/:playerId", async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    if (!Number.isFinite(playerId)) {
      res.status(400).json({ error: "Invalid playerId" });
      return;
    }
    const rows = await db.execute(sql`
      SELECT boss_id FROM boss_battle_progress WHERE player_id = ${playerId}
    `);
    res.json({ defeated: rows.rows.map((r: any) => r.boss_id as string) });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to load boss battle progress");
    res.status(500).json({ error: "Failed to load boss battle progress" });
  }
});

router.post("/boss-battles/complete", async (req: Request, res: Response) => {
  try {
    const { playerId, bossId } = req.body ?? {};
    const pid = parseInt(playerId, 10);
    if (!Number.isFinite(pid) || typeof bossId !== "string" || !bossId) {
      res.status(400).json({ error: "playerId and bossId are required" });
      return;
    }
    await db.execute(sql`
      INSERT INTO boss_battle_progress (player_id, boss_id)
      VALUES (${pid}, ${bossId})
      ON CONFLICT (player_id, boss_id) DO NOTHING
    `);
    res.json({ success: true });
  } catch (err) {
    (req as any).log?.error({ err }, "Failed to record boss battle completion");
    res.status(500).json({ error: "Failed to record boss battle completion" });
  }
});

export default router;
