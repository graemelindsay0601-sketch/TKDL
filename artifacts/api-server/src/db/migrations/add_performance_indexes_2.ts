import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Performance Critical Indexes (batch 2)
 *
 * - matches(winner_id, played_at) / matches(loser_id, played_at): the
 *   player-roster "recent form" subquery (routes/players.ts) filters
 *   `WHERE winner_id = X OR loser_id = X` and sorts `ORDER BY played_at
 *   DESC`. The existing single-column indexes on winner_id, loser_id and
 *   played_at can each narrow one side of that query, but none of them can
 *   satisfy the sort directly as the table grows - a composite index on
 *   each (winner_id/loser_id, played_at) lets Postgres get pre-sorted rows
 *   for each side of the OR without a separate sort step.
 * - master501_runs(player_id): master501-achievements.ts runs 8 separate
 *   queries against this table, all filtered by player_id, and the table
 *   was created (app.ts) with no index at all on that column.
 */
export async function addPerformanceIndexes2() {
  console.log("📊 Adding performance indexes (batch 2)...");

  // Wrap each index individually so if one fails (missing table), others continue
  // This prevents app crash on missing tables

  const indexes = [
    {
      name: "idx_matches_winner_played_at",
      query: sql`CREATE INDEX IF NOT EXISTS idx_matches_winner_played_at
          ON matches(winner_id, played_at)`,
      description: "matches(winner_id, played_at)",
    },
    {
      name: "idx_matches_loser_played_at",
      query: sql`CREATE INDEX IF NOT EXISTS idx_matches_loser_played_at
          ON matches(loser_id, played_at)`,
      description: "matches(loser_id, played_at)",
    },
    {
      name: "idx_master501_runs_player_id",
      query: sql`CREATE INDEX IF NOT EXISTS idx_master501_runs_player_id
          ON master501_runs(player_id)`,
      description: "master501_runs(player_id)",
    },
  ];

  let successCount = 0;
  let failedIndexes: string[] = [];

  // Process each index separately with individual error handling
  for (const index of indexes) {
    try {
      await db.execute(index.query);
      console.log(`  ✅ Index on ${index.description}`);
      successCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // If table doesn't exist, log and continue (non-critical)
      if (errorMessage.includes("does not exist")) {
        console.log(
          `  ℹ️  Index skipped (table doesn't exist yet): ${index.description}`
        );
        failedIndexes.push(index.description);
      }
      // If index already exists, that's fine
      else if (errorMessage.includes("already exists")) {
        console.log(`  ℹ️  Index already exists: ${index.description}`);
        successCount++;
      }
      // Any other error, log it but don't crash
      else {
        console.warn(
          `  ⚠️  Error creating index on ${index.description}: ${errorMessage}`
        );
        failedIndexes.push(index.description);
      }
    }
  }

  // Report final status
  if (successCount === indexes.length) {
    console.log(
      `✅ All ${successCount} performance indexes (batch 2) added successfully!`
    );
  } else if (successCount > 0) {
    console.log(
      `⚠️  Added ${successCount}/${indexes.length} performance indexes (batch 2)`
    );
    if (failedIndexes.length > 0) {
      console.log(
        `   Skipped ${failedIndexes.length}: ${failedIndexes.join(", ")}`
      );
    }
  } else {
    console.log("⚠️  No performance indexes (batch 2) were created");
  }
}
