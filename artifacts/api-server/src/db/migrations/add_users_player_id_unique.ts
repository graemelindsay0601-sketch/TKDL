import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * users.player_id had no unique constraint — POST /admin/users
 * (routes/auth.ts) checked "does this player already have an account?"
 * with a plain SELECT, then inserted, with nothing stopping two admins
 * (or a double-submit) from both passing that check for the same player
 * and both inserting, giving one player two accounts. Adds the missing
 * constraint so the route's INSERT can use ON CONFLICT DO NOTHING as a
 * real guard instead of just trusting the race never happens.
 *
 * Deliberately does NOT auto-delete any pre-existing duplicate (unlike the
 * equivalent season_standings fix) — a duplicate user account carries its
 * own password hash, admin flag and login history, and picking one to
 * silently delete on boot risks locking someone out or dropping an admin
 * grant. If a duplicate already exists, this index creation simply fails
 * and is logged (per this codebase's per-statement migration convention)
 * rather than thrown — safe to leave for an admin to resolve by hand,
 * and the fix still takes effect for every account created from here on.
 */
export async function addUsersPlayerIdUnique(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS users_player_id_unique
      ON users (player_id)
    `);
    logger.info("users.player_id unique index ready");
  } catch (err) {
    logger.error({ err }, "Failed to create users_player_id_unique");
  }
}
