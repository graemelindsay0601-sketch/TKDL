import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const SessionBody = z.object({
  player1Id:             z.number().int().positive().optional(),
  player2Id:             z.number().int().positive().optional(),
  gameTypeKey:           z.string(),
  gameTypeName:          z.string(),
  winnerIdx:             z.number().int().min(0).max(1).nullable().optional(),
  detail:                z.string().optional(),
  dartsThrown:           z.number().int().min(0).optional(),
  durationSeconds:       z.number().int().min(0).optional(),
  sessionData:           z.record(z.string(), z.unknown()).optional(),
  // Per-player X01 stats
  p1Darts:              z.number().int().min(0).optional(),
  p1Score:              z.number().int().min(0).optional(),
  p1_180s:              z.number().int().min(0).optional(),
  p1CheckoutAttempts:   z.number().int().min(0).optional(),
  p1CheckoutHits:       z.number().int().min(0).optional(),
});

// POST /api/practice/sessions — save a completed practice session
router.post("/practice/sessions", async (req, res): Promise<void> => {
  try {
    const body = SessionBody.parse(req.body);
    await db.execute(sql`
      INSERT INTO practice_sessions
        (player1_id, player2_id, game_type_key, game_type_name, winner_idx, detail,
         darts_thrown, duration_seconds, session_data,
         p1_darts, p1_score, p1_180s, p1_checkout_attempts, p1_checkout_hits)
      VALUES
        (${body.player1Id ?? null}, ${body.player2Id ?? null},
         ${body.gameTypeKey}, ${body.gameTypeName},
         ${body.winnerIdx ?? null}, ${body.detail ?? null},
         ${body.dartsThrown ?? null}, ${body.durationSeconds ?? null},
         ${body.sessionData ? sql`${JSON.stringify(body.sessionData)}::jsonb` : sql`NULL`},
         ${body.p1Darts ?? null}, ${body.p1Score ?? null},
         ${body.p1_180s ?? 0}, ${body.p1CheckoutAttempts ?? 0}, ${body.p1CheckoutHits ?? 0})
    `);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save practice session");
    res.status(500).json({ error: "Failed to save session" });
  }
});

// GET /api/players/:id/practice-stats — aggregate career practice stats for a player
router.get("/players/:id/practice-stats", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }

    const [agg] = (await db.execute(sql`
      SELECT
        COUNT(*)::int                                                                    AS total_sessions,
        COUNT(CASE WHEN winner_idx = 0 THEN 1 END)::int                                AS wins,
        COUNT(CASE WHEN winner_idx = 1 THEN 1 END)::int                                AS losses,
        COALESCE(SUM(p1_darts), 0)::int                                                AS total_darts,
        COALESCE(SUM(p1_score), 0)::int                                                AS total_score,
        COALESCE(SUM(p1_180s), 0)::int                                                 AS total_180s,
        COALESCE(SUM(p1_checkout_attempts), 0)::int                                    AS total_co_attempts,
        COALESCE(SUM(p1_checkout_hits), 0)::int                                        AS total_co_hits,
        COUNT(CASE WHEN p1_darts IS NOT NULL AND p1_darts > 0 THEN 1 END)::int         AS x01_sessions,
        CASE
          WHEN SUM(p1_darts) > 0
          THEN ROUND(CAST(SUM(p1_score) AS NUMERIC) * 3.0 / SUM(p1_darts), 2)
          ELSE NULL
        END                                                                             AS avg_three_dart
      FROM practice_sessions
      WHERE player1_id = ${playerId}
    `)).rows;

    // Best session avg (X01 only)
    const [best] = (await db.execute(sql`
      SELECT
        ROUND(CAST(p1_score AS NUMERIC) * 3.0 / p1_darts, 2) AS session_avg
      FROM practice_sessions
      WHERE player1_id = ${playerId} AND p1_darts > 0
      ORDER BY (CAST(p1_score AS NUMERIC) * 3.0 / p1_darts) DESC
      LIMIT 1
    `)).rows;

    res.json({
      ...agg,
      best_session_avg: best?.session_avg ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get player practice stats");
    res.status(500).json({ error: "Failed to get practice stats" });
  }
});

// GET /api/players/:id/practice-sessions — recent practice sessions for a player
router.get("/players/:id/practice-sessions", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }

    const rows = (await db.execute(sql`
      SELECT
        id,
        game_type_key,
        game_type_name,
        winner_idx,
        p1_darts,
        p1_score,
        p1_180s,
        p1_checkout_attempts,
        p1_checkout_hits,
        duration_seconds,
        created_at,
        CASE
          WHEN p1_darts IS NOT NULL AND p1_darts > 0
          THEN ROUND(CAST(p1_score AS NUMERIC) * 3.0 / p1_darts, 1)
          ELSE NULL
        END AS p1_avg
      FROM practice_sessions
      WHERE player1_id = ${playerId}
      ORDER BY created_at DESC
      LIMIT 25
    `)).rows;

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get player practice sessions");
    res.status(500).json({ error: "Failed to get practice sessions" });
  }
});

// GET /api/admin/practice/stats — analytics for admin
router.get("/admin/practice/stats", async (req, res): Promise<void> => {
  try {
    const byGame = await db.execute(sql`
      SELECT
        game_type_key, game_type_name,
        COUNT(*)::int                                                       AS total_sessions,
        COUNT(CASE WHEN winner_idx IS NOT NULL THEN 1 END)::int             AS completed,
        ROUND(AVG(darts_thrown))::int                                       AS avg_darts,
        ROUND(AVG(duration_seconds))::int                                   AS avg_duration_secs,
        COALESCE(SUM(p1_180s), 0)::int                                      AS total_180s
      FROM practice_sessions
      GROUP BY game_type_key, game_type_name
      ORDER BY total_sessions DESC
    `);

    const byPlayer = await db.execute(sql`
      SELECT
        p.name                                                              AS player_name,
        COUNT(DISTINCT ps.id)::int                                         AS total_sessions,
        COUNT(DISTINCT CASE WHEN ps.winner_idx = 0 AND ps.player1_id = p.id THEN ps.id END)::int AS wins,
        CASE WHEN SUM(ps.p1_darts) > 0
          THEN ROUND(CAST(SUM(ps.p1_score) AS NUMERIC) * 3.0 / SUM(ps.p1_darts), 1)
          ELSE NULL END                                                     AS avg_three_dart,
        COALESCE(SUM(ps.p1_180s), 0)::int                                  AS total_180s
      FROM players p
      JOIN practice_sessions ps ON ps.player1_id = p.id
      GROUP BY p.id, p.name
      ORDER BY total_sessions DESC
      LIMIT 20
    `);

    const recent = await db.execute(sql`
      SELECT ps.*, p1.name AS player1_name, p2.name AS player2_name
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
