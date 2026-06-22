import { db } from "@workspace/db";
import { sql as drizzleSql } from "drizzle-orm";

export interface StreakData {
  currentWinStreak: number;
  bestWinStreak: number;
  currentCheckoutStreak: number;
  bestCheckoutStreak: number;
  lastMatchDate?: Date;
  streakMilestones: string[];
}

export interface StreakHistory {
  type: "win" | "checkout";
  length: number;
  startDate: Date;
  endDate: Date;
}

export const streakService = {
  // Calculate current win streak
  async getCurrentWinStreak(playerId: number): Promise<number> {
    const result = await db.execute(drizzleSql`
      WITH ordered_matches AS (
        SELECT 
          played_at,
          winner_id = ${playerId} as is_win,
          ROW_NUMBER() OVER (ORDER BY played_at DESC) as rn
        FROM matches
        WHERE winner_id = ${playerId} OR loser_id = ${playerId}
        ORDER BY played_at DESC
      ),
      streak_groups AS (
        SELECT
          is_win,
          rn - ROW_NUMBER() OVER (ORDER BY rn) as streak_group
        FROM ordered_matches
      )
      SELECT COUNT(*)::int as streak_length
      FROM streak_groups
      WHERE is_win = true
      GROUP BY streak_group
      ORDER BY streak_group ASC
      LIMIT 1
    `);

    return (result.rows[0] as any)?.streak_length || 0;
  },

  // Get best win streak all-time
  async getBestWinStreak(playerId: number): Promise<number> {
    const result = await db.execute(drizzleSql`
      WITH ordered_matches AS (
        SELECT 
          played_at,
          winner_id = ${playerId} as is_win,
          ROW_NUMBER() OVER (ORDER BY played_at DESC) as rn
        FROM matches
        WHERE winner_id = ${playerId} OR loser_id = ${playerId}
      ),
      streak_groups AS (
        SELECT
          is_win,
          rn - ROW_NUMBER() OVER (ORDER BY rn) as streak_group
        FROM ordered_matches
      ),
      streaks AS (
        SELECT COUNT(*)::int as streak_length
        FROM streak_groups
        WHERE is_win = true
        GROUP BY streak_group
      )
      SELECT COALESCE(MAX(streak_length), 0)::int as best_streak
      FROM streaks
    `);

    return (result.rows[0] as any)?.best_streak || 0;
  },

  // Calculate current checkout streak (consecutive matches with 50%+ checkout)
  async getCurrentCheckoutStreak(playerId: number): Promise<number> {
    const result = await db.execute(drizzleSql`
      WITH match_checkouts AS (
        SELECT
          played_at,
          CASE 
            WHEN winner_id = ${playerId} 
              THEN COALESCE(winner_checkout_attempts, 0) > 0
                   AND COALESCE(winner_checkout_hits, 0)::float / COALESCE(winner_checkout_attempts, 1) >= 0.5
            WHEN loser_id = ${playerId}
              THEN COALESCE(loser_checkout_attempts, 0) > 0
                   AND COALESCE(loser_checkout_hits, 0)::float / COALESCE(loser_checkout_attempts, 1) >= 0.5
            ELSE false
          END as good_checkout,
          ROW_NUMBER() OVER (ORDER BY played_at DESC) as rn
        FROM matches
        WHERE winner_id = ${playerId} OR loser_id = ${playerId}
        ORDER BY played_at DESC
      ),
      streak_groups AS (
        SELECT
          good_checkout,
          rn - ROW_NUMBER() OVER (ORDER BY rn) as streak_group
        FROM match_checkouts
      )
      SELECT COUNT(*)::int as streak_length
      FROM streak_groups
      WHERE good_checkout = true
      GROUP BY streak_group
      ORDER BY streak_group ASC
      LIMIT 1
    `);

    return (result.rows[0] as any)?.streak_length || 0;
  },

  // Get all streak data
  async getStreakData(playerId: number): Promise<StreakData> {
    const [currentWin, bestWin, currentCheckout, bestCheckout] = await Promise.all([
      this.getCurrentWinStreak(playerId),
      this.getBestWinStreak(playerId),
      this.getCurrentCheckoutStreak(playerId),
      this.getBestCheckoutStreak(playerId),
    ]);

    const lastMatch = await db.execute(drizzleSql`
      SELECT played_at FROM matches
      WHERE winner_id = ${playerId} OR loser_id = ${playerId}
      ORDER BY played_at DESC
      LIMIT 1
    `);

    const streakMilestones: string[] = [];
    if (currentWin >= 5) streakMilestones.push(`🔥 ${currentWin}-game win streak!`);
    if (currentWin >= bestWin && bestWin > 0) streakMilestones.push("🏆 Tied personal best!");
    if (currentWin > bestWin) streakMilestones.push("🚀 New personal best streak!");
    if (currentCheckout >= 3) streakMilestones.push(`✓ ${currentCheckout} matches with 50%+ checkouts`);

    return {
      currentWinStreak: currentWin,
      bestWinStreak: bestWin,
      currentCheckoutStreak: currentCheckout,
      bestCheckoutStreak: bestCheckout,
      lastMatchDate: lastMatch.rows[0] ? new Date((lastMatch.rows[0] as any).played_at) : undefined,
      streakMilestones,
    };
  },

  // Get best checkout streak
  async getBestCheckoutStreak(playerId: number): Promise<number> {
    const result = await db.execute(drizzleSql`
      WITH match_checkouts AS (
        SELECT
          played_at,
          CASE 
            WHEN winner_id = ${playerId} 
              THEN COALESCE(winner_checkout_attempts, 0) > 0
                   AND COALESCE(winner_checkout_hits, 0)::float / COALESCE(winner_checkout_attempts, 1) >= 0.5
            WHEN loser_id = ${playerId}
              THEN COALESCE(loser_checkout_attempts, 0) > 0
                   AND COALESCE(loser_checkout_hits, 0)::float / COALESCE(loser_checkout_attempts, 1) >= 0.5
            ELSE false
          END as good_checkout,
          ROW_NUMBER() OVER (ORDER BY played_at DESC) as rn
        FROM matches
        WHERE winner_id = ${playerId} OR loser_id = ${playerId}
      ),
      streak_groups AS (
        SELECT
          good_checkout,
          rn - ROW_NUMBER() OVER (ORDER BY rn) as streak_group
        FROM match_checkouts
      ),
      streaks AS (
        SELECT COUNT(*)::int as streak_length
        FROM streak_groups
        WHERE good_checkout = true
        GROUP BY streak_group
      )
      SELECT COALESCE(MAX(streak_length), 0)::int as best_streak
      FROM streaks
    `);

    return (result.rows[0] as any)?.best_streak || 0;
  },

  // Get streak history (all notable streaks)
  async getStreakHistory(playerId: number, minLength: number = 3): Promise<StreakHistory[]> {
    const result = await db.execute(drizzleSql`
      WITH ordered_matches AS (
        SELECT 
          played_at,
          winner_id = ${playerId} as is_win,
          ROW_NUMBER() OVER (ORDER BY played_at DESC) as rn
        FROM matches
        WHERE winner_id = ${playerId} OR loser_id = ${playerId}
      ),
      streak_groups AS (
        SELECT
          is_win,
          played_at,
          rn - ROW_NUMBER() OVER (PARTITION BY is_win ORDER BY rn) as streak_group
        FROM ordered_matches
      ),
      streak_info AS (
        SELECT
          is_win,
          streak_group,
          COUNT(*)::int as streak_length,
          MAX(played_at) as start_date,
          MIN(played_at) as end_date
        FROM streak_groups
        WHERE is_win = true
        GROUP BY is_win, streak_group
        HAVING COUNT(*) >= ${minLength}
      )
      SELECT 
        'win'::text as type,
        streak_length,
        start_date,
        end_date
      FROM streak_info
      ORDER BY start_date DESC
      LIMIT 20
    `);

    return (result.rows as any[]).map((row: any) => ({
      type: row.type as "win" | "checkout",
      length: row.streak_length,
      startDate: new Date(row.start_date),
      endDate: new Date(row.end_date),
    }));
  },

  // Check if player should get milestone notification
  getStreakMilestoneAlert(streakData: StreakData): string | null {
    if (streakData.currentWinStreak === 5) return "🔥 You're on a 5-game winning streak!";
    if (streakData.currentWinStreak === 10) return "🚀 INCREDIBLE: 10-game winning streak!";
    if (streakData.currentWinStreak === 20) return "👑 LEGENDARY: 20-game winning streak!";

    if (streakData.currentWinStreak > streakData.bestWinStreak) {
      return `🏆 New personal best! ${streakData.currentWinStreak}-game streak!`;
    }

    if (streakData.currentCheckoutStreak === 3) return "✓ 3 consecutive 50%+ checkout matches!";

    return null;
  },
};
