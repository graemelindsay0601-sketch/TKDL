import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * A player's avatar today is always the same fixed profile-icon cosmetic
 * (lib/cosmetics.ts's PROFILE_ICON_MAP) — there's no way to show a real
 * photo next to your name. This adds storage for one, deliberately as raw
 * bytes straight in this table rather than through lib/objectStorage.ts:
 * that service always calls out to a Replit-only local sidecar
 * (REPLIT_SIDECAR_ENDPOINT, "make sure you're running on Replit" in its own
 * error message) to sign upload/download URLs, and this app now runs on
 * Render (render.yaml) — nothing on Render listens on that sidecar's port,
 * so every call through that path fails. It's already relied on for DM
 * photo attachments and community photo posts, so those are almost
 * certainly failing in production today too, but that's a separate,
 * pre-existing problem from before this change — not something to build a
 * brand new feature on top of. A small (client-resized-before-upload)
 * avatar image stored directly in Postgres and served through this app's
 * own routes needs no cloud storage credentials, no sidecar, nothing beyond
 * what's already running.
 */
export async function addPlayerAvatarImage(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_image BYTEA
    `);
    await db.execute(sql`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_content_type TEXT
    `);
    await db.execute(sql`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ
    `);
    logger.info("players.avatar_image ready");
  } catch (err) {
    logger.error({ err }, "Failed to add players avatar columns");
  }
}
