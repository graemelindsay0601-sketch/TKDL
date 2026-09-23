/**
 * Migration: Add last_seen_broadcast_edition_id column to players
 *
 * Backs the "new edition" indicator on the TKDL LIVE nav item (desktop
 * sidebar colour pass) — a small dot that lights up when a broadcast
 * edition has published since this player last opened /tkdl-live. Nullable:
 * a player who has never visited TKDL LIVE has no "last seen" edition yet,
 * which GET /broadcast/live-status treats the same as "there's something
 * new" (as long as a published edition actually exists).
 *
 * No FK to broadcast_editions(id) on purpose — editions aren't deleted in
 * normal operation, but this column is read-only comparison state (never
 * joined against broadcast_editions), so there's nothing an FK protects
 * here that's worth the extra constraint to maintain.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

export async function addLastSeenBroadcastEditionColumn() {
  try {
    await db.execute(sql`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS last_seen_broadcast_edition_id INTEGER
    `);
    logger.info("✅ Added last_seen_broadcast_edition_id column to players");
  } catch (err) {
    logger.error({ err }, "❌ Failed to add last_seen_broadcast_edition_id column to players");
    throw err;
  }
}
