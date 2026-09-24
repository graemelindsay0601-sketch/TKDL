import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * community_posts.photo_path stored a GCS object path from
 * lib/objectStorage.ts's presigned-upload flow — which, like the profile-
 * photo and DM-photo columns before this one (see add_player_avatar_image.ts
 * and add_direct_message_photo_image.ts for the full story), calls out to a
 * Replit-only local sidecar that doesn't exist now this app runs on Render.
 * Every community post photo upload has therefore very likely been failing
 * silently in production, same as avatars and DMs were before those got
 * fixed.
 *
 * Same fix: store the (client-resized-before-upload) image directly on the
 * row, serve it through this app's own routes/community.ts, no cloud storage
 * credentials or sidecar involved. photo_path itself is left in place,
 * untouched — old rows that already have one keep it (still broken, exactly
 * as before; not this change's job to fix history), new posts just use these
 * columns instead.
 */
export async function addCommunityPostPhotoImage(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS photo_image BYTEA
    `);
    await db.execute(sql`
      ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS photo_content_type TEXT
    `);
    logger.info("community_posts.photo_image ready");
  } catch (err) {
    logger.error({ err }, "Failed to add community_posts photo columns");
  }
}
