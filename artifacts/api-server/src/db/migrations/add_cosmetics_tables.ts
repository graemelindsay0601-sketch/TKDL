import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Creates the two tables behind the profile-cosmetics shop (see
 * lib/db/src/schema/cosmetics.ts): a catalog of purchasable name-style /
 * profile-icon cosmetics, and each player's purchase record for them.
 *
 * cosmetic_definitions.id is a stable text slug rather than a serial id —
 * seedCosmeticDefinitions (services/cosmetics-service.ts) upserts by that
 * id on every boot, so the catalog's prices/visuals can be tweaked by
 * editing that seed file and redeploying, without ever needing to
 * delete-and-reseed (which would cascade-delete real players' purchase
 * rows in player_cosmetics — see ON DELETE CASCADE below).
 */
export async function addCosmeticsTables(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cosmetic_definitions (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        rarity TEXT NOT NULL DEFAULT 'COMMON',
        price INTEGER NOT NULL,
        color TEXT,
        gradient TEXT,
        glow TEXT,
        icon_key TEXT,
        enabled BOOLEAN NOT NULL DEFAULT true,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    logger.error({ err }, "Failed to create cosmetic_definitions table");
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS player_cosmetics (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        cosmetic_id TEXT NOT NULL REFERENCES cosmetic_definitions(id) ON DELETE CASCADE,
        purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Guards both the purchase route's "already owned" check and the
    // underlying data — a player should never be able to own the same
    // cosmetic twice.
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS player_cosmetics_player_id_cosmetic_id_key
      ON player_cosmetics(player_id, cosmetic_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS player_cosmetics_player_id_idx
      ON player_cosmetics(player_id)
    `);
  } catch (err) {
    logger.error({ err }, "Failed to create player_cosmetics table");
  }
}
