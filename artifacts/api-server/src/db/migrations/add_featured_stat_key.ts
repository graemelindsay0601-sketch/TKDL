import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Idempotent ALTER TABLE. Adds players.featured_stat_key (see
 * schema/players.ts) — the Featured Stat Spotlight, a free profile
 * customization independent of the coin-cosmetics wave. Null means nothing
 * featured, safe against every existing row.
 */
export async function addFeaturedStatKeyColumn(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS featured_stat_key TEXT`);
  } catch (err) {
    logger.error({ err }, "Failed to add featured_stat_key column to players");
  }
}
