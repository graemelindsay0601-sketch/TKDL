import { db, playerCurrencyTable } from "@workspace/db";
import {
  dailyChallenges,
  playerDailyChallenges,
  weeklyChallenges,
  playerWeeklyChallenges,
} from "@workspace/db/schema";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { addCoinsToPlayer } from "./card-shop-service.ts";
import { giveCardToPlayer } from "./card-shop-service.ts";
import { getIsoWeekNumber, getIsoWeekYear } from "../lib/iso-week.ts";

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
            challenge_key: challenge.challenge_key,
            progress: 0,
            is_completed: false,
            week_number: getIsoWeekNumber(new Date()),
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

    // Which requirement_types this game result actually satisfies — used
    // below to scope the atomic updates to just the matching challenges.
    const matchingTypes = Object.entries(requirementMappings)
      .filter(([, matches]) => matches)
      .map(([type]) => type);
    if (matchingTypes.length === 0) return;

    // getDailyChallengesForPlayer/getWeeklyChallengesForPlayer (challenge-
    // service.ts — what the player-facing Challenges screen actually reads)
    // create a FRESH player_daily_challenges/player_weekly_challenges row
    // whenever none exists for the current day/week, leaving any prior
    // day's/week's incomplete row sitting in the table rather than deleting
    // it. Without the date_assigned/week_number bounds below, this UPDATE
    // matched every incomplete row for the player — today's AND every
    // never-finished row from past days/weeks — so a single win could
    // complete and pay out several stale challenges the player's screen no
    // longer even shows. Bounding to "today"/"this ISO week" (the same
    // windows those two read functions use) keeps this to the one row the
    // player can actually see.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const now = new Date();
    const weekNumber = getIsoWeekNumber(now);
    // week_number alone repeats every calendar year (week 12 of 2026 and
    // week 12 of 2027 are both just "12") — see add_weekly_challenge_year.ts.
    // Without also pinning week_year, this UPDATE's week_number match could
    // silently complete/pay out a stale same-numbered week from a year ago.
    const weekYear = getIsoWeekYear(now);

    // Atomic per-row UPDATE...FROM...RETURNING: increments progress and
    // flips is_completed/completed_at in the database in one statement,
    // guarded by `is_completed = false`. The old code read progress into
    // JS, decided completion from that snapshot, then wrote it back with a
    // plain UPDATE — two calls for the same player racing close together
    // (e.g. two games finishing at once) could both read the same starting
    // progress, both conclude "just completed," and both award the coins.
    // Postgres re-checks an UPDATE's WHERE clause against the committed row
    // after acquiring its lock, so once the first of two concurrent updates
    // commits with is_completed = true, the second's `is_completed = false`
    // guard no longer matches and it affects zero rows for that challenge —
    // same idempotency-via-atomic-UPDATE-WHERE-guard shape as
    // master501.ts's/tour.ts's run-completion fixes, applied per row here
    // instead of per run.
    const dailyCompletions = (await db.execute(sql`
      UPDATE player_daily_challenges pdc
      SET progress = pdc.progress + 1,
          is_completed = (pdc.progress + 1) >= dc.requirement_value,
          completed_at = CASE WHEN (pdc.progress + 1) >= dc.requirement_value THEN NOW() ELSE NULL END,
          updated_at = NOW()
      FROM daily_challenges dc
      WHERE pdc.challenge_id = dc.id
        AND pdc.player_id = ${playerId}
        AND pdc.is_completed = false
        AND pdc.date_assigned >= ${today} AND pdc.date_assigned < ${tomorrow}
        AND dc.requirement_type = ANY(${matchingTypes}::text[])
      RETURNING pdc.is_completed AS is_completed, dc.reward_coins AS reward_coins, dc.reward_pack_tokens AS reward_pack_tokens
    `)).rows as { is_completed: boolean; reward_coins: number; reward_pack_tokens: number | null }[];

    for (const row of dailyCompletions) {
      if (row.is_completed) {
        await this.awardRewards(playerId, row.reward_coins, row.reward_pack_tokens ?? 0);
      }
    }

    // Update weekly challenges (same logic)
    const weeklyCompletions = (await db.execute(sql`
      UPDATE player_weekly_challenges pwc
      SET progress = pwc.progress + 1,
          is_completed = (pwc.progress + 1) >= wc.requirement_value,
          completed_at = CASE WHEN (pwc.progress + 1) >= wc.requirement_value THEN NOW() ELSE NULL END,
          updated_at = NOW()
      FROM weekly_challenges wc
      WHERE pwc.challenge_id = wc.id
        AND pwc.player_id = ${playerId}
        AND pwc.is_completed = false
        AND pwc.week_number = ${weekNumber}
        AND pwc.week_year = ${weekYear}
        AND wc.requirement_type = ANY(${matchingTypes}::text[])
      RETURNING pwc.is_completed AS is_completed, wc.reward_coins AS reward_coins, wc.reward_pack_tokens AS reward_pack_tokens
    `)).rows as { is_completed: boolean; reward_coins: number; reward_pack_tokens: number | null }[];

    for (const row of weeklyCompletions) {
      if (row.is_completed) {
        await this.awardRewards(playerId, row.reward_coins, row.reward_pack_tokens ?? 0);
      }
    }
  },

  /**
   * Award rewards for completed challenge
   */
  async awardRewards(playerId: number, coins: number, packTokens: number) {
    // Award coins
    if (coins > 0) {
      await addCoinsToPlayer(playerId, coins, "challenge");
      console.log(`[CHALLENGE] Awarded ${coins} coins to player ${playerId}`);
    }

    // Award card packs (convert tokens to packs)
    if (packTokens > 0) {
      // 1 token = 1 card pack pull
      // For now, just add coins equivalent (can be changed to actual card pull)
      // 1 pack token ≈ 50 coins worth
      await addCoinsToPlayer(playerId, packTokens * 50, "challenge", "pack token bonus");
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

    // Delete current challenge assignment — scoped to TODAY's row only.
    // This used to delete every row ever assigned for (playerId,
    // challengeId) regardless of date (today/tomorrow were computed above
    // but never actually used in the WHERE clause), so rerolling a daily
    // challenge silently erased that player's entire history with this
    // challenge — every past day's progress and completion record, not just
    // the one row being rerolled.
    await db
      .delete(playerDailyChallenges)
      .where(
        and(
          eq(playerDailyChallenges.player_id, playerId),
          eq(playerDailyChallenges.challenge_id, challengeId),
          gte(playerDailyChallenges.date_assigned, today),
          lt(playerDailyChallenges.date_assigned, tomorrow)
        )
      );

    // Next getDailyForPlayer call will create a new one
    return { success: true, message: "Challenge rerolled. Reload to see new challenge." };
  },

  /**
   * Reroll a weekly challenge for a player
   */
  async rerollWeekly(playerId: number, challengeId: number) {
    // Same fix as rerollDaily above, scoped to THIS week's row only (by
    // week_year + week_number together — see add_weekly_challenge_year.ts
    // for why week_number alone isn't enough) instead of deleting every row
    // ever assigned for this challenge across every past week.
    const now = new Date();
    const weekNumber = getIsoWeekNumber(now);
    const weekYear = getIsoWeekYear(now);

    await db
      .delete(playerWeeklyChallenges)
      .where(
        and(
          eq(playerWeeklyChallenges.player_id, playerId),
          eq(playerWeeklyChallenges.challenge_id, challengeId),
          eq(playerWeeklyChallenges.week_number, weekNumber),
          eq(playerWeeklyChallenges.week_year, weekYear)
        )
      );

    return { success: true, message: "Weekly challenge rerolled. Reload to see new challenge." };
  },
};

