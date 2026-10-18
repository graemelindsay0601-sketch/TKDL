import cron from "node-cron";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";
import { createNotification } from "./notificationService";
import { findCareerReminders } from "../career/reminders";

/** Once a day, remind players about a Career they've left with something waiting in it (see career/reminders.ts). */
export async function sendCareerReminders(): Promise<number> {
  const reminders = await db.transaction(tx => findCareerReminders(tx as never));
  let sent = 0;
  for (const r of reminders) {
    try {
      await createNotification({ playerId: r.playerId, type: "career_reminder", title: r.title, body: r.body, data: { url: r.url, saveId: r.saveId }, dedupeKey: r.dedupeKey });
      sent++;
    } catch (error) { logger.error({ error, saveId: r.saveId }, "Career reminder failed"); }
  }
  if (sent) logger.info({ sent }, "Career reminders sent");
  return sent;
}

export function initializeCareerReminderScheduler(): void {
  try {
    // 17:40 UTC daily: early evening in the UK, when most people play.
    cron.schedule("40 17 * * *", () => { void sendCareerReminders().catch(error => logger.error({ error }, "Career reminders run failed")); }, { runOnInit: false });
    logger.info("Career reminder scheduler initialized (daily at 17:40 UTC)");
  } catch (error) {
    logger.error({ error }, "Failed to initialize career reminder scheduler");
  }
}
