import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * One-off: the new Visit total scorer is the default, but anyone who saved
 * "Classic" while it was being tried out kept the old layout. Clear those
 * saved choices once so everyone lands on the new scorer; players can still
 * pick Classic again in Account › Scorer and that choice will then stick.
 * The one_off_fixes marker makes sure this never runs a second time.
 */
export async function resetClassicScorerChoice(): Promise<void> {
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS one_off_fixes (key TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT NOW())`);
    await db.transaction(async (tx) => {
      const claimed = await tx.execute(sql`
        INSERT INTO one_off_fixes (key) VALUES ('reset_classic_scorer_2026_11')
        ON CONFLICT (key) DO NOTHING RETURNING key
      `);
      if (claimed.rows.length === 0) return;
      const r = await tx.execute(sql`UPDATE users SET scorer_style = NULL WHERE scorer_style = 'classic'`);
      logger.info({ cleared: (r as any).rowCount ?? null }, "Cleared saved Classic scorer choices (one-off)");
    });
  } catch (err) {
    logger.error({ err }, "Failed to reset Classic scorer choices");
  }
}
