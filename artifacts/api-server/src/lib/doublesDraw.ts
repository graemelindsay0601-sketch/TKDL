import { sql, eq } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";
import { buildDoublesGroupsWithDefendingPair, type PreviousTriple } from "./doubles-grouping";

// Doubles teams start with a bigger shared pool than singles (25pts) since it's split between 2-3 players.
export const DOUBLES_STARTING_POINTS = 50;

/**
 * Randomly pairs active players into 2-3-person Doubles Event teams for a season
 * and inserts fresh doubles_teams rows. Used by the admin "reroll" button
 * (routes/admin.ts) and automatically at the start of every new season
 * (lib/seasonReset.ts) — Doubles Event runs as its own monthly league alongside
 * singles, so it gets a fresh random draw every reset, same cadence as singles
 * resetting to 25pts.
 */
export async function drawDoublesTeams(
  seasonId: number,
  opts?: { force?: boolean }
): Promise<{ ok: true; teams: any[]; defendingPairKept: boolean } | { ok: false; error: string }> {
  const force = opts?.force ?? false;

  return db.transaction(async tx => {
    // Serialise automatic recovery and an admin pressing Draw/Redraw at the
    // same moment. Both paths target the same season row, so the second one
    // waits, rechecks, and cannot create a duplicate set of teams.
    const season = await tx.execute(sql`SELECT id FROM seasons WHERE id = ${seasonId} FOR UPDATE`);
    if (season.rows.length === 0) {
      return { ok: false as const, error: "Season not found" };
    }

    const existing = await tx.execute(sql`SELECT id FROM doubles_teams WHERE season_id = ${seasonId} LIMIT 1`);
    if (existing.rows.length > 0 && !force) {
      return { ok: false as const, error: "Doubles teams already exist for this season. Pass force:true to redraw." };
    }

    // Validate the replacement roster before deleting a valid existing draw.
    // Previously a forced redraw with fewer than two eligible players erased
    // all teams and only then returned this error.
    const eligible = await tx.select().from(playersTable).where(eq(playersTable.isActive, true));
    if (eligible.length < 2) {
      return { ok: false as const, error: "Need at least 2 active players to draw doubles teams" };
    }
    if (existing.rows.length > 0 && force) {
      // Cascades to doubles_matches via FK.
      await tx.execute(sql`DELETE FROM doubles_teams WHERE season_id = ${seasonId}`);
    }

    const previousTriples = (await tx.execute(sql`
      SELECT season_id, player1_id, player2_id, player3_id
      FROM doubles_teams
      WHERE player3_id IS NOT NULL
    `)).rows.map(row => ({
      seasonId: Number(row.season_id),
      player1Id: Number(row.player1_id),
      player2Id: Number(row.player2_id),
      player3Id: Number(row.player3_id),
    })) as PreviousTriple[];

    // Find the top team from the immediately preceding completed Doubles
    // season. Only a genuine two-player team can defend as a pair; a past
    // odd-roster triple falls back to the normal fair draw.
    const previousChampion = (await tx.execute(sql`
      WITH previous_season AS (
        SELECT id
        FROM seasons
        WHERE league_type = 'doubles' AND is_active = false AND id <> ${seasonId}
        ORDER BY end_date DESC NULLS LAST, id DESC
        LIMIT 1
      )
      SELECT dt.player1_id, dt.player2_id, dt.player3_id
      FROM doubles_teams dt
      JOIN previous_season ps ON ps.id = dt.season_id
      ORDER BY dt.points DESC, dt.elo DESC, dt.id ASC
      LIMIT 1
    `)).rows[0] as { player1_id: number; player2_id: number; player3_id: number | null } | undefined;

    const defendingPairIds = previousChampion && previousChampion.player3_id == null
      ? [Number(previousChampion.player1_id), Number(previousChampion.player2_id)]
      : null;
    const { groups, defendingPairKept } = buildDoublesGroupsWithDefendingPair(
      eligible,
      previousTriples,
      defendingPairIds,
    );

    const created: any[] = [];
    for (const team of groups) {
      const teamName = team.map(p => p.name).join(" & ");
      const [row] = await tx.execute(sql`
        INSERT INTO doubles_teams (season_id, player1_id, player2_id, player3_id, team_name, points, peak_points, elo, wins, losses, is_eliminated)
        VALUES (${seasonId}, ${team[0].id}, ${team[1].id}, ${team[2]?.id ?? null}, ${teamName}, ${DOUBLES_STARTING_POINTS}, ${DOUBLES_STARTING_POINTS}, 1000, 0, 0, false)
        RETURNING *
      `).then(r => r.rows as any[]);
      created.push(row);
    }

    return { ok: true as const, teams: created, defendingPairKept };
  });
}
