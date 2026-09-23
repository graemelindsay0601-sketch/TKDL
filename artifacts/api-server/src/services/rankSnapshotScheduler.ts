/**
 * Rank Snapshot Scheduler
 * Records every active player's leaderboard position once a day, so the
 * dashboard/season/stats `positionChange` arrows have something real to
 * diff against (see lib/leaderboardRank.ts's snapshotTodaysRanks() and
 * getPositionChanges(), and db/migrations/add_player_rank_snapshots.ts for
 * the table). Runs just after midnight UTC — late enough that the day's
 * final matches have settled, early enough that everyone sees a fresh
 * "yesterday" baseline by the time they check the app in the morning.
 */

import cron from "node-cron";
import { logger } from "../lib/logger";
import { snapshotTodaysRanks } from "../lib/leaderboardRank";

export function initializeRankSnapshotScheduler(): void {
  try {
    // Cron pattern: 5 0 * * * = Every day at 00:05 UTC
    const job = cron.schedule("5 0 * * *", async () => {
      try {
        const { playerCount } = await snapshotTodaysRanks();
        logger.info(`Daily rank snapshot recorded for ${playerCount} players`);
      } catch (err) {
        logger.error({ err }, "Daily rank snapshot failed");
      }
    }, {
      runOnInit: false, // Don't snapshot at boot — only on the schedule
    });

    logger.info("Rank snapshot scheduler initialized (00:05 UTC daily)");

    // Expose for manual backfill / testing (same pattern as
    // coachTipsScheduler.ts's TKDL_testCoachTips) — a season that just
    // shipped this feature has no history yet, so an admin can call this
    // once to seed today's baseline instead of waiting for the first
    // scheduled run.
    (global as any).TKDL_testRankSnapshot = snapshotTodaysRanks;
  } catch (err) {
    logger.error({ err }, "Failed to initialize rank snapshot scheduler");
  }
}
