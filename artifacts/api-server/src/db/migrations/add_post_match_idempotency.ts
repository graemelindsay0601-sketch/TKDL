import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/** Makes retrying post-match notifications and feed posts safe. */
export async function addPostMatchIdempotency(): Promise<void> {
  await db.execute(sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT`);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key_idx
    ON notifications(dedupe_key) WHERE dedupe_key IS NOT NULL
  `);

  await db.execute(sql`
    DELETE FROM community_posts newer
    USING community_posts older
    WHERE newer.post_type = 'auto' AND older.post_type = 'auto'
      AND newer.auto_meta->>'matchId' IS NOT NULL
      AND newer.auto_meta->>'type' = older.auto_meta->>'type'
      AND newer.auto_meta->>'matchId' = older.auto_meta->>'matchId'
      AND newer.id > older.id
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS community_posts_auto_match_idx
    ON community_posts ((auto_meta->>'type'), (auto_meta->>'matchId'))
    WHERE post_type = 'auto' AND auto_meta->>'matchId' IS NOT NULL
  `);
}
