import { db, playerCurrencyTable } from "@workspace/db";
import {
  dailyChallenges,
  playerDailyChallenges,
  weeklyChallenges,
  playerWeeklyChallenges,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { addCoinsToPlayer } from "./card-shop-service";
import { giveCardToPlayer } from "./card-shop-service";

export const challengeManager = {
  /**
   * Get or create daily challenges for a player
   * Returns array of PlayerDailyChallenge with progress
   */
  async getDailyForPlayer(playerId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all active daily challenge definitions
    const allChallenges = await db
      .select()
      .from(dailyChallenges)
      .where(eq(dailyChallenges.is_active, true));

    // For each challenge, get or create player's progress
    const results = [];

    for (const challenge of allChallenges) {
      let playerChallenge = await db.query.playerDailyChallenges.findFirst({
        where: and(
          eq(playerDailyChallenges.player_id, playerId),
          eq(playerDailyChallenges.challenge_id, challenge.id),
        ),
      });

      // Create if doesn't exist (new day)
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
   * Get or create weekly challenges for a player
   */
  async getWeeklyForPlayer(playerId: number) {
    const allChallenges = await db
      .select()
      .from(weeklyChallenges)
      .where(eq(weeklyChallenges.is_active, true));

    const results = [];

    for (const challenge of allChallenges) {
      let playerChallenge = await db.query.playerWeeklyChallenges.findFirst({
        where: and(
          eq(playerWeeklyChallenges.player_id, playerId),
          eq(playerWeeklyChallenges.challenge_id, challenge.id),
        ),
      });

      if (!playerChallenge) {
        const [created] = await db
          .insert(playerWeeklyChallenges)
          .values({
            player_id: playerId,
            challenge_id: challenge.id,
            progress: 0,
            is_completed: false,
            week_starting: getWeekStart(new Date()),
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
   * Update player challenge progress based on game result
   * Called after a game is completed
   */
  async updateProgressFromGameResult(
    playerId: number,
    gameResult: {
      gameMode: "X01" | "CRICKET" | "PRACTICE" | "M501" | "TOUR" | "LEAGUE" | "CARD_CLASH";
      won: boolean;
      score?: number;
      cardsUsed?: number;
      coinsEarned?: number;
    }
  ) {
    // Map game result to challenge criteria
    const requirementMappings: Record<string, boolean> = {
      x01_wins: gameResult.gameMode === "X01" && gameResult.won,
      cricket_wins: gameResult.gameMode === "CRICKET" && gameResult.won,
      practice_wins: gameResult.gameMode === "PRACTICE" && gameResult.won,
      master501_wins: gameResult.gameMode === "M501" && gameResult.won,
      tour_wins: gameResult.gameMode === "TOUR" && gameResult.won,
      league_wins: gameResult.gameMode === "LEAGUE" && gameResult.won,
      card_clash_wins: gameResult.gameMode === "CARD_CLASH" && gameResult.won,
      total_games_played: true, // Every game counts
      cards_used: !!gameResult.cardsUsed,
      streak_wins: gameResult.won, // Track in separate system
      score_threshold: (gameResult.score ?? 0) >= 100, // Example threshold
    };

    // Update daily challenges
    const dailyPlayerChallenges = await db
      .select()
      .from(playerDailyChallenges)
      .innerJoin(
        dailyChallenges,
        eq(playerDailyChallenges.challenge_id, dailyChallenges.id)
      )
      .where(
        and(
          eq(playerDailyChallenges.player_id, playerId),
          eq(playerDailyChallenges.is_completed, false)
        )
      );

    for (const { player_daily_challenges, daily_challenges } of dailyPlayerChallenges) {
      if (requirementMappings[daily_challenges.requirement_type]) {
        const newProgress = player_daily_challenges.progress + 1;
        const isCompleted = newProgress >= daily_challenges.requirement_value;

        await db
          .update(playerDailyChallenges)
          .set({
            progress: newProgress,
            is_completed: isCompleted,
            completed_at: isCompleted ? new Date() : null,
            updated_at: new Date(),
          })
          .where(eq(playerDailyChallenges.id, player_daily_challenges.id));

        // Award rewards if completed
        if (isCompleted) {
          await this.awardRewards(
            playerId,
            daily_challenges.reward_coins,
            daily_challenges.reward_pack_tokens || 0
          );
        }
      }
    }

    // Update weekly challenges (same logic)
    const weeklyPlayerChallenges = await db
      .select()
      .from(playerWeeklyChallenges)
      .innerJoin(
        weeklyChallenges,
        eq(playerWeeklyChallenges.challenge_id, weeklyChallenges.id)
      )
      .where(
        and(
          eq(playerWeeklyChallenges.player_id, playerId),
          eq(playerWeeklyChallenges.is_completed, false)
        )
      );

    for (const { player_weekly_challenges, weekly_challenges } of weeklyPlayerChallenges) {
      if (requirementMappings[weekly_challenges.requirement_type]) {
        const newProgress = player_weekly_challenges.progress + 1;
        const isCompleted = newProgress >= weekly_challenges.requirement_value;

        await db
          .update(playerWeeklyChallenges)
          .set({
            progress: newProgress,
            is_completed: isCompleted,
            completed_at: isCompleted ? new Date() : null,
            updated_at: new Date(),
          })
          .where(eq(playerWeeklyChallenges.id, player_weekly_challenges.id));

        // Award rewards if completed
        if (isCompleted) {
          await this.awardRewards(
            playerId,
            weekly_challenges.reward_coins,
            weekly_challenges.reward_pack_tokens || 0
          );
        }
      }
    }
  },

  /**
   * Award rewards for completed challenge
   */
  async awardRewards(playerId: number, coins: number, packTokens: number) {
    // Award coins
    if (coins > 0) {
      await addCoinsToPlayer(playerId, coins);
      console.log(`[CHALLENGE] Awarded ${coins} coins to player ${playerId}`);
    }

    // Award card packs (convert tokens to packs)
    if (packTokens > 0) {
      // 1 token = 1 card pack pull
      // For now, just add coins equivalent (can be changed to actual card pull)
      // 1 pack token ≈ 50 coins worth
      await addCoinsToPlayer(playerId, packTokens * 50);
      console.log(`[CHALLENGE] Awarded ${packTokens} pack tokens to player ${playerId}`);
    }
  },

  /**
   * Reroll a daily challenge for a player
   * First reroll per day is free, then costs coins
   */
  async rerollDaily(playerId: number, challengeId: number) {
    // Check how many rerolls player has used today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // TODO: Track reroll usage
    // For now, assume first reroll is free

    // Delete current challenge assignment
    await db
      .delete(playerDailyChallenges)
      .where(
        and(
          eq(playerDailyChallenges.player_id, playerId),
          eq(playerDailyChallenges.challenge_id, challengeId)
        )
      );

    // Next getDailyForPlayer call will create a new one
    return { success: true, message: "Challenge rerolled. Reload to see new challenge." };
  },

  /**
   * Reroll a weekly challenge for a player
   */
  async rerollWeekly(playerId: number, challengeId: number) {
    // Similar to daily but for weekly
    await db
      .delete(playerWeeklyChallenges)
      .where(
        and(
          eq(playerWeeklyChallenges.player_id, playerId),
          eq(playerWeeklyChallenges.challenge_id, challengeId)
        )
      );

    return { success: true, message: "Weekly challenge rerolled. Reload to see new challenge." };
  },
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  return new Date(d.setDate(diff));
}
