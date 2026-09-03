import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Migration: `seasons.broadcast_reviewed_at` — a durable, state-based marker
 * for "has this closed season already had its Season Review special air,"
 * replacing a window-based check that only ever worked once.
 *
 * The Season Review feature (director-season-review.ts) originally decided
 * which closed leagues needed reviewing by checking whether their season
 * ended strictly within (previous.dataCutoff, cutoffEnd] — the same
 * incremental-window check story-engine.ts already uses for "did a new
 * match/result happen this batch." That's the right question for a result,
 * wrong for a one-off retrospective: the window only ever contains the
 * season-close instant on the very FIRST build after it happens. A real
 * user's report — "the regenerated episode is way way too short" and
 * brought the champion "up multiple times" — traced straight back to this:
 * hitting the admin regenerate button a second time (exactly what testing a
 * new feature involves) landed outside that window, silently fell back to
 * an ordinary Edition, and never tried the Season Review path again for
 * that season.
 *
 * `broadcast_reviewed_at` fixes this by making eligibility a direct state
 * check instead: null means the season still owes a review; a timestamp
 * means one was already published. edition-engine.ts sets it the moment a
 * Season Review for that season actually clears the quality gate and
 * publishes — never on a failed/skipped attempt, so a thin or gate-failing
 * build keeps retrying as a Season Review on the next build, exactly like
 * every other "keep previous published Edition" quality-gate case already
 * works.
 */
export async function addSeasonBroadcastReviewedAt() {
  try {
    await db.execute(sql`
      ALTER TABLE seasons ADD COLUMN IF NOT EXISTS broadcast_reviewed_at TIMESTAMPTZ
    `);
    logger.info("seasons.broadcast_reviewed_at column ready");
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to add seasons.broadcast_reviewed_at column");
    throw err;
  }
}
