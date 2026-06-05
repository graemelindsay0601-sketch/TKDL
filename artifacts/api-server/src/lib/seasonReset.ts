import { db } from "@workspace/db";
import { playersTable, seasonsTable, seasonStandingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "./logger";
import { checkSeasonAchievements } from "./achievements";

export async function performSeasonReset(overrideName?: string): Promise<typeof seasonsTable.$inferSelect> {
  const [currentSeason] = await db
    .select()
    .from(seasonsTable)
    .where(eq(seasonsTable.isActive, true))
    .limit(1);

  if (currentSeason) {
    const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));
    const sorted = [...players].sort((a, b) => b.points - a.points || b.elo - a.elo);

    const champion = sorted.find(p => p.status === "ACTIVE") ?? sorted[0] ?? null;

    // Save standings snapshot
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      await db.insert(seasonStandingsTable).values({
        seasonId: currentSeason.id,
        playerId: p.id,
        position: i + 1,
        wins: p.seasonWins,
        losses: p.seasonLosses,
        points: p.points,
        elo: p.elo,
        isChampion: champion ? p.id === champion.id : false,
      });
    }

    // Grant season achievements
    await checkSeasonAchievements(currentSeason.id, sorted, champion?.id ?? null);

    // Close season
    await db.update(seasonsTable).set({
      isActive: false,
      endDate: new Date().toISOString().split("T")[0],
      championId: champion?.id ?? null,
      championName: champion?.name ?? null,
    }).where(eq(seasonsTable.id, currentSeason.id));

    logger.info({ seasonId: currentSeason.id, champion: champion?.name }, "Season closed");
  }

  // Reset all active players for new season
  await db.update(playersTable)
    .set({
      points: 25,
      peakPoints: 25,
      seasonWins: 0,
      seasonLosses: 0,
      seasonGamesPlayed: 0,
      currentWinStreak: 0,
      currentLossStreak: 0,
      status: "ACTIVE",
    })
    .where(eq(playersTable.isActive, true));

  const now = new Date();
  const monthName = now.toLocaleString("en-GB", { month: "long" });
  const year = now.getFullYear();
  const [newSeason] = await db.insert(seasonsTable).values({
    name: overrideName ?? `${monthName} ${year}`,
    startDate: now.toISOString().split("T")[0],
    isActive: true,
  }).returning();

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
    logger.info("No active season found on startup, skipping auto-reset");
    return;
  }

  const start = new Date(current.startDate);
  const now = new Date();
  const sameMonth = start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear();

  if (!sameMonth) {
    logger.info({ currentSeasonId: current.id }, "Auto season reset triggered (new month)");
    await performSeasonReset();
  }
}
