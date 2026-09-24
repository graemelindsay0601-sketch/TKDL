import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Off the Oche's "save this post" feature — a plain per-player bookmark on a
 * community post, private (never shown to anyone but the bookmarking player,
 * unlike reactions/comments which are public). Deliberately raw SQL rather
 * than a Drizzle schema file, matching this codebase's existing pattern for
 * auxiliary tables (see player_rank_snapshots) and community_posts/
 * post_reactions/post_comments themselves, which this table sits alongside.
 *
 * UNIQUE(post_id, player_id) makes bookmarking idempotent and backs a plain
 * ON CONFLICT DO NOTHING / DELETE toggle in routes/community.ts, the same
 * race-free single-statement pattern already used for post_reactions.
 */
export async function addCommunityPostBookmarks(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS post_bookmarks (
        id SERIAL PRIMARY KEY,
        post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (post_id, player_id)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_post_bookmarks_player_id ON post_bookmarks (player_id)
    `);
    logger.info("post_bookmarks table ready");
  } catch (err) {
    logger.error({ err }, "Failed to create post_bookmarks table");
  }
}
