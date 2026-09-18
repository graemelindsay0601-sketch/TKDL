import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * player_seasonal_quests had no unique constraint on
 * (player_id, season_number, quest_key) — updateSeasonalProgress
 * (seasonal-quest-service.ts) does a plain read (findFirst) then either
 * INSERT or UPDATE with no transaction and no ON CONFLICT, the same
 * get-or-create race already fixed for daily/weekly challenges and for
 * season_standings (see add_season_standings_unique.ts). It's reachable
 * from real play: routes/matches.ts fires updateSeasonalProgress after every
 * league win. Two wins landing close together (a quick rematch, or a
 * retried request) can both read "no row yet" and both INSERT — leaving two
 * permanently-diverging progress rows for the same quest, since every
 * future update then races on which row findFirst happens to return — or
 * both read the same starting progress and each write N+1 instead of N+2
 * (a lost update). Either race can also double-award the completion coins
 * if it lands on the threshold.
 *
 * De-duplicates existing rows first (keeping the lowest id per
 * player/season/quest, summing their progress into it so no progress a
 * player already earned gets silently dropped, and completed if either
 * duplicate was), since this bug may already have produced real duplicates
 * before today.
 */
export async function addSeasonalQuestsUnique(): Promise<void> {
  try {
    await db.execute(sql`
      WITH ranked AS (
        SELECT id, player_id, season_number, quest_key,
               MIN(id) OVER (PARTITION BY player_id, season_number, quest_key) AS keep_id
        FROM player_seasonal_quests
      ), merged AS (
        SELECT keep_id,
               SUM(progress) AS total_progress,
               BOOL_OR(is_completed) AS any_completed,
               MIN(completed_at) FILTER (WHERE completed_at IS NOT NULL) AS earliest_completed_at
        FROM player_seasonal_quests psq
        JOIN ranked r ON r.id = psq.id
        GROUP BY keep_id
        HAVING COUNT(*) > 1
      )
      UPDATE player_seasonal_quests psq
      SET progress = merged.total_progress,
          is_completed = merged.any_completed,
          completed_at = COALESCE(psq.completed_at, merged.earliest_completed_at),
          updated_at = NOW()
      FROM merged
      WHERE psq.id = merged.keep_id
    `);

    await db.execute(sql`
      DELETE FROM player_seasonal_quests a
      USING player_seasonal_quests b
      WHERE a.player_id = b.player_id
        AND a.season_number = b.season_number
        AND a.quest_key = b.quest_key
        AND a.id > b.id
    `);
  } catch (err) {
    logger.error({ err }, "Failed to de-duplicate player_seasonal_quests before adding its unique index");
    return;
  }

  try {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS psq_player_season_quest_unique
      ON player_seasonal_quests (player_id, season_number, quest_key)
    `);
    logger.info("player_seasonal_quests(player_id, season_number, quest_key) unique index ready");
  } catch (err) {
    logger.error({ err }, "Failed to create psq_player_season_quest_unique");
  }
}
