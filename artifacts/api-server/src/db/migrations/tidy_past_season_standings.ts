import { db } from "@workspace/db";
import { logger } from "../../lib/logger";
import { tidySinglesSeasonStandings } from "../../lib/tidy-season-standings";
import { grantIfNotHas } from "../../lib/achievement-grant";
import { scheduleSync as scheduleAchievementsV2Sync } from "../../lib/achievements-v2/live";

/** Boot step: apply "no matches, no final position" to past Singles seasons. */
export async function tidyPastSeasonStandings(): Promise<void> {
  const r = await tidySinglesSeasonStandings(db as never);
  if (r.removed.length === 0 && r.moved.length === 0) return;
  logger.info({ removed: r.removed, moved: r.moved }, "Past Singles season tables tidied: players with no matches removed, places renumbered");
  // Placements earned by moving up: the original top-3 badge, then the
  // achievements cabinet re-reads the tables (it only ever adds).
  for (const m of r.moved) if (m.to <= 3) await grantIfNotHas(m.playerId, "UNBREAKABLE").catch(err => logger.error({ err, m }, "UNBREAKABLE grant failed"));
  scheduleAchievementsV2Sync();
}
