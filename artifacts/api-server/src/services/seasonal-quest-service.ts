import { db } from "@workspace/db";
import {
  seasonalQuests,
  playerSeasonalQuests,
  playerCurrencyTable,
  cardClashSeasonsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

export interface SeasonalQuestProgress {
  id: number;
  title: string;
  description: string | null;
  quest_key: string;
  progress: number;
  requirement_value: number;
  requirement_type: string;
  reward_coins: number;
  reward_pack_tokens: number;
  tier: number;
  is_completed: boolean;
  completed_at: Date | null;
}

export const seasonalQuestService = {
  /**
   * Get or create this season's quests for a player
   */
  async getSeasonalQuestsForPlayer(playerId: number): Promise<SeasonalQuestProgress[]> {
    // Get active season
    const [activeSeason] = await db
      .select()
      .from(cardClashSeasonsTable)
      .where(eq(cardClashSeasonsTable.is_active, true));

    if (!activeSeason) {
      return [];
    }

    // Get all active quest definitions
    const quests = await db.query.seasonalQuests.findMany({
      where: eq(seasonalQuests.is_active, true),
    });

    // For each quest, get or create player's progress
    const results: SeasonalQuestProgress[] = [];

    for (const quest of quests) {
      let playerQuest = await db.query.playerSeasonalQuests.findFirst({
        where: and(
          eq(playerSeasonalQuests.player_id, playerId),
          eq(playerSeasonalQuests.season_id, activeSeason.id),
          eq(playerSeasonalQuests.quest_id, quest.id)
        ),
      });

      // Create if doesn't exist for this season
      if (!playerQuest) {
        const [created] = await db
          .insert(playerSeasonalQuests)
          .values({
            player_id: playerId,
            season_id: activeSeason.id,
            quest_id: quest.id,
            quest_key: quest.quest_key,
            progress: 0,
            is_completed: false,
          })
          .returning();

        playerQuest = created;
      }

      results.push({
        id: quest.id,
        title: quest.title,
        description: quest.description,
        quest_key: quest.quest_key,
        progress: playerQuest.progress,
        requirement_value: quest.requirement_value,
        requirement_type: quest.requirement_type,
        reward_coins: quest.reward_coins,
        reward_pack_tokens: quest.reward_pack_tokens || 0,
        tier: quest.tier,
        is_completed: playerQuest.is_completed,
        completed_at: playerQuest.completed_at,
      });
    }

    return results;
  },

  /**
   * Update progress on a seasonal quest
   */
  async updateSeasonalProgress(
    playerId: number,
    questKey: string,
    incrementBy: number = 1
  ): Promise<{ completed: boolean; coinsAwarded: number }> {
    try {
      // Get active season
      const [activeSeason] = await db
        .select()
        .from(cardClashSeasonsTable)
        .where(eq(cardClashSeasonsTable.is_active, true));

      if (!activeSeason) {
        return { completed: false, coinsAwarded: 0 };
      }

      // Get quest definition
      const questDef = await db.query.seasonalQuests.findFirst({
        where: eq(seasonalQuests.quest_key, questKey),
      });

      if (!questDef) {
        throw new Error(`Seasonal quest not found: ${questKey}`);
      }

      // Get player's progress
      let playerQuest = await db.query.playerSeasonalQuests.findFirst({
        where: and(
          eq(playerSeasonalQuests.player_id, playerId),
          eq(playerSeasonalQuests.season_id, activeSeason.id),
          eq(playerSeasonalQuests.quest_key, questKey)
        ),
      });

      if (!playerQuest) {
        // Create if missing
        const [created] = await db
          .insert(playerSeasonalQuests)
          .values({
            player_id: playerId,
            season_id: activeSeason.id,
            quest_id: questDef.id,
            quest_key: questKey,
            progress: incrementBy,
            is_completed: incrementBy >= questDef.requirement_value,
            completed_at:
              incrementBy >= questDef.requirement_value ? new Date() : null,
          })
          .returning();

        playerQuest = created;
      } else {
        // Update progress
        const newProgress = (playerQuest.progress || 0) + incrementBy;
        const isCompleted = newProgress >= questDef.requirement_value;

        const [updated] = await db
          .update(playerSeasonalQuests)
          .set({
            progress: newProgress,
            is_completed: isCompleted,
            completed_at: isCompleted && !playerQuest.is_completed ? new Date() : playerQuest.completed_at,
            updated_at: new Date(),
          })
          .where(eq(playerSeasonalQuests.id, playerQuest.id))
          .returning();

        playerQuest = updated;
      }

      // If newly completed, award coins
      let coinsAwarded = 0;
      if (playerQuest.is_completed && !playerQuest.completed_at) {
        coinsAwarded = questDef.reward_coins;
        await this.awardCoins(playerId, coinsAwarded);
      }

      return {
        completed: playerQuest.is_completed,
        coinsAwarded,
      };
    } catch (error) {
      console.error(`[CardClash] Failed to update seasonal quest ${questKey}:`, error);
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
   * Seed default seasonal quests
   */
  async seedDefaultSeasonalQuests(): Promise<void> {
    try {
      const defaultQuests = [
        {
          quest_key: "card_clash_wins_20",
          title: "Card Clash Champion",
          description: "Win 20 Card Clash matches this season",
          requirement_type: "card_clash_wins",
          requirement_value: 20,
          reward_coins: 150,
          reward_pack_tokens: 2,
          tier: 1,
        },
        {
          quest_key: "league_dominator",
          title: "League Dominator",
          description: "Win 30 league matches this season",
          requirement_type: "total_wins",
          requirement_value: 30,
          reward_coins: 200,
          reward_pack_tokens: 3,
          tier: 1,
        },
        {
          quest_key: "card_collector",
          title: "Card Collector",
          description: "Collect 50 unique cards",
          requirement_type: "unique_cards_collected",
          requirement_value: 50,
          reward_coins: 100,
          reward_pack_tokens: 1,
          tier: 2,
        },
        {
          quest_key: "coin_hoarder",
          title: "Coin Hoarder",
          description: "Earn 2000 Card Clash coins",
          requirement_type: "coins_earned",
          requirement_value: 2000,
          reward_coins: 250,
          reward_pack_tokens: 2,
          tier: 2,
        },
        {
          quest_key: "undefeated_week",
          title: "Undefeated Reign",
          description: "Reach 10-game winning streak",
          requirement_type: "win_streak",
          requirement_value: 10,
          reward_coins: 200,
          reward_pack_tokens: 2,
          tier: 3,
        },
      ];

      for (const quest of defaultQuests) {
        const existing = await db.query.seasonalQuests.findFirst({
          where: eq(seasonalQuests.quest_key, quest.quest_key),
        });

        if (!existing) {
          await db.insert(seasonalQuests).values(quest);
        }
      }

      console.log("[CardClash] Default seasonal quests seeded");
    } catch (error) {
      console.error("[CardClash] Failed to seed seasonal quests:", error);
    }
  },
};
