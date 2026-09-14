import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * A single-row mutual-exclusion lock for the three admin-triggered producer
 * build actions (regenerate / create episode / clean sweep — edition-
 * engine.ts's forceRebuildCurrentEdition/createManualBroadcastEpisode/
 * createBroadcastCleanSweep). Each of those mints its own always-unique
 * slot_key (rebuildAttemptSlotKey/manualEpisodeSlotKey/a bespoke
 * "season-sweep:..." string, all suffixed with randomUUID()) specifically so
 * it never collides with the scheduled path's own logical slot — but that
 * also means none of the three ever collide with EACH OTHER, or with a
 * second concurrent call to themselves. Two overlapping admin clicks (two
 * tabs, two admins, a slow double-click before the button disables) could
 * previously run two full buildEdition() calls at once, racing to publish.
 *
 * Deliberately a NEW table rather than reusing broadcast_editions' own
 * slot_key uniqueness (16.4's claimBuildOwnership): that table's rows are
 * real Edition history, read by admin listings and latestPublishedEdition()
 * alike, and a permanent sentinel lock row there would leak into both. This
 * table exists purely to be raced over.
 *
 * id is pinned to 1 by the CHECK constraint, so there's never more than one
 * row to contend for. A held-but-abandoned lock (the process crashed
 * mid-build, never reaching its own release) self-heals: edition-engine.ts's
 * claimAdminBuildLock() reclaims any lock whose locked_at is older than a
 * generous timeout, rather than leaving every future admin build action
 * permanently blocked by one dead process.
 */
export async function addBroadcastAdminBuildLock(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS broadcast_admin_build_lock (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        locked_by TEXT,
        locked_at TIMESTAMPTZ
      )
    `);
  } catch (err) {
    // Logged, not rethrown — a failure here shouldn't be able to prevent
    // whatever startup step runs next (see app.ts's runInitStep). Worst
    // case, the three admin actions below fall back to their pre-fix
    // behaviour (claimAdminBuildLock treats a missing table as "couldn't
    // claim, refuse" rather than crashing — see its own comment).
    logger.error({ err }, "Failed to create broadcast_admin_build_lock table");
    return;
  }

  try {
    await db.execute(sql`
      INSERT INTO broadcast_admin_build_lock (id, locked_by, locked_at)
      VALUES (1, NULL, NULL)
      ON CONFLICT (id) DO NOTHING
    `);
    logger.info("broadcast_admin_build_lock ready");
  } catch (err) {
    logger.error({ err }, "Failed to seed broadcast_admin_build_lock's single row");
  }
}
