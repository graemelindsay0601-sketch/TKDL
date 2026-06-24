import { db } from "@workspace/db";
import { playerLoginStreaks, playerCurrencyTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export interface LoginReward {
  baseCoins: number;
  streakBonus: number;
  daysMilestone: number | null;
  totalCoins: number;
  currentStreak: number;
  bestStreak: number;
}

export const cardClashLoginService = {
  /**
   * Handle daily login for Card Clash
   * Awards coins based on login streak
   * Returns: { baseCoins, streakBonus, totalCoins, currentStreak }
   */
  async handleDailyLogin(playerId: number): Promise<LoginReward> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = today.toISOString().split("T")[0];

    // Get or create login streak record
    let streakRecord = await db.query.playerLoginStreaks.findFirst({
      where: eq(playerLoginStreaks.playerId, playerId),
    });

    if (!streakRecord) {
      // First login ever
      const [created] = await db
        .insert(playerLoginStreaks)
        .values({
          playerId,
          currentStreak: 1,
          bestStreak: 1,
          lastLoginDate: todayString,
          totalLogins: 1,
        })
        .returning();

      streakRecord = created;
    }

    // Check if already logged in today
    const lastLogin = streakRecord.lastLoginDate ? new Date(streakRecord.lastLoginDate) : null;
    const lastLoginString = lastLogin ? lastLogin.toISOString().split("T")[0] : null;

    let newStreak = streakRecord.currentStreak || 0;
    let newBestStreak = streakRecord.bestStreak || 0;
    let coinsAwarded = 0;
    let daysMilestone: number | null = null;

    if (lastLoginString === todayString) {
      // Already logged in today - no coins/streak change
      return {
        baseCoins: 0,
        streakBonus: 0,
        daysMilestone: null,
        totalCoins: 0,
        currentStreak: newStreak,
        bestStreak: newBestStreak,
      };
    }

    if (lastLogin) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const yesterdayString = yesterday.toISOString().split("T")[0];

      if (lastLoginString === yesterdayString) {
        // Consecutive day - increment streak
        newStreak = (streakRecord.currentStreak || 0) + 1;
      } else {
        // Gap in days - reset to 1
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    // Update best streak if needed
    if (newStreak > (streakRecord.bestStreak || 0)) {
      newBestStreak = newStreak;
    }

    // Award base coins
    coinsAwarded = 10;

    // Check for streak bonuses
    let streakBonus = 0;
    if (newStreak === 7) {
      streakBonus = 25;
      daysMilestone = 7;
    } else if (newStreak === 30) {
      streakBonus = 100;
      daysMilestone = 30;
    }

    const totalCoins = coinsAwarded + streakBonus;

    // Update streak record
    await db
      .update(playerLoginStreaks)
      .set({
        currentStreak: newStreak,
        bestStreak: newBestStreak,
        lastLoginDate: todayString,
        totalLogins: (streakRecord.totalLogins || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(playerLoginStreaks.playerId, playerId));

    // Award coins to player
    if (totalCoins > 0) {
      await this.awardCoins(playerId, totalCoins);
    }

    return {
      baseCoins: coinsAwarded,
      streakBonus,
      daysMilestone,
      totalCoins,
      currentStreak: newStreak,
      bestStreak: newBestStreak,
    };
  },

  /**
   * Award coins to player (fire-and-forget pattern)
   */
  async awardCoins(playerId: number, amount: number): Promise<void> {
    try {
      // Get current balance or create entry
      let currency = await db.query.playerCurrencyTable.findFirst({
        where: eq(playerCurrencyTable.playerId, playerId),
      });

      if (!currency) {
        // Create new currency entry
        await db.insert(playerCurrencyTable).values({
          playerId,
          cardPoints: amount,
        });
      } else {
        // Update existing entry
        await db
          .update(playerCurrencyTable)
          .set({
            cardPoints: (currency.cardPoints || 0) + amount,
            updatedAt: new Date(),
          })
          .where(eq(playerCurrencyTable.playerId, playerId));
      }
    } catch (error) {
      // Fire-and-forget: log but don't fail
      console.error(`[CardClash] Failed to award ${amount} coins to player ${playerId}:`, error);
    }
  },

  /**
   * Get current login streak info for a player
   */
  async getStreakInfo(playerId: number): Promise<{
    currentStreak: number;
    bestStreak: number;
    totalLogins: number;
    lastLoginDate: string | null;
  } | null> {
    const record = await db.query.playerLoginStreaks.findFirst({
      where: eq(playerLoginStreaks.playerId, playerId),
    });

    if (!record) return null;

    return {
      currentStreak: record.currentStreak || 0,
      bestStreak: record.bestStreak || 0,
      totalLogins: record.totalLogins || 0,
      lastLoginDate: record.lastLoginDate,
    };
  },

  /**
   * Reset streak for a player (admin only)
   */
  async resetStreak(playerId: number): Promise<void> {
    await db
      .update(playerLoginStreaks)
      .set({
        currentStreak: 0,
        lastLoginDate: null,
        updatedAt: new Date(),
      })
      .where(eq(playerLoginStreaks.playerId, playerId));
  },
};
