import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Lets every match-submission endpoint — Singles and Team Match (both the
 * `matches` table, distinguished by gameType), and Doubles/Shift Wars in
 * all three shapes (standard, combined-side, multi-team) — accept an
 * optional client-supplied idempotency key. A retried submission (the
 * explicit "Retry" link shown on a failed/timed-out request — realistically
 * triggered by a slow Render free-tier cold start, or a double-tap) can
 * then return the already-recorded match instead of writing a genuine
 * duplicate and double-charging points/Elo/achievements for everyone
 * involved. Nullable column + a partial unique index, not a NOT NULL
 * unique column, so existing rows and any client that never sends a key
 * (nothing requires one) are completely unaffected — the same pattern
 * already used for notifications.dedupe_key in
 * add_post_match_idempotency.ts. The unique index is the real guarantee
 * (rejects a true concurrent double-insert); each route's own pre-check
 * is just the fast, common-case path that avoids redoing the whole
 * transaction on an ordinary sequential retry.
 */
export async function addMatchResultIdempotencyKeys(): Promise<void> {
  await db.execute(sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS idempotency_key TEXT`);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS matches_idempotency_key_idx
    ON matches(idempotency_key) WHERE idempotency_key IS NOT NULL
  `);

  await db.execute(sql`ALTER TABLE doubles_matches ADD COLUMN IF NOT EXISTS idempotency_key TEXT`);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS doubles_matches_idempotency_key_idx
    ON doubles_matches(idempotency_key) WHERE idempotency_key IS NOT NULL
  `);

  await db.execute(sql`ALTER TABLE shift_wars_matches ADD COLUMN IF NOT EXISTS idempotency_key TEXT`);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS shift_wars_matches_idempotency_key_idx
    ON shift_wars_matches(idempotency_key) WHERE idempotency_key IS NOT NULL
  `);

  await db.execute(sql`ALTER TABLE doubles_combined_matches ADD COLUMN IF NOT EXISTS idempotency_key TEXT`);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS doubles_combined_matches_idempotency_key_idx
    ON doubles_combined_matches(idempotency_key) WHERE idempotency_key IS NOT NULL
  `);

  await db.execute(sql`ALTER TABLE shift_wars_combined_matches ADD COLUMN IF NOT EXISTS idempotency_key TEXT`);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS shift_wars_combined_matches_idempotency_key_idx
    ON shift_wars_combined_matches(idempotency_key) WHERE idempotency_key IS NOT NULL
  `);

  await db.execute(sql`ALTER TABLE doubles_multi_matches ADD COLUMN IF NOT EXISTS idempotency_key TEXT`);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS doubles_multi_matches_idempotency_key_idx
    ON doubles_multi_matches(idempotency_key) WHERE idempotency_key IS NOT NULL
  `);

  await db.execute(sql`ALTER TABLE shift_wars_multi_matches ADD COLUMN IF NOT EXISTS idempotency_key TEXT`);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS shift_wars_multi_matches_idempotency_key_idx
    ON shift_wars_multi_matches(idempotency_key) WHERE idempotency_key IS NOT NULL
  `);
}
