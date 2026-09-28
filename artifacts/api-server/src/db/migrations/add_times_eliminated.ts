import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

/**
 * Adds a truthful counter for eliminations suffered. Historical matches do
 * not record whether the loser actually reached zero, so this deliberately
 * starts at zero and records exact events from this deployment onward.
 */
export async function addTimesEliminatedColumn() {
  try {
    await db.execute(sql`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS times_eliminated INTEGER NOT NULL DEFAULT 0
    `);
    logger.info("Added times_eliminated column to players");
  } catch (err) {
    logger.error({ err }, "Failed to add times_eliminated column to players");
    throw err;
  }
}
