import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * One-off: a few game-card descriptions no longer matched how the scorer
 * plays (e.g. Snooker's reds are 1–15, Shooting Gallery is lowest-darts-wins).
 * The seed only inserts missing rows, so existing databases keep the old text.
 * Only rows still holding the exact old seed text are changed, so anything an
 * admin has edited is left alone.
 */
const FIXES: [key: string, oldText: string, newText: string][] = [
      ["snooker_darts", "Score like snooker: pot a red (15–20), then a colour (1–6). Reds=1pt, colours 2–7. 15 reds.", "Snooker on the board: pot 15 reds (any of 1–15, 1pt each), then the colours on 2–7 (Yellow 2 up to Black 7). Highest score wins."],
      ["football_darts", "TKDL custom: score 'goals' by hitting doubles. First to 5 goals wins. Hit a single = possession.", "Hit the bull to win the ball, then hit doubles to score. Hit the bull to steal it back. First to 5 goals wins."],
      ["exponential_bundle", "Targets 7–12: 3 darts to hit the target (count hits), then 3 darts free scoring. Round score = hits × free score.", "Targets 7–12. On the target a single scores the number, a double its square, a treble its cube. Highest total wins."],
      ["shooting_gallery", "Checkout 121–130 in fewest darts (double out). Points: 3d=12, 4d=8, 5d=6, 6d=5, 7d=3, 8d=2, 9d=1. Fail=0.", "5 random checkouts from 121–130 (double out). Score = darts used; bust or 9+ darts = 10. Lowest total wins."],
      ["jdc_challenge_41", "3-phase challenge: Shanghai 10–15, Doubles 1–20+Bull (50pts each, Bull=100), Shanghai 15–20. Most points wins.", "3 phases: Shanghai 10–15, then D1–D20 and the bull (3 darts each), then Shanghai 15–20. A Shanghai is worth +50. Most points wins."],
      ["tactics", "Cricket on numbers 10–20 and Bull — wider range adds more tactical depth.", "Cricket by another name: close 15–20 and the bull, score on numbers your opponent hasn't closed."],
      ["around_clock_quick", "Race 1–20. A treble/double advances 2 numbers instead of 1. Fastest Around-the-World format.", "Race 1–20 with no bull to finish. A double moves you on 2 numbers and a treble 3."],
];

export async function fixGameDescriptionsOnce(): Promise<void> {
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS one_off_fixes (key TEXT PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT NOW())`);
    await db.transaction(async (tx) => {
      const claimed = await tx.execute(sql`INSERT INTO one_off_fixes (key) VALUES ('fix_game_descriptions_2026_11') ON CONFLICT (key) DO NOTHING RETURNING key`);
      if (claimed.rows.length === 0) return;
      let changed = 0;
      for (const [key, oldText, newText] of FIXES) {
        const res = await tx.execute(sql`UPDATE game_types SET description = ${newText}, updated_at = NOW() WHERE key = ${key} AND description = ${oldText}`);
        changed += res.rowCount ?? 0;
      }
      logger.info({ changed }, "Fixed out-of-date game descriptions (one-off)");
    });
  } catch (err) {
    logger.error({ err }, "Failed to fix game descriptions");
  }
}
