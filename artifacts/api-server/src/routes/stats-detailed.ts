import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { statsService } from "../services/stats-service";
import { streakService } from "../services/streak-service";
import { drillProgressService } from "../services/drill-progress-service";
import { postMatchAnalysisService } from "../services/post-match-analysis-service";

const router = Router();

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

export default router;
