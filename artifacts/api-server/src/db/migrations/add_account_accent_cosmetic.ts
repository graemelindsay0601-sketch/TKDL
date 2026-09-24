import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Idempotent ALTER TABLE, same pattern as add_glow_cosmetic.ts. Adds the
 * "currently equipped" column for the new ACCOUNT_ACCENT cosmetic category
 * (a swatch colour scoped only to a player's own account page — see
 * schema/cosmetics.ts and schema/players.ts). Null means no accent
 * equipped, i.e. the existing default look, so this is safe against every
 * existing player row.
 */
export async function addAccountAccentCosmeticColumn(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS equipped_account_accent_id TEXT`);
  } catch (err) {
    logger.error({ err }, "Failed to add account accent cosmetic column to players");
  }
}
