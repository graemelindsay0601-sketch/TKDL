import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const SessionBody = z.object({
  player1Id:       z.number().int().positive().optional(),
  player2Id:       z.number().int().positive().optional(),
  gameTypeKey:     z.string(),
  gameTypeName:    z.string(),
  winnerIdx:       z.number().int().min(0).max(1).nullable().optional(),
  detail:          z.string().optional(),
  dartsThrown:     z.number().int().min(0).optional(),
  durationSeconds: z.number().int().min(0).optional(),
  sessionData:     z.record(z.string(), z.unknown()).optional(),
});

// POST /api/practice/sessions — save a completed practice session
router.post("/practice/sessions", async (req, res): Promise<void> => {
  try {
    const body = SessionBody.parse(req.body);
    await db.execute(sql`
      INSERT INTO practice_sessions
        (player1_id, player2_id, game_type_key, game_type_name, winner_idx, detail, darts_thrown, duration_seconds, session_data)
      VALUES
        (${body.player1Id ?? null}, ${body.player2Id ?? null},
         ${body.gameTypeKey}, ${body.gameTypeName},
         ${body.winnerIdx ?? null}, ${body.detail ?? null},
         ${body.dartsThrown ?? null}, ${body.durationSeconds ?? null},
         ${body.sessionData ? sql`${JSON.stringify(body.sessionData)}::jsonb` : sql`NULL`})
    `);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save practice session");
    res.status(500).json({ error: "Failed to save session" });
  }
});

// GET /api/admin/practice/stats — analytics for admin
router.get("/admin/practice/stats", async (req, res): Promise<void> => {
  try {
    const byGame = await db.execute(sql`
      SELECT
        game_type_key,
        game_type_name,
        COUNT(*)::int                                                       AS total_sessions,
        COUNT(CASE WHEN winner_idx IS NOT NULL THEN 1 END)::int             AS completed,
        ROUND(AVG(darts_thrown))::int                                       AS avg_darts,
        ROUND(AVG(duration_seconds))::int                                   AS avg_duration_secs
      FROM practice_sessions
      GROUP BY game_type_key, game_type_name
      ORDER BY total_sessions DESC
    `);

    const byPlayer = await db.execute(sql`
      SELECT
        p.name                                                              AS player_name,
        COUNT(DISTINCT ps.id)::int                                         AS total_sessions,
        COUNT(DISTINCT CASE WHEN (ps.winner_idx = 0 AND ps.player1_id = p.id) OR
                                 (ps.winner_idx = 1 AND ps.player2_id = p.id) THEN ps.id END)::int AS wins
      FROM players p
      JOIN practice_sessions ps ON (ps.player1_id = p.id OR ps.player2_id = p.id)
      GROUP BY p.id, p.name
      ORDER BY total_sessions DESC
      LIMIT 20
    `);

    const recent = await db.execute(sql`
      SELECT
        ps.*,
        p1.name AS player1_name,
        p2.name AS player2_name
      FROM practice_sessions ps
      LEFT JOIN players p1 ON p1.id = ps.player1_id
      LEFT JOIN players p2 ON p2.id = ps.player2_id
      ORDER BY ps.created_at DESC
      LIMIT 30
    `);

    res.json({ byGame: byGame.rows, byPlayer: byPlayer.rows, recent: recent.rows });
  } catch (err) {
    req.log.error({ err }, "Failed to get practice stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

export default router;
