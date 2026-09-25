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
import { logger } from "../lib/logger";
import { flushDuePushNotifications } from "./notificationService";

export function initializePushBatchScheduler(): void {
  try {
    const job = cron.schedule("*/5 * * * *", () => {
      flushDuePushNotifications().catch(err => logger.error({ err }, "Push batch flush failed"));
    }, {
      runOnInit: false, // Don't fire immediately on boot — matches coachTipsScheduler.ts's posture
    });

    logger.info("Push batch scheduler initialized (every 5 minutes)");

    // Expose for testing, same convention as coachTipsScheduler.ts's
    // TKDL_testCoachTips.
    (global as any).TKDL_testPushBatchFlush = flushDuePushNotifications;
    void job;
  } catch (error) {
    logger.error({ error }, "Failed to initialize push batch scheduler");
  }
}
