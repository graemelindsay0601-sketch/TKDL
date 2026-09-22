import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Performance Critical Indexes (batch 3) — community/messaging tables
 *
 * community_posts, post_comments and direct_messages (app.ts's
 * seedCommunityTables) were created with no indexes at all beyond their
 * primary keys, unlike every other hot table in the app (see
 * add_performance_indexes / _2 and notificationsMigration.ts). Fine at the
 * league's current size, but every one of these becomes a full table scan
 * once there are enough posts/messages for it to matter:
 *
 * - community_posts(status, created_at): GET /community/posts and
 *   /community/posts/pending both filter on status and sort by created_at
 *   (DESC for the feed, ASC for the pending queue) — one composite index
 *   serves the filter and the sort together instead of scanning every post.
 * - community_posts(player_id): the feed's optional `?player_id=` filter
 *   (a player's own post history) and the admin pending queue's per-player
 *   lookups.
 * - post_comments(post_id): every post's comment count and comment list are
 *   looked up by post_id — this table has no unique constraint at all to
 *   fall back on (unlike post_reactions, whose
 *   UNIQUE(post_id, player_id, emoji) already covers post_id-only lookups
 *   as that index's leading column, so it's deliberately not repeated here).
 * - direct_messages(sender_id), direct_messages(receiver_id): every
 *   conversation list and thread query filters
 *   `WHERE sender_id = X OR receiver_id = X` (routes/messages.ts) — Postgres
 *   can combine two single-column indexes with a bitmap OR, which a single
 *   composite index can't do for an OR across two different columns.
 */
export async function addPerformanceIndexes3() {
  console.log("📊 Adding performance indexes (batch 3 — community/messaging)...");

  const indexes = [
    {
      name: "idx_community_posts_status_created_at",
      query: sql`CREATE INDEX IF NOT EXISTS idx_community_posts_status_created_at
          ON community_posts(status, created_at)`,
      description: "community_posts(status, created_at)",
    },
    {
      name: "idx_community_posts_player_id",
      query: sql`CREATE INDEX IF NOT EXISTS idx_community_posts_player_id
          ON community_posts(player_id)`,
      description: "community_posts(player_id)",
    },
    {
      name: "idx_post_comments_post_id",
      query: sql`CREATE INDEX IF NOT EXISTS idx_post_comments_post_id
          ON post_comments(post_id)`,
      description: "post_comments(post_id)",
    },
    {
      name: "idx_direct_messages_sender_id",
      query: sql`CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id
          ON direct_messages(sender_id)`,
      description: "direct_messages(sender_id)",
    },
    {
      name: "idx_direct_messages_receiver_id",
      query: sql`CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_id
          ON direct_messages(receiver_id)`,
      description: "direct_messages(receiver_id)",
    },
  ];

  let successCount = 0;
  let failedIndexes: string[] = [];

  for (const index of indexes) {
    try {
      await db.execute(index.query);
      console.log(`  ✅ Index on ${index.description}`);
      successCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("does not exist")) {
        console.log(
          `  ℹ️  Index skipped (table doesn't exist yet): ${index.description}`
        );
        failedIndexes.push(index.description);
      } else if (errorMessage.includes("already exists")) {
        console.log(`  ℹ️  Index already exists: ${index.description}`);
        successCount++;
      } else {
        console.warn(
          `  ⚠️  Error creating index on ${index.description}: ${errorMessage}`
        );
        failedIndexes.push(index.description);
      }
    }
  }

  if (successCount === indexes.length) {
    console.log(
      `✅ All ${successCount} performance indexes (batch 3) added successfully!`
    );
  } else if (successCount > 0) {
    console.log(
      `⚠️  Added ${successCount}/${indexes.length} performance indexes (batch 3)`
    );
    if (failedIndexes.length > 0) {
      console.log(
        `   Skipped ${failedIndexes.length}: ${failedIndexes.join(", ")}`
      );
    }
  } else {
    console.log("⚠️  No performance indexes (batch 3) were created");
  }
}
