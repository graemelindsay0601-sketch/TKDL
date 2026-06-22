/**
 * CARD SCORE INTEGRATION SERVICE
 * Bridges card effects with match scoring results
 * Modifies final match scores based on equipped and used cards
 */

import {
  applyX01GoodCard,
  applyX01BadCard,
  applyCricketGoodCard,
  applyCricketBadCard,
  applyWildcardGoodCard,
  applyWildcardBadCard,
  type X01ScoringContext,
  type CricketScoringContext,
} from "./card-effects";

import { db, cardDefinitionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface CardUsage {
  cardId: string;
  usedBy: number;
  turn?: number;
}

interface MatchScoreModifiers {
  player1ScoreModifier: number;
  player2ScoreModifier: number;
}

/**
 * Get card details from database
 */
async function getCardDetails(cardId: string) {
  const card = await db
    .select()
    .from(cardDefinitionsTable)
    .where(eq(cardDefinitionsTable.cardId, cardId))
    .limit(1);

  return card[0];
}

/**
 * Apply card effects to X01 match scoring
 * IMPORTANT: This is simplified - assumes cards were used strategically
 * In real implementation, cards would be tracked per-turn and applied then
 */
export async function applyX01CardModifiers(
  player1Id: number,
  player2Id: number,
  cardsUsed: CardUsage[],
  player1BaseScore: number,
  player2BaseScore: number
): Promise<MatchScoreModifiers> {
  let player1Modifier = 0;
  let player2Modifier = 0;

  for (const usage of cardsUsed) {
    const card = await getCardDetails(usage.cardId);
    if (!card) continue;

    // Determine if this card helps player 1 or player 2
    const isPlayer1Card = usage.usedBy === player1Id;
    const targetPlayer = isPlayer1Card ? 1 : 2;

    // Create a basic context for the card effect
    // In production, this would have actual dart-by-dart data
    const baseScore = isPlayer1Card ? player1BaseScore : player2BaseScore;
    const context: X01ScoringContext = {
      playerScore: baseScore,
      turnDarts: [20, 20, 0], // Average turn - simplified
      isOnDouble: baseScore < 50, // Likely on double if low score
      remainingScore: baseScore,
    };

    try {
      if (card.cardType === "GOOD") {
        const modifier = applyX01GoodCard(card.effect, context);
        if (targetPlayer === 1) {
          player1Modifier += modifier;
        } else {
          player2Modifier += modifier;
        }
      } else if (card.cardType === "BAD") {
        // BAD card played by player 1 affects player 2, and vice versa
        const targetContext: X01ScoringContext = {
          playerScore: targetPlayer === 1 ? player2BaseScore : player1BaseScore,
          turnDarts: [20, 20, 0],
          isOnDouble: (targetPlayer === 1 ? player2BaseScore : player1BaseScore) < 50,
          remainingScore: targetPlayer === 1 ? player2BaseScore : player1BaseScore,
        };

        const modifier = applyX01BadCard(card.effect, targetContext);
        if (targetPlayer === 1) {
          // Modifier is negative for opponent
          player2Modifier += modifier;
        } else {
          player1Modifier += modifier;
        }
      }
    } catch (e) {
      console.error(`Error applying card ${card.name}:`, e);
      // Silently continue - don't break match submission
    }
  }

  return {
    player1ScoreModifier: Math.max(-100, Math.min(200, player1Modifier)), // Cap at ±100
    player2ScoreModifier: Math.max(-100, Math.min(200, player2Modifier)),
  };
}

/**
 * Apply card effects to Cricket match scoring
 */
export async function applyCricketCardModifiers(
  player1Id: number,
  player2Id: number,
  cardsUsed: CardUsage[],
  player1MarksCount: number,
  player2MarksCount: number
): Promise<MatchScoreModifiers> {
  let player1Modifier = 0;
  let player2Modifier = 0;

  for (const usage of cardsUsed) {
    const card = await getCardDetails(usage.cardId);
    if (!card) continue;

    const isPlayer1Card = usage.usedBy === player1Id;
    const targetPlayer = isPlayer1Card ? 1 : 2;

    // Create a basic context for Cricket
    const context: CricketScoringContext = {
      playerMarks: { 20: 2, 19: 1, 18: 1, 17: 0, 16: 0, 15: 0, 25: 1 },
      targetNumber: 20,
      currentMarksOnTarget: 3,
      opponentMarks: { 20: 2, 19: 1, 18: 1, 17: 0, 16: 0, 15: 0, 25: 1 },
    };

    try {
      if (card.cardType === "GOOD") {
        const modifier = applyCricketGoodCard(card.effect, context);
        if (targetPlayer === 1) {
          player1Modifier += modifier;
        } else {
          player2Modifier += modifier;
        }
      } else if (card.cardType === "BAD") {
        const modifier = applyCricketBadCard(card.effect, context);
        if (targetPlayer === 1) {
          player2Modifier += modifier;
        } else {
          player1Modifier += modifier;
        }
      }
    } catch (e) {
      console.error(`Error applying Cricket card ${card.name}:`, e);
    }
  }

  return {
    player1ScoreModifier: Math.max(-50, Math.min(100, player1Modifier)),
    player2ScoreModifier: Math.max(-50, Math.min(100, player2Modifier)),
  };
}

/**
 * Calculate final match card points including modifiers
 * Called before standings update
 */
export function calculateCardClashPoints(
  basePoints: number,
  cardsUsedCount: number,
  scoreModifier: number
): number {
  // Base: 50 for win, 10 for loss
  // Cards: +10 per card used
  // Modifiers: +/- from card effects
  const cardBonus = cardsUsedCount * 10;
  const total = basePoints + cardBonus + scoreModifier;

  return Math.max(0, Math.floor(total)); // Never go below 0
}
