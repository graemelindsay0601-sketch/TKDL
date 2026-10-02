import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * admin_announcements.admin_id was created NOT NULL REFERENCES players(id)
 * (see notificationsMigration.ts), on the assumption that sending an
 * announcement is an action taken "as" a specific player. It isn't: admin
 * access throughout this app is PIN-only (requireAdminSession, set by
 * POST /admin/verify-pin) and was never tied to a player login, so there is
 * no real player id to attribute an announcement to.
 *
 * The route ended up hardcoding a guessed constant (`CREATE_ANNOUNCEMENT_ADMIN_ID
 * = 1`) to satisfy the NOT NULL + FK, which meant every POST /admin/announcements
 * call threw a foreign-key violation (and the whole feature failed before a
 * single player notification was created) whenever player id 1 didn't exist
 * or had been reassigned. Nothing reads admin_id back — no admin UI shows
 * "sent by X" — so it's write-only metadata, and relaxing it to nullable is
 * the correct fix rather than guessing a better constant.
 */
export async function relaxAdminAnnouncementsAdminId(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE admin_announcements ALTER COLUMN admin_id DROP NOT NULL`);
    logger.info("admin_announcements.admin_id relaxed to nullable");
  } catch (err) {
    logger.error({ err }, "Failed to relax admin_announcements.admin_id");
  }
}
