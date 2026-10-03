/**
 * Push Batch Scheduler
 * Delivers push notifications that were deferred by quiet hours or the
 * daily notification cap (see services/batchingService.ts and
 * flushDuePushNotifications() in services/notificationService.ts).
 *
 * Runs every 5 minutes — good enough for an "arrives around 8:00" promise,
 * same cadence philosophy as coachTipsScheduler.ts/rankSnapshotScheduler.ts
 * elsewhere in this app. A precise per-row timer would be more exact but
 * is unnecessary complexity for a feature whose own UI copy already says
 * "will be sent at 8:00", not "at 8:00:00".
 */

import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";
import { flushDuePushNotifications } from "./notificationService";

const DELIVERED_OUTBOX_RETENTION_DAYS = 30;

/**
 * The outbox is a delivery mechanism, not notification history. Once a push
 * has been sent, the durable notification and analytics rows retain the user-
 * facing and reporting history. Keep a month for diagnosis, then remove only
 * delivered outbox copies; queued and failed deliveries are never pruned.
 */
export async function pruneDeliveredPushOutbox(): Promise<number> {
  const result = await db.execute(sql`
    DELETE FROM pending_push_notifications
    WHERE sent_at IS NOT NULL
      AND sent_at < NOW() - INTERVAL '30 days'
    RETURNING id
  `);
  return result.rows.length;
}

export function initializePushBatchScheduler(): void {
  try {
    const job = cron.schedule("*/5 * * * *", () => {
      flushDuePushNotifications().catch(err => logger.error({ err }, "Push batch flush failed"));
    }, {
      runOnInit: false,
    });

    // Render's free service can be asleep when a queued row becomes due.
    // Flush once on every wake/start instead of making an overdue push wait
    // for the next five-minute cron boundary as well.
    void flushDuePushNotifications().catch(err => logger.error({ err }, "Initial push batch flush failed"));

    const cleanup = cron.schedule("30 3 * * *", () => {
      pruneDeliveredPushOutbox()
        .then(deleted => {
          if (deleted > 0) logger.info({ deleted, retentionDays: DELIVERED_OUTBOX_RETENTION_DAYS }, "Delivered push outbox pruned");
        })
        .catch(err => logger.error({ err }, "Delivered push outbox cleanup failed"));
    }, { runOnInit: false });

    // A sleeping free-tier service may miss the scheduled maintenance window.
    // Running the same bounded cleanup at startup keeps retention reliable.
    void pruneDeliveredPushOutbox()
      .then(deleted => {
        if (deleted > 0) logger.info({ deleted, retentionDays: DELIVERED_OUTBOX_RETENTION_DAYS }, "Delivered push outbox pruned on startup");
      })
      .catch(err => logger.error({ err }, "Initial delivered push outbox cleanup failed"));

    logger.info("Push batch scheduler initialized (every 5 minutes; delivered outbox cleanup daily)");

    // Expose for testing, same convention as coachTipsScheduler.ts's
    // TKDL_testCoachTips.
    (global as any).TKDL_testPushBatchFlush = flushDuePushNotifications;
    void job;
    void cleanup;
  } catch (error) {
    logger.error({ error }, "Failed to initialize push batch scheduler");
  }
}
