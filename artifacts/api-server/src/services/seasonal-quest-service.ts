import { db } from "@workspace/db";
import {
  seasonalQuests,
  playerSeasonalQuests,
  playerCurrencyTable,
  cardClashSeasonsTable,
} from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";

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
      .where(eq(cardClashSeasonsTable.isActive, true));

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
          eq(playerSeasonalQuests.season_number, activeSeason.id),
          eq(playerSeasonalQuests.quest_id, quest.id)
        ),
      });

      // Create if doesn't exist for this season
      if (!playerQuest) {
        const [created] = await db
          .insert(playerSeasonalQuests)
          .values({
            player_id: playerId,
            season_number: activeSeason.id,
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
        .where(eq(cardClashSeasonsTable.isActive, true));

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

      // Single atomic INSERT ... ON CONFLICT DO UPDATE instead of the old
      // read-then-branch (findFirst, then a separate INSERT or UPDATE): two
      // wins for the same player landing close together (a quick rematch, or
      // a retried request) could both read "no row yet" and both INSERT
      // (player_id, season_number, quest_key now has a unique index — see
      // add_seasonal_quests_unique.ts — so the second one used to just
      // error; before that migration it silently created a duplicate row),
      // or both read the same starting progress and each write N+1 instead
      // of N+2, losing an increment. Folding create-or-increment into one
      // statement means Postgres evaluates it against a single consistent
      // snapshot per call, so concurrent calls serialize correctly instead
      // of racing — same shape as challenge-manager.ts's atomic progress
      // UPDATE and card-clash-service.ts's ON CONFLICT card-grant pattern.
      const [playerQuest] = await db.execute(sql`
        INSERT INTO player_seasonal_quests
          (player_id, season_number, quest_id, quest_key, progress, is_completed, completed_at, updated_at)
        VALUES
          (${playerId}, ${activeSeason.id}, ${questDef.id}, ${questKey}, ${incrementBy},
           ${incrementBy >= questDef.requirement_value},
           CASE WHEN ${incrementBy >= questDef.requirement_value} THEN NOW() ELSE NULL END,
           NOW())
        ON CONFLICT (player_id, season_number, quest_key) DO UPDATE SET
          progress = player_seasonal_quests.progress + EXCLUDED.progress,
          is_completed = (player_seasonal_quests.progress + EXCLUDED.progress) >= ${questDef.requirement_value},
          completed_at = CASE
            WHEN NOT player_seasonal_quests.is_completed
                 AND (player_seasonal_quests.progress + EXCLUDED.progress) >= ${questDef.requirement_value}
            THEN NOW()
            ELSE player_seasonal_quests.completed_at
          END,
          updated_at = NOW()
        RETURNING is_completed,
                  (xmax = 0) AS was_insert,
                  (completed_at = updated_at) AS completed_this_call
      `).then(r => r.rows as any[]);

      // newlyCompleted: either this call inserted an already-complete row
      // (incrementBy alone met the threshold on a brand-new quest), or the
      // UPDATE branch's completed_at was just set to NOW() = updated_at
      // (it only does that when the row wasn't already completed).
      const newlyCompleted = playerQuest.is_completed &&
        (playerQuest.was_insert || playerQuest.completed_this_call);

      // If newly completed, award coins
      let coinsAwarded = 0;
      if (newlyCompleted) {
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
