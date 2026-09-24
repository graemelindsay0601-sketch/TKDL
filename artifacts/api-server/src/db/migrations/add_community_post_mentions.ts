import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

// Backs Off the Oche's @mentions — a post's resolved mention targets,
// written once at create/edit time (see resolveMentions() in
// routes/community.ts) rather than re-parsed from the post text on every
// read. NOT NULL DEFAULT '{}' so every existing row (and any INSERT that
// forgets the column) reads back as an empty array rather than NULL,
// which keeps the ANY(cp.mentioned_player_ids) lookup in GET
// /community/posts simple.
export async function addCommunityPostMentions(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS mentioned_player_ids INTEGER[] NOT NULL DEFAULT '{}'
    `);
    logger.info("community_posts.mentioned_player_ids ready");
  } catch (err) {
    logger.error({ err }, "Failed to add community_posts.mentioned_player_ids");
  }
}
