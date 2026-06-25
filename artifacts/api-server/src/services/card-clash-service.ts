import { db, playerCurrencyTable, playersTable } from "@workspace/db";
import {
  cardClashMatchesTable,
  cardClashStandingsTable,
  cardClashSeasonsTable,
  cardInventoryTable,
} from "@workspace/db";
import { eq, and, leftJoin, desc } from "drizzle-orm";
import { addCoinsToPlayer, removeCardFromPlayer } from "./card-shop-service";
import { applyX01CardModifiers, applyCricketCardModifiers, calculateCardClashPoints } from "./card-score-integration";

const CARD_CLASH_WAGER_POINTS = {
  WIN: 50,
  LOSS: 10,
};

const COIN_REWARDS = {
  WIN_BASE: 50,
  LOSS_BASE: 25,
  PER_CARD_USED: 10,
};

export async function getActiveCardClashSeason() {
  let season = await db
    .select()
    .from(cardClashSeasonsTable)
    .where(eq(cardClashSeasonsTable.isActive, true))
    .limit(1);

  if (season.length === 0) {
    // Create a new season if none exists
    const now = new Date();
    const startDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]; // YYYY-MM-DD
    
    const [newSeason] = await db
      .insert(cardClashSeasonsTable)
      .values({
        name: `Season ${now.getFullYear()}-${now.getMonth() + 1}`,
        startDate,
        endDate,
        isActive: true,
      })
      .returning();
    return newSeason;
  }

  return season[0];
}

export async function startCardClashMatch(
  gameMode: "X01" | "CRICKET",
  player1Id: number,
  player2Id: number,
  equippedCards: {
    player1: Array<{ cardId: string; cardType: "GOOD" | "BAD" }>;
    player2: Array<{ cardId: string; cardType: "GOOD" | "BAD" }>;
  }
) {
  const season = await getActiveCardClashSeason();
  if (!season) throw new Error("No active Card Clash season");

  const match = await db.insert(cardClashMatchesTable).values({
    seasonId: season.id,
    gameMode,
    player1Id,
    player2Id,
    winnerId: player1Id, // Placeholder, will be updated on finish
    player1EquippedCards: JSON.stringify(equippedCards.player1),
    player2EquippedCards: JSON.stringify(equippedCards.player2),
    cardsUsedInMatch: JSON.stringify([]),
    player1PointsEarned: 0,
    player2PointsEarned: 0,
  });

  const matchId = match[0];
  const createdMatch = await db
    .select()
    .from(cardClashMatchesTable)
    .where(eq(cardClashMatchesTable.id, matchId))
    .limit(1);

  return createdMatch[0];
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
    console.error("Card Clash challenge/quest update error:", err);
    // Don't fail the match if challenges fail
  }

  // Consume cards (remove from inventory)
  for (const card of cardsUsed) {
    try {
      await removeCardFromPlayer(card.usedBy, card.cardId, 1);
    } catch (e) {
      console.error(`Failed to consume card ${card.cardId} for player ${card.usedBy}:`, e);
    }
  }

  // Update standings
  const season = await db
    .select()
    .from(cardClashSeasonsTable)
    .where(eq(cardClashSeasonsTable.id, match[0].seasonId))
    .limit(1);

  if (!season[0]) throw new Error("Season not found");

  // Update winner standing
  const winnerStanding = await db
    .select()
    .from(cardClashStandingsTable)
    .where(
      and(
        eq(cardClashStandingsTable.seasonId, season[0].id),
        eq(cardClashStandingsTable.playerId, winnerId)
      )
    )
    .limit(1);

  if (winnerStanding[0]) {
    await db
      .update(cardClashStandingsTable)
      .set({
        cardPoints: winnerStanding[0].cardPoints + winnerCardPoints,
        wins: winnerStanding[0].wins + 1,
      })
      .where(
        and(
          eq(cardClashStandingsTable.seasonId, season[0].id),
          eq(cardClashStandingsTable.playerId, winnerId)
        )
      );
  } else {
    await db.insert(cardClashStandingsTable).values({
      seasonId: season[0].id,
      playerId: winnerId,
      cardPoints: winnerCardPoints,
      wins: 1,
      losses: 0,
    });
  }

  // Update loser standing
  const loserStanding = await db
    .select()
    .from(cardClashStandingsTable)
    .where(
      and(
        eq(cardClashStandingsTable.seasonId, season[0].id),
        eq(cardClashStandingsTable.playerId, loser)
      )
    )
    .limit(1);

  if (loserStanding[0]) {
    await db
      .update(cardClashStandingsTable)
      .set({
        cardPoints: loserStanding[0].cardPoints + loserCardPoints,
        losses: loserStanding[0].losses + 1,
      })
      .where(
        and(
          eq(cardClashStandingsTable.seasonId, season[0].id),
          eq(cardClashStandingsTable.playerId, loser)
        )
      );
  } else {
    await db.insert(cardClashStandingsTable).values({
      seasonId: season[0].id,
      playerId: loser,
      cardPoints: loserCardPoints,
      wins: 0,
      losses: 1,
    });
  }

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
  let query = db
    .select()
    .from(cardClashMatchesTable)
    .where(
      seasonId
        ? and(
            eq(cardClashMatchesTable.seasonId, seasonId),
            eq(cardClashMatchesTable.player1Id, playerId) ||
              eq(cardClashMatchesTable.player2Id, playerId)
          )
        : eq(cardClashMatchesTable.player1Id, playerId) ||
            eq(cardClashMatchesTable.player2Id, playerId)
    );

  return await query;
}
