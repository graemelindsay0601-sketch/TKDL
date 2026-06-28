/**
 * Shop Purchase Cooldown Service
 * 
 * Enforces 24-hour cooldown per card per player
 * - Track last purchase time in shopPurchaseHistoryTable
 * - Prevent duplicate purchases within 24 hours
 * - Return cooldown status to frontend
 */

import { db } from "@workspace/db";
import { shopPurchaseHistoryTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

const COOLDOWN_HOURS = 24;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

/**
 * Check if player can purchase a specific card from shop
 * Returns: { canPurchase: bool, hoursUntilAvailable: number, lastPurchasedAt: Date | null }
 */
export async function checkCardPurchaseCooldown(
  playerId: number,
  cardId: number
): Promise<{
  canPurchase: boolean;
  hoursUntilAvailable: number;
  lastPurchasedAt: Date | null;
}> {
  try {
    // Get most recent purchase of this card by this player
    const [lastPurchase] = await db
      .select({
        purchasedAt: shopPurchaseHistoryTable.purchasedAt,
      })
      .from(shopPurchaseHistoryTable)
      .where(
        and(
          eq(shopPurchaseHistoryTable.playerId, playerId),
          eq(shopPurchaseHistoryTable.cardId, cardId)
        )
      )
      .orderBy(desc(shopPurchaseHistoryTable.purchasedAt))
      .limit(1);

    if (!lastPurchase) {
      // Never purchased this card
      return {
        canPurchase: true,
        hoursUntilAvailable: 0,
        lastPurchasedAt: null,
      };
    }

    const lastPurchaseTime = new Date(lastPurchase.purchasedAt);
    const now = new Date();
    const timeSinceLastPurchase = now.getTime() - lastPurchaseTime.getTime();

    if (timeSinceLastPurchase >= COOLDOWN_MS) {
      // Cooldown has expired
      return {
        canPurchase: true,
        hoursUntilAvailable: 0,
        lastPurchasedAt: lastPurchaseTime,
      };
    }

    // Still on cooldown
    const remainingMs = COOLDOWN_MS - timeSinceLastPurchase;
    const hoursUntilAvailable = Math.ceil(remainingMs / (60 * 60 * 1000));

    return {
      canPurchase: false,
      hoursUntilAvailable,
      lastPurchasedAt: lastPurchaseTime,
    };
  } catch (err) {
    logger.error(
      { playerId, cardId, err },
      "Failed to check purchase cooldown"
    );
    // On error, be permissive (allow purchase)
    return {
      canPurchase: true,
      hoursUntilAvailable: 0,
      lastPurchasedAt: null,
    };
  }
}

/**
 * Validate purchase is allowed (cooldown check)
 * Call this BEFORE finalizing a purchase
 */
export async function validatePurchaseAllowed(
  playerId: number,
  cardId: number
): Promise<{
  allowed: boolean;
  reason?: string;
  hoursUntilAvailable?: number;
}> {
  const cooldown = await checkCardPurchaseCooldown(playerId, cardId);

  if (!cooldown.canPurchase) {
    return {
      allowed: false,
      reason: `Card on cooldown. Available in ${cooldown.hoursUntilAvailable} hours`,
      hoursUntilAvailable: cooldown.hoursUntilAvailable,
    };
  }

  return {
    allowed: true,
  };
}

/**
 * Admin: Clear purchase history for testing
 */
export async function clearPurchaseHistoryForCard(
  playerId: number,
  cardId: number
): Promise<boolean> {
  try {
    await db
      .delete(shopPurchaseHistoryTable)
      .where(
        and(
          eq(shopPurchaseHistoryTable.playerId, playerId),
          eq(shopPurchaseHistoryTable.cardId, cardId)
        )
      );

    logger.info({ playerId, cardId }, "Purchase history cleared");
    return true;
  } catch (err) {
    logger.error({ playerId, cardId, err }, "Failed to clear purchase history");
    return false;
  }
}
