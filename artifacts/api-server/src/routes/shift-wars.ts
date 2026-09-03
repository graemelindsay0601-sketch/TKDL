import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { z } from "zod";
import { validateStake, applyWager } from "../lib/wager";
import { matchSubmitRateLimit } from "../middleware/writeRateLimit";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { sendShiftWarsMatchResultNotification } from "../services/notificationService";

/**
 * Shift Wars — 3 fixed department teams (Fresh, Twilight, Shift Leader) competing
 * on the same points/wager mechanic as the Doubles Event, but:
 *   - no random draw/reroll: the roster is a manual, permanent, admin-assigned
 *     department, not a season-drawn pairing
 *   - points-only, no ELO/tier ladder
 *   - not season-scoped: this is a standing competition, not reset each season
 * A match is recorded purely as "Team A beat Team B, stake X" — same as Doubles
 * Event — no individual player attribution is needed for the match itself; the
 * roster exists only to show who's on which team.
 */

const RecordShiftWarsMatchBody = z.object({
  winnerTeamId: z.number().int().positive(),
  loserTeamId:  z.number().int().positive(),
  stake:        z.number().int().min(1), // Rules minimum is 1 — see wager.ts validateStake for why 0 has no legitimate case here.
  gameType:     z.string().optional().default("shift_wars_501"),
  notes:        z.string().optional(),
});

const UpdateTeamPointsBody = z.object({
  points:         z.number().int().min(0).optional(),
  startingPoints: z.number().int().min(0).optional(),
}).refine(d => d.points !== undefined || d.startingPoints !== undefined, {
  message: "Provide points and/or startingPoints",
});

const AssignPlayerTeamBody = z.object({
  teamId: z.number().int().positive().nullable(),
});

const router = Router();

class ShiftWarsConflictError extends Error {}

// ── Team standings + roster ─────────────────────────────────────────────────

router.get("/shift-wars/teams", async (_req, res): Promise<void> => {
  const teamRows = await db.execute(sql`SELECT * FROM shift_wars_teams ORDER BY points DESC, name ASC`);
  const teams = teamRows.rows as any[];

  const playerRows = await db.execute(sql`
    SELECT id, name, shift_wars_team_id FROM players WHERE shift_wars_team_id IS NOT NULL
  `);
  const players = playerRows.rows as any[];

  res.json(teams.map((t, i) => ({
    position:       i + 1,
    id:             t.id,
    name:           t.name,
    points:         t.points,
    peakPoints:     t.peak_points,
    startingPoints: t.starting_points,
    wins:           t.wins,
    losses:         t.losses,
    players:        players.filter(p => p.shift_wars_team_id === t.id).map(p => ({ id: p.id, name: p.name })),
  })));
});

// ── Monthly champion history ────────────────────────────────────────────────
// Snapshotted at every reset (lib/seasonReset.ts) right before points/record
// are cleared for the new month, so a department's whole month isn't lost.
//
// With ?seasonId=NNN this instead returns every team's snapshot row for that
// one season (used by the season archive's Shift Wars tab) rather than just
// the champion across all seasons.

router.get("/shift-wars/history", async (req, res): Promise<void> => {
  const seasonId = req.query.seasonId ? Number(req.query.seasonId) : undefined;

  if (seasonId !== undefined) {
    if (!Number.isInteger(seasonId) || seasonId <= 0) { res.status(400).json({ error: "Invalid seasonId" }); return; }
    const rows = await db.execute(sql`
      SELECT h.team_id, h.team_name, h.points, h.wins, h.losses, h.is_champion
      FROM shift_wars_season_history h
      WHERE h.season_id = ${seasonId}
      ORDER BY h.points DESC, h.team_name ASC
    `);
    res.json((rows.rows as any[]).map((r, i) => ({
      position:     i + 1,
      teamId:       r.team_id,
      teamName:     r.team_name,
      points:       r.points,
      wins:         r.wins,
      losses:       r.losses,
      isChampion:   r.is_champion,
    })));
    return;
  }

  const rows = await db.execute(sql`
    SELECT h.season_id, s.name AS season_name, h.team_name, h.points, h.wins, h.losses
    FROM shift_wars_season_history h
    JOIN seasons s ON s.id = h.season_id
    WHERE h.is_champion = true
    ORDER BY h.season_id DESC
    LIMIT 24
  `);

  res.json((rows.rows as any[]).map(r => ({
    seasonId:     r.season_id,
    seasonName:   r.season_name,
    championName: r.team_name,
    points:       r.points,
    wins:         r.wins,
    losses:       r.losses,
  })));
});

// ── Match history ────────────────────────────────────────────────────────────

router.get("/shift-wars/matches", async (_req, res): Promise<void> => {
  const rows = await db.execute(sql`
    SELECT sm.id, sm.played_at, sm.stake, sm.game_type, sm.notes,
           sm.winner_team_id, wt.name AS winner_team_name,
           sm.loser_team_id, lt.name AS loser_team_name
    FROM shift_wars_matches sm
    JOIN shift_wars_teams wt ON wt.id = sm.winner_team_id
    JOIN shift_wars_teams lt ON lt.id = sm.loser_team_id
    ORDER BY sm.played_at DESC
    LIMIT 200
  `);

  res.json((rows.rows as any[]).map(r => ({
    id:             r.id,
    playedAt:       r.played_at,
    stake:          r.stake,
    gameType:       r.game_type,
    notes:          r.notes,
    winnerTeamId:   r.winner_team_id,
    winnerTeamName: r.winner_team_name,
    loserTeamId:    r.loser_team_id,
    loserTeamName:  r.loser_team_name,
  })));
});

// ── Record a Shift Wars match ────────────────────────────────────────────────

router.post("/shift-wars/matches", matchSubmitRateLimit, async (req, res): Promise<void> => {
  const parsed = RecordShiftWarsMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }
  const { winnerTeamId, loserTeamId, stake, gameType, notes } = parsed.data;

  if (winnerTeamId === loserTeamId) { res.status(400).json({ error: "A team cannot play itself" }); return; }

  // Locked transaction for the same reason as doubles/matches.ts: reading
  // team balances, computing new ones in JS, and writing them back as
  // separate unguarded statements lets two concurrent submissions for the
  // same team race and lose one match's points to the other.
  try {
    const { match, winnerName, loserName } = await db.transaction(async (tx) => {
      const teamRows = await tx.execute(sql`SELECT * FROM shift_wars_teams WHERE id IN (${winnerTeamId}, ${loserTeamId}) FOR UPDATE`);
      const teams = teamRows.rows as any[];
      const winner = teams.find(t => t.id === winnerTeamId);
      const loser  = teams.find(t => t.id === loserTeamId);

      if (!winner || !loser) throw new ShiftWarsConflictError("One or both teams not found");

      const stakeError = validateStake(
        stake,
        { points: winner.points, name: winner.name },
        { points: loser.points, name: loser.name },
      );
      if (stakeError) throw new ShiftWarsConflictError(stakeError);

      const { newWinnerPoints, newLoserPoints } = applyWager(
        stake,
        { points: winner.points },
        { points: loser.points },
      );

      await tx.execute(sql`
        UPDATE shift_wars_teams SET
          points = ${newWinnerPoints},
          peak_points = GREATEST(peak_points, ${newWinnerPoints}),
          wins = wins + 1
        WHERE id = ${winner.id}
      `);
      await tx.execute(sql`
        UPDATE shift_wars_teams SET
          points = ${newLoserPoints},
          losses = losses + 1
        WHERE id = ${loser.id}
      `);

      const [match] = (await tx.execute(sql`
        INSERT INTO shift_wars_matches (winner_team_id, loser_team_id, stake, game_type, notes)
        VALUES (${winner.id}, ${loser.id}, ${stake}, ${gameType}, ${notes ?? null})
        RETURNING *
      `)).rows as any[];

      return { match, winnerName: winner.name, loserName: loser.name };
    });

    res.status(201).json({ match, winnerName, loserName });

    // Push notifications (fire and forget — never delay the response). Shift
    // Wars had no notification integration at all before this. The match
    // itself only records team ids/names — no individual player attribution
    // — so the roster to notify is looked up fresh from players.shift_wars_
    // team_id rather than threaded through the transaction above.
    void (async () => {
      try {
        const rosterRows = await db.execute(sql`
          SELECT id, shift_wars_team_id FROM players WHERE shift_wars_team_id IN (${winnerTeamId}, ${loserTeamId})
        `);
        const roster = rosterRows.rows as any[];
        const winnerPlayerIds = roster.filter(p => p.shift_wars_team_id === winnerTeamId).map(p => p.id);
        const loserPlayerIds  = roster.filter(p => p.shift_wars_team_id === loserTeamId).map(p => p.id);
        await sendShiftWarsMatchResultNotification(winnerName, loserName, winnerPlayerIds, loserPlayerIds, stake);
      } catch (err) {
        req.log?.error?.({ err }, "Failed to send Shift Wars match result notifications");
      }
    })();
  } catch (err) {
    if (err instanceof ShiftWarsConflictError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// ── Admin: edit a team's points directly ────────────────────────────────────
// `points` is the live, currently-in-play value — safe to correct any time.
// `startingPoints` is only the baseline the monthly reset restores points to;
// changing it doesn't touch the team's current points until the next reset.

router.patch("/admin/shift-wars/teams/:id", requireAdminSession, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid team id" }); return; }
  const parsed = UpdateTeamPointsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }
  const { points, startingPoints } = parsed.data;

  const existingRows = (await db.execute(sql`SELECT * FROM shift_wars_teams WHERE id = ${id}`)).rows as any[];
  const existing = existingRows[0];
  if (!existing) { res.status(404).json({ error: "Team not found" }); return; }

  const newPoints = points ?? existing.points;
  const newStartingPoints = startingPoints ?? existing.starting_points;

  const rows = (await db.execute(sql`
    UPDATE shift_wars_teams SET
      points          = ${newPoints},
      peak_points     = GREATEST(peak_points, ${newPoints}),
      starting_points = ${newStartingPoints}
    WHERE id = ${id}
    RETURNING *
  `)).rows as any[];
  res.json(rows[0]);
});

// ── Admin: assign (or clear) a player's department team ─────────────────────

router.patch("/admin/shift-wars/players/:id/team", requireAdminSession, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid player id" }); return; }
  const parsed = AssignPlayerTeamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }

  const rows = (await db.execute(sql`
    UPDATE players SET shift_wars_team_id = ${parsed.data.teamId}
    WHERE id = ${id}
    RETURNING id, name, shift_wars_team_id
  `)).rows as any[];
  if (rows.length === 0) { res.status(404).json({ error: "Player not found" }); return; }
  res.json(rows[0]);
});

export default router;
