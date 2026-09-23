import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Idempotent ALTER TABLE, same pattern as add_result_theme_cosmetic.ts.
 * Adds the "currently equipped" column for the new BUBBLE_COLOR cosmetic
 * category (a tint for a player's own outgoing chat bubbles in account-page
 * DMs — see schema/players.ts and schema/cosmetics.ts). Null means no
 * colour equipped, i.e. the existing default pink bubble, so this is safe
 * against every existing player row.
 */
export async function addBubbleColorCosmeticColumn(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_bubble_color_id TEXT`);
  } catch (err) {
    logger.error({ err }, "Failed to add bubble color cosmetic column to players");
  }
}
