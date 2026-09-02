/**
 * Migration: Add longest_loss_streak column to players
 *
 * currentLossStreak was always tracked (reset to 0 on a win, incremented on
 * a loss), but nothing ever recorded the HIGHEST it had ever reached — the
 * loss-streak equivalent of longestWinStreak, which matches.ts and
 * team-matches.ts already max() onto on every win. Without this column
 * there's no way to answer "what's the longest losing streak anyone has
 * ever been on," which the Hall of Fame's new "Wall of Shame" section needs.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

export async function addLongestLossStreakColumn() {
  try {
    await db.execute(sql`
      ALTER TABLE players
      ADD COLUMN IF NOT EXISTS longest_loss_streak INTEGER NOT NULL DEFAULT 0
    `);
    // Backfill from each player's current loss streak so existing active
    // streaks aren't reported as a 0 record until their next loss.
    await db.execute(sql`
      UPDATE players
      SET longest_loss_streak = current_loss_streak
      WHERE current_loss_streak > longest_loss_streak
    `);
    logger.info("✅ Added longest_loss_streak column to players");
  } catch (err) {
    logger.error({ err }, "❌ Failed to add longest_loss_streak column to players");
    throw err;
  }
}
