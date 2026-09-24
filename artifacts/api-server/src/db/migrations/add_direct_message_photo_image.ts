import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * direct_messages.photo_path stored a GCS object path from
 * lib/objectStorage.ts's presigned-upload flow — which, like this app's
 * other object-storage usage, calls out to a Replit-only local sidecar
 * (see db/migrations/add_player_avatar_image.ts's header for the full
 * story) that doesn't exist now this app runs on Render. Every DM photo
 * send has therefore very likely been failing silently in production.
 *
 * Same fix as the profile-photo column: store the (client-resized-before-
 * upload) image directly on the row, serve it through this app's own
 * routes/messages.ts, no cloud storage credentials or sidecar involved.
 * photo_path itself is left in place, untouched — old rows that already
 * have one keep it (still broken, exactly as before; not this change's
 * job to fix history), new sends just use these columns instead.
 */
export async function addDirectMessagePhotoImage(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS photo_image BYTEA
    `);
    await db.execute(sql`
      ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS photo_content_type TEXT
    `);
    logger.info("direct_messages.photo_image ready");
  } catch (err) {
    logger.error({ err }, "Failed to add direct_messages photo columns");
  }
}
