/**
 * Migration: Add challenge_key column to player_daily_challenges table
 *
 * player_weekly_challenges already denormalizes challenge_key onto the
 * per-player row "for easier querying" (see lib/db/src/schema/weekly-challenges.ts),
 * and challenge-service.ts's updateDailyProgress() has always queried/inserted
 * player_daily_challenges by challenge_key too — but the daily table's schema
 * never declared the column. Without it, every call to updateDailyProgress()
 * (the function that actually credits daily Card Clash challenge progress after
 * a match) fails and is silently swallowed by its own try/catch, so daily
 * challenges never advance past their initial assignment. This brings the
 * daily table in line with the weekly one so that code path works as intended.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

export async function addDailyChallengeKeyColumn() {
  try {
    await db.execute(sql`
      ALTER TABLE player_daily_challenges
      ADD COLUMN IF NOT EXISTS challenge_key TEXT
    `);
    logger.info("✅ Added challenge_key column to player_daily_challenges");
  } catch (err) {
    logger.error({ err }, "❌ Failed to add challenge_key column to player_daily_challenges");
    throw err;
  }
}
