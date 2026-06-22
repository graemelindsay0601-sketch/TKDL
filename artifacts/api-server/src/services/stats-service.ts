import { db, matchesTable, practiceSessionsTable, playersTable } from "@workspace/db";
import { eq, and, desc, gte, sql as drizzleSql } from "drizzle-orm";

type TimeWindow = "7days" | "30days" | "90days" | "all";

const getDateFilter = (window: TimeWindow): Date => {
  const now = new Date();
  switch (window) {
    case "7days": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30days": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90days": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "all": return new Date(0);
  }
};

const normalizeGameType = (gameType: string): string => {
  const normalized = gameType.toUpperCase().replace(/_/g, "");
  if (normalized.startsWith("X01") || normalized === "501" || normalized === "301" || normalized === "1001") {
    return "X01";
  }
  if (normalized === "CRICKET") return "CRICKET";
  return normalized;
};

export const statsService = {
  async getOverallStats(playerId: number, window: TimeWindow = "all") {
    const cutoff = getDateFilter(window);
    
    const [matchResults, practiceData] = await Promise.all([
      db.execute(drizzleSql`
        SELECT 
          COUNT(*)::int as total_matches,
          SUM(CASE WHEN winner_id = ${playerId} THEN 1 ELSE 0 END)::int as wins,
          SUM(CASE WHEN loser_id = ${playerId} THEN 1 ELSE 0 END)::int as losses,
          COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_darts ELSE loser_darts END), 0)::int as total_darts,
          COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_180s ELSE loser_180s END), 0)::int as total_180s,
          COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_checkout_hits ELSE loser_checkout_hits END), 0)::int as checkout_hits,
          COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_checkout_attempts ELSE loser_checkout_attempts END), 0)::int as checkout_attempts,
          COALESCE(AVG(CASE WHEN winner_id = ${playerId} OR loser_id = ${playerId} THEN CASE WHEN winner_darts > 0 OR loser_darts > 0 THEN CASE WHEN winner_id = ${playerId} THEN winner_darts ELSE loser_darts END ELSE NULL END END), 0)::numeric as avg_darts_per_match
        FROM matches 
        WHERE (winner_id = ${playerId} OR loser_id = ${playerId}) 
          AND played_at >= ${cutoff}
      `),
      db.execute(drizzleSql`
        SELECT 
          COUNT(*)::int as sessions,
          COALESCE(SUM(darts_thrown), 0)::int as total_darts_practice,
          COALESCE(SUM(p1_180s), 0)::int as p1_180s,
          COALESCE(SUM(p1_checkout_hits), 0)::int as p1_checkouts
        FROM practice_sessions 
        WHERE player1_id = ${playerId} 
          AND created_at >= ${cutoff}
      `),
    ]);

    const matches = matchResults.rows[0] as any;
    const practice = practiceData.rows[0] as any;

    return {
      competitive: {
        matches: matches.total_matches || 0,
        wins: matches.wins || 0,
        losses: matches.losses || 0,
        winRate: matches.total_matches ? (matches.wins || 0) / matches.total_matches : 0,
        totalDarts: matches.total_darts || 0,
        total180s: matches.total_180s || 0,
        checkoutHits: matches.checkout_hits || 0,
        checkoutAttempts: matches.checkout_attempts || 0,
        checkoutRate: matches.checkout_attempts ? (matches.checkout_hits || 0) / matches.checkout_attempts : 0,
        avgDartsPerMatch: matches.avg_darts_per_match ? parseFloat(matches.avg_darts_per_match) : 0,
      },
      practice: {
        sessions: practice.sessions || 0,
        totalDarts: practice.total_darts_practice || 0,
        total180s: practice.p1_180s || 0,
        checkoutHits: practice.p1_checkouts || 0,
      },
    };
  },

  async getByGameType(playerId: number, window: TimeWindow = "all") {
    const cutoff = getDateFilter(window);
    
    const result = await db.execute(drizzleSql`
      SELECT 
        game_type,
        COUNT(*)::int as total,
        SUM(CASE WHEN winner_id = ${playerId} THEN 1 ELSE 0 END)::int as wins,
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_darts ELSE loser_darts END), 0)::int as total_darts,
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_180s ELSE loser_180s END), 0)::int as total_180s
      FROM matches 
      WHERE (winner_id = ${playerId} OR loser_id = ${playerId}) 
        AND played_at >= ${cutoff}
      GROUP BY game_type
      ORDER BY total DESC
    `);

    return (result.rows as any[]).map(row => ({
      gameType: normalizeGameType(row.game_type),
      matches: row.total,
      wins: row.wins,
      losses: row.total - row.wins,
      winRate: row.total ? row.wins / row.total : 0,
      totalDarts: row.total_darts,
      total180s: row.total_180s,
    }));
  },

  async getGameTypeDetail(playerId: number, gameType: string, window: TimeWindow = "all") {
    const cutoff = getDateFilter(window);
    const normalized = normalizeGameType(gameType);
    
    const result = await db.execute(drizzleSql`
      SELECT 
        m.id,
        m.winner_id,
        m.winner_name,
        m.loser_name,
        m.winner_darts,
        m.winner_180s,
        m.loser_darts,
        m.loser_180s,
        m.played_at,
        m.game_type,
        m.stake,
        m.elo_change
      FROM matches m
      WHERE (m.winner_id = ${playerId} OR m.loser_id = ${playerId})
        AND UPPER(REPLACE(m.game_type, '_', '')) LIKE ${'%' + normalized.replace(/[_]/g, '') + '%'}
        AND m.played_at >= ${cutoff}
      ORDER BY m.played_at DESC
      LIMIT 50
    `);

    return (result.rows as any[]).map(match => ({
      id: match.id,
      opponent: match.winner_id === playerId ? match.loser_name : match.winner_name,
      won: match.winner_id === playerId,
      dartsUsed: match.winner_id === playerId ? match.winner_darts : match.loser_darts,
      opponent180s: match.winner_id === playerId ? match.loser_180s : match.winner_180s,
      playedAt: match.played_at,
      eloChange: match.elo_change,
      stake: match.stake,
    }));
  },

  async getTrends(playerId: number) {
    const result = await db.execute(drizzleSql`
      WITH monthly_stats AS (
        SELECT 
          DATE_TRUNC('month', played_at)::DATE as month,
          COUNT(*)::int as matches,
          SUM(CASE WHEN winner_id = ${playerId} THEN 1 ELSE 0 END)::int as wins
        FROM matches 
        WHERE (winner_id = ${playerId} OR loser_id = ${playerId})
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

  async getDartProfile(playerId: number) {
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

    // Calculate hit rates for common targets
    const targets = [20, 19, 18, 17, 16, 15, 25];
    const hitRates = targets.map(target => ({
      target,
      hits: dartFrequency.get(target) || 0,
      frequency: ((dartFrequency.get(target) || 0) / Array.from(dartFrequency.values()).reduce((a, b) => a + b, 1)) * 100,
    }));

    return {
      mostFrequentTargets: hitRates.sort((a, b) => b.hits - a.hits).slice(0, 5),
      allTargetFrequencies: hitRates,
    };
  },

  async getSessionHistory(playerId: number, limit: number = 50) {
    const sessions = await db
      .select()
      .from(practiceSessionsTable)
      .where(eq(practiceSessionsTable.player1Id, playerId))
      .orderBy(desc(practiceSessionsTable.createdAt))
      .limit(limit);

    return sessions.map(session => ({
      id: session.id,
      gameType: session.gameTypeName,
      dartsThrown: session.dartsThrown,
      durationSeconds: session.durationSeconds,
      p1Score: session.p1Score,
      p1_180s: session.p1_180s,
      p1CheckoutHits: session.p1CheckoutHits,
      p1CheckoutAttempts: session.p1CheckoutAttempts,
      createdAt: session.createdAt,
      detail: session.detail,
      opponent: session.player2Id ? `Player ${session.player2Id}` : "Solo",
    }));
  },

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
};
