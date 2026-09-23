import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * One row per player per day — the daily leaderboard-position snapshot that
 * powers the dashboard/season/stats `positionChange` arrows (see
 * services/rankSnapshotScheduler.ts, which writes today's row every night,
 * and lib/leaderboardRank.ts's getPositionChanges(), which diffs a live
 * ranking against the most recent snapshot strictly before today).
 *
 * Deliberately raw SQL rather than a Drizzle schema file, matching this
 * codebase's existing pattern for auxiliary tables like doubles_teams and
 * notification_preferences — the row shape is simple and this avoids a
 * lib/db composite rebuild for what's an internal bookkeeping table, not
 * something the frontend's generated API client needs typed.
 *
 * UNIQUE(player_id, snapshot_date) makes the nightly write idempotent — if
 * the scheduler runs twice in one day (a restart, a manual backfill call),
 * the second write just updates the same row via ON CONFLICT rather than
 * creating a duplicate that would skew the diff.
 */
export async function addPlayerRankSnapshotsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS player_rank_snapshots (
        id SERIAL PRIMARY KEY,
        player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        season_id INT,
        rank INT NOT NULL,
        points INT NOT NULL,
        elo INT NOT NULL,
        snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (player_id, snapshot_date)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_player_rank_snapshots_date ON player_rank_snapshots (snapshot_date)
    `);
  } catch (err) {
    logger.error({ err }, "Failed to create player_rank_snapshots table");
  }
}
