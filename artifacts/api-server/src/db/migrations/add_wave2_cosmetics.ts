import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Idempotent ALTER TABLEs for the second wave of cosmetics (TAGLINE_STYLE,
 * POST_ACCENT, STICKER, CHECKOUT_EFFECT — see schema/cosmetics.ts):
 *   - players.tagline: a short player-entered line, plus the three new
 *     "currently equipped" columns for the colour/tint cosmetics.
 *   - direct_messages.sticker_id: which STICKER cosmetic (if any) a given
 *     DM was sent with — direct_messages itself is a raw-SQL table (see
 *     app.ts's init(), not a drizzle schema file), so this follows that
 *     table's existing raw ALTER TABLE pattern rather than schema/players.ts's.
 * Null/empty is safe against every existing row in both cases.
 */
export async function addWave2CosmeticColumns(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS tagline TEXT`);
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_tagline_style_id TEXT`);
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_post_accent_id TEXT`);
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_checkout_effect_id TEXT`);
    await db.execute(sql`ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS sticker_id TEXT`);
  } catch (err) {
    logger.error({ err }, "Failed to add wave-2 cosmetic columns");
  }
}
