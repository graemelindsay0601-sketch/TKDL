import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Idempotent ALTER TABLE, same pattern as add_banner_frame_cosmetics.ts.
 * Adds the "currently equipped" column for the new GLOW cosmetic category
 * (a leaderboard row highlight colour — see schema/players.ts and
 * schema/cosmetics.ts). Null means no glow equipped, i.e. the existing
 * default row styling, so this is safe against every existing player row.
 */
export async function addGlowCosmeticColumn(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_glow_id TEXT`);
  } catch (err) {
    logger.error({ err }, "Failed to add glow cosmetic column to players");
  }
}
