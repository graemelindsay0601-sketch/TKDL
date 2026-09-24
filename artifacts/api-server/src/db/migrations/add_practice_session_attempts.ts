import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Logs when a practice session actually STARTS, not just when it finishes.
 *
 * POST /practice/sessions (practice_sessions) only ever gets a row once a
 * session completes successfully — see that route's own comments. That
 * means a session that never finishes (the tab freezes, the app crashes,
 * the player just gives up) leaves no trace anywhere: not in the database,
 * not in this player's history, nothing. This table exists purely to close
 * that gap cheaply: one fire-and-forget insert the moment a real game
 * actually starts (see POST /practice/session-attempts), so a crashed or
 * abandoned session is at least visible rather than silently vanishing —
 * and so attempts-vs-completions can be compared over time to check
 * whether a freeze fix actually reduced how often sessions never finish.
 *
 * This is deliberately NOT a full checkpoint/resume system — it stores no
 * scores, darts, or in-progress state, so a crashed session still can't be
 * resumed from here. Real dart-by-dart resume would need state lifted out
 * of all ~38 individual scorer components in lib/scorers.tsx (each one
 * currently owns its own local React state) and is a much bigger, separate
 * piece of work — flagged, not attempted, in this pass.
 */
export async function addPracticeSessionAttempts(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS practice_session_attempts (
        id SERIAL PRIMARY KEY,
        player1_id INT REFERENCES players(id) ON DELETE SET NULL,
        player2_id INT REFERENCES players(id) ON DELETE SET NULL,
        game_type_key TEXT NOT NULL,
        mode TEXT,
        started_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_practice_session_attempts_player1 ON practice_session_attempts (player1_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_practice_session_attempts_started_at ON practice_session_attempts (started_at)`);
    logger.info("practice_session_attempts table ready");
  } catch (err) {
    logger.error({ err }, "Failed to create practice_session_attempts table");
  }
}
