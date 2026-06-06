import { Router } from "express";
import { db, achievementsTable, playerAchievementsTable } from "@workspace/db";
import { asc } from "drizzle-orm";

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

export default router;
