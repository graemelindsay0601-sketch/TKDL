import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Fixes a real bug in the Phase 7 notification-batching system
 * (services/batchingService.ts): checkBatchingRules() tells the caller a
 * quiet-hours or daily-limit-deferred push "will be sent at 8:00", and
 * computes a real delay for that, but queueNotificationForBatching() —
 * the function meant to act on that delay — was a stub that only logged
 * and did nothing. The push was silently dropped forever, not deferred as
 * documented. (The in-app notification row itself was never affected —
 * that insert happens before the batching check runs — only the push
 * delivery was lost.)
 *
 * This table is what queueNotificationForBatching() now actually writes
 * to, and what the new push-batch scheduler (services/
 * pushBatchScheduler.ts) polls to deliver the deferred push once its
 * send_after time arrives.
 */
export async function addPendingPushNotifications(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pending_push_notifications (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        send_after TIMESTAMP WITH TIME ZONE NOT NULL,
        sent_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);
    // Partial index — the scheduler only ever queries the unsent, due rows,
    // and that set stays small (most rows flip to sent_at within minutes of
    // their send_after time), so this stays cheap even as the full table
    // grows with history.
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS pending_push_notifications_due_idx
      ON pending_push_notifications(send_after)
      WHERE sent_at IS NULL
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS pending_push_notifications_player_id_idx
      ON pending_push_notifications(player_id)
    `);
    logger.info("pending_push_notifications table ready");
  } catch (err) {
    logger.error({ err }, "Failed to create pending_push_notifications table");
  }
}
