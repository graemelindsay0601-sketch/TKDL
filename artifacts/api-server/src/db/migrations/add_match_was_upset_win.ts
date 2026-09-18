/**
 * Migration: Add was_upset_win column to matches
 *
 * TACTICAL/GENIUS ("win N times as underdog in points") were being decided
 * by checking whether TACTICAL had already been granted before this match —
 * which makes GENIUS (criteriaValue: 3) fire on the 2nd upset win, not the
 * 3rd, since TACTICAL itself is already granted after the 1st. There was no
 * actual per-match "was this an upset win" record to count from, because
 * points-before-match isn't otherwise recoverable later (points are just a
 * running total on the player row, overwritten every match). This column is
 * computed and stored at match-write time (routes/matches.ts) going forward
 * so achievements.ts can count real upset wins instead of inferring the
 * count from grant state.
 *
 * Existing historical matches default to false — there's no way to recover
 * what each player's points were immediately before a past match, the same
 * limitation already accepted elsewhere in this file (see TOP_RANKED_ELIMS
 * in routes/players.ts). Only future matches are correctly flagged.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

/**
 * Hardened September 18th: this previously ran the ALTER once and trusted
 * it — but every read of `matches` (players.ts /stats, /elo-history,
 * /career-journey, /achievement-progress, GET /matches) explicitly lists
 * was_upset_win in its column set, so if this step ever failed silently
 * (runInitStep in app.ts deliberately swallows startup-step failures so one
 * bad migration can't take the whole server down) every one of those routes
 * would 500 on every request, forever, until the column actually exists —
 * exactly the production incident this fixes. Now it retries once on
 * failure (covers a transient lock/connection hiccup) and, either way,
 * explicitly re-checks information_schema afterwards and logs a clear,
 * unambiguous PRESENT/MISSING line — so if this is ever wrong again, the
 * very next deploy's logs say so in plain terms instead of staying silent.
 */
async function columnExists(): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'was_upset_win'
  `);
  return result.rows.length > 0;
}

async function attemptAdd(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS was_upset_win BOOLEAN NOT NULL DEFAULT false
  `);
}

export async function addMatchWasUpsetWinColumn() {
  try {
    await attemptAdd();
  } catch (err) {
    logger.error({ err }, "❌ was_upset_win: first ALTER TABLE attempt failed — retrying once");
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await attemptAdd();
    } catch (retryErr) {
      logger.error({ err: retryErr }, "❌ was_upset_win: retry also failed — matches queries will 500 until this is resolved");
    }
  }

  try {
    const exists = await columnExists();
    if (exists) {
      logger.info("✅ matches.was_upset_win column confirmed PRESENT");
    } else {
      logger.error("🚨 matches.was_upset_win column confirmed MISSING after migration attempt — every query against matches will fail until this is fixed manually");
    }
  } catch (err) {
    logger.error({ err }, "❌ Failed to verify matches.was_upset_win column existence");
  }
}
