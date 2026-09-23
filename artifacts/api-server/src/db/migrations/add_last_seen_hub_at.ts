import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Idempotent ALTER TABLE, same pattern as add_equipped_cosmetics.ts /
 * add_last_seen_broadcast_edition.ts. Adds players.last_seen_hub_at (see
 * schema/players.ts) — null just means "never recorded a Hub visit yet",
 * so this is safe to run against every existing player row with no
 * backfill needed.
 */
export async function addLastSeenHubAtColumn(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS last_seen_hub_at TIMESTAMPTZ`);
  } catch (err) {
    logger.error({ err }, "Failed to add last_seen_hub_at column to players");
  }
}
