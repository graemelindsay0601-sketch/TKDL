import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/** Give Shift Wars results durable season ownership instead of re-deriving it
 * from a date window each time. Columns remain nullable for unmatched legacy
 * rows; every new write supplies the active Shift Wars season. */
export async function addShiftWarsMatchSeason(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE shift_wars_matches ADD COLUMN IF NOT EXISTS season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE`);
    await db.execute(sql`ALTER TABLE shift_wars_combined_matches ADD COLUMN IF NOT EXISTS season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE`);
    await db.execute(sql`
      UPDATE shift_wars_matches m SET season_id = (
        SELECT s.id FROM seasons s
        WHERE s.league_type = 'shift_wars'
          AND m.played_at::date >= s.start_date
          AND (s.end_date IS NULL OR m.played_at::date <= s.end_date)
        ORDER BY s.start_date DESC, s.id DESC LIMIT 1
      ) WHERE m.season_id IS NULL
    `);
    await db.execute(sql`
      UPDATE shift_wars_combined_matches m SET season_id = (
        SELECT s.id FROM seasons s
        WHERE s.league_type = 'shift_wars'
          AND m.played_at::date >= s.start_date
          AND (s.end_date IS NULL OR m.played_at::date <= s.end_date)
        ORDER BY s.start_date DESC, s.id DESC LIMIT 1
      ) WHERE m.season_id IS NULL
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shift_wars_matches_season_id ON shift_wars_matches(season_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shift_wars_combined_matches_season_id ON shift_wars_combined_matches(season_id)`);
    logger.info("Shift Wars match season ownership ready");
  } catch (err) {
    logger.error({ err }, "Failed to add Shift Wars match season ownership");
  }
}
