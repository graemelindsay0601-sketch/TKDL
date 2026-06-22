/**
 * ENHANCED STATS & COACH API ROUTES
 * All endpoints to be added to artifacts/api-server/src/routes/stats-detailed.ts
 */

// ===== STREAK ENDPOINTS =====

/**
 * GET /api/players/:id/streaks
 * Returns current and best win/checkout streaks
 * 
 * Response:
 * {
 *   currentWinStreak: number,
 *   bestWinStreak: number,
 *   currentCheckoutStreak: number,
 *   bestCheckoutStreak: number,
 *   streakMilestones: string[], // ["🔥 5-game win streak!", ...]
 *   lastMatchDate: Date
 * }
 */
export const getStreaks = async (req, res) => {
  const { id } = req.params;
  const streaks = await streakService.getStreakData(parseInt(id));
  res.json(streaks);
};

// ===== DRILL PROGRESS ENDPOINTS =====

/**
 * POST /api/players/:id/drills/complete
 * Record a completed drill session
 * 
 * Body:
 * {
 *   drillId: string,
 *   drillTitle: string,
 *   durationMinutes: number,
 *   score: number (0-100),
 *   difficulty: "easy" | "medium" | "hard" | "master",
 *   notes?: string
 * }
 */
export const completeDrill = async (req, res) => {
  const { id } = req.params;
  const { drillId, drillTitle, durationMinutes, score, difficulty, notes } = req.body;
  
  const completion = await drillProgressService.completeDrill(
    parseInt(id),
    drillId,
    drillTitle,
    durationMinutes,
    score,
    difficulty,
    notes
  );
  res.json(completion);
};

/**
 * GET /api/players/:id/drills/stats
 * Get drill progress stats for all drills player has done
 * 
 * Response:
 * [
 *   {
 *     drillId: string,
 *     drillTitle: string,
 *     totalCompletions: number,
 *     bestScore: number,
 *     averageScore: number,
 *     currentMastery: "novice" | "intermediate" | "proficient" | "mastered",
 *     nextGoal: string,
 *     improvementTrend: number // percentage
 *   }
 * ]
 */
export const getDrillStats = async (req, res) => {
  const { id } = req.params;
  const stats = await drillProgressService.getPlayerDrillStats(parseInt(id));
  res.json(stats);
};

/**
 * GET /api/players/:id/drills/milestones
 * Get drill-related achievement milestones
 * 
 * Response:
 * [
 *   {
 *     name: "First Drill",
 *     achieved: boolean,
 *     progress: number (0-100),
 *     description: string
 *   }
 * ]
 */
export const getDrillMilestones = async (req, res) => {
  const { id } = req.params;
  const milestones = await drillProgressService.getPlayerDrillMilestones(parseInt(id));
  res.json(milestones);
};

/**
 * GET /api/players/:id/drills/adaptive
 * Get adaptive difficulty progression for drills
 * 
 * Response:
 * [
 *   {
 *     drillId: string,
 *     drillTitle: string,
 *     currentDifficulty: "easy" | "medium" | "hard" | "master",
 *     mastery: number (0-100),
 *     completedDifficulties: string[],
 *     nextChallenge: string,
 *     daysToNextLevel: number | null
 *   }
 * ]
 */
export const getAdaptiveDifficulty = async (req, res) => {
  const { id } = req.params;
  const drills = await drillProgressService.getPlayerDrillStats(parseInt(id));
  
  const adaptive = drills.map(drill => ({
    drillId: drill.drillId,
    drillTitle: drill.drillTitle,
    currentDifficulty: drill.averageScore! >= 90 ? "master" : 
                       drill.averageScore! >= 75 ? "hard" :
                       drill.averageScore! >= 60 ? "medium" : "easy",
    mastery: drill.averageScore || 0,
    completedDifficulties: ["easy"], // TODO: query from DB
    nextChallenge: drill.nextGoal || "Complete this level",
    daysToNextLevel: Math.ceil(Math.random() * 14) // TODO: calculate from history
  }));
  
  res.json(adaptive);
};

// ===== TIME OF DAY ENDPOINTS =====

/**
 * GET /api/players/:id/stats/time-of-day
 * Get win rate analysis by hour of day
 * 
 * Response:
 * [
 *   {
 *     hour: "9am-12pm",
 *     matches: number,
 *     wins: number,
 *     winRate: number,
 *     avgDarts: number,
 *     avgCheckout: number
 *   }
 * ]
 */
export const getTimeOfDayStats = async (req, res) => {
  const { id } = req.params;
  
  const result = await db.execute(drizzleSql`
    WITH matches_with_hour AS (
      SELECT
        EXTRACT(HOUR FROM played_at)::int as hour,
        winner_id = ${parseInt(id)} as won,
        CASE WHEN winner_id = ${parseInt(id)} THEN winner_darts ELSE loser_darts END as darts,
        CASE WHEN winner_id = ${parseInt(id)}
          THEN winner_checkout_hits::float / NULLIF(winner_checkout_attempts, 0)
          ELSE loser_checkout_hits::float / NULLIF(loser_checkout_attempts, 0)
        END as checkout_rate
      FROM matches
      WHERE winner_id = ${parseInt(id)} OR loser_id = ${parseInt(id)}
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
      (wins::float / NULLIF(total_matches, 0))::numeric as win_rate,
      avg_darts,
      avg_checkout
    FROM hour_stats
    ORDER BY time_window
  `);
  
  res.json(result.rows);
};

// ===== POST-MATCH ANALYSIS ENDPOINTS =====

/**
 * GET /api/matches/:matchId/analysis?playerId=:playerId
 * Get detailed analysis of a completed match
 * 
 * Response:
 * {
 *   matchId: number,
 *   playerId: number,
 *   won: boolean,
 *   opponent: { name, playerId, tier },
 *   playerStats: { darts, checkout, checkoutAttempts, checkoutRate, _180s, eloChange },
 *   opponentStats: { darts, checkout, checkoutAttempts, checkoutRate, _180s },
 *   keyInsights: { strength, weakness, recommendation },
 *   comparisonToYourAverage: [
 *     { metric, yours, average, difference }
 *   ]
 * }
 */
export const getMatchAnalysis = async (req, res) => {
  const { matchId } = req.params;
  const { playerId } = req.query;
  
  const analysis = await postMatchAnalysisService.analyzeMatch(
    parseInt(matchId),
    parseInt(playerId as string)
  );
  
  res.json(analysis);
};

/**
 * GET /api/players/:id/matches/recent
 * Get recent matches for post-match analysis popup
 * 
 * Query params:
 * - limit: number (default: 10)
 * - showAnalyzed: boolean (show only unreviewed matches)
 * 
 * Response:
 * [
 *   {
 *     id: number,
 *     opponent: { id, name },
 *     won: boolean,
 *     played_at: Date,
 *     analyzed: boolean
 *   }
 * ]
 */
export const getRecentMatches = async (req, res) => {
  const { id } = req.params;
  const { limit = 10, showAnalyzed = false } = req.query;
  
  const result = await db.execute(drizzleSql`
    SELECT
      m.id,
      CASE WHEN winner_id = ${parseInt(id)} THEN loser_id ELSE winner_id END as opponent_id,
      p.name as opponent_name,
      winner_id = ${parseInt(id)} as won,
      m.played_at,
      COALESCE(m.match_analysis_viewed, false) as analyzed
    FROM matches m
    JOIN players p ON (
      CASE WHEN m.winner_id = ${parseInt(id)} THEN m.loser_id ELSE m.winner_id END = p.id
    )
    WHERE winner_id = ${parseInt(id)} OR loser_id = ${parseInt(id)}
    ${showAnalyzed ? drizzleSql`AND NOT COALESCE(m.match_analysis_viewed, false)` : drizzleSql``}
    ORDER BY m.played_at DESC
    LIMIT ${parseInt(limit as string)}
  `);
  
  res.json(result.rows);
};

// ===== HELPER: CALCULATE NEXT DRILL RECOMMENDATION =====

/**
 * POST /api/players/:id/drills/next-recommendation
 * Get AI-powered recommendation for next drill based on performance
 * 
 * Body (optional):
 * {
 *   recentMatchId?: number (if just finished a match)
 * }
 * 
 * Response:
 * {
 *   type: "new" | "improve",
 *   drill: { id, title, focus, duration },
 *   reason: string,
 *   priority: "critical" | "high" | "normal"
 * }
 */
export const getNextDrillRecommendation = async (req, res) => {
  const { id } = req.params;
  const { recentMatchId } = req.body;
  
  const coachData = await practiceService.getCoachFeedback(parseInt(id));
  const recommendation = await drillProgressService.getNextDrillRecommendation(
    parseInt(id),
    coachData.drills || []
  );
  
  res.json(recommendation);
};

// ===== EXPORTS FOR ROUTE REGISTRATION =====

export default {
  // Streaks
  getStreaks,
  
  // Drill Progress
  completeDrill,
  getDrillStats,
  getDrillMilestones,
  getAdaptiveDifficulty,
  getNextDrillRecommendation,
  
  // Time of Day
  getTimeOfDayStats,
  
  // Post-Match Analysis
  getMatchAnalysis,
  getRecentMatches,
};

/**
 * ROUTE REGISTRATION
 * Add these to artifacts/api-server/src/routes/stats-detailed.ts:
 * 
 * // Streaks
 * router.get('/players/:id/streaks', getStreaks);
 * 
 * // Drill Progress
 * router.post('/players/:id/drills/complete', completeDrill);
 * router.get('/players/:id/drills/stats', getDrillStats);
 * router.get('/players/:id/drills/milestones', getDrillMilestones);
 * router.get('/players/:id/drills/adaptive', getAdaptiveDifficulty);
 * router.post('/players/:id/drills/next-recommendation', getNextDrillRecommendation);
 * 
 * // Time of Day
 * router.get('/players/:id/stats/time-of-day', getTimeOfDayStats);
 * 
 * // Post-Match Analysis
 * router.get('/matches/:matchId/analysis', getMatchAnalysis);
 * router.get('/players/:id/matches/recent', getRecentMatches);
 */
