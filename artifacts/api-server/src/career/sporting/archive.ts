import { sql } from "drizzle-orm";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { ensureRankingArchive } from "../../db/migrations/create_career_sporting.ts";
import { ensureCareerMaintenance } from "../../db/migrations/create_career_world.ts";

/**
 * Ranking history: every list publishes its whole table each week there are results, so a long career would keep
 * tens of thousands of rows a season, forever. Weekly tables are kept in full for the current season and the two
 * before it (news looks back that far for upsets: both players' ranks just before the match). Older seasons keep
 * what the screens read: the human's rank every week, the top 8 every week (#1s, "recently top 8"), the full table at
 * the start of the season and the end of every four weeks, each participant's best rank of the season (career highs,
 * best-ever rankings), and a per-season summary of best, worst and weeks ranked (ranking history).
 */
export const FULL_RANKING_SEASONS = 3;
const KEEP_TOP = 8, BLOCK_WEEKS = 4;

/** Thin one finished season's weekly ranking tables (once; a later call does nothing). */
export async function archiveRankingSeason(tx: CareerExecutor, saveId: string, season: number): Promise<number> {
  if ((await tx.execute(sql`SELECT 1 FROM career_ranking_archives WHERE career_save_id = ${saveId} AND season = ${season}`)).rows.length) return 0;
  await tx.execute(sql`INSERT INTO career_ranking_season_summaries (career_save_id, list_key, participant_key, season, best, worst, snapshots)
    SELECT ${saveId}::uuid, list_key, participant_key, season, MIN(position), MAX(position), COUNT(*)
    FROM career_ranking_snapshot_rows WHERE career_save_id = ${saveId} AND season = ${season}
    GROUP BY list_key, participant_key, season ON CONFLICT DO NOTHING`);
  const removed = (await tx.execute(sql`WITH snaps AS (
      SELECT id, row_number() OVER (PARTITION BY list_key, (week - 1) / ${BLOCK_WEEKS} ORDER BY week DESC, sequence DESC) AS last_in_block,
        row_number() OVER (PARTITION BY list_key ORDER BY week, sequence) AS first_in_season
      FROM career_ranking_snapshots WHERE career_save_id = ${saveId} AND season = ${season}),
    kept AS (SELECT id FROM snaps WHERE last_in_block = 1 OR first_in_season = 1),
    best AS (SELECT DISTINCT ON (list_key, participant_key) snapshot_id, participant_key FROM career_ranking_snapshot_rows
      WHERE career_save_id = ${saveId} AND season = ${season} ORDER BY list_key, participant_key, position, publication_index)
    DELETE FROM career_ranking_snapshot_rows r WHERE r.career_save_id = ${saveId} AND r.season = ${season}
      AND r.participant_key <> 'HUMAN' AND r.position > ${KEEP_TOP}
      AND r.snapshot_id NOT IN (SELECT id FROM kept)
      AND NOT EXISTS (SELECT 1 FROM best b WHERE b.snapshot_id = r.snapshot_id AND b.participant_key = r.participant_key)
    RETURNING 1`)).rows.length;
  await tx.execute(sql`INSERT INTO career_ranking_archives (career_save_id, season) VALUES (${saveId}, ${season}) ON CONFLICT DO NOTHING`);
  return removed;
}

/** Seasons of this save that are old enough to thin and have not been yet. */
export async function seasonsToArchive(tx: CareerExecutor, saveId: string, currentSeason: number): Promise<number[]> {
  return (await tx.execute(sql`SELECT DISTINCT s.season FROM career_ranking_snapshots s WHERE s.career_save_id = ${saveId}
    AND s.season <= ${currentSeason - FULL_RANKING_SEASONS}
    AND NOT EXISTS (SELECT 1 FROM career_ranking_archives a WHERE a.career_save_id = s.career_save_id AND a.season = s.season) ORDER BY s.season`))
    .rows.map(r => Number(r.season));
}

const DONE_KEY = "archive-ranking-history-v1";
/**
 * Careers that were already long when the archive arrived: thin their old seasons after startup, one season per short
 * transaction so play carries on meanwhile, then record that it is done. From then on each new season thins the
 * season that has just fallen out of the full window (sporting onCalendarMoved).
 */
export async function archiveExistingRankingHistory(database: CareerDatabase, options: { pauseMs?: number } = {}): Promise<number> {
  const pauseMs = options.pauseMs ?? 200;
  await database.transaction(async tx => { await ensureCareerMaintenance(tx); await ensureRankingArchive(tx); });
  if ((await database.execute(sql`SELECT 1 FROM career_maintenance WHERE key = ${DONE_KEY}`)).rows.length) return 0;
  let removed = 0;
  const saves = (await database.execute(sql`SELECT id, current_season FROM career_saves`)).rows;
  for (const save of saves) {
    const id = String(save.id);
    for (const season of await database.transaction(tx => seasonsToArchive(tx, id, Number(save.current_season)))) {
      removed += await database.transaction(tx => archiveRankingSeason(tx, id, season));
      if (pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs));
    }
  }
  await database.execute(sql`INSERT INTO career_maintenance (key) VALUES (${DONE_KEY}) ON CONFLICT DO NOTHING`);
  return removed;
}
