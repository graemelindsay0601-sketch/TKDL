import { db } from "@workspace/db";
import {
  dailyChallenges,
  playerDailyChallenges,
  weeklyChallenges,
  playerWeeklyChallenges,
  playerCurrencyTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, isNull } from "drizzle-orm";

export interface ChallengeProgress {
  id: number;
  title: string;
  description: string | null;
  challenge_key: string;
  progress: number;
  requirement_value: number;
  requirement_type: string;
  reward_coins: number;
  reward_pack_tokens: number;
  is_completed: boolean;
  completed_at: Date | null;
}

export const challengeService = {
  /**
   * Get or create today's daily challenges for a player
   */
  async getDailyChallengesForPlayer(playerId: number): Promise<ChallengeProgress[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all active daily challenge definitions
    const challenges = await db.query.dailyChallenges.findMany({
      where: eq(dailyChallenges.is_active, true),
    });

    // For each challenge, get or create player's progress
    const results: ChallengeProgress[] = [];

    for (const challenge of challenges) {
      let playerChallenge = await db.query.playerDailyChallenges.findFirst({
        where: and(
          eq(playerDailyChallenges.player_id, playerId),
          eq(playerDailyChallenges.challenge_id, challenge.id),
          gte(playerDailyChallenges.date_assigned, today),
          lte(playerDailyChallenges.date_assigned, tomorrow)
        ),
      });

      // Create if doesn't exist for today
      if (!playerChallenge) {
        const [created] = await db
          .insert(playerDailyChallenges)
          .values({
            player_id: playerId,
            challenge_id: challenge.id,
            progress: 0,
            is_completed: false,
            date_assigned: new Date(),
          })
          .returning();

        playerChallenge = created;
      }

      results.push({
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        challenge_key: challenge.challenge_key,
        progress: playerChallenge.progress,
        requirement_value: challenge.requirement_value,
        requirement_type: challenge.requirement_type,
        reward_coins: challenge.reward_coins,
        reward_pack_tokens: challenge.reward_pack_tokens || 0,
        is_completed: playerChallenge.is_completed,
        completed_at: playerChallenge.completed_at,
      });
    }

    return results;
  },

  /**
   * Get this week's weekly challenges for a player
   */
  async getWeeklyChallengesForPlayer(playerId: number): Promise<ChallengeProgress[]> {
    // Calculate ISO week number
    const today = new Date();
    const date = new Date(today.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 4 - (date.getDay() || 7));
    const yearStart = new Date(date.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

    // Get all active weekly challenge definitions
    const challenges = await db.query.weeklyChallenges.findMany({
      where: eq(weeklyChallenges.is_active, true),
    });

    // For each challenge, get or create player's progress
    const results: ChallengeProgress[] = [];

    for (const challenge of challenges) {
      let playerChallenge = await db.query.playerWeeklyChallenges.findFirst({
        where: and(
          eq(playerWeeklyChallenges.player_id, playerId),
          eq(playerWeeklyChallenges.challenge_id, challenge.id),
          eq(playerWeeklyChallenges.week_number, weekNumber)
        ),
      });

      // Create if doesn't exist for this week
      if (!playerChallenge) {
        const [created] = await db
          .insert(playerWeeklyChallenges)
          .values({
            player_id: playerId,
            challenge_id: challenge.id,
            challenge_key: challenge.challenge_key,
            progress: 0,
            is_completed: false,
            week_number: weekNumber,
          })
          .returning();

        playerChallenge = created;
      }

      results.push({
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        challenge_key: challenge.challenge_key,
        progress: playerChallenge.progress,
        requirement_value: challenge.requirement_value,
        requirement_type: challenge.requirement_type,
        reward_coins: challenge.reward_coins,
        reward_pack_tokens: challenge.reward_pack_tokens || 0,
        is_completed: playerChallenge.is_completed,
        completed_at: playerChallenge.completed_at,
      });
    }

    return results;
  },

  /**
   * Update progress on a daily challenge
   * Returns: { completed: boolean, coinsAwarded: number }
   */
  async updateDailyProgress(
    playerId: number,
    challengeKey: string,
    incrementBy: number = 1
  ): Promise<{ completed: boolean; coinsAwarded: number }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get challenge definition
      const challengeDef = await db.query.dailyChallenges.findFirst({
        where: eq(dailyChallenges.challenge_key, challengeKey),
      });

      if (!challengeDef) {
        throw new Error(`Daily challenge not found: ${challengeKey}`);
      }

      // Get player's progress
      let playerChallenge = await db.query.playerDailyChallenges.findFirst({
        where: and(
          eq(playerDailyChallenges.player_id, playerId),
          eq(playerDailyChallenges.challenge_key, challengeKey),
          gte(playerDailyChallenges.date_assigned, today),
          lte(playerDailyChallenges.date_assigned, tomorrow)
        ),
      });

      if (!playerChallenge) {
        // Create if missing
        const [created] = await db
          .insert(playerDailyChallenges)
          .values({
            player_id: playerId,
            challenge_id: challengeDef.id,
            challenge_key: challengeKey,
            progress: incrementBy,
            is_completed: incrementBy >= challengeDef.requirement_value,
            completed_at:
              incrementBy >= challengeDef.requirement_value ? new Date() : null,
          })
          .returning();

        playerChallenge = created;
      } else {
        // Update progress
        const newProgress = (playerChallenge.progress || 0) + incrementBy;
        const isCompleted = newProgress >= challengeDef.requirement_value;

        const [updated] = await db
          .update(playerDailyChallenges)
          .set({
            progress: newProgress,
            is_completed: isCompleted,
            completed_at: isCompleted && !playerChallenge.is_completed ? new Date() : playerChallenge.completed_at,
            updated_at: new Date(),
          })
          .where(eq(playerDailyChallenges.id, playerChallenge.id))
          .returning();

        playerChallenge = updated;
      }

      // If newly completed, award coins
      let coinsAwarded = 0;
      if (playerChallenge.is_completed && !playerChallenge.completed_at) {
        coinsAwarded = challengeDef.reward_coins;
        await this.awardCoins(playerId, coinsAwarded);
      }

      return {
        completed: playerChallenge.is_completed,
        coinsAwarded,
      };
    } catch (error) {
      console.error(`[CardClash] Failed to update daily challenge ${challengeKey}:`, error);
      return { completed: false, coinsAwarded: 0 };
    }
  },

  /**
   * Update progress on a weekly challenge
   */
  async updateWeeklyProgress(
    playerId: number,
    challengeKey: string,
    incrementBy: number = 1
  ): Promise<{ completed: boolean; coinsAwarded: number }> {
    try {
      // Calculate ISO week number
      const today = new Date();
      const date = new Date(today.getTime());
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + 4 - (date.getDay() || 7));
      const yearStart = new Date(date.getFullYear(), 0, 1);
      const weekNumber = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

      // Get challenge definition
      const challengeDef = await db.query.weeklyChallenges.findFirst({
        where: eq(weeklyChallenges.challenge_key, challengeKey),
      });

      if (!challengeDef) {
        throw new Error(`Weekly challenge not found: ${challengeKey}`);
      }

      // Get player's progress
      let playerChallenge = await db.query.playerWeeklyChallenges.findFirst({
        where: and(
          eq(playerWeeklyChallenges.player_id, playerId),
          eq(playerWeeklyChallenges.challenge_key, challengeKey),
          eq(playerWeeklyChallenges.week_number, weekNumber)
        ),
      });

      if (!playerChallenge) {
        // Create if missing
        const [created] = await db
          .insert(playerWeeklyChallenges)
          .values({
            player_id: playerId,
            challenge_id: challengeDef.id,
            challenge_key: challengeKey,
            progress: incrementBy,
            is_completed: incrementBy >= challengeDef.requirement_value,
            completed_at:
              incrementBy >= challengeDef.requirement_value ? new Date() : null,
            week_number: weekNumber,
          })
          .returning();

        playerChallenge = created;
      } else {
        // Update progress
        const newProgress = (playerChallenge.progress || 0) + incrementBy;
        const isCompleted = newProgress >= challengeDef.requirement_value;

        const [updated] = await db
          .update(playerWeeklyChallenges)
          .set({
            progress: newProgress,
            is_completed: isCompleted,
            completed_at: isCompleted && !playerChallenge.is_completed ? new Date() : playerChallenge.completed_at,
            updated_at: new Date(),
          })
          .where(eq(playerWeeklyChallenges.id, playerChallenge.id))
          .returning();

        playerChallenge = updated;
      }

      // If newly completed, award coins
      let coinsAwarded = 0;
      if (playerChallenge.is_completed && !playerChallenge.completed_at) {
        coinsAwarded = challengeDef.reward_coins;
        await this.awardCoins(playerId, coinsAwarded);
      }

      return {
        completed: playerChallenge.is_completed,
        coinsAwarded,
      };
    } catch (error) {
      console.error(`[CardClash] Failed to update weekly challenge ${challengeKey}:`, error);
      return { completed: false, coinsAwarded: 0 };
    }
  },

  /**
   * Award coins to player (fire-and-forget)
   */
  async awardCoins(playerId: number, amount: number): Promise<void> {
    try {
      const currency = await db.query.playerCurrencyTable.findFirst({
        where: eq(playerCurrencyTable.playerId, playerId),
      });

      if (!currency) {
        await db.insert(playerCurrencyTable).values({
          playerId,
          cardPoints: amount,
        });
      } else {
        await db
          .update(playerCurrencyTable)
          .set({
            cardPoints: (currency.cardPoints || 0) + amount,
            updatedAt: new Date(),
          })
          .where(eq(playerCurrencyTable.playerId, playerId));
      }
    } catch (error) {
      console.error(`[CardClash] Failed to award ${amount} coins to player ${playerId}:`, error);
    }
  },

  /**
   * Seed default challenges (call once on setup)
   */
  async seedDefaultChallenges(): Promise<void> {
    try {
      // Daily challenges - one for each game mode
      const defaultDailyTasks = [
        // Practice
        {
          challenge_key: "practice_wins_2",
          title: "Practice Perfect",
          description: "Win 2 Practice matches",
          requirement_type: "practice_wins",
          requirement_value: 2,
          reward_coins: 15,
          is_active: true,
        },
        // M-501
        {
          challenge_key: "master501_wins_2",
          title: "501 Master",
          description: "Win 2 M-501 matches",
          requirement_type: "master501_wins",
          requirement_value: 2,
          reward_coins: 15,
          is_active: true,
        },
        // Tour
        {
          challenge_key: "tour_wins_2",
          title: "Tour Champion",
          description: "Complete 2 Tour rounds",
          requirement_type: "tour_wins",
          requirement_value: 2,
          reward_coins: 15,
          is_active: true,
        },
        // League
        {
          challenge_key: "league_wins_3",
          title: "League Legend",
          description: "Win 3 League matches",
          requirement_type: "league_wins",
          requirement_value: 3,
          reward_coins: 20,
          is_active: true,
        },
        // X01
        {
          challenge_key: "x01_wins_2",
          title: "X01 Dominator",
          description: "Win 2 X01 matches",
          requirement_type: "x01_wins",
          requirement_value: 2,
          reward_coins: 15,
          is_active: true,
        },
        // Cricket
        {
          challenge_key: "cricket_wins_2",
          title: "Cricket Master",
          description: "Win 2 Cricket matches",
          requirement_type: "cricket_wins",
          requirement_value: 2,
          reward_coins: 15,
          is_active: true,
        },
        // Card Clash
        {
          challenge_key: "card_clash_wins_2",
          title: "Card Clash Winner",
          description: "Win 2 Card Clash matches",
          requirement_type: "card_clash_wins",
          requirement_value: 2,
          reward_coins: 20,
          is_active: true,
        },
        // General
        {
          challenge_key: "matches_5",
          title: "Match Grinder",
          description: "Play any 5 matches",
          requirement_type: "total_matches",
          requirement_value: 5,
          reward_coins: 25,
          is_active: true,
        },
      ];

      for (const task of defaultDailyTasks) {
        const existing = await db.query.dailyChallenges.findFirst({
          where: eq(dailyChallenges.challenge_key, task.challenge_key),
        });

        if (!existing) {
          await db.insert(dailyChallenges).values(task);
        }
      }

      // Weekly challenges
      const defaultWeeklyTasks = [
        {
          challenge_key: "weekly_wins_5",
          title: "Champion Week",
          description: "Win 5 matches this week",
          requirement_type: "total_wins",
          requirement_value: 5,
          reward_coins: 75,
          is_active: true,
        },
        {
          challenge_key: "weekly_practice_3",
          title: "Practice Warrior",
          description: "Win 3 Practice matches this week",
          requirement_type: "practice_wins",
          requirement_value: 3,
          reward_coins: 50,
          is_active: true,
        },
        {
          challenge_key: "weekly_501_3",
          title: "501 Specialist",
          description: "Win 3 M-501 matches this week",
          requirement_type: "master501_wins",
          requirement_value: 3,
          reward_coins: 50,
          is_active: true,
        },
        {
          challenge_key: "weekly_tour_2",
          title: "Tour Conqueror",
          description: "Win 2 Tour rounds this week",
          requirement_type: "tour_wins",
          requirement_value: 2,
          reward_coins: 60,
          is_active: true,
        },
        {
          challenge_key: "weekly_league_3",
          title: "League Dominator",
          description: "Win 3 League matches this week",
          requirement_type: "league_wins",
          requirement_value: 3,
          reward_coins: 75,
          is_active: true,
        },
        {
          challenge_key: "weekly_card_clash_3",
          title: "Card Clash Dominator",
          description: "Win 3 Card Clash matches this week",
          requirement_type: "card_clash_wins",
          requirement_value: 3,
          reward_coins: 100,
          is_active: true,
        },
      ];

      for (const task of defaultWeeklyTasks) {
        const existing = await db.query.weeklyChallenges.findFirst({
          where: eq(weeklyChallenges.challenge_key, task.challenge_key),
        });

        if (!existing) {
          await db.insert(weeklyChallenges).values(task);
        }
      }

      console.log("[CardClash] Default challenges seeded (8 daily + 6 weekly)");
    } catch (error) {
      console.error("[CardClash] Failed to seed default challenges:", error);
    }
  },

  /**
   * Seed comprehensive challenge pool from challengePool.ts
   * Called once during initialization
   */
  async seedComprehensivePool(): Promise<void> {
    try {
      const { DAILY_CHALLENGE_POOL, WEEKLY_CHALLENGE_POOL } = await import("../lib/challengePool");

      // Seed daily challenges
      for (const challenge of DAILY_CHALLENGE_POOL) {
        const existing = await db.query.dailyChallenges.findFirst({
          where: eq(dailyChallenges.challenge_key, challenge.challenge_key),
        });

        if (!existing) {
          await db.insert(dailyChallenges).values({
            ...challenge,
            is_active: true,
          });
        }
      }

      // Seed weekly challenges
      for (const challenge of WEEKLY_CHALLENGE_POOL) {
        const existing = await db.query.weeklyChallenges.findFirst({
          where: eq(weeklyChallenges.challenge_key, challenge.challenge_key),
        });

        if (!existing) {
          await db.insert(weeklyChallenges).values({
            ...challenge,
            is_active: true,
          });
        }
      }

      console.log(`[CardClash] Comprehensive challenge pool seeded (${DAILY_CHALLENGE_POOL.length} daily + ${WEEKLY_CHALLENGE_POOL.length} weekly)`);
    } catch (error) {
      console.error("[CardClash] Failed to seed comprehensive pool:", error);
    }
  },
};
