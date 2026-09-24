import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Off the Oche's "I'm in" RSVP — a simple one-directional signup (no maybe/
 * no), restricted client- and server-side to pinned posts (see the
 * eligibility check in POST /community/posts/:id/rsvp), since pinning is
 * already this app's "this is a real announcement, not just a post"
 * mechanic (see add_community_post_pin.ts's header comment). Deliberately
 * raw SQL rather than a Drizzle schema file, matching this codebase's
 * existing pattern for auxiliary community tables (post_bookmarks,
 * player_rank_snapshots).
 *
 * UNIQUE(post_id, player_id) makes RSVPing idempotent and backs the same
 * race-free single-statement toggle already used for post_reactions and
 * post_bookmarks.
 */
export async function addCommunityPostRsvps(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS post_rsvps (
        id SERIAL PRIMARY KEY,
        post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (post_id, player_id)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_post_rsvps_post_id ON post_rsvps (post_id)
    `);
    logger.info("post_rsvps table ready");
  } catch (err) {
    logger.error({ err }, "Failed to create post_rsvps table");
  }
}
