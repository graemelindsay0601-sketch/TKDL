import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Idempotent ALTER TABLE, same pattern as add_daily_challenge_key.ts /
 * add_favorites.ts / add_last_seen_broadcast_edition.ts. Adds the two
 * "currently equipped cosmetic" columns to players (see schema/players.ts
 * and schema/cosmetics.ts) — null in either column just means that slot
 * has nothing equipped, i.e. the existing default look, so this is safe to
 * run against every existing player row with no backfill needed.
 */
export async function addEquippedCosmeticsColumns(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_name_style_id TEXT`);
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_profile_icon_id TEXT`);
  } catch (err) {
    logger.error({ err }, "Failed to add equipped cosmetics columns to players");
  }
}
