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

// Categorize a practice_sessions row's game_type_key into M501 or Practice.
//
// Only two things ever write to practice_sessions: the Practice page
// (practice.ts, real game_type_keys like "501_double_out", "cricket") and
// M501's incidental all-zero-stats row (game_type_key === "master501",
// written purely so PRACTICE_ACTIVITY/the M501 leaderboard can find it — see
// master501.ts's comment). Tour and League never write here at all. The old
// version fell through to "League" by default and matched "Practice" only
// via an ILIKE-style substring check for "PRACTICE"/"SOLO" — but real
// Practice-page keys never contain those substrings, so every genuine
// practice session was silently mis-bucketed as "League" and getCategory-
// Sessions(..., "Practice") / getSessionDetail always came back empty for
// real sessions, while getCategorySessions(..., "League") wrongly listed
// practice sessions that aren't League matches at all (League matches live
// in the separate `matches` table, not here). Since this table only ever
// holds those two kinds of rows, "master501 → M501, everything else →
// Practice" is exhaustive and correct — no substring guessing needed.
const categorizeGameType = (gameTypeKey: string): GameTypeCategory => {
  const key = gameTypeKey?.toUpperCase() || "";

  if (key.includes("M501") || key.includes("MASTER")) return "M501";
  return "Practice";
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
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_100s ELSE loser_100s END), 0)::int as total_100s,
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_140s ELSE loser_140s END), 0)::int as total_140s,
        COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_170s ELSE loser_170s END), 0)::int as total_170s,
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
      total100s: row.total_100s,
      total140s: row.total_140s,
      total170s: row.total_170s,
      total180s: row.total_180s,
      checkoutHits: row.checkout_hits,
      checkoutAttempts: row.checkout_attempts,
      checkoutRate: row.checkout_attempts ? row.checkout_hits / row.checkout_attempts : 0,
    }));
  },

  // Get detailed stats for a specific category (M501, Tour, Practice, League)
  //
  // M501 and Tour never write to the `matches` table at all — M501 runs live
  // in master501_runs (+ a practice_sessions row with no per-dart stats, see
  // master501.ts's own comment on why), and Tour runs live in
  // player_tour_runs's bracket JSONB. Querying `matches` for those two
  // categories (the old behavior here) always returned zero rows, so a
  // player who'd genuinely played M501/Tour saw "0 matches, 0.0% win rate"
  // regardless of their real record. Both are now sourced from their own
  // tables below. Per-dart stats (darts thrown, 100s/140s/170s/180s,
  // checkout hits/attempts) genuinely aren't tracked at that granularity for
  // either mode, so those fields stay 0 rather than inventing numbers —
  // same "fact firewall" this codebase already applies elsewhere (see
  // master501.ts's PATCH /master501/runs/:runId comment).
  async getCategoryStats(playerId: number, category: GameTypeCategory, window: TimeWindow = "all") {
    try {
      const cutoff = getDateFilter(window);

      if (category === "M501") return await statsService.getM501CategoryStats(playerId, cutoff);
      if (category === "Tour")  return await statsService.getTourCategoryStats(playerId, cutoff);

      let whereClause = "";
      if (category === "Practice") {
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
            COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_100s ELSE loser_100s END), 0)::int as total_100s,
            COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_140s ELSE loser_140s END), 0)::int as total_140s,
            COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_170s ELSE loser_170s END), 0)::int as total_170s,
            COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_180s ELSE loser_180s END), 0)::int as total_180s,
            COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_checkout_hits ELSE loser_checkout_hits END), 0)::int as checkout_hits,
            COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN winner_checkout_attempts ELSE loser_checkout_attempts END), 0)::int as checkout_attempts
          FROM matches
          WHERE (winner_id = ${playerId} OR loser_id = ${playerId})
            AND played_at >= ${cutoff}
            ${drizzleSql.raw(whereClause)}
        `).catch((err: any) => {
          console.error("Match stats query error:", err);
          return { rows: [{ total_matches: 0, wins: 0, total_darts: 0, avg_darts: 0, total_100s: 0, total_140s: 0, total_170s: 0, total_180s: 0, checkout_hits: 0, checkout_attempts: 0 }] };
        }),
        // Practice sessions (only for Practice category or general).
        // Excludes game_type_key='master501' — M501 runs get their own
        // practice_sessions row purely so story-engine.ts's PRACTICE_ACTIVITY
        // detector and the M501 leaderboard can find them (see
        // master501.ts's PATCH /master501/runs/:runId comment); without this
        // exclusion those zero-darts rows were silently padding the Practice
        // category's session count and dragging its per-session averages
        // down, while M501 itself (sourced from master501_runs above)
        // separately still showed its own real numbers — the two tabs
        // visibly disagreed with each other.
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
            AND game_type_key IS DISTINCT FROM 'master501'
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
        total100s: matches.total_100s || 0,
        total140s: matches.total_140s || 0,
        total170s: matches.total_170s || 0,
        total180s: matches.total_180s || 0,
        checkoutHits: matches.checkout_hits || 0,
        checkoutAttempts: matches.checkout_attempts || 0,
        checkoutRate: matches.checkout_attempts ? (matches.checkout_hits || 0) / matches.checkout_attempts : 0,
      };
    } catch (error) {
      console.error("Error getting category stats:", error);
      throw error;
    }
  },

  // M501 category stats — sourced from master501_runs (each row is one
  // completed-or-in-progress run through a tier/round ladder), not `matches`.
  async getM501CategoryStats(playerId: number, cutoff: Date) {
    const result = await db.execute(drizzleSql`
      SELECT
        COUNT(*) FILTER (WHERE result IS NOT NULL)::int AS total_matches,
        COUNT(*) FILTER (WHERE result = 'win')::int AS wins
      FROM master501_runs
      WHERE player_id = ${playerId} AND started_at >= ${cutoff}
    `).catch((err: any) => {
      console.error("M501 stats query error:", err);
      return { rows: [{ total_matches: 0, wins: 0 }] };
    });
    const row = result.rows[0] as any;
    const totalMatches = row.total_matches || 0;
    const wins = row.wins || 0;

    return {
      category: "M501" as const,
      source: "competitive" as const,
      matches: totalMatches,
      wins,
      losses: totalMatches - wins,
      winRate: totalMatches ? wins / totalMatches : 0,
      // Per-dart stats aren't recorded per M501 run (see the comment above
      // getCategoryStats) — 0 here means "not tracked", not "none thrown".
      totalDarts: 0, avgDartsPerMatch: 0,
      total100s: 0, total140s: 0, total170s: 0, total180s: 0,
      checkoutHits: 0, checkoutAttempts: 0, checkoutRate: 0,
    };
  },

  // Tour category stats — sourced from player_tour_runs.bracket, the JSONB
  // blob the bracket engine (lib/bracketEngine.ts) reads and advances; Tour
  // never writes a row to `matches` at all. Knockout brackets store the
  // player's results per-match inside rounds[].matches[] (found by
  // p1Key/p2Key === "player"); Premier League brackets keep a running
  // standings row per participant (`isPlayer` marks the player's own),
  // covering the 9 group fixtures, plus a separate one-off final tracked via
  // finalResult since the final isn't part of the group standings.
  async getTourCategoryStats(playerId: number, cutoff: Date) {
    const result = await db.execute(drizzleSql`
      SELECT bracket FROM player_tour_runs
      WHERE player_id = ${playerId} AND started_at >= ${cutoff}
    `).catch((err: any) => {
      console.error("Tour stats query error:", err);
      return { rows: [] };
    });

    let totalMatches = 0;
    let wins = 0;
    for (const row of result.rows as any[]) {
      const bracket = row.bracket;
      if (!bracket) continue;

      if (bracket.format === "knockout") {
        for (const round of bracket.rounds ?? []) {
          for (const m of round.matches ?? []) {
            const playerInvolved = m.p1Key === "player" || m.p2Key === "player";
            if (!playerInvolved || m.winnerKey == null) continue;
            totalMatches++;
            if (m.winnerKey === "player") wins++;
          }
        }
      } else if (bracket.format === "premier_league") {
        const standing = (bracket.standings ?? []).find((s: any) => s.isPlayer);
        if (standing) {
          totalMatches += standing.played || 0;
          wins += standing.won || 0;
        }
        if (bracket.finalResult) {
          totalMatches++;
          if (bracket.finalResult === "win") wins++;
        }
      }
    }

    return {
      category: "Tour" as const,
      source: "competitive" as const,
      matches: totalMatches,
      wins,
      losses: totalMatches - wins,
      winRate: totalMatches ? wins / totalMatches : 0,
      // Per-dart stats aren't recorded per Tour leg either — see the M501
      // method above for why these stay 0 rather than guessed at.
      totalDarts: 0, avgDartsPerMatch: 0,
      total100s: 0, total140s: 0, total170s: 0, total180s: 0,
      checkoutHits: 0, checkoutAttempts: 0, checkoutRate: 0,
    };
  },

  // Get monthly trends for a category.
  //
  // Same table split as getCategoryStats above: M501 and Tour never write to
  // `matches`, so querying it for those two categories (the old behavior)
  // always returned an empty trend line even once the headline stats were
  // fixed to read master501_runs/player_tour_runs. Practice trends are left
  // as-is (empty) for now — practice_sessions has no win/loss concept to
  // chart against a "wins" trend line the same way competitive categories
  // do, and no caller currently requests a Practice trend.
  async getCategoryTrends(playerId: number, category: GameTypeCategory) {
    if (category === "M501")  return await statsService.getM501CategoryTrends(playerId);
    if (category === "Tour")  return await statsService.getTourCategoryTrends(playerId);

    const whereClause = `AND game_type NOT ILIKE '%M501%' AND game_type NOT ILIKE '%MASTER%'
                          AND game_type NOT ILIKE '%TOUR%' AND game_type NOT ILIKE '%CAREER%'
                          AND game_type NOT ILIKE '%PRACTICE%' AND game_type NOT ILIKE '%SOLO%'`;

    const result = await db.execute(drizzleSql`
      WITH monthly_stats AS (
        SELECT
          DATE_TRUNC('month', played_at)::DATE as month,
          COUNT(*)::int as matches,
          SUM(CASE WHEN winner_id = ${playerId} THEN 1 ELSE 0 END)::int as wins
        FROM matches
        WHERE (winner_id = ${playerId} OR loser_id = ${playerId})
          ${drizzleSql.raw(whereClause)}
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

  // M501 monthly trend — sourced from master501_runs, grouped by started_at.
  async getM501CategoryTrends(playerId: number) {
    const result = await db.execute(drizzleSql`
      WITH monthly_stats AS (
        SELECT
          DATE_TRUNC('month', started_at)::DATE as month,
          COUNT(*) FILTER (WHERE result IS NOT NULL)::int as matches,
          COUNT(*) FILTER (WHERE result = 'win')::int as wins
        FROM master501_runs
        WHERE player_id = ${playerId}
        GROUP BY DATE_TRUNC('month', started_at)
        ORDER BY month DESC
        LIMIT 12
      )
      SELECT * FROM monthly_stats ORDER BY month ASC
    `).catch((err: any) => {
      console.error("M501 trends query error:", err);
      return { rows: [] };
    });

    return (result.rows as any[]).map(row => ({
      month: new Date(row.month).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      matches: row.matches,
      wins: row.wins,
      winRate: row.matches ? row.wins / row.matches : 0,
    }));
  },

  // Tour monthly trend — sourced from player_tour_runs.bracket, the same
  // knockout/premier_league walk getTourCategoryStats does above, just
  // bucketed by the run's started_at month instead of summed across all time.
  async getTourCategoryTrends(playerId: number) {
    const result = await db.execute(drizzleSql`
      SELECT DATE_TRUNC('month', started_at)::DATE as month, bracket
      FROM player_tour_runs
      WHERE player_id = ${playerId}
    `).catch((err: any) => {
      console.error("Tour trends query error:", err);
      return { rows: [] };
    });

    const byMonth = new Map<string, { matches: number; wins: number }>();
    for (const row of result.rows as any[]) {
      const monthKey = new Date(row.month).toISOString();
      const bracket = row.bracket;
      if (!bracket) continue;

      let matches = 0, wins = 0;
      if (bracket.format === "knockout") {
        for (const round of bracket.rounds ?? []) {
          for (const m of round.matches ?? []) {
            const playerInvolved = m.p1Key === "player" || m.p2Key === "player";
            if (!playerInvolved || m.winnerKey == null) continue;
            matches++;
            if (m.winnerKey === "player") wins++;
          }
        }
      } else if (bracket.format === "premier_league") {
        const standing = (bracket.standings ?? []).find((s: any) => s.isPlayer);
        if (standing) { matches += standing.played || 0; wins += standing.won || 0; }
        if (bracket.finalResult) { matches++; if (bracket.finalResult === "win") wins++; }
      }

      const existing = byMonth.get(monthKey) ?? { matches: 0, wins: 0 };
      existing.matches += matches;
      existing.wins += wins;
      byMonth.set(monthKey, existing);
    }

    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([monthKey, { matches, wins }]) => ({
        month: new Date(monthKey).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        matches,
        wins,
        winRate: matches ? wins / matches : 0,
      }));
  },

  // Get dart profile for a category (from practice sessions)
  async getCategoryDartProfile(playerId: number, category: GameTypeCategory) {
    // Same "master501 → M501, everything else → Practice" split as
    // categorizeGameType() above, reimplemented in SQL — practice_sessions
    // only ever holds those two kinds of rows (Tour/League never write here),
    // so a Tour or League request correctly matches nothing rather than
    // guessing at a substring that was never going to appear.
    const categoryFilter =
      category === "M501"     ? drizzleSql`(game_type_key ILIKE '%M501%' OR game_type_key ILIKE '%MASTER%')` :
      category === "Practice" ? drizzleSql`(game_type_key NOT ILIKE '%M501%' AND game_type_key NOT ILIKE '%MASTER%')` :
      /* Tour / League: never represented in practice_sessions */
                                 drizzleSql`FALSE`;

    // Each dartLog entry is { seg, mult, val } — seg is the actual board segment
    // (1-20, or 25 for bull) the dart landed on; val is seg*mult (its point value).
    // Group by seg here, NOT val — grouping by val previously conflated a dart's
    // score with the segment it hit (e.g. a double-10 and a single-20 both score
    // 20, but they're different segments), and excluded every bullseye entirely
    // (a bull's val is always 25 or 50, so it never matched the old `val <= 20`
    // filter).
    const result = await db.execute(drizzleSql`
      WITH dart_analysis AS (
        SELECT
          (dart->>'seg')::int AS seg,
          COUNT(*)::int AS frequency
        FROM (
          SELECT jsonb_array_elements(session_data->'dartLog') as dart
          FROM practice_sessions
          WHERE player1_id = ${playerId}
            AND session_data ? 'dartLog'
            AND ${categoryFilter}
        ) t
        GROUP BY seg
      )
      SELECT * FROM dart_analysis WHERE seg IS NOT NULL AND seg > 0 AND seg <= 25
    `);

    const dartFrequency = new Map<number, number>();
    for (const row of result.rows as any[]) {
      dartFrequency.set(row.seg, row.frequency);
    }

    const totalDarts = Array.from(dartFrequency.values()).reduce((a, b) => a + b, 0);
    const targets = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 25];
    const hitRates = targets.map(target => ({
      target,
      hits: dartFrequency.get(target) || 0,
      frequency: totalDarts > 0 ? ((dartFrequency.get(target) || 0) / totalDarts) * 100 : 0,
    }));

    return {
      mostFrequentTargets: hitRates.filter(h => h.hits > 0).sort((a, b) => b.hits - a.hits).slice(0, 5),
      allTargetFrequencies: hitRates,
      totalDarts,
    };
  },

  // Get sessions for a category
  async getCategorySessions(playerId: number, category: GameTypeCategory, limit: number = 50) {
    // Was: fetch the most recent `limit` sessions across EVERY category,
    // THEN filter down to the requested one. A player with lots of recent
    // Tour/M501 activity could have their Practice-category sessions pushed
    // entirely out of that initial window, undercounting (or zeroing out)
    // results that genuinely exist further back. Filtering by category in
    // the query itself — before the limit — fixes that. This table only
    // ever holds M501 or Practice rows (see categorizeGameType above), so
    // any other category short-circuits to empty, matching prior behavior.
    if (category !== "M501" && category !== "Practice") return [];

    const isM501 = drizzleSql`(${practiceSessionsTable.gameTypeKey} ILIKE '%M501%' OR ${practiceSessionsTable.gameTypeKey} ILIKE '%MASTER%')`;
    const categoryCondition = category === "M501" ? isM501 : drizzleSql`NOT ${isM501}`;

    const sessions = await db
      .select()
      .from(practiceSessionsTable)
      .where(and(eq(practiceSessionsTable.player1Id, playerId), categoryCondition))
      .orderBy(desc(practiceSessionsTable.createdAt))
      .limit(limit);

    return sessions.map(session => ({
      id: session.id,
      gameType: session.gameTypeName,
      category,
      dartsThrown: session.dartsThrown,
      durationSeconds: session.durationSeconds,
      p1Score: session.p1Score,
      p1_180s: session.p1_180s,
      p1CheckoutHits: session.p1CheckoutHits,
      p1CheckoutAttempts: session.p1CheckoutAttempts,
      createdAt: session.createdAt,
      detail: session.detail,
    }));
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
