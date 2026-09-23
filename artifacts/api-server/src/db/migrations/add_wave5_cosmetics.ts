import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Idempotent ALTER TABLE for the fifth wave of cosmetics (RECAP_STYLE — see
 * schema/cosmetics.ts): the "currently equipped" column on players. Null is
 * safe against every existing row.
 */
export async function addWave5CosmeticColumns(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_recap_style_id TEXT`);
  } catch (err) {
    logger.error({ err }, "Failed to add wave-5 cosmetic columns");
  }
}
