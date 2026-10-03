import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/match-posters — the Poster Library gallery feed.
//
// Withdrawn posters (see the withdraw/restore routes below) are excluded by
// default, same as a soft-deleted row anywhere else in this app. An admin
// who has already verified the PIN this session can pass ?includeWithdrawn=1
// to see them too (so they have somewhere to find and restore one) — the
// flag is ignored for anyone who isn't, so a non-admin can never list
// withdrawn posters just by guessing the query string.
router.get("/match-posters", async (req, res): Promise<void> => {
  try {
    const isAdmin = Boolean((req.session as any)?.isAdmin);
    const includeWithdrawn = isAdmin && req.query.includeWithdrawn === "1";

    const rows = await db.execute(sql`
      SELECT id, format, side_a, side_b, kicker, reason, level,
             side_a_points, side_b_points, status, winner_name, match_key,
             stake, game_type, season_name, created_at, withdrawn_at
      FROM match_posters
      WHERE ${includeWithdrawn ? sql`TRUE` : sql`withdrawn_at IS NULL`}
      ORDER BY created_at DESC
      LIMIT 300
    `);

    res.json((rows.rows as any[]).map(r => ({
      id: r.id,
      format: r.format,
      sideA: r.side_a,
      sideB: r.side_b,
      kicker: r.kicker,
      reason: r.reason,
      level: r.level,
      sideAPoints: r.side_a_points,
      sideBPoints: r.side_b_points,
      status: r.status,
      winnerName: r.winner_name,
      matchKey: r.match_key,
      stake: r.stake,
      gameType: r.game_type,
      seasonName: r.season_name,
      createdAt: r.created_at,
      withdrawn: r.withdrawn_at != null,
    })));
  } catch (err) {
    logger.error({ err }, "Failed to load match poster library");
    res.status(500).json({ error: "Could not load the poster library" });
  }
});

// POST /api/match-posters/:id/withdraw — soft delete. The poster row and its
// result_ref stay in place (so a real match result re-saving through
// upsertResultPoster doesn't resurrect it unexpectedly mid-season — that
// upsert always clears withdrawn_at, which is the intended "re-recording a
// corrected result brings its poster back" behaviour) and an admin can
// restore it from the withdrawn list below.
router.post("/match-posters/:id/withdraw", requireAdminSession, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: "Invalid poster id" }); return; }

    const result = await db.execute(sql`
      UPDATE match_posters SET withdrawn_at = NOW() WHERE id = ${id} AND withdrawn_at IS NULL RETURNING id
    `);
    if (result.rows.length === 0) { res.status(404).json({ error: "Poster not found (or already withdrawn)" }); return; }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, posterId: req.params.id }, "Failed to withdraw match poster");
    res.status(500).json({ error: "Could not withdraw this poster" });
  }
});

// POST /api/match-posters/:id/restore — undo a withdraw.
router.post("/match-posters/:id/restore", requireAdminSession, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error: "Invalid poster id" }); return; }

    const result = await db.execute(sql`
      UPDATE match_posters SET withdrawn_at = NULL WHERE id = ${id} AND withdrawn_at IS NOT NULL RETURNING id
    `);
    if (result.rows.length === 0) { res.status(404).json({ error: "Poster not found (or not withdrawn)" }); return; }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, posterId: req.params.id }, "Failed to restore match poster");
    res.status(500).json({ error: "Could not restore this poster" });
  }
});

export default router;
