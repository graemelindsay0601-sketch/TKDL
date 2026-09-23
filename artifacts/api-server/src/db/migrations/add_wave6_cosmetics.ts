import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Idempotent ALTER TABLE for the sixth wave of cosmetics (RANK_UP_EFFECT —
 * see schema/cosmetics.ts): the "currently equipped" column on players.
 * Null is safe against every existing row.
 */
export async function addWave6CosmeticColumns(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_rank_up_effect_id TEXT`);
  } catch (err) {
    logger.error({ err }, "Failed to add wave-6 cosmetic columns");
  }
}
