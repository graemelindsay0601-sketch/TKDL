import { db, playerCurrencyTable, playersTable } from "@workspace/db";
import {
  cardClashMatchesTable,
  cardClashStandingsTable,
  cardClashSeasonsTable,
  cardInventoryTable,
} from "@workspace/db";
import { eq, and, or, leftJoin, desc, sql } from "drizzle-orm";
import { addCoinsToPlayer, removeCardFromPlayer } from "./card-shop-service";
import { applyX01CardModifiers, applyCricketCardModifiers, calculateCardClashPoints } from "./card-score-integration";
import { logger } from "../lib/logger";

const CARD_CLASH_WAGER_POINTS = {
  WIN: 50,
  LOSS: 10,
};

const COIN_REWARDS = {
  WIN_BASE: 50,
  LOSS_BASE: 25,
  PER_CARD_USED: 10,
};

async function ensureSeasonSchema() {
  for (const alter of [
    sql`ALTER TABLE card_clash_seasons ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Season'`,
    sql`ALTER TABLE card_clash_seasons ADD COLUMN IF NOT EXISTS start_date DATE NOT NULL DEFAULT CURRENT_DATE`,
    sql`ALTER TABLE card_clash_seasons ADD COLUMN IF NOT EXISTS end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days')`,
    sql`ALTER TABLE card_clash_seasons ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`,
    sql`ALTER TABLE card_clash_seasons ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false`,
    sql`ALTER TABLE card_clash_seasons ADD COLUMN IF NOT EXISTS total_matches INTEGER NOT NULL DEFAULT 0`,
    sql`ALTER TABLE card_clash_seasons ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    sql`ALTER TABLE card_clash_seasons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  ]) {
    try { await db.execute(alter); } catch (e) { logger.warn({ e }, "[SEASON_SERVICE] column alter skipped"); }
  }
  logger.info("[SEASON_SERVICE] Schema columns verified/added");
}

export async function getActiveCardClashSeason() {
  // Season system removed — no DB query needed
  return null;
}

export async function startCardClashMatch(
  gameMode: "X01" | "CRICKET",
  player1Id: number,
  player2Id: number,
  equippedCards?: {
    player1?: Array<{ cardId: string; cardType: "GOOD" | "BAD" }>;
    player2?: Array<{ cardId: string; cardType: "GOOD" | "BAD" }>;
  }
) {
  const p1Cards = equippedCards?.player1 ?? [];
  const p2Cards = equippedCards?.player2 ?? [];

  logger.info({ gameMode, player1Id, player2Id }, "Starting Card Clash match");

  // Ensure schema is up to date - make season_id nullable
  try {
    await db.execute(sql`ALTER TABLE card_clash_matches ALTER COLUMN season_id DROP NOT NULL`);
    logger.info("Ensured season_id is nullable");
  } catch (e) {
    logger.warn({ e }, "Could not drop NOT NULL on season_id (may already be done)");
  }

  try {
    // Drop foreign key constraint if it exists
    await db.execute(
      sql`ALTER TABLE card_clash_matches DROP CONSTRAINT IF EXISTS card_clash_matches_season_id_card_clash_seasons_id_fk`
    );
    logger.info("Dropped season_id foreign key constraint");
  } catch (e) {
    logger.warn({ e }, "Could not drop FK (may not exist)");
  }

  // Ensure columns exist
  for (const alter of [
    sql`ALTER TABLE card_clash_matches ADD COLUMN IF NOT EXISTS player_1_equipped_cards JSONB`,
    sql`ALTER TABLE card_clash_matches ADD COLUMN IF NOT EXISTS player_2_equipped_cards JSONB`,
    sql`ALTER TABLE card_clash_matches ADD COLUMN IF NOT EXISTS cards_used_in_match JSONB DEFAULT '[]'`,
    sql`ALTER TABLE card_clash_matches ADD COLUMN IF NOT EXISTS player_1_points_earned INTEGER DEFAULT 0`,
    sql`ALTER TABLE card_clash_matches ADD COLUMN IF NOT EXISTS player_2_points_earned INTEGER DEFAULT 0`,
  ]) {
    try {
      await db.execute(alter);
    } catch (_) {
      // Column may already exist
    }
  }

  // INSERT without season_id (Card Clash is standalone, no seasons)
  try {
    const result = await db.execute(sql`
      INSERT INTO card_clash_matches
        (game_mode, player_1_id, player_2_id, winner_id,
         player_1_equipped_cards, player_2_equipped_cards, cards_used_in_match,
         player_1_points_earned, player_2_points_earned)
      VALUES
        (${gameMode}, ${player1Id}, ${player2Id}, NULL,
         ${JSON.stringify(p1Cards)}::jsonb, ${JSON.stringify(p2Cards)}::jsonb,
         '[]'::jsonb, 0, 0)
      RETURNING *
    `);    
    logger.info({ matchId: result.rows[0]?.id }, "Match created successfully");
    return result.rows[0];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMsg, gameMode, player1Id, player2Id },
      "Failed to start Card Clash match"
    );
    throw new Error(`Failed to create match: ${errorMsg}`);
  }
}

export async function recordCardUsedInMatch(
  matchId: number,
  cardId: string,
  usedBy: number,
  turn: number
) {
  const match = await db
    .select()
    .from(cardClashMatchesTable)
    .where(eq(cardClashMatchesTable.id, matchId))
    .limit(1);

  if (!match[0]) throw new Error("Match not found");

  const cardsUsed = JSON.parse(match[0].cardsUsedInMatch as string);
  cardsUsed.push({ cardId, usedBy, turn, timestamp: new Date() });

  await db
    .update(cardClashMatchesTable)
    .set({ cardsUsedInMatch: JSON.stringify(cardsUsed) })
    .where(eq(cardClashMatchesTable.id, matchId));
}

/**
 * Update Card Clash leaderboard - all-time win/loss tracking (no seasons)
 */
async function updateCardClashLeaderboard(playerId: number, won: boolean) {
  try {
    // Ensure table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS card_clash_leaderboard (
        player_id INTEGER PRIMARY KEY UNIQUE REFERENCES players(id) ON DELETE CASCADE,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        cards_unlocked_count INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Try to update existing entry
    const updateResult = await db.execute(sql`
      UPDATE card_clash_leaderboard
      SET 
        wins = CASE WHEN ${won} THEN wins + 1 ELSE wins END,
        losses = CASE WHEN NOT ${won} THEN losses + 1 ELSE losses END,
        updated_at = CURRENT_TIMESTAMP
      WHERE player_id = ${playerId}
      RETURNING *
    `);

    // If no rows updated, insert new entry
    if (updateResult.rowCount === 0) {
      await db.execute(sql`
        INSERT INTO card_clash_leaderboard (player_id, wins, losses, cards_unlocked_count)
        VALUES (${playerId}, ${won ? 1 : 0}, ${won ? 0 : 1}, 0)
        ON CONFLICT (player_id) DO UPDATE SET
          wins = CASE WHEN ${won} THEN card_clash_leaderboard.wins + 1 ELSE card_clash_leaderboard.wins END,
          losses = CASE WHEN NOT ${won} THEN card_clash_leaderboard.losses + 1 ELSE card_clash_leaderboard.losses END,
          updated_at = CURRENT_TIMESTAMP
      `);
    }

    logger.info({ playerId, won }, "Updated Card Clash leaderboard");
  } catch (error) {
    logger.error({ error, playerId, won }, "Failed to update leaderboard");
  }
}

export async function finishCardClashMatch(
  matchId: number,
  winnerId: number,
  cardsUsedInMatch?: string[] | Array<{ cardId: string; usedBy: number }>,
  player1PointsEarned: number = 0,
  player2PointsEarned: number = 0
) {
  const match = await db
    .select()
    .from(cardClashMatchesTable)
    .where(eq(cardClashMatchesTable.id, matchId))
    .limit(1);

  if (!match[0]) throw new Error("Match not found");

  const loser = match[0].player1Id === winnerId ? match[0].player2Id : match[0].player1Id;
  
  // Parse cards - handle both string format ("cardId:pPlayerId") and object format
  let parsedCards: Array<{ cardId: string; usedBy: number }> = [];
  
  if (cardsUsedInMatch && Array.isArray(cardsUsedInMatch)) {
    if (cardsUsedInMatch.length > 0) {
      if (typeof cardsUsedInMatch[0] === "string") {
        // Parse string format: "cardId:pPlayerId"
        parsedCards = cardsUsedInMatch.map((card: any) => {
          const [cardId, playerStr] = card.split(":");
          const playerId = parseInt(playerStr.replace("p", ""));
          return { cardId, usedBy: playerId };
        });
      } else {
        // Already in object format
        parsedCards = cardsUsedInMatch as Array<{ cardId: string; usedBy: number }>;
      }
    }
  }
  
  const cardsUsed = parsedCards;
  const winnerCardsUsed = cardsUsed.filter(c => c.usedBy === winnerId).length;
  const loserCardsUsed = cardsUsed.filter(c => c.usedBy === loser).length;

  // Calculate points: base + 10 per card used
  const winnerCardPoints = CARD_CLASH_WAGER_POINTS.WIN + (winnerCardsUsed * 10);
  const loserCardPoints = CARD_CLASH_WAGER_POINTS.LOSS + (loserCardsUsed * 10);

  // Calculate coin rewards
  const winnerCoins = COIN_REWARDS.WIN_BASE + (winnerCardsUsed * COIN_REWARDS.PER_CARD_USED);
  const loserCoins = COIN_REWARDS.LOSS_BASE + (loserCardsUsed * COIN_REWARDS.PER_CARD_USED);

  // Update match
  await db
    .update(cardClashMatchesTable)
    .set({
      winnerId,
      player1PointsEarned:
        match[0].player1Id === winnerId ? winnerCardPoints : loserCardPoints,
      player2PointsEarned:
        match[0].player2Id === winnerId ? winnerCardPoints : loserCardPoints,
      cardsUsedInMatch: JSON.stringify(cardsUsed),
    })
    .where(eq(cardClashMatchesTable.id, matchId));

  // Award coins to both players
  await addCoinsToPlayer(winnerId, winnerCoins);
  await addCoinsToPlayer(loser, loserCoins);

  // Update challenge progress (fire and forget)
  try {
    const { challengeService } = await import("../services/challenge-service");
    
    // Update daily challenges for winner
    await challengeService.updateDailyProgress(winnerId, "matches_5", 1);
    await challengeService.updateDailyProgress(winnerId, "card_clash_wins_2", 1);
    
    // Update daily challenges for loser
    await challengeService.updateDailyProgress(loser, "matches_5", 1);
    await challengeService.updateDailyProgress(loser, "card_clash_wins_2", 0);
    
    // Update weekly challenges
    await challengeService.updateWeeklyProgress(winnerId, "weekly_wins_5", 1);
    await challengeService.updateWeeklyProgress(winnerId, "weekly_card_clash_3", 1);
    
    await challengeService.updateWeeklyProgress(loser, "weekly_wins_5", 0);
    await challengeService.updateWeeklyProgress(loser, "weekly_card_clash_3", 0);

    // Update seasonal quests
    const { seasonalQuestService } = await import("../services/seasonal-quest-service");
    await seasonalQuestService.updateSeasonalProgress(winnerId, "card_clash_wins_20", 1);
    // Loser doesn't progress card clash quest (only winners count)
  } catch (err) {
    logger.error("Card Clash challenge/quest update error:", err);
    // Don't fail the match if challenges fail
  }

  // Consume cards (remove from inventory)
  for (const card of cardsUsed) {
    try {
      await removeCardFromPlayer(card.usedBy, card.cardId, 1);
    } catch (e) {
      logger.error(`Failed to consume card ${card.cardId} for player ${card.usedBy}:`, e);
    }
  }

  // Update Card Clash leaderboard (all-time wins/losses tracking)
  try {
    await updateCardClashLeaderboard(winnerId, true);
    await updateCardClashLeaderboard(loser, false);
  } catch (err) {
    logger.warn({ err }, "Failed to update Card Clash leaderboard");
  }

  // Standings are now computed live from card_clash_matches — no separate standings table needed

  // Return match with updated data
  const updatedMatch = await db
    .select()
    .from(cardClashMatchesTable)
    .where(eq(cardClashMatchesTable.id, matchId))
    .limit(1);

  return updatedMatch[0];
}

export async function deleteCardClashMatch(matchId: number) {
  const match = await db
    .select()
    .from(cardClashMatchesTable)
    .where(eq(cardClashMatchesTable.id, matchId))
    .limit(1);

  if (!match[0]) throw new Error("Match not found");

  const season = await db
    .select()
    .from(cardClashSeasonsTable)
    .where(eq(cardClashSeasonsTable.id, match[0].seasonId))
    .limit(1);

  // Revert points from standings
  const winnerStanding = await db
    .select()
    .from(cardClashStandingsTable)
    .where(
      and(
        eq(cardClashStandingsTable.seasonId, match[0].seasonId),
        eq(cardClashStandingsTable.playerId, match[0].winnerId)
      )
    )
    .limit(1);

  const loser =
    match[0].player1Id === match[0].winnerId ? match[0].player2Id : match[0].player1Id;
  const loserStanding = await db
    .select()
    .from(cardClashStandingsTable)
    .where(
      and(
        eq(cardClashStandingsTable.seasonId, match[0].seasonId),
        eq(cardClashStandingsTable.playerId, loser)
      )
    )
    .limit(1);

  if (winnerStanding[0]) {
    await db
      .update(cardClashStandingsTable)
      .set({
        cardPoints: Math.max(0, winnerStanding[0].cardPoints - CARD_CLASH_WAGER_POINTS.WIN),
        wins: Math.max(0, winnerStanding[0].wins - 1),
      })
      .where(
        and(
          eq(cardClashStandingsTable.seasonId, match[0].seasonId),
          eq(cardClashStandingsTable.playerId, match[0].winnerId)
        )
      );
  }

  if (loserStanding[0]) {
    await db
      .update(cardClashStandingsTable)
      .set({
        cardPoints: Math.max(0, loserStanding[0].cardPoints - CARD_CLASH_WAGER_POINTS.LOSS),
        losses: Math.max(0, loserStanding[0].losses - 1),
      })
      .where(
        and(
          eq(cardClashStandingsTable.seasonId, match[0].seasonId),
          eq(cardClashStandingsTable.playerId, loser)
        )
      );
  }

  // Return cards to inventory
  const cardsUsed = JSON.parse(match[0].cardsUsedInMatch as string);
  for (const cardUsage of cardsUsed) {
    await db
      .update(cardInventoryTable)
      .set({
        quantity: cardInventoryTable.quantity + 1,
      })
      .where(
        and(
          eq(cardInventoryTable.playerId, cardUsage.usedBy),
          eq(cardInventoryTable.cardId, cardUsage.cardId)
        )
      );
  }

  // Delete match
  await db.delete(cardClashMatchesTable).where(eq(cardClashMatchesTable.id, matchId));
}

export async function getCardClashStandings(seasonId: number) {
  const standings = await db
    .select({
      id: cardClashStandingsTable.id,
      seasonId: cardClashStandingsTable.seasonId,
      playerId: cardClashStandingsTable.playerId,
      cardPoints: cardClashStandingsTable.cardPoints,
      wins: cardClashStandingsTable.wins,
      losses: cardClashStandingsTable.losses,
      playerName: playersTable.name,
    })
    .from(cardClashStandingsTable)
    .leftJoin(playersTable, eq(cardClashStandingsTable.playerId, playersTable.id))
    .where(eq(cardClashStandingsTable.seasonId, seasonId))
    .orderBy(desc(cardClashStandingsTable.cardPoints));

  return standings;
}

export async function getCardClashMatchHistory(playerId: number, seasonId?: number) {
  const playerFilter = or(
    eq(cardClashMatchesTable.player1Id, playerId),
    eq(cardClashMatchesTable.player2Id, playerId)
  );
  let query = db
    .select()
    .from(cardClashMatchesTable)
    .where(
      seasonId
        ? and(eq(cardClashMatchesTable.seasonId, seasonId), playerFilter)
        : playerFilter
    );

  return await query;
}
