import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * season_standings had no unique constraint on (season_id, player_id) —
 * lib/seasonReset.ts's standings-snapshot loop (one INSERT per player,
 * looped, not batched or guarded) could duplicate every player's row if the
 * same season reset ever ran twice, which nothing previously prevented (see
 * seasonReset.ts's own new concurrency-lock comment). This adds the missing
 * constraint so the snapshot INSERT can use ON CONFLICT DO NOTHING as a real
 * guard, not just rely on the lock never being raced.
 *
 * De-duplicates existing rows first (keeping the lowest id — the original
 * snapshot — per season_id/player_id pair), since this bug may already have
 * produced real duplicates before today; otherwise CREATE UNIQUE INDEX would
 * simply fail and get skipped by the try/catch below, leaving the fix
 * incomplete.
 */
export async function addSeasonStandingsUnique(): Promise<void> {
  try {
    await db.execute(sql`
      DELETE FROM season_standings a
      USING season_standings b
      WHERE a.season_id = b.season_id
        AND a.player_id = b.player_id
        AND a.id > b.id
    `);
  } catch (err) {
    logger.error({ err }, "Failed to de-duplicate season_standings before adding its unique index");
    return;
  }

  try {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS ss_season_player_unique
      ON season_standings (season_id, player_id)
    `);
    logger.info("season_standings(season_id, player_id) unique index ready");
  } catch (err) {
    logger.error({ err }, "Failed to create ss_season_player_unique");
  }
}
