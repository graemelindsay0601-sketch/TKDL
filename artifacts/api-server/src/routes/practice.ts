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

    // Visit-level stats from dart logs (X01 sessions only)
    // Groups every 3 darts into a visit and buckets the visit score
    const [visitStats] = (await db.execute(sql`
      WITH session_darts AS (
        SELECT
          ps.id                                           AS session_id,
          (dart->>'val')::int                             AS val,
          dart->>'phase'                                  AS phase,
          ordinality                                      AS dart_pos
        FROM practice_sessions ps,
             jsonb_array_elements(ps.session_data->'dartLog') WITH ORDINALITY AS t(dart, ordinality)
        WHERE ps.player1_id = ${playerId}
          AND ps.session_data ? 'dartLog'
          AND ps.game_type_key LIKE 'x01%'
      ),
      visit_scores AS (
        SELECT
          session_id,
          CEIL(dart_pos::numeric / 3)::int   AS visit_num,
          SUM(val)                            AS visit_score
        FROM session_darts
        WHERE phase = 'scoring'
        GROUP BY session_id, CEIL(dart_pos::numeric / 3)::int
      ),
      first9 AS (
        SELECT ROUND(AVG(visit_score)::numeric, 1) AS first9_avg
        FROM visit_scores
        WHERE visit_num <= 3
      )
      SELECT
        COUNT(CASE WHEN vs.visit_score = 180 THEN 1 END)::int                      AS v180,
        COUNT(CASE WHEN vs.visit_score >= 140 AND vs.visit_score < 180 THEN 1 END)::int AS v140,
        COUNT(CASE WHEN vs.visit_score >= 100 AND vs.visit_score < 140 THEN 1 END)::int AS v100,
        COUNT(CASE WHEN vs.visit_score >= 60  AND vs.visit_score < 100 THEN 1 END)::int AS v60,
        COUNT(CASE WHEN vs.visit_score >= 40  AND vs.visit_score < 60  THEN 1 END)::int AS v40,
        COUNT(CASE WHEN vs.visit_score >= 1   AND vs.visit_score < 40  THEN 1 END)::int AS v_low,
        COUNT(CASE WHEN vs.visit_score = 0 THEN 1 END)::int                        AS v_zero,
        MAX(vs.visit_score)::int                                                    AS best_visit,
        COUNT(*)::int                                                               AS total_visits,
        MAX(f.first9_avg)                                                           AS first9_avg
      FROM visit_scores vs, first9 f
    `)).rows;

    res.json({
      ...agg,
      best_session_avg: best?.session_avg ?? null,
      visit_stats: visitStats ?? null,
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

// GET /api/players/:id/dart-profile — computed dart pattern profile from all dart logs
router.get("/players/:id/dart-profile", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }

    const MIN_DARTS = 100;

    // Unpack all darts from JSONB dart logs stored in session_data
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

// GET /api/players/:id/shadow-profile — shadow bot profile derived from dart logs
// Returns { locked: true, totalDarts, needed } until 250+ combined darts are logged,
// then returns a full ShadowProfile object for use as BotConfig.shadowProfile.
router.get("/players/:id/shadow-profile", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }
    const THRESHOLD = 250;

    const [practiceQ, playerQ, dartLogQ, coQ, avgQ] = await Promise.all([
      db.execute(sql`SELECT COALESCE(SUM(p1_darts),0)::int AS practice_darts FROM practice_sessions WHERE player1_id = ${playerId}`),
      db.execute(sql`SELECT name, career_wins, career_losses FROM players WHERE id = ${playerId}`),
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

    const practiceDarts = Number(practiceQ.rows[0]?.practice_darts ?? 0);
    const player = playerQ.rows[0] as { name: string; career_wins: number; career_losses: number } | undefined;
    const matchDarts  = (Number(player?.career_wins ?? 0) + Number(player?.career_losses ?? 0)) * 50;
    const totalDarts  = practiceDarts + matchDarts;

    if (totalDarts < THRESHOLD) {
      res.json({ locked: true, totalDarts, needed: THRESHOLD, playerName: player?.name ?? "" });
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
    const treblePct  = primary && primary.total > 0 ? Math.round((primary.treble / primary.total) * 100) / 100 : 0.25;
    const singlePct  = primary && primary.total > 0 ? Math.round((primary.single / primary.total) * 100) / 100 : 0.50;

    const coDarts     = raw.filter(r => r.phase === "checkout" && Number(r.mult) === 2);
    const checkoutSegs = coDarts.length > 0 ? coDarts.slice(0, 6).map(r => Number(r.seg)) : [16, 8, 4, 2];

    const coHits     = Number(coQ.rows[0]?.co_hits ?? 0);
    const coAttempts = Number(coQ.rows[0]?.co_attempts ?? 0);
    const doubleHitPct = coAttempts > 0 ? Math.round((coHits / coAttempts) * 100) / 100 : 0.22;

    const totalScore       = Number(avgQ.rows[0]?.total_score ?? 0);
    const totalPracticeDarts = Number(avgQ.rows[0]?.total_darts ?? 0);
    const computedAvg      = totalPracticeDarts > 0 ? Math.round((totalScore / totalPracticeDarts) * 3 * 10) / 10 : 45;

    res.json({
      locked: false,
      totalDarts,
      needed: THRESHOLD,
      playerName: player?.name ?? "",
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

export default router;
