import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

/** Stores exact team-match changes so admin deletion can reverse them. */
export async function addMatchParticipantDeltas() {
  try {
    await db.execute(sql`
      ALTER TABLE match_participants
      ADD COLUMN IF NOT EXISTS points_delta INTEGER,
      ADD COLUMN IF NOT EXISTS elo_delta INTEGER,
      ADD COLUMN IF NOT EXISTS caused_elimination BOOLEAN
    `);
    logger.info("Added exact rollback deltas to match_participants");
  } catch (err) {
    logger.error({ err }, "Failed to add rollback deltas to match_participants");
    throw err;
  }
}
