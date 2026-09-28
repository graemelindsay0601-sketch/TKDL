import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Store an admin's acknowledgement of a health-check warning. This is
 * deliberately separate from achievements and match data: reviewing a flag
 * never changes the badge, its reward, or the result that triggered it.
 */
export async function addIntegrityReviewAcknowledgements(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS integrity_review_acknowledgements (
      issue_key       TEXT PRIMARY KEY,
      reviewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      admin_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL
    )
  `);
}
