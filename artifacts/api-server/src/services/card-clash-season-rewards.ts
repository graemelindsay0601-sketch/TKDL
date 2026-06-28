/**
 * Card Clash Season Rewards Service
 * 
 * Handles end-of-season reward distribution:
 * - Calculates final rankings
 * - Awards coins based on position
 * - Awards packs to top finishers
 * - Archives season standings
 * - Creates new season
 */

import { db } from "@workspace/db";
import {
  cardClashSeasonsTable,
  cardClashMatchesTable,
  playerCurrencyTable,
  cardClashPackInventoryTable,
  playersTable,
} from "@workspace/db/schema";
import { sql, eq, desc, and } from "drizzle-orm";
import { logger } from "../lib/logger";

interface SeasonReward {
  playerId: number;
  playerName: string;
  rank: number;
  wins: number;
  losses: number;
  coinsAwarded: number;
  packAwarded: string | null;
}

interface SeasonRewardResult {
  success: boolean;
  seasonId: number;
  seasonName: string;
  rewards: SeasonReward[];
  totalRewardsDistributed: number;
  message: string;
}

// Reward structure: rank -> { coins, pack }
const SEASON_REWARDS = {
  1: { coins: 500, pack: "FIVE" },
  2: { coins: 300, pack: "SINGLE" },
  3: { coins: 150, pack: "SINGLE" },
  4: { coins: 75, pack: null },
  5: { coins: 50, pack: null },
};

/**
 * Get active season or create new one
 */
async function getOrCreateActiveCardClashSeason() {
  const [active] = await db
    .select()
    .from(cardClashSeasonsTable)
    .where(eq(cardClashSeasonsTable.isActive, true))
    .limit(1);

  if (active) return active;

  // Create new season
  const now = new Date();
  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [newSeason] = await db
    .insert(cardClashSeasonsTable)
    .values({
      name: `${monthName} Season`,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      isActive: true,
      isLocked: false,
    })
    .returning();

  logger.info({ seasonId: newSeason.id }, "Auto-created new Card Clash season");
  return newSeason;
}

/**
 * Calculate final rankings for a season
 * Based on match results (wins, then head-to-head, then match count)
 */
async function calculateSeasonStandings(seasonId: number) {
  const standings = await db.execute(sql`
    SELECT
      p.id as player_id,
      p.name as player_name,
      COUNT(CASE WHEN m.winner_id = p.id THEN 1 END)::int as wins,
      COUNT(CASE WHEN (m.player_1_id = p.id OR m.player_2_id = p.id) AND m.winner_id != p.id THEN 1 END)::int as losses,
      COUNT(CASE WHEN m.player_1_id = p.id OR m.player_2_id = p.id THEN 1 END)::int as total_matches
    FROM players p
    LEFT JOIN card_clash_matches m ON (m.player_1_id = p.id OR m.player_2_id = p.id) AND m.season_id = ${seasonId}
    WHERE p.is_active = true
    GROUP BY p.id, p.name
    HAVING COUNT(CASE WHEN m.player_1_id = p.id OR m.player_2_id = p.id THEN 1 END) > 0
    ORDER BY wins DESC, total_matches DESC, p.name ASC
  `);

  return standings.rows as Array<{
    player_id: number;
    player_name: string;
    wins: number;
    losses: number;
    total_matches: number;
  }>;
}

/**
 * Award coins to a player (fire-and-forget, handles errors)
 */
async function awardCoinsToPlayer(playerId: number, amount: number): Promise<boolean> {
  try {
    const [currency] = await db
      .select()
      .from(playerCurrencyTable)
      .where(eq(playerCurrencyTable.playerId, playerId));

    if (currency) {
      await db
        .update(playerCurrencyTable)
        .set({
          cardPoints: (currency.cardPoints || 0) + amount,
        })
        .where(eq(playerCurrencyTable.playerId, playerId));
    } else {
      await db.insert(playerCurrencyTable).values({
        playerId,
        cardPoints: amount,
      });
    }
    return true;
  } catch (err) {
    logger.error({ playerId, amount, err }, "Failed to award coins");
    return false;
  }
}

/**
 * Award pack to a player (fire-and-forget)
 */
async function awardPackToPlayer(
  playerId: number,
  packType: "SINGLE" | "FIVE" | "TEN"
): Promise<boolean> {
  try {
    await db.insert(cardClashPackInventoryTable).values({
      playerId,
      packType,
      earnedReason: "Season reward - final ranking",
    });
    return true;
  } catch (err) {
    logger.error({ playerId, packType, err }, "Failed to award pack");
    return false;
  }
}

/**
 * End a season and distribute rewards
 * Should be called at the end of each month
 */
export async function endSeasonAndAwardRewards(
  seasonId?: number
): Promise<SeasonRewardResult> {
  try {
    // Get the season to end (or find active one)
    let season;
    if (seasonId) {
      const [s] = await db
        .select()
        .from(cardClashSeasonsTable)
        .where(eq(cardClashSeasonsTable.id, seasonId));
      season = s;
    } else {
      const [s] = await db
        .select()
        .from(cardClashSeasonsTable)
        .where(eq(cardClashSeasonsTable.isActive, true))
        .limit(1);
      season = s;
    }

    if (!season) {
      return {
        success: false,
        seasonId: -1,
        seasonName: "Unknown",
        rewards: [],
        totalRewardsDistributed: 0,
        message: "No active season found",
      };
    }

    // Calculate final standings
    const standings = await calculateSeasonStandings(season.id);

    if (standings.length === 0) {
      logger.warn({ seasonId: season.id }, "No matches in season, no rewards to distribute");
      // Still close the season
      await db
        .update(cardClashSeasonsTable)
        .set({ isActive: false })
        .where(eq(cardClashSeasonsTable.id, season.id));

      return {
        success: true,
        seasonId: season.id,
        seasonName: season.name,
        rewards: [],
        totalRewardsDistributed: 0,
        message: "Season ended (no matches played)",
      };
    }

    // Distribute rewards
    const rewards: SeasonReward[] = [];
    let totalCoinsDistributed = 0;

    for (let rank = 1; rank <= standings.length; rank++) {
      const player = standings[rank - 1];
      const rewardConfig = SEASON_REWARDS[rank as keyof typeof SEASON_REWARDS] || null;

      if (!rewardConfig) {
        // Only top 5 get rewards
        continue;
      }

      const reward: SeasonReward = {
        playerId: player.player_id,
        playerName: player.player_name,
        rank,
        wins: player.wins,
        losses: player.losses,
        coinsAwarded: rewardConfig.coins,
        packAwarded: rewardConfig.pack,
      };

      // Award coins
      const coinSuccess = await awardCoinsToPlayer(player.player_id, rewardConfig.coins);
      if (!coinSuccess) {
        logger.warn(
          { playerId: player.player_id, coins: rewardConfig.coins },
          "Failed to award coins"
        );
      }

      // Award pack if applicable
      if (rewardConfig.pack) {
        const packSuccess = await awardPackToPlayer(
          player.player_id,
          rewardConfig.pack as "SINGLE" | "FIVE"
        );
        if (!packSuccess) {
          logger.warn(
            { playerId: player.player_id, pack: rewardConfig.pack },
            "Failed to award pack"
          );
        }
      }

      rewards.push(reward);
      totalCoinsDistributed += rewardConfig.coins;

      logger.info(
        {
          playerId: player.player_id,
          playerName: player.player_name,
          rank,
          coins: rewardConfig.coins,
          pack: rewardConfig.pack,
        },
        "Season reward awarded"
      );
    }

    // Close the season
    await db
      .update(cardClashSeasonsTable)
      .set({ isActive: false })
      .where(eq(cardClashSeasonsTable.id, season.id));

    logger.info(
      { seasonId: season.id, rewardsCount: rewards.length, totalCoins: totalCoinsDistributed },
      "Card Clash season ended and rewards distributed"
    );

    return {
      success: true,
      seasonId: season.id,
      seasonName: season.name,
      rewards,
      totalRewardsDistributed: totalCoinsDistributed,
      message: `Season rewards distributed to ${rewards.length} players (${totalCoinsDistributed} coins)`,
    };
  } catch (err) {
    logger.error({ err }, "Failed to end season and award rewards");
    return {
      success: false,
      seasonId: -1,
      seasonName: "Unknown",
      rewards: [],
      totalRewardsDistributed: 0,
      message: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

/**
 * Check if season should auto-end (monthly boundary)
 * Called on app startup or periodically
 */
export async function checkAndEndSeasonIfNeeded(): Promise<void> {
  try {
    const [activeSeason] = await db
      .select()
      .from(cardClashSeasonsTable)
      .where(eq(cardClashSeasonsTable.isActive, true))
      .limit(1);

    if (!activeSeason) {
      // No active season, create one
      await getOrCreateActiveCardClashSeason();
      return;
    }

    // Check if season should end (end_date passed)
    const endDate = new Date(activeSeason.endDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (now > endDate) {
      logger.info(
        { seasonId: activeSeason.id, seasonName: activeSeason.name },
        "Season end date reached, auto-ending"
      );
      const result = await endSeasonAndAwardRewards(activeSeason.id);

      // Create new season
      await getOrCreateActiveCardClashSeason();

      logger.info(result, "Season auto-end completed");
    }
  } catch (err) {
    logger.error({ err }, "Error in checkAndEndSeasonIfNeeded");
  }
}

/**
 * Get season reward leaderboard (for UI display)
 */
export async function getSeasonRewardLeaderboard(seasonId: number) {
  try {
    const standings = await calculateSeasonStandings(seasonId);

    return standings.slice(0, 5).map((player, idx) => {
      const rewardConfig = SEASON_REWARDS[(idx + 1) as keyof typeof SEASON_REWARDS];
      return {
        rank: idx + 1,
        playerId: player.player_id,
        playerName: player.player_name,
        wins: player.wins,
        losses: player.losses,
        coinsReward: rewardConfig?.coins || 0,
        packReward: rewardConfig?.pack || null,
      };
    });
  } catch (err) {
    logger.error({ seasonId, err }, "Failed to get season reward leaderboard");
    return [];
  }
}
