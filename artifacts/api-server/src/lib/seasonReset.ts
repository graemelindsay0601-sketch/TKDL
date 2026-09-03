import cron from "node-cron";
import { db } from "@workspace/db";
import { playersTable, seasonsTable, seasonStandingsTable } from "@workspace/db";
import type { LeagueType } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "./logger";
import { checkSeasonAchievements } from "./achievements";
import { drawDoublesTeams } from "./doublesDraw";
import { decideSinglesChampion } from "./singles-champion";

function newSeasonName(overrideName?: string): { name: string; startDate: string } {
  const now = new Date();
  const monthName = now.toLocaleString("en-GB", { month: "long" });
  const year = now.getFullYear();
  return {
    name: overrideName ?? `${monthName} ${year}`,
    startDate: now.toISOString().split("T")[0],
  };
}

// ── Singles ──────────────────────────────────────────────────────────────
// The original season reset: standings snapshot, season achievements,
// crown the champion, reset all players to 25pts, open a new season. Scoped
// to league_type='singles' — Doubles and Shift Wars each have their own
// independent lifecycle below, and no longer ride along with this one (see
// db/migrations/add_season_league_type.ts for why that used to be a bug).
export async function performSeasonReset(overrideName?: string): Promise<typeof seasonsTable.$inferSelect> {
  const [currentSeason] = await db
    .select()
    .from(seasonsTable)
    .where(and(eq(seasonsTable.isActive, true), eq(seasonsTable.leagueType, "singles")))
    .limit(1);

  if (currentSeason) {
    const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));
    const sorted = [...players].sort((a, b) => b.points - a.points || b.elo - a.elo);
    const contenders = sorted.filter(p => p.status === "ACTIVE");

    // currentSeason.championId is only ever set here by the playoff-match
    // admin flow (POST/PATCH /api/seasons/:id/playoff) resolving an earlier
    // tie — decideSinglesChampion() honors that recorded result instead of
    // re-deriving one, and never lets Elo silently settle a tie on points.
    const decision = decideSinglesChampion(contenders, currentSeason.championId);

    if (decision.kind === "tied") {
      // The rules require a one-off no-stake tiebreaker for a tied Singles
      // championship. Hold the season open and flag it for an admin to
      // resolve via the existing playoff-match flow instead of crowning
      // anyone. Re-checked on every reset attempt (daily cron + manual
      // "reset now"), so this clears itself the moment either a recorded
      // tiebreak or further real matches break the tie.
      if (!currentSeason.playoffPending) {
        await db.update(seasonsTable).set({ playoffPending: true }).where(eq(seasonsTable.id, currentSeason.id));
        logger.warn(
          { seasonId: currentSeason.id, tied: decision.tied.map(p => p.name), points: decision.points },
          "Singles season tied for first place — holding season open pending tiebreak (resolve via admin season editor)"
        );
      }
      return currentSeason;
    }

    const champion = decision.kind === "champion" ? decision.player : null;

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

    // Close season. Prefer a champion already recorded on the season row
    // (set via the playoff-match flow) over `champion` being null here —
    // that only happens if the recorded champion has since left the active
    // roster, and their playoff win shouldn't be erased by that.
    await db.update(seasonsTable).set({
      isActive: false,
      endDate: new Date().toISOString().split("T")[0],
      championId: champion?.id ?? currentSeason.championId ?? null,
      championName: champion?.name ?? currentSeason.championName ?? null,
    }).where(eq(seasonsTable.id, currentSeason.id));

    logger.info({ seasonId: currentSeason.id, champion: champion?.name }, "Singles season closed");
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

  const { name, startDate } = newSeasonName(overrideName);
  const [newSeason] = await db.insert(seasonsTable).values({
    name, startDate, isActive: true, leagueType: "singles",
  }).returning();

  logger.info({ newSeasonId: newSeason.id, name: newSeason.name }, "New singles season started");
  return newSeason;
}

// ── Doubles Event ────────────────────────────────────────────────────────
// Its own independent monthly league: close out the current doubles season
// (the team with the most points is champion — there's no single "player"
// champion here, so championId stays null and championName carries the
// team name), then open a new one and draw fresh random pairs for it.
export async function performDoublesSeasonReset(overrideName?: string): Promise<typeof seasonsTable.$inferSelect> {
  const [currentSeason] = await db
    .select()
    .from(seasonsTable)
    .where(and(eq(seasonsTable.isActive, true), eq(seasonsTable.leagueType, "doubles")))
    .limit(1);

  if (currentSeason) {
    const teams = (await db.execute(sql`
      SELECT team_name, points, elo FROM doubles_teams
      WHERE season_id = ${currentSeason.id}
      ORDER BY points DESC, elo DESC
      LIMIT 1
    `)).rows as { team_name: string }[];
    const champion = teams[0] ?? null;

    await db.update(seasonsTable).set({
      isActive: false,
      endDate: new Date().toISOString().split("T")[0],
      championName: champion?.team_name ?? null,
    }).where(eq(seasonsTable.id, currentSeason.id));

    logger.info({ seasonId: currentSeason.id, champion: champion?.team_name }, "Doubles Event season closed");
  }

  const { name, startDate } = newSeasonName(overrideName);
  const [newSeason] = await db.insert(seasonsTable).values({
    name, startDate, isActive: true, leagueType: "doubles",
  }).returning();

  try {
    const draw = await drawDoublesTeams(newSeason.id);
    if (draw.ok) {
      logger.info({ seasonId: newSeason.id, teams: draw.teams.length }, "Doubles Event drawn for new season");
    } else {
      logger.warn({ seasonId: newSeason.id, error: draw.error }, "Doubles Event draw skipped");
    }
  } catch (err) {
    logger.error({ err, seasonId: newSeason.id }, "Doubles Event draw failed");
  }

  logger.info({ newSeasonId: newSeason.id, name: newSeason.name }, "New Doubles Event season started");
  return newSeason;
}

// ── Shift Wars ───────────────────────────────────────────────────────────
// Its own independent monthly league: snapshot the 3 departments' standing
// into shift_wars_season_history before wiping it, then reset every team's
// points/record back to its configured starting_points. The roster and
// teams themselves are permanent and never touched here.
export async function performShiftWarsSeasonReset(overrideName?: string): Promise<typeof seasonsTable.$inferSelect> {
  const [currentSeason] = await db
    .select()
    .from(seasonsTable)
    .where(and(eq(seasonsTable.isActive, true), eq(seasonsTable.leagueType, "shift_wars")))
    .limit(1);

  if (currentSeason) {
    try {
      const swRows = (await db.execute(sql`SELECT * FROM shift_wars_teams ORDER BY points DESC, name ASC`)).rows as any[];
      let champion: string | null = null;
      if (swRows.length > 0) {
        const topPoints = swRows[0].points;
        champion = swRows[0].name;
        for (const t of swRows) {
          await db.execute(sql`
            INSERT INTO shift_wars_season_history (season_id, team_id, team_name, points, wins, losses, is_champion)
            VALUES (${currentSeason.id}, ${t.id}, ${t.name}, ${t.points}, ${t.wins}, ${t.losses}, ${t.points === topPoints})
          `);
        }
        logger.info({ seasonId: currentSeason.id }, "Shift Wars season history snapshot saved");
      }

      await db.update(seasonsTable).set({
        isActive: false,
        endDate: new Date().toISOString().split("T")[0],
        championName: champion,
      }).where(eq(seasonsTable.id, currentSeason.id));
    } catch (err) {
      logger.error({ err, seasonId: currentSeason.id }, "Shift Wars season history snapshot failed");
    }
  }

  const { name, startDate } = newSeasonName(overrideName);
  const [newSeason] = await db.insert(seasonsTable).values({
    name, startDate, isActive: true, leagueType: "shift_wars",
  }).returning();

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

  logger.info({ newSeasonId: newSeason.id, name: newSeason.name }, "New Shift Wars season started");
  return newSeason;
}

// ── Auto-reset, checked independently per league ────────────────────────
// Each league only resets when ITS OWN active season has rolled into a new
// calendar month — Doubles or Shift Wars starting mid-August no longer
// forces (or gets forced by) a Singles reset on September 1st just because
// they used to share one row.
async function maybeAutoResetLeague(
  leagueType: LeagueType,
  resetFn: () => Promise<typeof seasonsTable.$inferSelect>,
): Promise<void> {
  const [current] = await db
    .select()
    .from(seasonsTable)
    .where(and(eq(seasonsTable.isActive, true), eq(seasonsTable.leagueType, leagueType)))
    .orderBy(desc(seasonsTable.id))
    .limit(1);

  if (!current) {
    logger.info({ leagueType }, "No active season found on startup, skipping auto-reset");
    return;
  }

  const start = new Date(current.startDate);
  const now = new Date();
  const sameMonth = start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear();

  if (!sameMonth) {
    logger.info({ leagueType, currentSeasonId: current.id }, "Auto season reset triggered (new month)");
    await resetFn();
  }
}

export async function maybeAutoResetLeagueSeasons(): Promise<void> {
  await maybeAutoResetLeague("singles", () => performSeasonReset());
  await maybeAutoResetLeague("doubles", () => performDoublesSeasonReset());
  await maybeAutoResetLeague("shift_wars", () => performShiftWarsSeasonReset());
}

// ── Scheduled auto-reset ─────────────────────────────────────────────────
// maybeAutoResetLeagueSeasons() used to only run at server startup, which
// meant a month could roll over with no reset (and, for Shift Wars, no
// history snapshot) if the server just stayed up the whole time — the same
// class of bug fixed for the featured card shop in
// featured-card-shop-service.ts. This runs the same check daily so a new
// month is always caught within a day of it starting, regardless of
// deploys/restarts. Each per-league check is already idempotent (it only
// resets when the active season's start month differs from the current
// month), so a daily cadence is safe to run indefinitely.
export function initializeSeasonResetScheduler(): void {
  try {
    // Every day at 00:15 UTC — after the 00:05 featured-card rotation, well
    // clear of midnight-boundary races.
    cron.schedule("15 0 * * *", async () => {
      try {
        await maybeAutoResetLeagueSeasons();
        logger.info("Season auto-reset: daily check complete");
      } catch (error) {
        logger.error({ error }, "Season auto-reset: scheduled check failed");
      }
    }, {
      runOnInit: false,
    });

    logger.info("Season auto-reset scheduler initialized (daily at 00:15 UTC)");
  } catch (error) {
    logger.error({ error }, "Failed to initialize season auto-reset scheduler");
  }
}
