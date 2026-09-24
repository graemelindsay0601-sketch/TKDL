import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Off the Oche's lightweight polls — deliberately built as a new
 * community_posts.post_type ('poll') rather than a separate feed/entity, so
 * a poll gets everything a normal post already has for free: it shows in
 * the feed, can be pinned, commented on, reacted to, deleted by an admin
 * (which cascades to these two tables), and found by search — see
 * routes/community.ts's POST /community/polls and the poll_options/
 * poll_my_vote fields added to GET /community/posts.
 *
 * Admin-only creation for now (see POST /community/polls) — this is meant
 * for organizer questions ("next friendly night?"), not a general per-post
 * feature, so it's scoped the same way pinning and the auto-post trigger
 * already are in this file.
 *
 * community_poll_options.sort_order is set at creation time and never
 * reordered — options aren't editable/addable after a poll exists, keeping
 * this genuinely "lightweight" rather than growing into a full poll editor.
 *
 * community_poll_votes.UNIQUE(post_id, player_id) is one vote per player
 * per poll (not per option) — a player can change their vote by voting
 * again (see the ON CONFLICT upsert in POST /community/posts/:id/vote),
 * but can never hold two simultaneous votes on the same poll.
 */
export async function addCommunityPolls(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS community_poll_options (
        id SERIAL PRIMARY KEY,
        post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_community_poll_options_post_id ON community_poll_options (post_id)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS community_poll_votes (
        id SERIAL PRIMARY KEY,
        post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        option_id INT NOT NULL REFERENCES community_poll_options(id) ON DELETE CASCADE,
        player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (post_id, player_id)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_community_poll_votes_option_id ON community_poll_votes (option_id)
    `);
    logger.info("community_poll_options / community_poll_votes tables ready");
  } catch (err) {
    logger.error({ err }, "Failed to create community poll tables");
  }
}
