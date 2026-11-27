import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";
import { syncPlayerNames } from "../../lib/player-rename";

/** One-off: renames made before syncPlayerNames existed (e.g. Ronald Augustine to Ronnie) left old names on past results and pairing names. */
export async function syncPlayerNamesOnce(): Promise<void> {
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS one_off_fixes (key TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT NOW())`);
    await db.transaction(async (tx) => {
      const claimed = await tx.execute(sql`INSERT INTO one_off_fixes (key) VALUES ('sync_player_names_2026_11') ON CONFLICT (key) DO NOTHING RETURNING key`);
      if (claimed.rows.length === 0) return;
      await syncPlayerNames(tx);
      logger.info("Synced saved player names to current names (one-off)");
    });
  } catch (err) {
    logger.error({ err }, "Failed to sync player names");
  }
}
