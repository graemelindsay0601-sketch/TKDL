import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Idempotent ALTER TABLE, same pattern as add_bubble_color_cosmetic.ts.
 * Adds the "currently equipped" columns for two new cosmetic categories:
 *   - AVATAR_BADGE — a small decorative sticker icon pinned to the corner
 *     of a player's avatar square (see schema/players.ts and
 *     schema/cosmetics.ts).
 *   - LEADERBOARD_TAG — a short flair chip shown next to a player's name
 *     on the leaderboard.
 * Null means nothing equipped in that slot, i.e. the existing default
 * look, so this is safe against every existing player row.
 */
export async function addAvatarBadgeLeaderboardTagCosmeticColumns(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_avatar_badge_id TEXT`);
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_leaderboard_tag_id TEXT`);
  } catch (err) {
    logger.error({ err }, "Failed to add avatar badge / leaderboard tag cosmetic columns to players");
  }
}
