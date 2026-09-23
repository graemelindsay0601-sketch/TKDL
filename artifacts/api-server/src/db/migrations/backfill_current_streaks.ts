import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Recompute players.current_win_streak / current_loss_streak from the real
 * matches table, for every player who has ever played a singles/team match.
 *
 * Why this needs to exist at all: seasonReset.ts's singles season-rollover
 * used to unconditionally zero both columns for every active player at every
 * season boundary, alongside the stats that genuinely are per-season
 * (points, seasonWins/Losses). A streak is "consecutive results since my
 * last loss/win", not a per-season tally, so that reset silently truncated
 * any streak that happened to span two seasons even though no match was
 * actually lost — e.g. a player who won their last 3 games of one season
 * and their first 5 of the next showed a "3W" streak instead of 8. That
 * reset no longer touches these two columns (see seasonReset.ts's own
 * comment on the change) — this file is the other half: it repairs the
 * values that were already wiped by every season boundary that happened
 * before that fix shipped.
 *
 * This is a full recompute, not a conditional patch, which is what makes it
 * safe to run on every startup rather than just once: matches.ts and
 * team-matches.ts already keep these two columns correct after every real
 * match (increment the winner's win streak / zero their loss streak, and
 * vice versa for the loser), so recomputing from the same matches table
 * those routes read from can only ever reproduce that same correct value —
 * there's no way for this to "backfill in" a wrong number. It's a
 * reconciliation pass, not a one-time guess, exactly like the season-reset
 * bug this exists to undo: something can always zero these columns behind
 * matches.ts/team-matches.ts's back (a manual DB edit, a future migration
 * that doesn't know better) and this keeps correcting it.
 *
 * Scope: `matches` is exclusively singles + Shift Wars team-match results —
 * practice, M501/Tour session logs, doubles, board curse, boss battles and
 * card clash all live in their own separate tables and never touch this
 * one (confirmed by grep when this bug was first diagnosed) — so this
 * naturally computes over "all singles/team matches", never crossing into
 * an unrelated game mode's results.
 *
 * The SQL below is the standard gaps-and-islands streak calculation (same
 * technique as streak-service.ts's getCurrentWinStreak, just computed for
 * every player in one pass instead of one player at a time): for each
 * player, number their matches most-recent-first, group consecutive rows
 * with the same win/loss outcome, then take the length of whichever group
 * contains their single most recent match (rn = 1). That group's outcome
 * decides which column gets the count and which gets zeroed — matching the
 * existing invariant (maintained by matches.ts/team-matches.ts) that a
 * player never has both a nonzero win streak and a nonzero loss streak at
 * the same time.
 */
export async function backfillCurrentStreaks(): Promise<void> {
  try {
    await db.execute(sql`
      WITH ordered AS (
        SELECT
          p.id AS player_id,
          (m.winner_id = p.id) AS is_win,
          ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY m.played_at DESC, m.id DESC) AS rn
        FROM players p
        JOIN matches m ON m.winner_id = p.id OR m.loser_id = p.id
      ),
      grouped AS (
        SELECT
          player_id,
          is_win,
          rn,
          rn - ROW_NUMBER() OVER (PARTITION BY player_id, is_win ORDER BY rn) AS grp
        FROM ordered
      ),
      current_group AS (
        -- The group containing each player's single most recent match.
        SELECT player_id, is_win, grp
        FROM grouped
        WHERE rn = 1
      ),
      streak_len AS (
        SELECT cg.player_id, cg.is_win, COUNT(*)::int AS len
        FROM grouped g
        JOIN current_group cg
          ON cg.player_id = g.player_id AND cg.grp = g.grp AND cg.is_win = g.is_win
        GROUP BY cg.player_id, cg.is_win
      )
      UPDATE players p
      SET
        current_win_streak  = CASE WHEN sl.is_win THEN sl.len ELSE 0 END,
        current_loss_streak = CASE WHEN sl.is_win THEN 0 ELSE sl.len END
      FROM streak_len sl
      WHERE p.id = sl.player_id
        AND (
          p.current_win_streak  IS DISTINCT FROM (CASE WHEN sl.is_win THEN sl.len ELSE 0 END)
          OR p.current_loss_streak IS DISTINCT FROM (CASE WHEN sl.is_win THEN 0 ELSE sl.len END)
        )
    `);
  } catch (err) {
    logger.error({ err }, "Failed to backfill players.current_win_streak / current_loss_streak");
  }
}
