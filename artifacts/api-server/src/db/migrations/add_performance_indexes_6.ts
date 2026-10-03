import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Indexes found during the database-growth audit. These follow the predicates
 * used by the notification cap, practice history and TKDL LIVE result-story
 * queries so those paths do not become slower as their append-only tables
 * grow.
 */
export async function addPerformanceIndexes6() {
  const indexes = [
    sql`CREATE INDEX IF NOT EXISTS idx_notification_analytics_player_sent_at ON notification_analytics(player_id, sent_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_practice_sessions_player1_created_at ON practice_sessions(player1_id, created_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_practice_sessions_player2_created_at ON practice_sessions(player2_id, created_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_pending_push_notifications_sent_at ON pending_push_notifications(sent_at) WHERE sent_at IS NOT NULL`,
    sql`CREATE INDEX IF NOT EXISTS idx_broadcast_editions_status_published_at ON broadcast_editions(status, published_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_broadcast_stories_result_ref ON broadcast_stories ((facts->>'resultRef')) WHERE facts ? 'resultRef'`,
  ];

  for (const query of indexes) await db.execute(query);
}
