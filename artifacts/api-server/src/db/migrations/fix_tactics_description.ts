import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/** One-off: Tactics now really plays 10–20 and the bull, so its card description says so again. Admin-edited text is left alone. */
const OLD = ["Cricket by another name: close 15–20 and the bull, score on numbers your opponent hasn't closed.",
  "Cricket on numbers 10–20 and Bull — wider range adds more tactical depth."];
const NEW = "Cricket on 10–20 and the bull: twelve numbers to close, more room for tactics.";

export async function fixTacticsDescriptionOnce(): Promise<void> {
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS one_off_fixes (key TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT NOW())`);
    await db.transaction(async (tx) => {
      const claimed = await tx.execute(sql`INSERT INTO one_off_fixes (key) VALUES ('fix_tactics_description_2026_11') ON CONFLICT (key) DO NOTHING RETURNING key`);
      if (claimed.rows.length === 0) return;
      await tx.execute(sql`UPDATE game_types SET description = ${NEW}, updated_at = NOW() WHERE key = 'tactics' AND description IN (${OLD[0]}, ${OLD[1]})`);
      logger.info("Tactics description updated (one-off)");
    });
  } catch (err) { logger.error({ err }, "Failed to update Tactics description"); }
}
