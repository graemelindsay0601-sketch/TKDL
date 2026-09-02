/**
 * Migration: Add career_biggest_points_fall column to players
 *
 * The Hall of Fame's "The Collapse" category originally compared each
 * player's CURRENT peakPoints/points -- but both of those reset to 25 every
 * season (see seasonReset.ts), so the record reset itself every month and
 * a true "worst slump ever" was impossible to show. This column is an
 * all-time high-water mark, updated at the moment of every loss (see
 * matches.ts/team-matches.ts) and never reset, so it survives season
 * rollovers the way longest_win_streak and career_peak_elo already do.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

export async function addCareerBiggestPointsFallColumn() {
  try {
    await db.execute(sql`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS career_biggest_points_fall INTEGER NOT NULL DEFAULT 0
    `);
    // One-time seed from whatever this season's in-progress fall already is,
    // so existing players aren't shown as 0 until their next loss -- there's
    // no way to recover past seasons' falls since peakPoints/points were
    // overwritten on every past reset.
    await db.execute(sql`
      UPDATE players
      SET career_biggest_points_fall = GREATEST(0, peak_points - points)
      WHERE GREATEST(0, peak_points - points) > career_biggest_points_fall
    `);
    logger.info("✅ Added career_biggest_points_fall column to players");
  } catch (err) {
    logger.error({ err }, "❌ Failed to add career_biggest_points_fall column to players");
    throw err;
  }
}
