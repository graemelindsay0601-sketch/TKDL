import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * player_weekly_challenges.week_number (an ISO week number, 1-53) had no
 * accompanying year, so it collides across calendar years — week 12 of 2026
 * and week 12 of 2027 are both stored as just "12", indistinguishable to any
 * query that only filters on week_number. challenge-manager.ts's atomic
 * progress UPDATE (see its own date/week-scoping fix) filters on
 * `week_number = <this week>` alone, so a stale, never-completed row from
 * the SAME week number a year ago could still match and get silently
 * completed/paid out by an unrelated win today. This adds the missing
 * `week_year` column (see the schema comment in weekly-challenges.ts) and
 * backfills it for existing rows using each row's created_at — the best
 * available proxy for "which week this row was actually for", computed with
 * Postgres's native ISOYEAR extract so it matches lib/iso-week.ts's
 * getIsoWeekYear() algorithm exactly (both implement the same ISO-8601
 * week-year definition).
 */
export async function addWeeklyChallengeYear(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE player_weekly_challenges ADD COLUMN IF NOT EXISTS week_year INTEGER
    `);
  } catch (err) {
    logger.error({ err }, "Failed to add player_weekly_challenges.week_year column");
    return;
  }

  try {
    await db.execute(sql`
      UPDATE player_weekly_challenges
      SET week_year = EXTRACT(ISOYEAR FROM created_at)::int
      WHERE week_year IS NULL
    `);
    logger.info("player_weekly_challenges.week_year backfilled");
  } catch (err) {
    logger.error({ err }, "Failed to backfill player_weekly_challenges.week_year");
    return;
  }

  try {
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS pwc_player_week_year_idx
      ON player_weekly_challenges (player_id, week_year, week_number)
    `);
    logger.info("player_weekly_challenges(player_id, week_year, week_number) index ready");
  } catch (err) {
    logger.error({ err }, "Failed to create pwc_player_week_year_idx");
  }
}
