import { sql, eq } from "drizzle-orm";
import { db, playersTable } from "@workspace/db";

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
): Promise<{ ok: true; teams: any[] } | { ok: false; error: string }> {
  const force = opts?.force ?? false;

  const existing = await db.execute(sql`SELECT id FROM doubles_teams WHERE season_id = ${seasonId} LIMIT 1`);
  if (existing.rows.length > 0 && !force) {
    return { ok: false, error: "Doubles teams already exist for this season. Pass force:true to redraw." };
  }
  if (existing.rows.length > 0 && force) {
    // Cascades to doubles_matches via FK.
    await db.execute(sql`DELETE FROM doubles_teams WHERE season_id = ${seasonId}`);
  }

  const eligible = await db.select().from(playersTable).where(eq(playersTable.isActive, true));
  if (eligible.length < 2) {
    return { ok: false, error: "Need at least 2 active players to draw doubles teams" };
  }

  // Fisher-Yates shuffle
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const pairs: (typeof shuffled)[] = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }
  if (shuffled.length % 2 === 1) {
    const leftover = shuffled[shuffled.length - 1];
    const luckyTeam = pairs[Math.floor(Math.random() * pairs.length)];
    luckyTeam.push(leftover);
  }

  const created: any[] = [];
  for (const team of pairs) {
    const teamName = team.map(p => p.name).join(" & ");
    const [row] = await db.execute(sql`
      INSERT INTO doubles_teams (season_id, player1_id, player2_id, player3_id, team_name, points, peak_points, elo, wins, losses, is_eliminated)
      VALUES (${seasonId}, ${team[0].id}, ${team[1].id}, ${team[2]?.id ?? null}, ${teamName}, ${DOUBLES_STARTING_POINTS}, ${DOUBLES_STARTING_POINTS}, 1000, 0, 0, false)
      RETURNING *
    `).then(r => r.rows as any[]);
    created.push(row);
  }

  return { ok: true, teams: created };
}
