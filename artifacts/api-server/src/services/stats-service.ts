import { db, matchesTable, practiceSessionsTable, playersTable } from "@workspace/db";
import { eq, and, desc, gte, sql as drizzleSql } from "drizzle-orm";

type TimeWindow = "7days" | "30days" | "90days" | "all";
type GameTypeCategory = "M501" | "Tour" | "Practice" | "League";

const getDateFilter = (window: TimeWindow): Date => {
  const now = new Date();
  switch (window) {
    case "7days": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30days": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90days": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "all": return new Date(0);
  }
};

// Categorize game types into M501, Tour, Practice, League
const categorizeGameType = (gameTypeKey: string): GameTypeCategory => {
  const key = gameTypeKey?.toUpperCase() || "";
  
  if (key.includes("M501") || key.includes("MASTER")) return "M501";
  if (key.includes("TOUR") || key.includes("CAREER")) return "Tour";
  if (key.includes("PRACTICE") || key.includes("SOLO")) return "Practice";
  
  // Default to League for regular competitive games (501, cricket, etc)
  return "League";
};

const getGameTypeCategory = (gameType: string): GameTypeCategory => {
  const normalized = gameType?.toUpperCase() || "";
  
  if (normalized.includes("M501") || normalized.includes("MASTER")) return "M501";
  if (normalized.includes("TOUR") || normalized.includes("CAREER")) return "Tour";
  if (normalized.includes("PRACTICE") || normalized.includes("SOLO")) return "Practice";
  
  return "League";
};

export const statsService = {
  // Get all game type categories with high-level stats
  async getGameTypeBreakdown(playerId: number, window: TimeWindow = "all") {
    const cutoff = getDateFilter(window);
    
    const result = await db.execute(drizzleSql`
      SELECT 
        game_type,
        COUNT(*)::int as total_matches,
        SUM(CASE WHEN winner_id = ${playerId} THEN 1 ELSE 0 END)::int as wins,
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_darts ELSE loser_darts END), 0)::int as total_darts,
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_180s ELSE loser_180s END), 0)::int as total_180s,
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_checkout_hits ELSE loser_checkout_hits END), 0)::int as checkout_hits,
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_checkout_attempts ELSE loser_checkout_attempts END), 0)::int as checkout_attempts
      FROM matches 
      WHERE (winner_id = ${playerId} OR loser_id = ${playerId}) 
        AND played_at >= ${cutoff}
      GROUP BY game_type
      ORDER BY total_matches DESC
    `);

    return (result.rows as any[]).map(row => ({
      gameType: row.game_type,
      gameTypeName: row.game_type || "Unknown",
      category: getGameTypeCategory(row.game_type),
      matches: row.total_matches,
      wins: row.wins,
      losses: row.total_matches - row.wins,
      winRate: row.total_matches ? row.wins / row.total_matches : 0,
      totalDarts: row.total_darts,
      total180s: row.total_180s,
      checkoutHits: row.checkout_hits,
      checkoutAttempts: row.checkout_attempts,
      checkoutRate: row.checkout_attempts ? row.checkout_hits / row.checkout_attempts : 0,
    }));
  },

  // Get detailed stats for a specific category (M501, Tour, Practice, League)
  async getCategoryStats(playerId: number, category: GameTypeCategory, window: TimeWindow = "all") {
    try {
      const cutoff = getDateFilter(window);
      
      let whereClause = "";
      if (category === "M501") {
        whereClause = `AND (game_type ILIKE '%M501%' OR game_type ILIKE '%MASTER%')`;
      } else if (category === "Tour") {
        whereClause = `AND (game_type ILIKE '%TOUR%' OR game_type ILIKE '%CAREER%')`;
      } else if (category === "Practice") {
        whereClause = `AND (game_type ILIKE '%PRACTICE%' OR game_type ILIKE '%SOLO%')`;
      } else {
        // League: everything else
        whereClause = `AND game_type NOT ILIKE '%M501%' AND game_type NOT ILIKE '%MASTER%' 
                        AND game_type NOT ILIKE '%TOUR%' AND game_type NOT ILIKE '%CAREER%'
                        AND game_type NOT ILIKE '%PRACTICE%' AND game_type NOT ILIKE '%SOLO%'`;
      }

      const [matchStats, practiceStats] = await Promise.all([
        // Competitive matches for this category
        db.execute(drizzleSql`
          SELECT 
            COUNT(*)::int as total_matches,
            SUM(CASE WHEN winner_id = ${playerId} THEN 1 ELSE 0 END)::int as wins,
            COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_darts ELSE loser_darts END), 0)::int as total_darts,
            COALESCE(AVG(CASE WHEN winner_id = ${playerId} OR loser_id = ${playerId} THEN CASE WHEN winner_id = ${playerId} THEN winner_darts ELSE loser_darts END ELSE NULL END), 0)::numeric as avg_darts,
            COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_180s ELSE loser_180s END), 0)::int as total_180s,
            COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_checkout_hits ELSE loser_checkout_hits END), 0)::int as checkout_hits,
            COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_checkout_attempts ELSE loser_checkout_attempts END), 0)::int as checkout_attempts
          FROM matches 
          WHERE (winner_id = ${playerId} OR loser_id = ${playerId}) 
            AND played_at >= ${cutoff}
            ${whereClause}
        `).catch((err: any) => {
          console.error("Match stats query error:", err);
          return { rows: [{ total_matches: 0, wins: 0, total_darts: 0, avg_darts: 0, total_180s: 0, checkout_hits: 0, checkout_attempts: 0 }] };
        }),
        // Practice sessions (only for Practice category or general)
        category === "Practice" ? db.execute(drizzleSql`
          SELECT 
            COUNT(*)::int as sessions,
            COALESCE(SUM(darts_thrown), 0)::int as total_darts_practice,
            COALESCE(SUM(p1_180s), 0)::int as total_180s,
            COALESCE(SUM(p1_checkout_hits), 0)::int as checkout_hits,
            COALESCE(AVG(p1_darts), 0)::numeric as avg_darts
          FROM practice_sessions 
          WHERE player1_id = ${playerId} 
            AND created_at >= ${cutoff}
        `).catch((err: any) => {
          console.error("Practice stats query error:", err);
          return { rows: [{ sessions: 0, total_darts_practice: 0, total_180s: 0, checkout_hits: 0, avg_darts: 0 }] };
        }) : Promise.resolve({ rows: [{ sessions: 0, total_darts_practice: 0, total_180s: 0, checkout_hits: 0, avg_darts: 0 }] }),
      ]);

      const matches = matchStats.rows[0] as any;
      const practice = (practiceStats as any).rows[0] as any;

      if (category === "Practice") {
        return {
          category: "Practice",
          source: "practice",
          sessions: practice.sessions || 0,
          totalDarts: practice.total_darts_practice || 0,
          avgDartsPerSession: practice.avg_darts ? parseFloat(practice.avg_darts) : 0,
          total180s: practice.total_180s || 0,
          checkoutHits: practice.checkout_hits || 0,
        };
      }

      return {
        category,
        source: "competitive",
        matches: matches.total_matches || 0,
        wins: matches.wins || 0,
        losses: (matches.total_matches || 0) - (matches.wins || 0),
        winRate: matches.total_matches ? (matches.wins || 0) / matches.total_matches : 0,
        totalDarts: matches.total_darts || 0,
        avgDartsPerMatch: matches.avg_darts ? parseFloat(matches.avg_darts) : 0,
        total180s: matches.total_180s || 0,
        checkoutHits: matches.checkout_hits || 0,
        checkoutAttempts: matches.checkout_attempts || 0,
      checkoutRate: matches.checkout_attempts ? (matches.checkout_hits || 0) / matches.checkout_attempts : 0,
    };
  },

  // Get monthly trends for a category
  async getCategoryTrends(playerId: number, category: GameTypeCategory) {
    let whereClause = "";
    if (category === "M501") {
      whereClause = `AND (game_type ILIKE '%M501%' OR game_type ILIKE '%MASTER%')`;
    } else if (category === "Tour") {
      whereClause = `AND (game_type ILIKE '%TOUR%' OR game_type ILIKE '%CAREER%')`;
    } else if (category === "Practice") {
      whereClause = `AND (game_type ILIKE '%PRACTICE%' OR game_type ILIKE '%SOLO%')`;
    } else {
      whereClause = `AND game_type NOT ILIKE '%M501%' AND game_type NOT ILIKE '%MASTER%' 
                      AND game_type NOT ILIKE '%TOUR%' AND game_type NOT ILIKE '%CAREER%'
                      AND game_type NOT ILIKE '%PRACTICE%' AND game_type NOT ILIKE '%SOLO%'`;
    }

    const result = await db.execute(drizzleSql`
      WITH monthly_stats AS (
        SELECT 
          DATE_TRUNC('month', played_at)::DATE as month,
          COUNT(*)::int as matches,
          SUM(CASE WHEN winner_id = ${playerId} THEN 1 ELSE 0 END)::int as wins
        FROM matches 
        WHERE (winner_id = ${playerId} OR loser_id = ${playerId})
          ${whereClause}
        GROUP BY DATE_TRUNC('month', played_at)
        ORDER BY month DESC
        LIMIT 12
      )
      SELECT * FROM monthly_stats ORDER BY month ASC
    `);

    return (result.rows as any[]).map(row => ({
      month: new Date(row.month).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      matches: row.matches,
      wins: row.wins,
      winRate: row.matches ? row.wins / row.matches : 0,
    }));
  },

  // Get dart profile for a category (from practice sessions)
  async getCategoryDartProfile(playerId: number, category: GameTypeCategory) {
    const result = await db.execute(drizzleSql`
      WITH dart_analysis AS (
        SELECT 
          (dart->>'val')::int AS val,
          COUNT(*)::int AS frequency
        FROM (
          SELECT jsonb_array_elements(session_data->'dartLog') as dart
          FROM practice_sessions 
          WHERE player1_id = ${playerId} 
            AND session_data ? 'dartLog'
        ) t
        GROUP BY val
        ORDER BY val DESC
      )
      SELECT * FROM dart_analysis WHERE val > 0 AND val <= 20
    `);

    const dartFrequency = new Map<number, number>();
    for (const row of result.rows as any[]) {
      dartFrequency.set(row.val, row.frequency);
    }

    const targets = [20, 19, 18, 17, 16, 15, 25];
    const hitRates = targets.map(target => ({
      target,
      hits: dartFrequency.get(target) || 0,
      frequency: dartFrequency.size > 0 
        ? ((dartFrequency.get(target) || 0) / Array.from(dartFrequency.values()).reduce((a, b) => a + b, 1)) * 100
        : 0,
    }));

    return {
      mostFrequentTargets: hitRates.sort((a, b) => b.hits - a.hits).slice(0, 5),
      allTargetFrequencies: hitRates,
    };
  },

  // Get sessions for a category
  async getCategorySessions(playerId: number, category: GameTypeCategory, limit: number = 50) {
    const sessions = await db
      .select()
      .from(practiceSessionsTable)
      .where(eq(practiceSessionsTable.player1Id, playerId))
      .orderBy(desc(practiceSessionsTable.createdAt))
      .limit(limit);

    return sessions.map(session => ({
      id: session.id,
      gameType: session.gameTypeName,
      category: categorizeGameType(session.gameTypeKey || ""),
      dartsThrown: session.dartsThrown,
      durationSeconds: session.durationSeconds,
      p1Score: session.p1Score,
      p1_180s: session.p1_180s,
      p1CheckoutHits: session.p1CheckoutHits,
      p1CheckoutAttempts: session.p1CheckoutAttempts,
      createdAt: session.createdAt,
      detail: session.detail,
    })).filter(s => s.category === category);
  },

  // Get session detail
  async getSessionDetail(playerId: number, sessionId: number) {
    const [session] = await db
      .select()
      .from(practiceSessionsTable)
      .where(and(eq(practiceSessionsTable.id, sessionId), eq(practiceSessionsTable.player1Id, playerId)))
      .limit(1);

    if (!session) return null;

    const sessionData = session.sessionData as any;
    const dartLog = sessionData?.dartLog || [];

    return {
      id: session.id,
      gameType: session.gameTypeName,
      category: categorizeGameType(session.gameTypeKey || ""),
      dartsThrown: session.dartsThrown,
      durationSeconds: session.durationSeconds,
      p1Score: session.p1Score,
      p1_180s: session.p1_180s,
      p1CheckoutHits: session.p1CheckoutHits,
      p1CheckoutAttempts: session.p1CheckoutAttempts,
      createdAt: session.createdAt,
      dartLog: dartLog.slice(0, 100).map((d: any) => d.val || d),
      avgDartValue: dartLog.length ? dartLog.reduce((sum: number, d: any) => sum + (d.val || 0), 0) / dartLog.length : 0,
    };
  },

  // Get stats for coach integration (calculates metrics coach needs for drill generation)
  async getCoachFeedData(playerId: number) {
    const result = await db.execute(drizzleSql`
      SELECT
        COALESCE(SUM(p1_darts), 0)::int as total_darts,
        COALESCE(SUM(p1_checkout_attempts), 0)::int as co_attempts,
        COALESCE(SUM(p1_checkout_hits), 0)::int as co_hits,
        COUNT(*)::int as total_sessions,
        CASE WHEN SUM(p1_darts) > 0
          THEN ROUND(SUM(p1_score)::numeric * 3.0 / SUM(p1_darts), 1)
          ELSE NULL END::float as avg_three_dart
      FROM practice_sessions 
      WHERE player1_id = ${playerId} AND p1_darts IS NOT NULL
    `);

    const row = result.rows[0] as any;
    
    return {
      totalDarts: row.total_darts || 0,
      checkoutAttempts: row.co_attempts || 0,
      checkoutHits: row.co_hits || 0,
      checkoutRate: row.co_attempts ? (row.co_hits / row.co_attempts) * 100 : 0,
      totalSessions: row.total_sessions || 0,
      avgThreeDart: row.avg_three_dart ? parseFloat(row.avg_three_dart) : 0,
    };
  },
};
