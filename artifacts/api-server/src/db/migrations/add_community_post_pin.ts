import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Admin-pinned posts for Off the Oche (community_posts) — a separate
 * mechanic from the client-side "Top of the board" highlights, which is
 * just a sort of whatever's already loaded by real reaction/comment counts.
 * Pinning is a deliberate admin action (committee announcements, signup
 * sheets) that should stay at the top of the feed regardless of engagement,
 * until an admin unpins it.
 */
export async function addCommunityPostPin(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await db.execute(sql`
      ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP
    `);
    logger.info("community_posts.pinned ready");
  } catch (err) {
    logger.error({ err }, "Failed to add community_posts pin columns");
  }
}
