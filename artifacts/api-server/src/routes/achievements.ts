import { Router } from "express";
import { db, achievementsTable, playerAchievementsTable } from "@workspace/db";
import { asc } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/achievements", async (_req, res): Promise<void> => {
  const [achievements, unlocks] = await Promise.all([
    db.select().from(achievementsTable)
      .orderBy(asc(achievementsTable.priority), asc(achievementsTable.name)),
    db.select({ achievementId: playerAchievementsTable.achievementId })
      .from(playerAchievementsTable),
  ]);

  const unlockCounts = new Map<number, number>();
  for (const u of unlocks) {
    unlockCounts.set(u.achievementId, (unlockCounts.get(u.achievementId) ?? 0) + 1);
  }

  const result = achievements.map(a => ({
    ...a,
    unlockedCount: unlockCounts.get(a.id) ?? 0,
  }));

  res.json(result);
});

router.get("/achievements/recent", async (_req, res): Promise<void> => {
  try {
    const rows = (await db.execute(sql`
      SELECT
        pa.unlocked_at,
        p.id   AS player_id,
        p.name AS player_name,
        a.name AS achievement_name,
        a.icon,
        a.rarity
      FROM player_achievements pa
      JOIN players    p ON p.id = pa.player_id
      JOIN achievements a ON a.id = pa.achievement_id
      ORDER BY pa.unlocked_at DESC
      LIMIT 6
    `)).rows;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to get recent achievements" });
  }
});

export default router;
