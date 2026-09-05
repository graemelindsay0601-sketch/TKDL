/**
 * Migration: Add was_upset_win column to matches
 *
 * TACTICAL/GENIUS ("win N times as underdog in points") were being decided
 * by checking whether TACTICAL had already been granted before this match —
 * which makes GENIUS (criteriaValue: 3) fire on the 2nd upset win, not the
 * 3rd, since TACTICAL itself is already granted after the 1st. There was no
 * actual per-match "was this an upset win" record to count from, because
 * points-before-match isn't otherwise recoverable later (points are just a
 * running total on the player row, overwritten every match). This column is
 * computed and stored at match-write time (routes/matches.ts) going forward
 * so achievements.ts can count real upset wins instead of inferring the
 * count from grant state.
 *
 * Existing historical matches default to false — there's no way to recover
 * what each player's points were immediately before a past match, the same
 * limitation already accepted elsewhere in this file (see TOP_RANKED_ELIMS
 * in routes/players.ts). Only future matches are correctly flagged.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

export async function addMatchWasUpsetWinColumn() {
  try {
    await db.execute(sql`
      ALTER TABLE matches
      ADD COLUMN IF NOT EXISTS was_upset_win BOOLEAN NOT NULL DEFAULT false
    `);
    logger.info("✅ Added was_upset_win column to matches");
  } catch (err) {
    logger.error({ err }, "❌ Failed to add was_upset_win column to matches");
    throw err;
  }
}
