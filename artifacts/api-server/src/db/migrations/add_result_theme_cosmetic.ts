import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Idempotent ALTER TABLE, same pattern as add_glow_cosmetic.ts. Adds the
 * "currently equipped" column for the new RESULT_THEME cosmetic category
 * (an accent colour for a player's own practice-mode result screens — see
 * schema/players.ts and schema/cosmetics.ts). Null means no theme
 * equipped, i.e. the existing default accent colour, so this is safe
 * against every existing player row.
 */
export async function addResultThemeCosmeticColumn(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_result_theme_id TEXT`);
  } catch (err) {
    logger.error({ err }, "Failed to add result theme cosmetic column to players");
  }
}
