import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { checkAndAwardShadowBotAchievements, getShadowAchievementProgress } from "../lib/shadow-bot-achievements";

const router = Router();

const SessionBody = z.object({
  player1Id:             z.number().int().positive().optional(),
  player2Id:             z.number().int().positive().nullish(),
  gameTypeKey:           z.string(),
  gameTypeName:          z.string(),
  winnerIdx:             z.number().int().min(0).max(1).nullable().optional(),
  detail:                z.string().optional(),
  dartsThrown:           z.number().int().min(0).optional(),
  durationSeconds:       z.number().int().min(0).optional(),
  sessionData:           z.record(z.string(), z.unknown()).optional(),
  // P1 X01 stats
  p1Darts:              z.number().int().min(0).optional(),
  p1Score:              z.number().int().min(0).optional(),
  p1_180s:              z.number().int().min(0).optional(),
  p1CheckoutAttempts:   z.number().int().min(0).optional(),
  p1CheckoutHits:       z.number().int().min(0).optional(),
  // P2 X01 stats (human-vs-human sessions only)
  p2Darts:              z.number().int().min(0).optional(),
  p2Score:              z.number().int().min(0).optional(),
  p2_180s:              z.number().int().min(0).optional(),
  p2CheckoutAttempts:   z.number().int().min(0).optional(),
  p2CheckoutHits:       z.number().int().min(0).optional(),
});

// GET /api/practice/sessions/:id — full detail for one session, with player names
router.get("/practice/sessions/:id", async (req, res): Promise<void> => {
  try {
    const sessionId = parseInt(req.params.id, 10);
    if (!sessionId) { res.status(400).json({ error: "Invalid session id" }); return; }

    const [row] = (await db.execute(sql`
      SELECT
        ps.id, ps.game_type_key, ps.game_type_name, ps.winner_idx, ps.detail,
        ps.darts_thrown, ps.duration_seconds, ps.created_at,
        ps.player1_id, ps.player2_id,
        p1.name AS p1_name, p2.name AS p2_name,
        ps.p1_darts, ps.p1_score, ps.p1_180s, ps.p1_checkout_attempts, ps.p1_checkout_hits,
        ps.p2_darts, ps.p2_score, ps.p2_180s, ps.p2_checkout_attempts, ps.p2_checkout_hits,
        ps.session_data,
        CASE WHEN ps.p1_darts IS NOT NULL AND ps.p1_darts > 0
          THEN ROUND(CAST(ps.p1_score AS NUMERIC) * 3.0 / ps.p1_darts, 2) ELSE NULL
        END AS p1_avg,
        CASE WHEN ps.p2_darts IS NOT NULL AND ps.p2_darts > 0
          THEN ROUND(CAST(ps.p2_score AS NUMERIC) * 3.0 / ps.p2_darts, 2) ELSE NULL
        END AS p2_avg
      FROM practice_sessions ps
      LEFT JOIN players p1 ON p1.id = ps.player1_id
      LEFT JOIN players p2 ON p2.id = ps.player2_id
      WHERE ps.id = ${sessionId}
    `)).rows;

    if (!row) { res.status(404).json({ error: "Session not found" }); return; }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to get practice session detail");
    res.status(500).json({ error: "Failed to get session" });
  }
});

// POST /api/practice/sessions — save a completed practice session
router.post("/practice/sessions", async (req, res): Promise<void> => {
  try {
    const body = SessionBody.parse(req.body);
    // Merge both dart logs into session_data JSONB
    const sd = { ...(body.sessionData ?? {}) };
    await db.execute(sql`
      INSERT INTO practice_sessions
        (player1_id, player2_id, game_type_key, game_type_name, winner_idx, detail,
         darts_thrown, duration_seconds, session_data,
         p1_darts, p1_score, p1_180s, p1_checkout_attempts, p1_checkout_hits,
         p2_darts, p2_score, p2_180s, p2_checkout_attempts, p2_checkout_hits)
      VALUES
        (${body.player1Id ?? null}, ${body.player2Id ?? null},
         ${body.gameTypeKey}, ${body.gameTypeName},
         ${body.winnerIdx ?? null}, ${body.detail ?? null},
         ${body.dartsThrown ?? null}, ${body.durationSeconds ?? null},
         ${Object.keys(sd).length ? sql`${JSON.stringify(sd)}::jsonb` : sql`NULL`},
         ${body.p1Darts ?? null}, ${body.p1Score ?? null},
         ${body.p1_180s ?? 0}, ${body.p1CheckoutAttempts ?? 0}, ${body.p1CheckoutHits ?? 0},
         ${body.p2Darts ?? null}, ${body.p2Score ?? null},
         ${body.p2_180s ?? 0}, ${body.p2CheckoutAttempts ?? 0}, ${body.p2CheckoutHits ?? 0})
    `);
    res.json({ ok: true });
    
    // Fire-and-forget: shadow bot achievement check for P1
    if (body.player1Id) {
      checkAndAwardShadowBotAchievements(body.player1Id).catch(() => {});
    }

    // Fire-and-forget: award practice coins
    void (async () => {
      try {
        const { addCoinsToPlayer } = await import("../services/card-shop-service");
        // Award 10 coins per practice win
        if (body.winnerIdx === 0 && body.player1Id) {
          await addCoinsToPlayer(body.player1Id, 10);
        } else if (body.winnerIdx === 1 && body.player2Id) {
          await addCoinsToPlayer(body.player2Id, 10);
        }
      } catch (err) {
        // Silently fail - don't disrupt practice session
        console.error("Practice coin award error:", err);
      }
    })();
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

    // Aggregate stats — union P1 and P2 perspectives so stats reflect all sessions played
    const [agg] = (await db.execute(sql`
      WITH all_sessions AS (
        SELECT winner_idx = 0 AS won, p1_darts AS darts, p1_score AS score,
               p1_180s AS s180s, p1_checkout_attempts AS co_att, p1_checkout_hits AS co_hits
        FROM practice_sessions WHERE player1_id = ${playerId}
        UNION ALL
        SELECT winner_idx = 1 AS won, p2_darts AS darts, p2_score AS score,
               p2_180s AS s180s, p2_checkout_attempts AS co_att, p2_checkout_hits AS co_hits
        FROM practice_sessions WHERE player2_id = ${playerId} AND p2_darts IS NOT NULL
      )
      SELECT
        COUNT(*)::int                                                          AS total_sessions,
        COUNT(CASE WHEN won THEN 1 END)::int                                  AS wins,
        COUNT(CASE WHEN NOT won THEN 1 END)::int                              AS losses,
        COALESCE(SUM(darts), 0)::int                                          AS total_darts,
        COALESCE(SUM(score), 0)::int                                          AS total_score,
        COALESCE(SUM(s180s), 0)::int                                          AS total_180s,
        COALESCE(SUM(co_att), 0)::int                                         AS total_co_attempts,
        COALESCE(SUM(co_hits), 0)::int                                        AS total_co_hits,
        COUNT(CASE WHEN darts IS NOT NULL AND darts > 0 THEN 1 END)::int      AS x01_sessions,
        CASE WHEN SUM(darts) > 0
          THEN ROUND(CAST(SUM(score) AS NUMERIC) * 3.0 / SUM(darts), 2)
          ELSE NULL END                                                        AS avg_three_dart
      FROM all_sessions
    `)).rows;

    // Best session avg — from both P1 and P2 sessions
    const [best] = (await db.execute(sql`
      SELECT session_avg FROM (
        SELECT ROUND(CAST(p1_score AS NUMERIC) * 3.0 / p1_darts, 2) AS session_avg
        FROM practice_sessions WHERE player1_id = ${playerId} AND p1_darts > 0
        UNION ALL
        SELECT ROUND(CAST(p2_score AS NUMERIC) * 3.0 / p2_darts, 2) AS session_avg
        FROM practice_sessions WHERE player2_id = ${playerId} AND p2_darts > 0
      ) t ORDER BY session_avg DESC LIMIT 1
    `)).rows;

    // Visit-level stats from dart logs — union P1 dartLog + P2 p2DartLog keys
    // Visit-level stats: use ROW_NUMBER on scoring-only darts for correct visit grouping.
    // Filter X01 games via engine lookup (actual keys are e.g. "501_double_out", not "x01_*").
    const [visitStats] = (await db.execute(sql`
      WITH raw_darts AS (
        SELECT ps.id AS session_id, ordinality, dart
        FROM practice_sessions ps,
             jsonb_array_elements(ps.session_data->'dartLog') WITH ORDINALITY AS t(dart, ordinality)
        WHERE ps.player1_id = ${playerId}
          AND ps.session_data ? 'dartLog'
          AND ps.game_type_key IN (SELECT key FROM game_types WHERE engine = 'X01')
        UNION ALL
        SELECT ps.id AS session_id, ordinality, dart
        FROM practice_sessions ps,
             jsonb_array_elements(ps.session_data->'p2DartLog') WITH ORDINALITY AS t(dart, ordinality)
        WHERE ps.player2_id = ${playerId}
          AND ps.session_data ? 'p2DartLog'
          AND ps.game_type_key IN (SELECT key FROM game_types WHERE engine = 'X01')
      ),
      scoring_darts AS (
        SELECT
          session_id,
          (dart->>'val')::int AS val,
          ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY ordinality) AS rn
        FROM raw_darts
        WHERE dart->>'phase' = 'scoring'
      ),
      visit_scores AS (
        SELECT
          session_id,
          CEIL(rn::numeric / 3)::int AS visit_num,
          SUM(val)                   AS visit_score
        FROM scoring_darts
        GROUP BY session_id, CEIL(rn::numeric / 3)::int
      ),
      first9 AS (
        SELECT ROUND(AVG(visit_score)::numeric, 1) AS first9_avg
        FROM visit_scores WHERE visit_num <= 3
      )
      SELECT
        COUNT(CASE WHEN vs.visit_score = 180 THEN 1 END)::int                          AS v180,
        COUNT(CASE WHEN vs.visit_score >= 140 AND vs.visit_score < 180 THEN 1 END)::int AS v140,
        COUNT(CASE WHEN vs.visit_score >= 100 AND vs.visit_score < 140 THEN 1 END)::int AS v100,
        COUNT(CASE WHEN vs.visit_score >= 60  AND vs.visit_score < 100 THEN 1 END)::int AS v60,
        COUNT(CASE WHEN vs.visit_score >= 40  AND vs.visit_score < 60  THEN 1 END)::int AS v40,
        COUNT(CASE WHEN vs.visit_score >= 1   AND vs.visit_score < 40  THEN 1 END)::int AS v_low,
        COUNT(CASE WHEN vs.visit_score = 0 THEN 1 END)::int                            AS v_zero,
        MAX(vs.visit_score)::int                                                        AS best_visit,
        COUNT(*)::int                                                                   AS total_visits,
        MAX(f.first9_avg)                                                               AS first9_avg
      FROM visit_scores vs, first9 f
    `)).rows;

    // Favourite doubles & checkout analysis — most-attempted doubles during checkout phase
    const favDoubles = (await db.execute(sql`
      WITH co_darts AS (
        SELECT (dart->>'seg')::int AS seg, (dart->>'mult')::int AS mult
        FROM practice_sessions ps,
             jsonb_array_elements(ps.session_data->'dartLog') AS t(dart)
        WHERE ps.player1_id = ${playerId}
          AND ps.session_data ? 'dartLog'
          AND dart->>'phase' = 'checkout'
        UNION ALL
        SELECT (dart->>'seg')::int AS seg, (dart->>'mult')::int AS mult
        FROM practice_sessions ps,
             jsonb_array_elements(ps.session_data->'p2DartLog') AS t(dart)
        WHERE ps.player2_id = ${playerId}
          AND ps.session_data ? 'p2DartLog'
          AND dart->>'phase' = 'checkout'
      )
      SELECT
        seg,
        CASE WHEN seg = 25 THEN 'Bull' ELSE 'D' || seg::text END AS label,
        COUNT(*)::int                                              AS attempts,
        COUNT(CASE WHEN mult = 2 THEN 1 END)::int                 AS hits
      FROM co_darts
      WHERE seg IS NOT NULL AND seg > 0
      GROUP BY seg
      ORDER BY COUNT(*) DESC
      LIMIT 6
    `)).rows;

    // Per-game-mode breakdown — union P1 and P2 perspectives
    const byGame = (await db.execute(sql`
      WITH all_sessions AS (
        SELECT id, game_type_key, game_type_name,
          CASE WHEN winner_idx IS NOT NULL THEN (winner_idx = 0) ELSE NULL END AS won,
          p1_darts AS darts, p1_score AS score, p1_180s AS s180s, created_at,
          p1_checkout_attempts AS co_att, p1_checkout_hits AS co_hits
        FROM practice_sessions WHERE player1_id = ${playerId}
        UNION ALL
        SELECT id, game_type_key, game_type_name,
          CASE WHEN winner_idx IS NOT NULL THEN (winner_idx = 1) ELSE NULL END AS won,
          p2_darts AS darts, p2_score AS score, p2_180s AS s180s, created_at,
          p2_checkout_attempts AS co_att, p2_checkout_hits AS co_hits
        FROM practice_sessions WHERE player2_id = ${playerId} AND p2_darts IS NOT NULL
      )
      SELECT
        game_type_key,
        game_type_name,
        COUNT(*)::int                                                                     AS sessions,
        COUNT(CASE WHEN won = true  THEN 1 END)::int                                    AS wins,
        COUNT(CASE WHEN won = false THEN 1 END)::int                                    AS losses,
        CASE WHEN SUM(darts) > 0
          THEN ROUND(CAST(SUM(score) AS NUMERIC) * 3.0 / SUM(darts), 1)
          ELSE NULL END                                                                   AS avg_three_dart,
        CASE WHEN SUM(darts) > 0
          THEN (
            SELECT ROUND(CAST(sub.score AS NUMERIC) * 3.0 / sub.darts, 1)
            FROM all_sessions sub
            WHERE sub.game_type_key = all_sessions.game_type_key AND sub.darts > 0
            ORDER BY CAST(sub.score AS NUMERIC) * 3.0 / sub.darts DESC
            LIMIT 1
          ) ELSE NULL END                                                                 AS best_session_avg,
        COALESCE(SUM(s180s), 0)::int                                                    AS total_180s,
        COALESCE(SUM(co_att), 0)::int                                                   AS total_co_att,
        COALESCE(SUM(co_hits), 0)::int                                                  AS total_co_hits,
        MAX(created_at)                                                                  AS last_played
      FROM all_sessions
      GROUP BY game_type_key, game_type_name
      ORDER BY sessions DESC
    `)).rows;

    const [highestCoRow] = (await db.execute(sql`
      WITH session_darts AS (
        SELECT
          ps.id AS session_id,
          (dart->>'val')::int               AS val,
          ordinality::int                    AS pos,
          COUNT(*) OVER (PARTITION BY ps.id)::int AS total_darts
        FROM practice_sessions ps,
             jsonb_array_elements(ps.session_data->'dartLog') WITH ORDINALITY AS t(dart, ordinality)
        WHERE ps.player1_id = ${playerId}
          AND ps.session_data ? 'dartLog'
          AND ps.p1_checkout_hits > 0
          AND ps.game_type_key IN (SELECT key FROM game_types WHERE engine = 'X01')
      ),
      last_visits AS (
        SELECT session_id, SUM(val) AS checkout_score
        FROM session_darts
        WHERE pos > total_darts - ((total_darts - 1) % 3 + 1)
        GROUP BY session_id
        HAVING SUM(val) BETWEEN 2 AND 170
      )
      SELECT COALESCE(MAX(checkout_score), 0) AS highest_checkout
      FROM last_visits
    `)).rows;

    res.json({
      ...agg,
      best_session_avg:   best?.session_avg ?? null,
      highest_checkout:   (highestCoRow as any)?.highest_checkout ?? 0,
      visit_stats:        visitStats ?? null,
      fav_doubles:        favDoubles,
      byGame,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get player practice stats");
    res.status(500).json({ error: "Failed to get practice stats" });
  }
});

// GET /api/players/:id/checkouts — all 80+ checkouts for a player, sorted by score desc
router.get("/players/:id/checkouts", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }
    const minScore = Math.max(1, parseInt(String(req.query.minScore ?? "80"), 10) || 80);

    const result = await db.execute(sql`
      WITH session_darts AS (
        SELECT
          ps.id                              AS session_id,
          ps.game_type_name,
          ps.created_at,
          (dart->>'val')::int               AS val,
          ordinality::int                    AS pos,
          COUNT(*) OVER (PARTITION BY ps.id)::int AS total_darts
        FROM practice_sessions ps,
             jsonb_array_elements(ps.session_data->'dartLog') WITH ORDINALITY AS t(dart, ordinality)
        WHERE ps.player1_id = ${playerId}
          AND ps.session_data ? 'dartLog'
          AND ps.p1_checkout_hits > 0
          AND ps.game_type_key IN (SELECT key FROM game_types WHERE engine = 'X01')
      ),
      last_visits AS (
        SELECT session_id, game_type_name, created_at, SUM(val) AS checkout_score
        FROM session_darts
        WHERE pos > total_darts - ((total_darts - 1) % 3 + 1)
        GROUP BY session_id, game_type_name, created_at
        HAVING SUM(val) BETWEEN ${minScore} AND 170
      )
      SELECT checkout_score, game_type_name, created_at
      FROM last_visits
      ORDER BY checkout_score DESC, created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get player checkouts");
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/players/:id/practice-sessions — recent practice sessions for a player
// Returns sessions where the player was either P1 or P2, normalised to the player's perspective.
// Optional query param: ?gameTypeKey=501_double_out  (filter by game type)
router.get("/players/:id/practice-sessions", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }
    const gameTypeKey = typeof req.query.gameTypeKey === "string" ? req.query.gameTypeKey : null;
    const mode        = typeof req.query.mode        === "string" ? req.query.mode        : null;

    const rows = (await db.execute(
      gameTypeKey
        ? sql`
          SELECT
            id, game_type_key, game_type_name, detail, duration_seconds, created_at,
            session_data->>'mode' AS session_mode,
            CASE WHEN winner_idx IS NULL THEN NULL ELSE (winner_idx = 0) END AS won,
            p1_darts  AS darts,
            p1_180s   AS s180s,
            p1_checkout_attempts AS co_attempts,
            p1_checkout_hits     AS co_hits,
            CASE WHEN p1_darts IS NOT NULL AND p1_darts > 0
              THEN ROUND(CAST(p1_score AS NUMERIC) * 3.0 / p1_darts, 1)
              ELSE NULL END AS avg
          FROM practice_sessions
          WHERE player1_id = ${playerId}
            AND game_type_key = ${gameTypeKey}

          UNION ALL

          SELECT
            id, game_type_key, game_type_name, detail, duration_seconds, created_at,
            session_data->>'mode' AS session_mode,
            CASE WHEN winner_idx IS NULL THEN NULL ELSE (winner_idx = 1) END AS won,
            p2_darts  AS darts,
            p2_180s   AS s180s,
            p2_checkout_attempts AS co_attempts,
            p2_checkout_hits     AS co_hits,
            CASE WHEN p2_darts IS NOT NULL AND p2_darts > 0
              THEN ROUND(CAST(p2_score AS NUMERIC) * 3.0 / p2_darts, 1)
              ELSE NULL END AS avg
          FROM practice_sessions
          WHERE player2_id = ${playerId}
            AND game_type_key = ${gameTypeKey}

          ORDER BY created_at DESC
          LIMIT 50
        `
        : mode
        ? sql`
          SELECT
            id, game_type_key, game_type_name, detail, duration_seconds, created_at,
            session_data->>'mode' AS session_mode,
            CASE WHEN winner_idx IS NULL THEN NULL ELSE (winner_idx = 0) END AS won,
            p1_darts  AS darts,
            p1_180s   AS s180s,
            p1_checkout_attempts AS co_attempts,
            p1_checkout_hits     AS co_hits,
            CASE WHEN p1_darts IS NOT NULL AND p1_darts > 0
              THEN ROUND(CAST(p1_score AS NUMERIC) * 3.0 / p1_darts, 1)
              ELSE NULL END AS avg
          FROM practice_sessions
          WHERE player1_id = ${playerId}
            AND session_data->>'mode' = ${mode}

          UNION ALL

          SELECT
            id, game_type_key, game_type_name, detail, duration_seconds, created_at,
            session_data->>'mode' AS session_mode,
            CASE WHEN winner_idx IS NULL THEN NULL ELSE (winner_idx = 1) END AS won,
            p2_darts  AS darts,
            p2_180s   AS s180s,
            p2_checkout_attempts AS co_attempts,
            p2_checkout_hits     AS co_hits,
            CASE WHEN p2_darts IS NOT NULL AND p2_darts > 0
              THEN ROUND(CAST(p2_score AS NUMERIC) * 3.0 / p2_darts, 1)
              ELSE NULL END AS avg
          FROM practice_sessions
          WHERE player2_id = ${playerId}
            AND session_data->>'mode' = ${mode}

          ORDER BY created_at DESC
          LIMIT 50
        `
        : sql`
          SELECT
            id, game_type_key, game_type_name, detail, duration_seconds, created_at,
            session_data->>'mode' AS session_mode,
            CASE WHEN winner_idx IS NULL THEN NULL ELSE (winner_idx = 0) END AS won,
            p1_darts  AS darts,
            p1_180s   AS s180s,
            p1_checkout_attempts AS co_attempts,
            p1_checkout_hits     AS co_hits,
            CASE WHEN p1_darts IS NOT NULL AND p1_darts > 0
              THEN ROUND(CAST(p1_score AS NUMERIC) * 3.0 / p1_darts, 1)
              ELSE NULL END AS avg
          FROM practice_sessions
          WHERE player1_id = ${playerId}

          UNION ALL

          SELECT
            id, game_type_key, game_type_name, detail, duration_seconds, created_at,
            session_data->>'mode' AS session_mode,
            CASE WHEN winner_idx IS NULL THEN NULL ELSE (winner_idx = 1) END AS won,
            p2_darts  AS darts,
            p2_180s   AS s180s,
            p2_checkout_attempts AS co_attempts,
            p2_checkout_hits     AS co_hits,
            CASE WHEN p2_darts IS NOT NULL AND p2_darts > 0
              THEN ROUND(CAST(p2_score AS NUMERIC) * 3.0 / p2_darts, 1)
              ELSE NULL END AS avg
          FROM practice_sessions
          WHERE player2_id = ${playerId}

          ORDER BY created_at DESC
          LIMIT 50
        `
    )).rows;

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get player practice sessions");
    res.status(500).json({ error: "Failed to get practice sessions" });
  }
});

// GET /api/players/:id/dart-profile — computed dart pattern profile from all dart logs
router.get("/players/:id/dart-profile", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }

    const MIN_DARTS = 100;

    // Unpack all darts — union P1 dartLog + P2 p2DartLog
    const raw = (await db.execute(sql`
      WITH dart_data AS (
        SELECT
          (dart->>'seg')::int   AS seg,
          (dart->>'mult')::int  AS mult,
          (dart->>'val')::int   AS val,
          dart->>'phase'        AS phase
        FROM practice_sessions,
          jsonb_array_elements(session_data->'dartLog') AS dart
        WHERE player1_id = ${playerId}
          AND session_data ? 'dartLog'
        UNION ALL
        SELECT
          (dart->>'seg')::int   AS seg,
          (dart->>'mult')::int  AS mult,
          (dart->>'val')::int   AS val,
          dart->>'phase'        AS phase
        FROM practice_sessions,
          jsonb_array_elements(session_data->'p2DartLog') AS dart
        WHERE player2_id = ${playerId}
          AND session_data ? 'p2DartLog'
      )
      SELECT seg, mult, phase, COUNT(*)::int AS throws
      FROM dart_data
      WHERE seg IS NOT NULL AND mult IS NOT NULL
      GROUP BY seg, mult, phase
      ORDER BY throws DESC
    `)).rows as { seg: number; mult: number; phase: string; throws: number }[];

    const totalDarts = raw.reduce((s, r) => s + Number(r.throws), 0);

    if (totalDarts < MIN_DARTS) {
      res.json({ totalDarts, hasEnoughData: false, minRequired: MIN_DARTS });
      return;
    }

    // ── Scoring phase distribution ───────────────────────────────────────────
    const scoring = raw.filter(r => r.phase === "scoring");
    const totalScoring = scoring.reduce((s, r) => s + Number(r.throws), 0);

    // Group by segment
    type SegCounts = { treble: number; single: number; double: number };
    const bySeg: Record<number, SegCounts> = {};
    for (const r of scoring) {
      const seg = Number(r.seg); const mult = Number(r.mult); const n = Number(r.throws);
      if (!bySeg[seg]) bySeg[seg] = { treble: 0, single: 0, double: 0 };
      if (mult === 3) bySeg[seg].treble += n;
      else if (mult === 1) bySeg[seg].single += n;
      else if (mult === 2) bySeg[seg].double += n;
    }

    const segTotals = Object.entries(bySeg)
      .map(([s, c]) => {
        const seg = Number(s);
        const total = c.treble + c.single + c.double;
        return {
          seg,
          label: seg === 25 ? "Bull" : String(seg),
          total,
          treble: c.treble,
          single: c.single,
          double: c.double,
          treblePct: total > 0 ? Math.round((c.treble / total) * 100) : 0,
          pct: totalScoring > 0 ? Math.round((total / totalScoring) * 100) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    // ── Checkout phase ───────────────────────────────────────────────────────
    const coDoubles = raw.filter(r => r.phase === "checkout" && Number(r.mult) === 2);
    const totalCoDoubles = coDoubles.reduce((s, r) => s + Number(r.throws), 0);
    const checkoutPrefs = coDoubles.slice(0, 6).map(r => ({
      seg: Number(r.seg),
      label: `D${r.seg}`,
      throws: Number(r.throws),
      pct: totalCoDoubles > 0 ? Math.round((Number(r.throws) / totalCoDoubles) * 100) : 0,
    }));

    // ── Build BotConfig from profile (for future player-shadow bots) ─────────
    const primary = segTotals[0] ?? null;
    const avgPerVisit = totalScoring > 0
      ? raw.filter(r => r.phase === "scoring").reduce((s, r) => s + Number(r.seg) * Number(r.mult) * Number(r.throws), 0) / totalScoring * 3
      : null;

    res.json({
      totalDarts,
      hasEnoughData: true,
      minRequired: MIN_DARTS,
      primaryTarget: primary ? { seg: primary.seg, label: primary.label, treblePct: primary.treblePct } : null,
      scoringDistribution: segTotals.slice(0, 7),
      checkoutPrefs,
      computedAvg: avgPerVisit != null ? Math.round(avgPerVisit * 10) / 10 : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to compute dart profile");
    res.status(500).json({ error: "Failed to compute dart profile" });
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

// GET /api/players/:id/shadow-achievements — progress on all shadow bot achievements
router.get("/players/:id/shadow-achievements", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }
    const progress = await getShadowAchievementProgress(playerId);
    res.json(progress);
  } catch (err) {
    req.log.error({ err }, "Failed to get shadow achievements");
    res.status(500).json({ error: "Failed to get shadow achievements" });
  }
});

// GET /api/players/:id/shadow-bot-stats — training stats for the Build Your Bot page
router.get("/players/:id/shadow-bot-stats", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }
    const THRESHOLD = 250;
    const THIN = 5;

    const [playerQ, totalsQ, gameModeQ, matchQ] = await Promise.all([
      db.execute(sql`SELECT name, elo FROM players WHERE id = ${playerId}`),
      db.execute(sql`
        WITH ranked AS (
          SELECT p1_darts, p1_score, p1_checkout_hits, p1_checkout_attempts,
            POWER(0.92, ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1) AS w
          FROM practice_sessions WHERE player1_id = ${playerId}
        )
        SELECT
          COALESCE(SUM(p1_darts), 0)::int                                              AS total_darts,
          COUNT(*)::int                                                                 AS total_sessions,
          COALESCE(SUM(p1_checkout_hits), 0)::int                                      AS co_hits,
          COALESCE(SUM(p1_checkout_attempts), 0)::int                                  AS co_attempts,
          COALESCE(
            SUM(w * CASE WHEN p1_darts > 0 THEN p1_score ELSE 0 END)
            / NULLIF(SUM(w * CASE WHEN p1_darts > 0 THEN p1_darts ELSE 0 END), 0),
          0)                                                                            AS weighted_spd
        FROM ranked
      `),
      db.execute(sql`
        SELECT game_type_key, game_type_name, COUNT(*)::int AS sessions,
               COALESCE(SUM(p1_darts), 0)::int AS darts
        FROM practice_sessions WHERE player1_id = ${playerId}
        GROUP BY game_type_key, game_type_name ORDER BY sessions DESC
      `),
      // Pull real league match data — checkout accuracy + 180s
      db.execute(sql`
        SELECT
          COUNT(*)::int                                                    AS total_matches,
          COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN 1 ELSE 0 END),0)::int AS wins,
          COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN COALESCE(winner_darts,0) ELSE COALESCE(loser_darts,0) END),0)::int AS match_darts,
          COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN COALESCE(winner_checkout_hits,0) ELSE COALESCE(loser_checkout_hits,0) END),0)::int AS match_co_hits,
          COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN COALESCE(winner_checkout_attempts,0) ELSE COALESCE(loser_checkout_attempts,0) END),0)::int AS match_co_attempts,
          COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN COALESCE(winner_180s,0) ELSE COALESCE(loser_180s,0) END),0)::int AS total_180s
        FROM matches WHERE winner_id = ${playerId} OR loser_id = ${playerId}
      `),
    ]);

    const playerRow = playerQ.rows[0] as { name: string; elo: number } | undefined;
    const playerName = playerRow?.name ?? "Unknown";
    const playerElo  = Number(playerRow?.elo ?? 1000);
    const t = totalsQ.rows[0] as { total_darts: number; total_sessions: number; weighted_spd: number; co_hits: number; co_attempts: number } | undefined;
    const practiceDarts    = Number(t?.total_darts ?? 0);
    const totalSessions    = Number(t?.total_sessions ?? 0);
    const weightedSpd      = Number(t?.weighted_spd ?? 0);
    const coHits           = Number(t?.co_hits ?? 0);
    const coAttempts       = Number(t?.co_attempts ?? 0);

    // Real match data from league games
    const m = matchQ.rows[0] as { total_matches: number; wins: number; match_darts: number; match_co_hits: number; match_co_attempts: number; total_180s: number } | undefined;
    const matchDarts         = Number(m?.match_darts ?? 0);
    const totalMatches       = Number(m?.total_matches ?? 0);
    const matchWins          = Number(m?.wins ?? 0);
    const matchCoHits        = Number(m?.match_co_hits ?? 0);
    const matchCoAttempts    = Number(m?.match_co_attempts ?? 0);
    const total180s          = Number(m?.total_180s ?? 0);

    // Combined dart count: practice + real match darts both count toward unlock
    const totalDarts = practiceDarts + matchDarts;

    const gameModeSessions = (gameModeQ.rows as { game_type_key: string; game_type_name: string; sessions: number; darts: number }[])
      .map(r => ({ gameTypeKey: r.game_type_key, gameTypeName: r.game_type_name, sessions: Number(r.sessions), darts: Number(r.darts) }));

    const thinSpots = gameModeSessions.filter(g => g.sessions < THIN);

    // Compute match win rate here so it's available in both locked and unlocked branches
    const matchWinRate = totalMatches > 0 ? Math.round((matchWins / totalMatches) * 100) : null;

    if (totalDarts < THRESHOLD) {
      res.json({
        playerName, locked: true, totalDarts, dartsNeeded: THRESHOLD,
        totalSessions, accuracyLevel: null, nextLevel: null,
        progressToNext: Math.round((totalDarts / THRESHOLD) * 100),
        gameModeSessions, thinSpots,
        practiceDarts, matchDarts, totalMatches, matchWins,
        matchWinRate, playerElo, total180s,
      });
      return;
    }

    // Recency-weighted 3-dart average from practice sessions (most accurate signal).
    const computedAvg  = practiceDarts > 0 ? Math.round(weightedSpd * 3 * 10) / 10 : 45;

    // Checkout %: blend practice and real-match doubles data, weighted by volume.
    const totalCoAttempts = coAttempts + matchCoAttempts;
    const totalCoHits     = coHits + matchCoHits;
    const doubleHitPct    = totalCoAttempts > 0 ? Math.round((totalCoHits / totalCoAttempts) * 100) / 100 : 0;

    const LEVELS = [
      { level: "beginner", min: 0,   next: "amateur" as const, nextMin: 45  },
      { level: "amateur",  min: 45,  next: "club"    as const, nextMin: 62  },
      { level: "club",     min: 62,  next: "county"  as const, nextMin: 80  },
      { level: "county",   min: 80,  next: "pro"     as const, nextMin: 95  },
      { level: "pro",      min: 95,  next: "elite"   as const, nextMin: 108 },
      { level: "elite",    min: 108, next: null, nextMin: null },
    ];
    let accuracyLevel = "beginner", nextLevel: string | null = "amateur", progressToNext = 0;
    for (const lvl of LEVELS) {
      if (computedAvg >= lvl.min) {
        accuracyLevel  = lvl.level;
        nextLevel      = lvl.next;
        progressToNext = lvl.next && lvl.nextMin
          ? Math.min(100, Math.round(((computedAvg - lvl.min) / (lvl.nextMin - lvl.min)) * 100))
          : 100;
      }
    }

    const dartLogQ = await db.execute(sql`
      WITH dart_data AS (
        SELECT (dart->>'seg')::int AS seg, (dart->>'mult')::int AS mult, dart->>'phase' AS phase
        FROM practice_sessions, jsonb_array_elements(session_data->'dartLog') AS dart
        WHERE player1_id = ${playerId} AND session_data ? 'dartLog'
      )
      SELECT seg, mult, phase, COUNT(*)::int AS throws
      FROM dart_data WHERE seg IS NOT NULL AND mult IS NOT NULL
      GROUP BY seg, mult, phase ORDER BY throws DESC
    `);
    const raw = dartLogQ.rows as { seg: number; mult: number; phase: string; throws: number }[];
    const segMap: Record<number, number> = {};
    for (const d of raw.filter(r => r.phase === "scoring")) {
      const s = Number(d.seg); segMap[s] = (segMap[s] ?? 0) + Number(d.throws);
    }
    const primarySeg   = Number(Object.entries(segMap).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] ?? 20);
    const checkoutSegs = raw.filter(r => r.phase === "checkout" && Number(r.mult) === 2).slice(0, 4).map(r => Number(r.seg));

    res.json({
      playerName, locked: false, totalDarts, dartsNeeded: THRESHOLD,
      totalSessions, computedAvg, doubleHitPct, primarySeg, checkoutSegs,
      accuracyLevel, nextLevel, progressToNext, gameModeSessions, thinSpots,
      practiceDarts, matchDarts, totalMatches, matchWins, matchWinRate,
      total180s, playerElo,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get shadow bot stats");
    res.status(500).json({ error: "Failed to get shadow bot stats" });
  }
});

// GET /api/players/:id/shadow-profile — shadow bot profile derived from dart logs
// Returns { locked: true, totalDarts, needed } until 250+ combined darts are logged,
// then returns a full ShadowProfile object for use as BotConfig.shadowProfile.
router.get("/players/:id/shadow-profile", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }
    const THRESHOLD = 250;

    const [playerQ, dartLogQ, coQ, avgQ] = await Promise.all([
      db.execute(sql`SELECT name FROM players WHERE id = ${playerId}`),
      db.execute(sql`
        WITH dart_data AS (
          SELECT (dart->>'seg')::int AS seg, (dart->>'mult')::int AS mult, dart->>'phase' AS phase
          FROM practice_sessions, jsonb_array_elements(session_data->'dartLog') AS dart
          WHERE player1_id = ${playerId} AND session_data ? 'dartLog'
        )
        SELECT seg, mult, phase, COUNT(*)::int AS throws
        FROM dart_data WHERE seg IS NOT NULL AND mult IS NOT NULL
        GROUP BY seg, mult, phase ORDER BY throws DESC
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(p1_checkout_hits),0)::int AS co_hits,
               COALESCE(SUM(p1_checkout_attempts),0)::int AS co_attempts
        FROM practice_sessions WHERE player1_id = ${playerId}
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(p1_score),0)::int AS total_score,
               COALESCE(SUM(p1_darts),0)::int  AS total_darts
        FROM practice_sessions WHERE player1_id = ${playerId}
      `),
    ]);

    const playerName     = (playerQ.rows[0] as { name: string } | undefined)?.name ?? "";
    const totalDarts     = Number(avgQ.rows[0]?.total_darts ?? 0);

    if (totalDarts < THRESHOLD) {
      res.json({ locked: true, totalDarts, needed: THRESHOLD, playerName });
      return;
    }

    // Compute profile from dart logs
    const raw = dartLogQ.rows as { seg: number; mult: number; phase: string; throws: number }[];
    type SC = { treble: number; single: number; double: number };
    const bySeg: Record<number, SC> = {};
    for (const r of raw.filter(r => r.phase === "scoring")) {
      const seg = Number(r.seg); const mult = Number(r.mult); const n = Number(r.throws);
      if (!bySeg[seg]) bySeg[seg] = { treble: 0, single: 0, double: 0 };
      if (mult === 3) bySeg[seg].treble += n;
      else if (mult === 1) bySeg[seg].single += n;
      else if (mult === 2) bySeg[seg].double += n;
    }
    const segTotals = Object.entries(bySeg)
      .map(([s, c]) => { const seg = Number(s); const total = c.treble + c.single + c.double; return { seg, total, treble: c.treble, single: c.single }; })
      .sort((a, b) => b.total - a.total);

    const primary    = segTotals[0];
    const primarySeg = primary?.seg ?? 20;
    const treblePct  = primary && primary.total > 0 ? Math.round((primary.treble / primary.total) * 100) / 100 : 0.15;
    const singlePct  = primary && primary.total > 0 ? Math.round((primary.single / primary.total) * 100) / 100 : 0.55;

    const coDarts      = raw.filter(r => r.phase === "checkout" && Number(r.mult) === 2);
    const checkoutSegs = coDarts.length > 0 ? coDarts.slice(0, 6).map(r => Number(r.seg)) : [16, 8, 4, 2];

    const coHits          = Number(coQ.rows[0]?.co_hits ?? 0);
    const coAttempts      = Number(coQ.rows[0]?.co_attempts ?? 0);
    const rawDoubleHitPct = coAttempts > 0 ? Math.round((coHits / coAttempts) * 100) / 100 : 0.18;
    const doubleHitPct    = Math.max(0.05, Math.min(0.95, rawDoubleHitPct));

    const totalScore  = Number(avgQ.rows[0]?.total_score ?? 0);
    // Pure practice average — no Elo blending. Default 45 if session data somehow missing.
    const computedAvg = totalDarts > 0
      ? Math.round((totalScore / totalDarts) * 3 * 10) / 10
      : 45;

    res.json({
      locked: false,
      totalDarts,
      needed: THRESHOLD,
      playerName,
      playerId,
      primarySeg,
      treblePct,
      singlePct,
      checkoutSegs,
      doubleHitPct,
      computedAvg,
      primaryTarget: primary ? { seg: primarySeg, treblePct: Math.round(treblePct * 100) } : null,
      logDartsCount: raw.reduce((s, r) => s + Number(r.throws), 0),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get shadow profile");
    res.status(500).json({ error: "Failed to get shadow profile" });
  }
});

// GET /api/bots/leaderboard — all active players' bot summaries for comparison
router.get("/bots/leaderboard", async (req, res): Promise<void> => {
  try {
    const result = await db.execute(sql`
      WITH session_weights AS (
        SELECT player1_id, game_type_key, p1_darts, p1_score,
          POWER(0.92, ROW_NUMBER() OVER (PARTITION BY player1_id ORDER BY created_at DESC) - 1) AS w
        FROM practice_sessions WHERE p1_darts > 0
      )
      SELECT
        p.id   AS player_id,
        p.name AS player_name,
        p.status,
        COALESCE((SELECT SUM(p1_darts)::int FROM practice_sessions WHERE player1_id = p.id), 0) AS total_darts,
        COALESCE((SELECT COUNT(*)::int      FROM practice_sessions WHERE player1_id = p.id), 0) AS total_sessions,
        COUNT(DISTINCT sw.game_type_key)::int                                                   AS game_modes,
        COALESCE(
          SUM(sw.w * sw.p1_score) / NULLIF(SUM(sw.w * sw.p1_darts), 0),
        0) AS weighted_spd
      FROM players p
      LEFT JOIN session_weights sw ON sw.player1_id = p.id
      WHERE p.is_active = true AND p.status != 'ELIMINATED'
      GROUP BY p.id, p.name, p.status
      ORDER BY total_darts DESC NULLS LAST
    `);

    const THRESHOLD = 250;
    const LEVEL_THRESHOLDS = [
      { key: "elite",    min: 108, max: Infinity },
      { key: "pro",      min: 95,  max: 108      },
      { key: "county",   min: 80,  max: 95       },
      { key: "club",     min: 62,  max: 80       },
      { key: "amateur",  min: 45,  max: 62       },
      { key: "beginner", min: 0,   max: 45       },
    ];
    const LEVEL_ORDER = LEVEL_THRESHOLDS.map(l => l.key);

    const rows = (result.rows as any[]).map(r => {
      const totalDarts    = Number(r.total_darts);
      const totalSessions = Number(r.total_sessions);
      const gameModes     = Number(r.game_modes);
      const weightedSpd   = Number(r.weighted_spd ?? 0);
      const locked        = totalDarts < THRESHOLD;
      const computedAvg   = totalDarts > 0 ? weightedSpd * 3 : 0;

      let accuracyLevel = "beginner";
      let progressToNext = 0;
      if (!locked) {
        const lt = LEVEL_THRESHOLDS.find(l => computedAvg >= l.min) ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
        accuracyLevel = lt.key;
        if (lt.key === "elite") {
          progressToNext = 100;
        } else {
          const nextLt = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.indexOf(lt) - 1];
          progressToNext = nextLt ? Math.round(((computedAvg - lt.min) / (nextLt.min - lt.min)) * 100) : 0;
        }
      } else {
        progressToNext = Math.round((totalDarts / THRESHOLD) * 100);
      }

      return {
        playerId:      Number(r.player_id),
        playerName:    r.player_name as string,
        status:        r.status as string,
        totalDarts,
        totalSessions,
        gameModes,
        locked,
        computedAvg:   locked ? null : Math.round(computedAvg * 10) / 10,
        accuracyLevel: locked ? null : accuracyLevel,
        progressToNext,
      };
    });

    rows.sort((a, b) => {
      if (!a.locked && !b.locked) {
        const ai = LEVEL_ORDER.indexOf(a.accuracyLevel ?? "beginner");
        const bi = LEVEL_ORDER.indexOf(b.accuracyLevel ?? "beginner");
        if (ai !== bi) return ai - bi;
        return (b.computedAvg ?? 0) - (a.computedAvg ?? 0);
      }
      if (!a.locked) return -1;
      if (!b.locked) return 1;
      return b.totalDarts - a.totalDarts;
    });

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get bot leaderboard");
    res.status(500).json({ error: "Failed to get bot leaderboard" });
  }
});

// GET /api/shadow-bot/:playerId/matches — practice sessions played against this shadow bot
router.get("/shadow-bot/:playerId/matches", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.playerId, 10);
    if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }

    const result = await db.execute(sql`
      SELECT
        ps.id,
        ps.player1_id,
        p1.name        AS player_name,
        ps.winner_idx,
        ps.p1_darts,
        ps.p1_score,
        ps.p1_checkout_hits,
        ps.p1_checkout_attempts,
        ps.p1_180s,
        ps.game_type_key,
        ps.game_type_name,
        ps.created_at,
        ps.detail,
        CASE WHEN ps.p1_darts IS NOT NULL AND ps.p1_darts > 0
          THEN ROUND(CAST(ps.p1_score AS NUMERIC) * 3.0 / ps.p1_darts, 1)
          ELSE NULL END AS p1_avg
      FROM practice_sessions ps
      LEFT JOIN players p1 ON p1.id = ps.player1_id
      WHERE (ps.session_data->>'shadowPlayerId')::int = ${playerId}
      ORDER BY ps.created_at DESC
      LIMIT 50
    `);

    const rows = (result.rows as any[]).map(r => ({
      id:               Number(r.id),
      playerId:         Number(r.player1_id),
      playerName:       r.player_name as string,
      winnerIdx:        r.winner_idx != null ? Number(r.winner_idx) : null,
      playerWon:        r.winner_idx === 0 || r.winner_idx === "0",
      p1Darts:          r.p1_darts != null ? Number(r.p1_darts) : null,
      p1Avg:            r.p1_avg != null ? Number(r.p1_avg) : null,
      p1CheckoutHits:   r.p1_checkout_hits != null ? Number(r.p1_checkout_hits) : null,
      p1_180s:          r.p1_180s != null ? Number(r.p1_180s) : null,
      gameTypeKey:      r.game_type_key as string,
      gameTypeName:     r.game_type_name as string,
      detail:           r.detail as string | null,
      createdAt:        r.created_at as string,
    }));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get shadow bot matches");
    res.status(500).json({ error: "Failed to get shadow bot matches" });
  }
});

// GET /api/practice/game-leaderboard?gameTypeKey=...
router.get("/practice/game-leaderboard", async (req, res): Promise<void> => {
  try {
    const key = String(req.query.gameTypeKey ?? "").trim();
    if (!key) { res.json([]); return; }

    const result = await db.execute(sql`
      SELECT
        p.id                                                                         AS player_id,
        p.name                                                                       AS player_name,
        COUNT(*)::int                                                                AS games_played,
        (COUNT(*) FILTER (WHERE ps.winner_idx = 0 AND ps.player1_id = p.id)
         + COUNT(*) FILTER (WHERE ps.winner_idx = 1 AND ps.player2_id = p.id))::int AS wins,
        ROUND(AVG(
          CASE WHEN ps.player1_id = p.id AND COALESCE(ps.p1_darts, 0) > 0
               THEN ps.p1_score::numeric / ps.p1_darts * 3
          END
        ), 1)::float                                                                 AS avg
      FROM players p
      JOIN practice_sessions ps
        ON (ps.player1_id = p.id OR ps.player2_id = p.id)
       AND ps.game_type_key = ${key}
      WHERE p.is_active = true
      GROUP BY p.id, p.name
      HAVING COUNT(*) >= 1
      ORDER BY wins DESC, games_played DESC
      LIMIT 8
    `);

    res.json(result.rows as any[]);
  } catch (err) {
    req.log.error({ err }, "Failed to get game leaderboard");
    res.status(500).json({ error: "Failed to get game leaderboard" });
  }
});

// ─── GET /api/players/:id/bot-improvement-timeline ──────────────────────────
// Monthly grouped stats for improvement chart on shadow bot detail page
router.get("/players/:id/bot-improvement-timeline", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }

    const result = await db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM')         AS month,
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YY')          AS month_label,
        COUNT(*)::int                                                 AS sessions,
        COALESCE(SUM(p1_darts), 0)::int                              AS total_darts,
        CASE WHEN SUM(p1_darts) > 0
          THEN ROUND(SUM(p1_score)::numeric * 3.0 / SUM(p1_darts), 1)
          ELSE NULL END::float                                        AS avg_three_dart,
        COALESCE(SUM(p1_180s), 0)::int                               AS s180s,
        CASE WHEN SUM(p1_checkout_attempts) > 0
          THEN ROUND(SUM(p1_checkout_hits)::numeric / SUM(p1_checkout_attempts) * 100, 1)
          ELSE NULL END::float                                        AS checkout_pct
      FROM practice_sessions
      WHERE player1_id = ${playerId} AND p1_darts IS NOT NULL AND p1_darts > 0
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
      LIMIT 24
    `);

    res.json(result.rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get improvement timeline");
    res.status(500).json({ error: "Failed to get timeline" });
  }
});

// ─── GET /api/players/:id/practice-routine ────────────────────────────────────
// Rule-based personalised practice routine from player DNA
router.get("/players/:id/practice-routine", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }

    const [[agg], [vs], dartRows, gameRows] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*)::int                                                               AS total_sessions,
          COALESCE(SUM(p1_darts), 0)::int                                            AS total_darts,
          COALESCE(SUM(p1_checkout_attempts), 0)::int                                AS co_attempts,
          COALESCE(SUM(p1_checkout_hits), 0)::int                                    AS co_hits,
          CASE WHEN SUM(p1_darts) > 0
            THEN ROUND(SUM(p1_score)::numeric * 3.0 / SUM(p1_darts), 1)
            ELSE NULL END::float                                                     AS avg_three_dart
        FROM practice_sessions WHERE player1_id = ${playerId} AND p1_darts IS NOT NULL
      `).then(r => r.rows),

      db.execute(sql`
        WITH raw_darts AS (
          SELECT ordinality, dart
          FROM practice_sessions ps,
               jsonb_array_elements(ps.session_data->'dartLog') WITH ORDINALITY AS t(dart, ordinality)
          WHERE ps.player1_id = ${playerId}
            AND ps.session_data ? 'dartLog'
            AND ps.game_type_key IN (SELECT key FROM game_types WHERE engine = 'X01')
        ),
        scoring_darts AS (
          SELECT (dart->>'val')::int AS val,
                 ROW_NUMBER() OVER (ORDER BY ordinality) AS rn
          FROM raw_darts WHERE dart->>'phase' = 'scoring'
        ),
        visits AS (
          SELECT CEIL(rn::numeric / 3)::int AS vn, SUM(val) AS vscore
          FROM scoring_darts GROUP BY CEIL(rn::numeric / 3)::int
        ),
        f9 AS (SELECT ROUND(AVG(vscore)::numeric,1) AS first9 FROM visits WHERE vn <= 3)
        SELECT
          COUNT(CASE WHEN vscore=180  THEN 1 END)::int                       AS v180,
          COUNT(CASE WHEN vscore>=140 AND vscore<180 THEN 1 END)::int        AS v140,
          COUNT(CASE WHEN vscore>=100 AND vscore<140 THEN 1 END)::int        AS v100,
          COUNT(CASE WHEN vscore>=60  AND vscore<100 THEN 1 END)::int        AS v60,
          COUNT(*)::int                                                       AS total_visits,
          MAX(f9.first9)                                                      AS first9_avg
        FROM visits, f9
      `).then(r => r.rows),

      db.execute(sql`
        WITH darts AS (
          SELECT
            (dart->>'seg')::int  AS seg,
            (dart->>'mult')::int AS mult,
            dart->>'phase'       AS phase
          FROM practice_sessions ps,
               jsonb_array_elements(ps.session_data->'dartLog') AS t(dart)
          WHERE ps.player1_id = ${playerId}
            AND ps.session_data ? 'dartLog'
            AND ps.game_type_key IN (SELECT key FROM game_types WHERE engine = 'X01')
        )
        SELECT seg, mult, phase, COUNT(*) AS throws
        FROM darts WHERE seg IS NOT NULL
        GROUP BY seg, mult, phase
        ORDER BY throws DESC
      `).then(r => r.rows),

      db.execute(sql`
        SELECT game_type_key, game_type_name, COUNT(*)::int AS sessions
        FROM practice_sessions WHERE player1_id = ${playerId}
        GROUP BY game_type_key, game_type_name
        ORDER BY sessions ASC
        LIMIT 20
      `).then(r => r.rows),
    ]);

    const avg        = Number(agg?.avg_three_dart ?? 0);
    const coAtt      = Number(agg?.co_attempts ?? 0);
    const coHits     = Number(agg?.co_hits ?? 0);
    const coPct      = coAtt > 0 ? (coHits / coAtt) * 100 : 0;
    const totalDarts = Number(agg?.total_darts ?? 0);
    const totalSessions = Number(agg?.total_sessions ?? 0);

    const totalVisits = Number(vs?.total_visits ?? 0);
    const v180  = Number(vs?.v180 ?? 0);
    const v140  = Number(vs?.v140 ?? 0);
    const highRate = totalVisits > 0 ? ((v180 + v140) / totalVisits) * 100 : 0;
    const first9  = Number(vs?.first9_avg ?? 0);

    const scoringDarts = (dartRows as any[]).filter(r => r.phase === "scoring");
    const t20 = scoringDarts.filter(r => Number(r.seg) === 20);
    const t20Total   = t20.reduce((s: number, r: any) => s + Number(r.throws), 0);
    const t20Trebles = t20.filter((r: any) => Number(r.mult) === 3).reduce((s: number, r: any) => s + Number(r.throws), 0);
    const treblePct  = t20Total > 0 ? (t20Trebles / t20Total) * 100 : 0;

    const coDoubles = (dartRows as any[]).filter(r => r.phase === "checkout" && Number(r.mult) === 2);
    const topDouble = coDoubles.sort((a: any, b: any) => Number(b.throws) - Number(a.throws))[0];

    const thinSpots = (gameRows as any[]).filter(r => Number(r.sessions) < 4 && Number(r.sessions) > 0).slice(0, 3);

    const drills: any[] = [];

    drills.push({
      id: "warmup", title: "Warm-Up Round", icon: "🎯",
      priority: "normal", focus: "general",
      description: "5 minutes of relaxed throwing to find your natural release and loosen your wrist.",
      drill: "3 visits at T20, 3 visits at D16. No pressure — just feel the rhythm.",
      target: "Consistent release across all 6 visits",
      duration: "5 min",
    });

    if (coPct < 30 || (coAtt < 30 && totalDarts > 200)) {
      drills.push({
        id: "doubles", title: "Double Assassin", icon: "🎱",
        priority: coPct < 20 ? "critical" : "high", focus: "checkout",
        description: coPct > 0
          ? `Your checkout rate is ${Math.round(coPct)}% — games are slipping away on the doubles. This is the fastest way to win more legs.`
          : "Not enough checkout data yet. Build your double confidence now.",
        drill: topDouble
          ? `Start with your go-to D${topDouble.seg}, then work round the clock D1→D20. 3 darts at each double, count hits.`
          : "Round the clock doubles: D1 → D20 → D25. 3 darts at each double. Record how many you hit.",
        target: coAtt > 20 ? `Beat your current ${Math.round(coPct)}% rate in a focused session` : "Hit 8+ doubles in one full clock round",
        duration: "15 min",
      });
    }

    if (treblePct < 24 && totalDarts > 150) {
      drills.push({
        id: "trebles", title: "Treble Zone", icon: "⚡",
        priority: "high", focus: "scoring",
        description: `You're hitting trebles ${Math.round(treblePct)}% of the time at T20. Pushing to 25%+ unlocks consistent 100+ visits.`,
        drill: "40 darts at T20 only. Track: treble / single-20 / other. Don't adjust your aim — note your natural pattern.",
        target: "25%+ treble hit rate across 40 darts",
        duration: "10 min",
      });
    }

    if (highRate < 8 && avg > 0 && avg < 72) {
      drills.push({
        id: "scoring", title: "Score Chaser", icon: "🔥",
        priority: "high", focus: "scoring",
        description: `Only ${Math.round(highRate)}% of your visits hit 140+. Improving this is the single biggest lever for winning legs faster.`,
        drill: "Play 5-minute sets targeting only 100+ per visit. Start at 501, reset if any visit scores under 100 (except checkout attempt).",
        target: "5 consecutive 100+ visits in a single leg",
        duration: "15 min",
      });
    }

    if (first9 > 0 && first9 < 62 && avg < 68) {
      drills.push({
        id: "first9", title: "First 9 Starter", icon: "🚀",
        priority: "normal", focus: "opening",
        description: `Your first-9 average is ${first9}. The opening 3 visits set the tone — a 65+ start forces your opponent to respond.`,
        drill: "Throw exactly 9 darts (3 visits) from 501, record the total. Repeat 8 times. No finishing — scoring phase only.",
        target: "65+ first-9 average across 8 sets",
        duration: "10 min",
      });
    }

    if (thinSpots.length > 0 && totalSessions >= 5) {
      const spot = thinSpots[0] as any;
      drills.push({
        id: "variety", title: "Branch Out", icon: "🗺️",
        priority: "normal", focus: "variety",
        description: `Your bot has only ${spot.sessions} session${spot.sessions === 1 ? "" : "s"} of ${spot.game_type_name} data — thin spots limit how well it mimics your full game.`,
        drill: `Play 3 sessions of ${spot.game_type_name} in Practice Mode this week. It feeds your bot's DNA and builds all-round skills.`,
        target: "3 logged sessions of a new game type",
        duration: "20 min",
      });
    }

    if (avg >= 72 && coPct >= 28) {
      drills.push({
        id: "checkout_paths", title: "Checkout Surgeon", icon: "🏆",
        priority: "advanced", focus: "checkout",
        description: "You're throwing well — now make checkouts instinctive. Know your route from every score without thinking.",
        drill: "Start at 5 different scores (170, 121, 100, 81, 62). Throw until you checkout or bust. Note which routes feel natural.",
        target: "Complete 3 checkout paths without hesitating on the route",
        duration: "15 min",
      });
    }

    res.json({
      drills,
      stats: {
        avg: avg > 0 ? avg : null,
        coPct: coAtt > 5 ? Math.round(coPct) : null,
        treblePct: totalDarts > 100 ? Math.round(treblePct) : null,
        highScoringRate: totalVisits > 20 ? Math.round(highRate) : null,
        first9: first9 > 0 ? first9 : null,
        totalSessions,
        totalDarts,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to generate practice routine");
    res.status(500).json({ error: "Failed to generate routine" });
  }
});

// ─── GET /api/players/:id/shadow-rivalry ─────────────────────────────────────
// W/L record against each shadow bot the player has faced
router.get("/players/:id/shadow-rivalry", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }

    const result = await db.execute(sql`
      SELECT
        (ps.session_data->>'shadowPlayerId')::int                                        AS shadow_player_id,
        p.name                                                                            AS shadow_player_name,
        COUNT(*)::int                                                                     AS sessions_played,
        SUM(CASE WHEN ps.winner_idx = 0 THEN 1 ELSE 0 END)::int                         AS wins,
        SUM(CASE WHEN ps.winner_idx = 1 THEN 1 ELSE 0 END)::int                         AS losses,
        ROUND(AVG(
          CASE WHEN COALESCE(ps.p1_darts,0) > 0
            THEN ps.p1_score::numeric * 3.0 / ps.p1_darts END
        )::numeric, 1)::float                                                            AS avg_vs_bot,
        MAX(ps.created_at)                                                               AS last_played
      FROM practice_sessions ps
      LEFT JOIN players p ON p.id = (ps.session_data->>'shadowPlayerId')::int
      WHERE ps.player1_id = ${playerId}
        AND ps.session_data ? 'shadowPlayerId'
        AND (ps.session_data->>'shadowPlayerId') IS NOT NULL
        AND (ps.session_data->>'shadowPlayerId')::text NOT IN ('0', 'null')
      GROUP BY (ps.session_data->>'shadowPlayerId')::int, p.name
      ORDER BY sessions_played DESC
      LIMIT 10
    `);

    res.json(result.rows.map((r: any) => ({
      shadowPlayerId: Number(r.shadow_player_id),
      shadowPlayerName: r.shadow_player_name as string,
      sessionsPlayed: Number(r.sessions_played),
      wins: Number(r.wins),
      losses: Number(r.losses),
      avgVsBot: r.avg_vs_bot != null ? Number(r.avg_vs_bot) : null,
      lastPlayed: r.last_played as string,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get shadow rivalry");
    res.status(500).json({ error: "Failed to get rivalry" });
  }
});

// ─── POST /api/shadow-bot/simulate ────────────────────────────────────────────
// Simulate a best-of-7 legs 501 match between two shadow bots
router.post("/shadow-bot/simulate", async (req, res): Promise<void> => {
  try {
    const { p1Id, p2Id } = req.body as { p1Id: number; p2Id: number };
    if (!p1Id || !p2Id || p1Id === p2Id) {
      res.status(400).json({ error: "Need two different player IDs" }); return;
    }

    const THRESHOLD = 250;
    const getProfile = async (id: number) => {
      const [row] = (await db.execute(sql`
        WITH ranked AS (
          SELECT p1_darts, p1_score, p1_checkout_hits, p1_checkout_attempts,
                 ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
          FROM practice_sessions WHERE player1_id = ${id} AND p1_darts > 0
        )
        SELECT
          pl.name,
          COALESCE(SUM(r.p1_darts), 0)::int AS total_darts,
          ROUND(
            SUM(POWER(0.92, r.rn - 1) * r.p1_score) /
            NULLIF(SUM(POWER(0.92, r.rn - 1) * r.p1_darts), 0) * 3
          , 1)::float AS weighted_avg,
          CASE WHEN SUM(r.p1_checkout_attempts) > 0
            THEN ROUND(SUM(r.p1_checkout_hits)::numeric / SUM(r.p1_checkout_attempts) * 100, 1)
            ELSE NULL END::float AS checkout_pct
        FROM players pl
        JOIN ranked r ON TRUE
        WHERE pl.id = ${id}
        GROUP BY pl.name
      `)).rows;
      return row ?? null;
    };

    const [p1, p2] = await Promise.all([getProfile(p1Id), getProfile(p2Id)]);
    if (!p1 || !p2) { res.status(404).json({ error: "One or both players not found" }); return; }
    if (Number(p1.total_darts) < THRESHOLD || Number(p2.total_darts) < THRESHOLD) {
      res.status(400).json({ error: "One or both bots don't have enough data (250 darts required)" }); return;
    }

    const p1Avg = Number(p1.weighted_avg ?? 42);
    const p2Avg = Number(p2.weighted_avg ?? 42);
    const p1CoPct = Number(p1.checkout_pct ?? 20) / 100;
    const p2CoPct = Number(p2.checkout_pct ?? 20) / 100;

    function normalRand(mean: number, std: number) {
      const u1 = Math.random() || 1e-10, u2 = Math.random() || 1e-10;
      return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }

    function simLeg(avg: number, coPct: number): { darts: number; won: boolean } {
      let rem = 501, darts = 0;
      for (let v = 0; v < 60; v++) {
        const visit = Math.max(0, Math.round(normalRand(avg, avg * 0.38)));
        if (rem - visit <= 1) {
          darts += 3;
          if (rem <= 170 && Math.random() < coPct * 0.85) { return { darts, won: true }; }
          continue;
        }
        rem -= visit; darts += 3;
        if (rem <= 170 && Math.random() < coPct) { return { darts, won: true }; }
      }
      return { darts, won: false };
    }

    const LEG_TARGET = 4;
    let p1Legs = 0, p2Legs = 0;
    let p1TotalDarts = 0, p2TotalDarts = 0;
    const legLog: { leg: number; p1Won: boolean; p1Darts: number; p2Darts: number }[] = [];

    for (let leg = 1; leg <= 7 && p1Legs < LEG_TARGET && p2Legs < LEG_TARGET; leg++) {
      const l1 = simLeg(p1Avg, p1CoPct);
      const l2 = simLeg(p2Avg, p2CoPct);
      const p1WinsLeg = l1.darts <= l2.darts && l1.won;
      if (p1WinsLeg || (!l2.won && l1.won)) p1Legs++;
      else p2Legs++;
      p1TotalDarts += l1.darts; p2TotalDarts += l2.darts;
      legLog.push({ leg, p1Won: p1WinsLeg || (!l2.won && l1.won), p1Darts: l1.darts, p2Darts: l2.darts });
    }

    const totalLegs = p1Legs + p2Legs;
    res.json({
      p1: { id: p1Id, name: p1.name as string, avg: p1Avg, coPct: Math.round(p1CoPct * 100), legsWon: p1Legs, totalDarts: p1TotalDarts, avgDartsPerLeg: totalLegs > 0 ? Math.round(p1TotalDarts / totalLegs) : null },
      p2: { id: p2Id, name: p2.name as string, avg: p2Avg, coPct: Math.round(p2CoPct * 100), legsWon: p2Legs, totalDarts: p2TotalDarts, avgDartsPerLeg: totalLegs > 0 ? Math.round(p2TotalDarts / totalLegs) : null },
      winner: p1Legs > p2Legs ? p1.name as string : p2.name as string,
      winnerId: p1Legs > p2Legs ? p1Id : p2Id,
      score: `${p1Legs}-${p2Legs}`,
      legs: legLog,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to simulate bot match");
    res.status(500).json({ error: "Failed to simulate" });
  }
});

// ─── GET /api/shadow-bot/league ───────────────────────────────────────────────
// All shadow bots ranked by weighted avg (respects shadow_league_enabled setting)
router.get("/shadow-bot/league", async (req, res): Promise<void> => {
  try {
    const [settingRow] = (await db.execute(sql`
      SELECT value FROM settings WHERE key = 'shadow_league_enabled'
    `)).rows;
    const enabled = (settingRow as any)?.value === "true";

    const result = await db.execute(sql`
      WITH ranked AS (
        SELECT player1_id, p1_darts, p1_score, p1_checkout_hits, p1_checkout_attempts, p1_180s,
               ROW_NUMBER() OVER (PARTITION BY player1_id ORDER BY created_at DESC) AS rn
        FROM practice_sessions
        WHERE p1_darts IS NOT NULL AND p1_darts > 0 AND player1_id IS NOT NULL
      ),
      weighted AS (
        SELECT
          player1_id,
          COUNT(*)::int AS sessions,
          COALESCE(SUM(p1_darts), 0)::int AS total_darts,
          COALESCE(SUM(p1_180s), 0)::int  AS total_180s,
          COALESCE(SUM(p1_checkout_attempts), 0)::int AS co_att,
          COALESCE(SUM(p1_checkout_hits), 0)::int     AS co_hits,
          ROUND(
            SUM(POWER(0.92, rn - 1) * p1_score) /
            NULLIF(SUM(POWER(0.92, rn - 1) * p1_darts), 0) * 3
          , 1)::float AS weighted_avg
        FROM ranked
        GROUP BY player1_id
        HAVING COALESCE(SUM(p1_darts), 0) >= 250
      )
      SELECT
        pl.id AS player_id, pl.name AS player_name,
        w.sessions, w.total_darts, w.total_180s, w.co_att, w.co_hits,
        w.weighted_avg,
        CASE WHEN w.co_att > 0 THEN ROUND(w.co_hits::numeric / w.co_att * 100, 1) ELSE NULL END::float AS checkout_pct,
        CASE
          WHEN w.weighted_avg >= 108 THEN 'elite'
          WHEN w.weighted_avg >= 95  THEN 'pro'
          WHEN w.weighted_avg >= 80  THEN 'county'
          WHEN w.weighted_avg >= 62  THEN 'club'
          WHEN w.weighted_avg >= 45  THEN 'amateur'
          ELSE 'beginner'
        END AS level
      FROM players pl
      JOIN weighted w ON w.player1_id = pl.id
      ORDER BY w.weighted_avg DESC NULLS LAST
    `);

    res.json({ enabled, rows: result.rows });
  } catch (err) {
    req.log.error({ err }, "Failed to get shadow league");
    res.status(500).json({ error: "Failed to get league" });
  }
});

// ─── GET /api/players/:id/session-source-summary ─────────────────────────────
// Count sessions by source (practice / tour / master501) for profile tabs
router.get("/players/:id/session-source-summary", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }

    const result = await db.execute(sql`
      SELECT
        COALESCE(session_data->>'mode', 'practice')  AS source,
        COUNT(*)::int                                 AS sessions,
        COALESCE(SUM(p1_darts), 0)::int              AS total_darts,
        CASE WHEN SUM(p1_darts) > 0
          THEN ROUND(SUM(p1_score)::numeric * 3.0 / SUM(p1_darts), 1) ELSE NULL END::float AS avg,
        COALESCE(SUM(p1_180s), 0)::int               AS s180s
      FROM practice_sessions
      WHERE player1_id = ${playerId}
      GROUP BY COALESCE(session_data->>'mode', 'practice')
    `);

    res.json(result.rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get source summary");
    res.status(500).json({ error: "Failed" });
  }
});

export default router;

