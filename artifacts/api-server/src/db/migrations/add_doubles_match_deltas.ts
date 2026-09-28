import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Store what actually moved in a standard Doubles result. `elo_change` is
 * the nominal calculation and can differ from the loser's real movement at
 * the 800 floor, so it is not always sufficient for an exact correction.
 */
export async function addDoublesMatchDeltas(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE doubles_matches
        ADD COLUMN IF NOT EXISTS winner_elo_delta INTEGER,
        ADD COLUMN IF NOT EXISTS loser_elo_delta INTEGER,
        ADD COLUMN IF NOT EXISTS loser_eliminated BOOLEAN
    `);
    logger.info("Doubles match rollback deltas ready");
  } catch (err) {
    logger.error({ err }, "Failed to add Doubles match rollback deltas");
  }
}
