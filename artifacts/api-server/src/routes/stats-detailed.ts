import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { statsService } from "../services/stats-service";
import { streakService } from "../services/streak-service";
import { drillProgressService } from "../services/drill-progress-service";
import { postMatchAnalysisService } from "../services/post-match-analysis-service";

const router = Router();

type TimeWindow = "7days" | "30days" | "90days" | "all";
function getDateFilter(window: string | undefined): Date {
  const now = new Date();
  switch (window as TimeWindow) {
    case "7days":  return new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    case "30days": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90days": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:       return new Date(0); // "all"
  }
}

// GET /api/players/:id/stats/categories - Game type breakdown
router.get("/players/:id/stats/categories", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const window = (req.query.window as any) || "all";
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    const breakdown = await statsService.getGameTypeBreakdown(playerId, window);
    res.json(breakdown);
  } catch (err) {
    req.log.error({ err }, "Failed to get category breakdown");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// GET /api/players/:id/stats/category/:category - Detailed stats for M501, Tour, Practice, League
router.get("/players/:id/stats/category/:category", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const category = req.params.category as any;
    const window = (req.query.window as any) || "all";
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    if (!["M501", "Tour", "Practice", "League"].includes(category)) {
      res.status(400).json({ error: "Invalid category. Must be M501, Tour, Practice, or League" });
      return;
    }

    const stats = await statsService.getCategoryStats(playerId, category, window);
    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Failed to get category stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// GET /api/players/:id/stats/category/:category/trends - Monthly trends for category
router.get("/players/:id/stats/category/:category/trends", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const category = req.params.category as any;
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    if (!["M501", "Tour", "Practice", "League"].includes(category)) {
      res.status(400).json({ error: "Invalid category" });
      return;
    }

    const trends = await statsService.getCategoryTrends(playerId, category);
    res.json(trends);
  } catch (err) {
    req.log.error({ err }, "Failed to get category trends");
    res.status(500).json({ error: "Failed to get trends" });
  }
});

// GET /api/players/:id/stats/category/:category/darts - Dart profile for category
router.get("/players/:id/stats/category/:category/darts", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const category = req.params.category as any;
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    if (!["M501", "Tour", "Practice", "League"].includes(category)) {
      res.status(400).json({ error: "Invalid category" });
      return;
    }

    const profile = await statsService.getCategoryDartProfile(playerId, category);
    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "Failed to get dart profile");
    res.status(500).json({ error: "Failed to get dart profile" });
  }
});

// GET /api/players/:id/stats/category/:category/sessions - Sessions for category
router.get("/players/:id/stats/category/:category/sessions", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const category = req.params.category as any;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    if (!["M501", "Tour", "Practice", "League"].includes(category)) {
      res.status(400).json({ error: "Invalid category" });
      return;
    }

    const sessions = await statsService.getCategorySessions(playerId, category, limit);
    res.json(sessions);
  } catch (err) {
    req.log.error({ err }, "Failed to get sessions");
    res.status(500).json({ error: "Failed to get sessions" });
  }
});

// GET /api/players/:id/stats/sessions/:sessionId - Session detail
router.get("/players/:id/stats/sessions/:sessionId", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    const sessionId = parseInt(req.params.sessionId, 10);
    
    if (isNaN(playerId) || isNaN(sessionId)) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }

    const detail = await statsService.getSessionDetail(playerId, sessionId);
    if (!detail) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Failed to get session detail");
    res.status(500).json({ error: "Failed to get session detail" });
  }
});

// GET /api/players/:id/stats/coach-feed - Data for coach integration
router.get("/players/:id/stats/coach-feed", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    const coachData = await statsService.getCoachFeedData(playerId);
    res.json(coachData);
  } catch (err) {
    req.log.error({ err }, "Failed to get coach feed");
    res.status(500).json({ error: "Failed to get coach feed" });
  }
});

// DEBUG ENDPOINT: /api/players/:id/stats/debug - Diagnostic stats info
router.get("/players/:id/stats/debug", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    
    if (isNaN(playerId)) {
      res.status(400).json({ error: "Invalid player ID" });
      return;
    }

    // Test categories endpoint
    const breakdown = await statsService.getGameTypeBreakdown(playerId, "all");
    
    // Test specific category
    const leagueStats = await statsService.getCategoryStats(playerId, "League", "all");
    
    res.json({
      playerId,
      timestamp: new Date().toISOString(),
      breakdown: {
        count: breakdown.length,
        data: breakdown.slice(0, 2), // Show first 2
      },
      leagueStats: {
        exists: !!leagueStats,
        matches: leagueStats?.matches ?? 0,
        wins: leagueStats?.wins ?? 0,
      },
      note: "This endpoint is for debugging only. Remove before production.",
    });
  } catch (err) {
    req.log.error({ err }, "Debug endpoint failed");
    res.status(500).json({ 
      error: "Debug endpoint failed",
      message: err instanceof Error ? err.message : "Unknown error"
    });
  }
});

// ── Streaks, drill progress, time-of-day, post-match analysis ──────────────────
// The service logic below (streak-service.ts, drill-progress-service.ts,
// post-match-analysis-service.ts) already existed, fully written against real
// match/practice data — it just never had routes registered in front of it.
// (getNextDrillRecommendation was left out: it depends on a "coach drills"
// list shape that doesn't actually match what any existing endpoint returns —
// wiring it up would mean guessing at a data contract, not just registering
// a route, so it needs a real design pass rather than a blind hookup.)

// GET /api/players/:id/streaks
router.get("/players/:id/streaks", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }
    res.json(await streakService.getStreakData(playerId));
  } catch (err) {
    req.log.error({ err }, "Failed to get streaks");
    res.status(500).json({ error: "Failed to get streaks" });
  }
});

// POST /api/players/:id/drills/complete
router.post("/players/:id/drills/complete", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }
    const { drillId, drillTitle, durationMinutes, score, difficulty, notes } = req.body ?? {};
    if (!drillId || !drillTitle || typeof score !== "number") {
      res.status(400).json({ error: "drillId, drillTitle and score are required" }); return;
    }
    const completion = await drillProgressService.completeDrill(
      playerId, drillId, drillTitle, durationMinutes ?? 0, score, difficulty ?? "medium", notes
    );
    res.json(completion);
  } catch (err) {
    req.log.error({ err }, "Failed to complete drill");
    res.status(500).json({ error: "Failed to record drill completion" });
  }
});

// GET /api/players/:id/drills/stats
router.get("/players/:id/drills/stats", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }
    res.json(await drillProgressService.getPlayerDrillStats(playerId));
  } catch (err) {
    req.log.error({ err }, "Failed to get drill stats");
    res.status(500).json({ error: "Failed to get drill stats" });
  }
});

// GET /api/players/:id/drills/milestones
router.get("/players/:id/drills/milestones", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }
    res.json(await drillProgressService.getPlayerDrillMilestones(playerId));
  } catch (err) {
    req.log.error({ err }, "Failed to get drill milestones");
    res.status(500).json({ error: "Failed to get drill milestones" });
  }
});

// GET /api/players/:id/drills/adaptive
router.get("/players/:id/drills/adaptive", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }
    const drills = await drillProgressService.getPlayerDrillStats(playerId);
    const adaptive = drills.map(drill => ({
      drillId: drill.drillId,
      drillTitle: drill.drillTitle,
      currentDifficulty: (drill.averageScore ?? 0) >= 90 ? "master" :
                         (drill.averageScore ?? 0) >= 75 ? "hard" :
                         (drill.averageScore ?? 0) >= 60 ? "medium" : "easy",
      mastery: drill.averageScore || 0,
      completedDifficulties: ["easy"],
      nextChallenge: drill.nextGoal || "Complete this level",
      // Not derived from real history yet (would need a proper mastery-over-time
      // model) — null rather than a fabricated number.
      daysToNextLevel: null,
    }));
    res.json(adaptive);
  } catch (err) {
    req.log.error({ err }, "Failed to get adaptive difficulty");
    res.status(500).json({ error: "Failed to get adaptive difficulty" });
  }
});

// GET /api/players/:id/stats/time-of-day
router.get("/players/:id/stats/time-of-day", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }

    const result = await db.execute(sql`
      WITH matches_with_hour AS (
        SELECT
          EXTRACT(HOUR FROM played_at)::int as hour,
          winner_id = ${playerId} as won,
          CASE WHEN winner_id = ${playerId} THEN winner_darts ELSE loser_darts END as darts,
          CASE WHEN winner_id = ${playerId}
            THEN winner_checkout_hits::float / NULLIF(winner_checkout_attempts, 0)
            ELSE loser_checkout_hits::float / NULLIF(loser_checkout_attempts, 0)
          END as checkout_rate
        FROM matches
        WHERE winner_id = ${playerId} OR loser_id = ${playerId}
      ),
      hour_stats AS (
        SELECT
          CASE
            WHEN hour >= 9 AND hour < 12 THEN '9am-12pm'
            WHEN hour >= 12 AND hour < 15 THEN '12pm-3pm'
            WHEN hour >= 15 AND hour < 18 THEN '3pm-6pm'
            WHEN hour >= 18 AND hour < 21 THEN '6pm-9pm'
            ELSE 'Other'
          END as time_window,
          COUNT(*)::int as total_matches,
          COUNT(CASE WHEN won THEN 1 END)::int as wins,
          AVG(darts)::numeric as avg_darts,
          AVG(checkout_rate)::numeric as avg_checkout
        FROM matches_with_hour
        GROUP BY time_window
      )
      SELECT
        time_window as hour,
        total_matches as matches,
        wins,
        (wins::float / NULLIF(total_matches, 0))::numeric as "winRate",
        avg_darts as "avgDarts",
        avg_checkout as "avgCheckout"
      FROM hour_stats
      ORDER BY time_window
    `);

    res.json(result.rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get time-of-day stats");
    res.status(500).json({ error: "Failed to get time-of-day stats" });
  }
});

// GET /api/matches/:matchId/analysis?playerId=X
router.get("/matches/:matchId/analysis", async (req, res) => {
  try {
    const matchId = parseInt(req.params.matchId, 10);
    const playerId = parseInt(req.query.playerId as string, 10);
    if (isNaN(matchId) || isNaN(playerId)) {
      res.status(400).json({ error: "Invalid matchId or playerId" }); return;
    }
    res.json(await postMatchAnalysisService.analyzeMatch(matchId, playerId));
  } catch (err) {
    req.log.error({ err }, "Failed to analyze match");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to analyze match" });
  }
});

// GET /api/players/:id/matches/recent?limit=10&showAnalyzed=false
router.get("/players/:id/matches/recent", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }
    const limit = Math.min(parseInt((req.query.limit as string) ?? "10", 10) || 10, 50);

    const result = await db.execute(sql`
      SELECT
        m.id,
        CASE WHEN winner_id = ${playerId} THEN loser_id ELSE winner_id END as "opponentId",
        p.name as "opponentName",
        winner_id = ${playerId} as won,
        m.played_at as "playedAt"
      FROM matches m
      JOIN players p ON (
        CASE WHEN m.winner_id = ${playerId} THEN m.loser_id ELSE m.winner_id END = p.id
      )
      WHERE winner_id = ${playerId} OR loser_id = ${playerId}
      ORDER BY m.played_at DESC
      LIMIT ${limit}
    `);

    res.json(result.rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get recent matches");
    res.status(500).json({ error: "Failed to get recent matches" });
  }
});

// ── Overall / by-game-type / dart-profile / trends ──────────────────────────────
// These back four components (overall-stats.tsx, by-game-type.tsx,
// dart-analysis.tsx, trends.tsx) that were imported in account.tsx but never
// rendered — unlike the rest of this file, there was no pre-written service
// logic to wire up here; this is new logic built from the matches/
// practice_sessions tables to match what those components already expect.

// GET /api/players/:id/stats/overview?window=7days|30days|90days|all
router.get("/players/:id/stats/overview", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }
    const cutoff = getDateFilter(req.query.window as string);

    const compResult = await db.execute(sql`
      SELECT
        COUNT(*)::int AS matches,
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN 1 ELSE 0 END), 0)::int AS wins,
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_darts ELSE loser_darts END), 0)::int AS total_darts,
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_180s ELSE loser_180s END), 0)::int AS total_180s,
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_checkout_hits ELSE loser_checkout_hits END), 0)::int AS checkout_hits,
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_checkout_attempts ELSE loser_checkout_attempts END), 0)::int AS checkout_attempts
      FROM matches
      WHERE (winner_id = ${playerId} OR loser_id = ${playerId}) AND played_at >= ${cutoff}
    `);
    const comp: any = compResult.rows[0] ?? {};

    const pracResult = await db.execute(sql`
      SELECT
        COUNT(*)::int AS sessions,
        COALESCE(SUM(p1_darts), 0)::int AS total_darts,
        COALESCE(SUM(p1_180s), 0)::int AS total_180s,
        COALESCE(SUM(p1_checkout_hits), 0)::int AS checkout_hits
      FROM practice_sessions
      WHERE player1_id = ${playerId} AND created_at >= ${cutoff}
    `);
    const prac: any = pracResult.rows[0] ?? {};

    const matches = Number(comp.matches ?? 0);
    const wins = Number(comp.wins ?? 0);
    const totalDarts = Number(comp.total_darts ?? 0);
    const checkoutHits = Number(comp.checkout_hits ?? 0);
    const checkoutAttempts = Number(comp.checkout_attempts ?? 0);

    res.json({
      competitive: {
        matches,
        wins,
        losses: matches - wins,
        winRate: matches > 0 ? wins / matches : 0,
        totalDarts,
        total180s: Number(comp.total_180s ?? 0),
        checkoutHits,
        checkoutAttempts,
        checkoutRate: checkoutAttempts > 0 ? checkoutHits / checkoutAttempts : 0,
        avgDartsPerMatch: matches > 0 ? totalDarts / matches : 0,
      },
      practice: {
        sessions: Number(prac.sessions ?? 0),
        totalDarts: Number(prac.total_darts ?? 0),
        total180s: Number(prac.total_180s ?? 0),
        checkoutHits: Number(prac.checkout_hits ?? 0),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats overview");
    res.status(500).json({ error: "Failed to get stats overview" });
  }
});

// GET /api/players/:id/stats/by-game-type?window=7days|30days|90days|all
router.get("/players/:id/stats/by-game-type", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }
    const cutoff = getDateFilter(req.query.window as string);

    const result = await db.execute(sql`
      SELECT
        game_type AS "gameType",
        COUNT(*)::int AS matches,
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN 1 ELSE 0 END), 0)::int AS wins,
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_darts ELSE loser_darts END), 0)::int AS "totalDarts",
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_180s ELSE loser_180s END), 0)::int AS "total180s"
      FROM matches
      WHERE (winner_id = ${playerId} OR loser_id = ${playerId}) AND played_at >= ${cutoff}
      GROUP BY game_type
      ORDER BY matches DESC
    `);

    res.json(result.rows.map((r: any) => {
      const matches = Number(r.matches);
      const wins = Number(r.wins);
      return {
        gameType: r.gameType,
        matches,
        wins,
        losses: matches - wins,
        winRate: matches > 0 ? wins / matches : 0,
        totalDarts: Number(r.totalDarts ?? 0),
        total180s: Number(r.total180s ?? 0),
      };
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to get by-game-type stats");
    res.status(500).json({ error: "Failed to get by-game-type stats" });
  }
});

// GET /api/players/:id/stats/game-type/:type/detail?window=7days|30days|90days|all
// :type is the raw game_type key (e.g. "x01", "cricket") as returned by
// by-game-type above — kept URL-safe rather than a display name with spaces.
router.get("/players/:id/stats/game-type/:type/detail", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }
    const gameType = req.params.type;
    const cutoff = getDateFilter(req.query.window as string);

    const result = await db.execute(sql`
      SELECT
        id,
        (winner_id = ${playerId}) AS won,
        CASE WHEN winner_id = ${playerId} THEN loser_name ELSE winner_name END AS opponent,
        CASE WHEN winner_id = ${playerId} THEN winner_darts ELSE loser_darts END AS "dartsUsed",
        played_at AS "playedAt"
      FROM matches
      WHERE (winner_id = ${playerId} OR loser_id = ${playerId})
        AND game_type = ${gameType}
        AND played_at >= ${cutoff}
      ORDER BY played_at DESC
      LIMIT 50
    `);

    res.json(result.rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get game-type detail");
    res.status(500).json({ error: "Failed to get game-type detail" });
  }
});

// GET /api/players/:id/stats/dart-profile
// Which board segments this player throws at most, from logged practice
// session dart-by-dart data (session_data.dartLog) — the same source the
// practice-routine coach recommendations already read from.
router.get("/players/:id/stats/dart-profile", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }

    const result = await db.execute(sql`
      WITH darts AS (
        SELECT (dart->>'seg')::int AS seg
        FROM practice_sessions ps,
             jsonb_array_elements(ps.session_data->'dartLog') AS t(dart)
        WHERE ps.player1_id = ${playerId} AND ps.session_data ? 'dartLog'
      ),
      counted AS (
        SELECT seg, COUNT(*)::int AS hits
        FROM darts
        WHERE seg IS NOT NULL
        GROUP BY seg
      ),
      total AS (SELECT COALESCE(SUM(hits), 0)::int AS total FROM counted)
      SELECT
        seg AS target,
        hits,
        CASE WHEN (SELECT total FROM total) > 0
          THEN ROUND(hits::numeric / (SELECT total FROM total) * 100, 1)
          ELSE 0
        END AS frequency
      FROM counted
      ORDER BY hits DESC
    `);

    const all = result.rows.map((r: any) => ({
      target: Number(r.target),
      hits: Number(r.hits),
      frequency: Number(r.frequency),
    }));

    res.json({
      mostFrequentTargets: all.slice(0, 5),
      allTargetFrequencies: all,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dart profile");
    res.status(500).json({ error: "Failed to get dart profile" });
  }
});

// GET /api/players/:id/stats/trends — win rate by month, last 6 months
router.get("/players/:id/stats/trends", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (isNaN(playerId)) { res.status(400).json({ error: "Invalid player ID" }); return; }

    const result = await db.execute(sql`
      SELECT
        to_char(date_trunc('month', played_at), 'Mon YYYY') AS month,
        date_trunc('month', played_at) AS month_start,
        COUNT(*)::int AS matches,
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN 1 ELSE 0 END), 0)::int AS wins
      FROM matches
      WHERE (winner_id = ${playerId} OR loser_id = ${playerId})
        AND played_at >= NOW() - INTERVAL '6 months'
      GROUP BY date_trunc('month', played_at)
      ORDER BY month_start ASC
    `);

    res.json(result.rows.map((r: any) => {
      const matches = Number(r.matches);
      const wins = Number(r.wins);
      return {
        month: r.month,
        matches,
        wins,
        winRate: matches > 0 ? wins / matches : 0,
      };
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to get trends");
    res.status(500).json({ error: "Failed to get trends" });
  }
});

export default router;
