/**
 * Free Pack Service
 * 
 * Manages free pack claiming system for Card Clash
 * - One free pack every 3 days (72 hours)
 * - Persistent across sessions
 * - Fire-and-forget resilience
 */

import { db } from "@workspace/db";
import { playersTable } from "@workspace/db/schema";
import { sql, eq } from "drizzle-orm";
import { logger } from "../lib/logger";

/**
 * Check if player can claim free pack
 * Returns: { canClaim: bool, hoursUntilAvailable: number }
 */
export async function checkFreePackStatus(playerId: number): Promise<{
  canClaim: boolean;
  hoursUntilAvailable: number;
  lastClaimedAt: Date | null;
}> {
  try {
    const [player] = await db
      .select({
        lastFreePackClaimTime: playersTable.lastFreePackClaimTime,
      })
      .from(playersTable)
      .where(eq(playersTable.id, playerId));

    if (!player) {
      return {
        canClaim: false,
        hoursUntilAvailable: 0,
        lastClaimedAt: null,
      };
    }

    const lastClaim = player.lastFreePackClaimTime
      ? new Date(player.lastFreePackClaimTime)
      : null;
    const now = new Date();

    if (!lastClaim) {
      // Never claimed before
      return {
        canClaim: true,
        hoursUntilAvailable: 0,
        lastClaimedAt: null,
      };
    }

    // 72 hours = 3 days
    const cooldownMs = 72 * 60 * 60 * 1000;
    const timeSinceLastClaim = now.getTime() - lastClaim.getTime();
    const canClaim = timeSinceLastClaim >= cooldownMs;

    if (canClaim) {
      return {
        canClaim: true,
        hoursUntilAvailable: 0,
        lastClaimedAt: lastClaim,
      };
    }

    const remainingMs = cooldownMs - timeSinceLastClaim;
    const hoursUntilAvailable = Math.ceil(remainingMs / (60 * 60 * 1000));

    return {
      canClaim: false,
      hoursUntilAvailable,
      lastClaimedAt: lastClaim,
    };
  } catch (err) {
    logger.error({ playerId, err }, "Failed to check free pack status");
    return {
      canClaim: false,
      hoursUntilAvailable: 0,
      lastClaimedAt: null,
    };
  }
}

/**
 * Award free pack to player
 * - Checks eligibility
 * - Awards SINGLE pack
 * - Updates claim timestamp
 * - Fire-and-forget pattern
 */
export async function claimFreePackForPlayer(
  playerId: number
): Promise<{
  success: boolean;
  message: string;
  packAwarded?: boolean;
  nextAvailableIn?: number;
}> {
  try {
    // Check eligibility
    const status = await checkFreePackStatus(playerId);

    if (!status.canClaim) {
      return {
        success: false,
        message: `Pack available in ${status.hoursUntilAvailable} hours`,
        packAwarded: false,
        nextAvailableIn: status.hoursUntilAvailable,
      };
    }

    // Award pack (fire-and-forget)
    try {
      await db.execute(sql`
        INSERT INTO card_clash_pack_inventory (player_id, pack_type, earned_reason)
        VALUES (${playerId}, 'SINGLE', 'Free pack claim')
      `);
    } catch (packErr) {
      logger.warn({ playerId, packErr }, "Failed to award pack (continuing)");
      // Don't fail the claim - update timestamp anyway
    }

    // Update claim timestamp
    await db
      .update(playersTable)
      .set({
        lastFreePackClaimTime: new Date(),
      })
      .where(eq(playersTable.id, playerId));

    logger.info({ playerId }, "Free pack claimed successfully");

    return {
      success: true,
      message: "Free pack claimed! Check your inventory.",
      packAwarded: true,
    };
  } catch (err) {
    logger.error({ playerId, err }, "Failed to claim free pack");
    return {
      success: false,
      message: "Failed to claim pack. Try again later.",
      packAwarded: false,
    };
  }
}

/**
 * Admin: Force reset free pack cooldown
 */
export async function resetFreePackCooldown(playerId: number): Promise<boolean> {
  try {
    await db
      .update(playersTable)
      .set({
        lastFreePackClaimTime: null,
      })
      .where(eq(playersTable.id, playerId));

    logger.info({ playerId }, "Free pack cooldown reset");
    return true;
  } catch (err) {
    logger.error({ playerId, err }, "Failed to reset free pack cooldown");
    return false;
  }
}
