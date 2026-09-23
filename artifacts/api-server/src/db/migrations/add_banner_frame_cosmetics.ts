import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Idempotent ALTER TABLE, same pattern as add_equipped_cosmetics.ts. Adds
 * the two "currently equipped" columns for the new BANNER and FRAME
 * cosmetic categories (see schema/players.ts and schema/cosmetics.ts).
 * Null in either column just means that slot has nothing equipped, i.e.
 * the existing default look, so this is safe to run against every
 * existing player row with no backfill needed.
 */
export async function addBannerFrameCosmeticColumns(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_banner_id TEXT`);
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_frame_id TEXT`);
  } catch (err) {
    logger.error({ err }, "Failed to add banner/frame cosmetic columns to players");
  }
}
