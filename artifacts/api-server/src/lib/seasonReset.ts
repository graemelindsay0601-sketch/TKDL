import { db } from "@workspace/db";
import { playersTable, seasonsTable, seasonStandingsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { logger } from "./logger";
import { checkSeasonAchievements } from "./achievements";
import { drawDoublesTeams } from "./doublesDraw";

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

    // Snapshot Shift Wars standings for the closing season before points reset
    // below wipes them — otherwise a department's whole month's record would be
    // lost with no way to look back at who won it.
    try {
      const swRows = (await db.execute(sql`SELECT * FROM shift_wars_teams ORDER BY points DESC, name ASC`)).rows as any[];
      if (swRows.length > 0) {
        const topPoints = swRows[0].points;
        for (const t of swRows) {
          await db.execute(sql`
            INSERT INTO shift_wars_season_history (season_id, team_id, team_name, points, wins, losses, is_champion)
            VALUES (${currentSeason.id}, ${t.id}, ${t.name}, ${t.points}, ${t.wins}, ${t.losses}, ${t.points === topPoints})
          `);
        }
        logger.info({ seasonId: currentSeason.id }, "Shift Wars season history snapshot saved");
      }
    } catch (err) {
      logger.error({ err, seasonId: currentSeason.id }, "Shift Wars season history snapshot failed");
    }

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

  // Doubles Event and Shift Wars both run as their own monthly leagues alongside
  // singles now, resetting on the exact same trigger (this function, whether fired
  // by the admin "Reset Season" button or the automatic monthly check). Doubles
  // gets a fresh random draw for the new season, same as singles resetting to
  // 25pts; Shift Wars keeps its fixed departments (never rerolled) but its points/
  // peak/record reset back to each team's configured starting points. Both are
  // best-effort and must never block the singles reset that just succeeded above.
  try {
    const draw = await drawDoublesTeams(newSeason.id);
    if (draw.ok) {
      logger.info({ seasonId: newSeason.id, teams: draw.teams.length }, "Doubles Event auto-drawn for new season");
    } else {
      logger.warn({ seasonId: newSeason.id, error: draw.error }, "Doubles Event auto-draw skipped");
    }
  } catch (err) {
    logger.error({ err, seasonId: newSeason.id }, "Doubles Event auto-draw failed");
  }

  try {
    await db.execute(sql`
      UPDATE shift_wars_teams SET
        points      = starting_points,
        peak_points = starting_points,
        wins        = 0,
        losses      = 0
    `);
    logger.info("Shift Wars points reset for new season");
  } catch (err) {
    logger.error({ err }, "Shift Wars points reset failed");
  }

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
