import { db } from "@workspace/db";
import {
  playersTable,
  seasonsTable,
  seasonStandingsTable,
  playerAchievementsTable,
  achievementsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { logger } from "./logger";

export async function performSeasonReset(overrideName?: string): Promise<typeof seasonsTable.$inferSelect> {
  const [currentSeason] = await db
    .select()
    .from(seasonsTable)
    .where(eq(seasonsTable.isActive, true))
    .limit(1);

  if (currentSeason) {
    const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));
    const sorted = [...players].sort((a, b) => b.currentSeasonPoints - a.currentSeasonPoints || b.currentSeasonWins - a.currentSeasonWins);

    // Save standings snapshot
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      await db.insert(seasonStandingsTable).values({
        seasonId: currentSeason.id,
        playerId: p.id,
        position: i + 1,
        wins: p.currentSeasonWins,
        losses: p.currentSeasonLosses,
        points: p.currentSeasonPoints,
        isChampion: i === 0 ? 1 : 0,
      });
    }

    // Crown champion
    let championId: number | null = null;
    let championName: string | null = null;
    if (sorted.length > 0) {
      championId = sorted[0].id;
      championName = sorted[0].name;
      // Grant champion achievement
      const [champAch] = await db
        .select()
        .from(achievementsTable)
        .where(eq(achievementsTable.key, "champion"));
      if (champAch) {
        const existing = await db
          .select()
          .from(playerAchievementsTable)
          .where(
            and(
              eq(playerAchievementsTable.playerId, championId),
              eq(playerAchievementsTable.achievementId, champAch.id)
            )
          );
        if (existing.length === 0) {
          await db.insert(playerAchievementsTable).values({
            playerId: championId,
            achievementId: champAch.id,
          });
        }
      }
    }

    // Close current season
    await db
      .update(seasonsTable)
      .set({
        isActive: false,
        endDate: new Date().toISOString().split("T")[0],
        championId,
        championName,
      })
      .where(eq(seasonsTable.id, currentSeason.id));

    logger.info({ seasonId: currentSeason.id, championId }, "Season closed");
  }

  // Reset all players' season stats
  await db.update(playersTable).set({
    currentSeasonPoints: 0,
    currentSeasonWins: 0,
    currentSeasonLosses: 0,
    currentWinStreak: 0,
  });

  // Create new season
  const now = new Date();
  const monthName = now.toLocaleString("en-GB", { month: "long", year: "numeric" });
  const [newSeason] = await db
    .insert(seasonsTable)
    .values({
      name: overrideName ?? `${monthName} Season`,
      startDate: now.toISOString().split("T")[0],
      isActive: true,
    })
    .returning();

  logger.info({ newSeasonId: newSeason.id, name: newSeason.name }, "New season started");
  return newSeason;
}

export async function maybeAutoResetSeason(): Promise<void> {
  const [current] = await db
    .select()
    .from(seasonsTable)
    .where(eq(seasonsTable.isActive, true))
    .orderBy(desc(seasonsTable.id))
    .limit(1);

  if (!current) {
    await performSeasonReset();
    return;
  }

  const start = new Date(current.startDate);
  const now = new Date();
  const sameMonth = start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear();

  if (!sameMonth) {
    logger.info({ currentSeasonId: current.id }, "Auto season reset triggered");
    await performSeasonReset();
  }
}
