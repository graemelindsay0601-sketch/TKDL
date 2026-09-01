import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Migration: let seasonal achievements (Season MVP, Climber, Most Active,
 * etc.) be earned again each season instead of only ever once per player.
 *
 * Before this, player_achievements had a single unique(player_id,
 * achievement_id) constraint, so even an achievement whose own definition
 * says "Seasonal" could only ever be granted one time in a player's life —
 * winning Season MVP again next season did nothing, because the row from
 * the first win already occupied that slot.
 *
 * Adding a season_id column (default 0, meaning "lifetime/one-time" — the
 * vast majority of achievements) and widening the unique constraint to
 * (player_id, achievement_id, season_id) lets a genuinely repeatable
 * seasonal achievement get a fresh row per season, while every existing
 * lifetime achievement keeps behaving exactly as before (they're always
 * granted with season_id=0, so the old "only once ever" rule still holds
 * for them). Every row that already exists gets season_id=0 automatically
 * via the column default — nobody's existing achievements move or change.
 */
export async function addAchievementSeasonColumn() {
  try {
    console.log("[MIGRATION] Adding season_id column to player_achievements...");

    await db.execute(sql`
      ALTER TABLE player_achievements
      ADD COLUMN IF NOT EXISTS season_id INTEGER NOT NULL DEFAULT 0
    `);

    // Drop the old 2-column unique constraint/index if present, under either
    // name it may have been created with historically, then create the new
    // 3-column one. onConflictDoNothing() in grantIfNotHas() targets no
    // specific constraint, so it works against whichever unique index
    // exists — as long as exactly one covers the right columns.
    await db.execute(sql`DROP INDEX IF EXISTS idx_player_achievements_unique`);
    await db.execute(sql`DROP INDEX IF EXISTS pa_player_achievement_unique`);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_player_achievements_unique_seasonal
      ON player_achievements(player_id, achievement_id, season_id)
    `);

    console.log("[MIGRATION] player_achievements season_id column + index ready");
    return true;
  } catch (err) {
    console.error("[MIGRATION ERROR] Failed to add player_achievements season_id column:", err);
    throw err;
  }
}
