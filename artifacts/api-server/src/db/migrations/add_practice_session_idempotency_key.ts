import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * POST /practice/sessions has no login/session check by design (a shared
 * walk-up device — see that route's own comment), and unlike master501.ts's
 * run-result PATCH or tour.ts's run-advance PATCH, there's no existing row
 * with a status column to fold an idempotency check into: every call is a
 * plain INSERT of a brand-new row, so a retried/double-tapped submit (a
 * flaky connection on a kiosk, not even anything malicious) duplicates the
 * session row, the 10-coin practice-win award, and the challenge-progress
 * update.
 *
 * idempotency_key is a hash of the full request body (see practice.ts),
 * computed server-side so no client/frontend contract change is needed. Two
 * genuinely different real sessions colliding on this hash is not a
 * realistic concern — it covers every scoring/checkout dart in order, not
 * just the summary numbers — so an exact match here can safely be treated
 * as "the same submit, seen again" rather than "a coincidence." The unique
 * index is partial (WHERE idempotency_key IS NOT NULL) so it imposes no
 * constraint on the pre-existing rows that predate this column.
 */
export async function addPracticeSessionIdempotencyKey(): Promise<void> {
  try {
    await db.execute(sql`
      ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS idempotency_key TEXT
    `);
  } catch (err) {
    logger.error({ err }, "Failed to add practice_sessions.idempotency_key column");
    return;
  }

  try {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS ps_idempotency_key_idx
      ON practice_sessions (idempotency_key)
      WHERE idempotency_key IS NOT NULL
    `);
    logger.info("practice_sessions.idempotency_key ready");
  } catch (err) {
    logger.error({ err }, "Failed to create ps_idempotency_key_idx");
  }
}
