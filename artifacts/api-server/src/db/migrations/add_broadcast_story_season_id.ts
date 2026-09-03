import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Migration: give broadcast_stories a real `season_id` column.
 *
 * story-engine.ts's own upsertStoryCandidate() has always taken a
 * `seasonId` parameter and used it to build a season-anchored storyKey
 * (LEAGUE/SHIFT_WARS/SEASON_COMPARISON — see story-engine-math.ts's
 * seasonAnchoredStoryKey) — but the value itself was never actually
 * written to a column, only folded into that key string. That meant there
 * was no way to ask "every real story from season X" directly; you'd have
 * to re-derive it from anchorMatchId or detectedAt after the fact, which
 * is exactly what a real user report ("not covering... any of the matches
 * from the league at all") ran into: nothing could pull back a closed
 * season's own real storylines for a proper recap, because nothing had
 * ever recorded which season each story belonged to.
 *
 * Idempotent ALTER TABLE ADD COLUMN IF NOT EXISTS, same pattern as every
 * other hand-rolled-SQL migration in this app (see add_season_league_type.ts,
 * add_tkdl_live_broadcast.ts) rather than a formal drizzle-kit migration.
 * Nullable and un-backfilled on purpose: every row that already exists in
 * production was written before this column existed, so there's no
 * reliable value to backfill it WITH — story-engine.ts's own
 * collectSeasonHighlights() falls back to a detection-window match
 * (detectedAt inside the season's own date range) for exactly those older
 * rows, so this migration doesn't need one.
 */
export async function addBroadcastStorySeasonId() {
  try {
    await db.execute(sql`
      ALTER TABLE broadcast_stories ADD COLUMN IF NOT EXISTS season_id INTEGER
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS broadcast_stories_season_id_idx ON broadcast_stories(season_id)
    `);
    logger.info("broadcast_stories.season_id column ready");
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to add broadcast_stories.season_id column");
    throw err;
  }
}
