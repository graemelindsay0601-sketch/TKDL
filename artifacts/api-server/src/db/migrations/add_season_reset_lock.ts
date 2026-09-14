import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * A per-league mutual-exclusion lock for lib/seasonReset.ts's three
 * perform*SeasonReset() functions. Each one is a long check-then-act
 * sequence (snapshot standings, grant season achievements, close the
 * season, reset every player/team, open a new season) with nothing
 * previously stopping two concurrent triggers for the SAME league — a
 * manual admin "reset now" racing the scheduled daily cron, or a double
 * click — from both reading the same active season and both running the
 * whole sequence. One row per league_type; claimed with a short staleness
 * timeout (these resets are bounded, synchronous-ish work — nothing like
 * the admin build lock's Monte-Carlo-scale builds — so a flat timeout is
 * enough, no heartbeat needed).
 */
export async function addSeasonResetLock(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS season_reset_lock (
        league_type TEXT PRIMARY KEY,
        locked_by TEXT,
        locked_at TIMESTAMPTZ
      )
    `);
    logger.info("season_reset_lock ready");
  } catch (err) {
    logger.error({ err }, "Failed to create season_reset_lock table");
  }
}
