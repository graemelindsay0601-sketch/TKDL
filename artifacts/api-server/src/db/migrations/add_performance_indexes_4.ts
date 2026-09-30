import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/** Indexes for the global recent-activity feeds and notification polling. */
export async function addPerformanceIndexes4() {
  const indexes = [
    sql`CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches(played_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_doubles_matches_played_at ON doubles_matches(played_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_shift_wars_matches_played_at ON shift_wars_matches(played_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_tour_trophies_awarded_at ON tour_trophies(awarded_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_player_achievements_unlocked_at ON player_achievements(unlocked_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_notifications_player_created_at ON notifications(player_id, created_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_notifications_player_unread ON notifications(player_id) WHERE read_at IS NULL`,
  ];

  for (const query of indexes) await db.execute(query);
}
