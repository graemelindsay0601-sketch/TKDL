import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Idempotent ALTER TABLEs for the third wave of cosmetics (SCORER_THEME,
 * PLAYER_CARD_FINISH — see schema/cosmetics.ts): the two new "currently
 * equipped" columns on players. Null is safe against every existing row.
 */
export async function addWave3CosmeticColumns(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_scorer_theme_id TEXT`);
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_player_card_finish_id TEXT`);
  } catch (err) {
    logger.error({ err }, "Failed to add wave-3 cosmetic columns");
  }
}
