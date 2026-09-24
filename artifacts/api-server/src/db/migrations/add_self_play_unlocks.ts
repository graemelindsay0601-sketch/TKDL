import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Creates the two tables behind self-play unlocks (see
 * lib/db/src/schema/self-play-unlocks.ts): a catalog of purchasable
 * solo-play extras (locked "Play a Pro" Shadow Bot personas, a time-limited
 * preview pass covering every locked persona at once, bonus Coach's Corner
 * drills) and each player's purchase record for them. Same two-table shape
 * as the cosmetics tables (add_cosmetics_tables.ts) — a text-slug catalog +
 * an ownership join table — reused across all three unlock types here
 * instead of three near-identical schemas.
 *
 * player_self_play_unlocks.expires_at is only ever set for a Preview Pass
 * purchase; every other row (a permanently-bought persona or the drill
 * bundle) leaves it null. Whether a given unlock is still active is a
 * read-time check (expires_at IS NULL OR expires_at > now()), not enforced
 * by this table.
 */
export async function addSelfPlayUnlocks(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS self_play_unlock_definitions (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        price INTEGER NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        duration_days INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    logger.error({ err }, "Failed to create self_play_unlock_definitions table");
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS player_self_play_unlocks (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        unlock_id TEXT NOT NULL REFERENCES self_play_unlock_definitions(id) ON DELETE CASCADE,
        unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE
      )
    `);
    // A player can only own a given PERMANENT unlock once, but CAN buy
    // multiple Preview Passes over time (each a fresh window) — so this is
    // a plain index, not a unique constraint like player_cosmetics'. The
    // "already owned" check for a permanent unlock is done in the purchase
    // route itself (looks for any existing row for that unlock_id with
    // expires_at IS NULL).
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS player_self_play_unlocks_player_id_idx
      ON player_self_play_unlocks(player_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS player_self_play_unlocks_unlock_id_idx
      ON player_self_play_unlocks(unlock_id)
    `);
    logger.info("self_play_unlock tables ready");
  } catch (err) {
    logger.error({ err }, "Failed to create player_self_play_unlocks table");
  }
}
