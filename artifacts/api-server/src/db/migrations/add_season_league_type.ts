import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Migration: split the single shared "active season" into one independent
 * lifecycle per league (Singles, Doubles, Shift Wars).
 *
 * Before this, all three leagues piggybacked on one `seasons` row via
 * `is_active` — a single reset event closed and reopened all three
 * together. That's exactly how Doubles and Shift Wars, added on the last
 * day of August, got dragged into an "August season" they never actually
 * played a game in: they simply inherited whatever singles season boundary
 * happened to be active when they were switched on.
 *
 * This adds a `league_type` column (default 'singles', so every season row
 * that already exists — all of singles' history — keeps behaving exactly
 * as before) and a partial unique index guaranteeing at most one active
 * season per league, then does a one-time cutover: give Doubles and Shift
 * Wars their own fresh season starting today, re-parenting Doubles' current
 * (already-correct, 0–0) team roster onto it rather than re-drawing, and
 * deletes the bogus Shift Wars "August champion" history snapshot — a
 * record where nobody actually won anything because nobody played.
 */
export async function addSeasonLeagueType() {
  try {
    await db.execute(sql`
      ALTER TABLE seasons ADD COLUMN IF NOT EXISTS league_type TEXT NOT NULL DEFAULT 'singles'
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_one_active_per_league
      ON seasons(league_type) WHERE is_active = true
    `);

    // One-time cutover — only runs if Doubles/Shift Wars don't have their
    // own season yet, so this never re-fires or disturbs a later admin
    // reset of either league.
    const [existingDoubles] = (await db.execute(
      sql`SELECT id FROM seasons WHERE league_type = 'doubles' LIMIT 1`
    )).rows as { id: number }[];

    if (!existingDoubles) {
      const [singlesActive] = (await db.execute(
        sql`SELECT id, name FROM seasons WHERE league_type = 'singles' AND is_active = true LIMIT 1`
      )).rows as { id: number; name: string }[];

      const [newDoublesSeason] = (await db.execute(sql`
        INSERT INTO seasons (name, start_date, is_active, league_type)
        VALUES (${singlesActive?.name ?? "Season 1"}, CURRENT_DATE, true, 'doubles')
        RETURNING id
      `)).rows as { id: number }[];

      if (singlesActive) {
        // Doubles' current roster was drawn fresh for the singles season it
        // was mistakenly tied to and has 0 wins/losses either way — moving
        // it to its own season preserves the actual teams instead of
        // forcing a redraw.
        await db.execute(sql`
          UPDATE doubles_teams SET season_id = ${newDoublesSeason.id} WHERE season_id = ${singlesActive.id}
        `);
      }
      logger.info({ seasonId: newDoublesSeason.id }, "Doubles Event given its own independent season");
    }

    const [existingShiftWars] = (await db.execute(
      sql`SELECT id FROM seasons WHERE league_type = 'shift_wars' LIMIT 1`
    )).rows as { id: number }[];

    if (!existingShiftWars) {
      const [singlesActive] = (await db.execute(
        sql`SELECT name FROM seasons WHERE league_type = 'singles' AND is_active = true LIMIT 1`
      )).rows as { name: string }[];

      const [newShiftWarsSeason] = (await db.execute(sql`
        INSERT INTO seasons (name, start_date, is_active, league_type)
        VALUES (${singlesActive?.name ?? "Season 1"}, CURRENT_DATE, true, 'shift_wars')
        RETURNING id
      `)).rows as { id: number }[];
      logger.info({ seasonId: newShiftWarsSeason.id }, "Shift Wars given its own independent season");
    }

    // Delete any Shift Wars season-history snapshot where literally nobody
    // won or lost a game — that's not a completed season, it's a reset
    // firing before a single match was played (exactly what happened in
    // August). A real season always has at least one recorded win/loss
    // across the 3 teams, so this can never touch a genuine result.
    const deleted = await db.execute(sql`
      DELETE FROM shift_wars_season_history
      WHERE season_id IN (
        SELECT season_id FROM shift_wars_season_history
        GROUP BY season_id
        HAVING SUM(wins) = 0 AND SUM(losses) = 0
      )
    `);
    if ((deleted.rowCount ?? 0) > 0) {
      logger.info({ rows: deleted.rowCount }, "Removed Shift Wars season-history snapshot(s) with zero games played");
    }

    logger.info("Season league_type column + per-league cutover ready");
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to add season league_type / run per-league cutover");
    throw err;
  }
}
