import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, seasonsTable } from "@workspace/db";
import { z } from "zod";
import { applyEloChange, calcTier } from "../lib/elo";
import { validateStake, applyWager } from "../lib/wager";
import { matchSubmitRateLimit } from "../middleware/writeRateLimit";
import { sendDoublesMatchResultNotification } from "../services/notificationService";

const GetSeasonParams = z.object({ id: z.coerce.number().int().positive() });

const RecordDoublesMatchBody = z.object({
  winnerTeamId: z.number().int().positive(),
  loserTeamId:  z.number().int().positive(),
  stake:        z.number().int().min(0),
  gameType:     z.string().optional().default("doubles_501"),
  notes:        z.string().optional(),
});

const router = Router();

class DoublesConflictError extends Error {}

// ── Team standings for a season ─────────────────────────────────────────────────

router.get("/seasons/:id/doubles/teams", async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db.execute(sql`
    SELECT dt.id, dt.season_id, dt.team_name, dt.points, dt.peak_points, dt.elo,
           dt.wins, dt.losses, dt.is_eliminated, dt.created_at,
           dt.player1_id, p1.name AS player1_name,
           dt.player2_id, p2.name AS player2_name,
           dt.player3_id, p3.name AS player3_name
    FROM doubles_teams dt
    JOIN players p1 ON p1.id = dt.player1_id
    JOIN players p2 ON p2.id = dt.player2_id
    LEFT JOIN players p3 ON p3.id = dt.player3_id
    WHERE dt.season_id = ${params.data.id}
  `);

  const teams = (rows.rows as any[]).map(t => ({
    id: t.id,
    seasonId: t.season_id,
    teamName: t.team_name,
    points: t.points,
    peakPoints: t.peak_points,
    elo: t.elo,
    tier: calcTier(t.elo),
    wins: t.wins,
    losses: t.losses,
    isEliminated: t.is_eliminated,
    players: [
      { id: t.player1_id, name: t.player1_name },
      { id: t.player2_id, name: t.player2_name },
      ...(t.player3_id ? [{ id: t.player3_id, name: t.player3_name }] : []),
    ],
  }));

  const active = teams.filter(t => !t.isEliminated).sort((a, b) => b.points - a.points || b.elo - a.elo);
  const eliminated = teams.filter(t => t.isEliminated).sort((a, b) => b.points - a.points);
  const sorted = [...active, ...eliminated].map((t, i) => ({ position: i + 1, ...t }));

  res.json(sorted);
});

// ── Match history for a season ──────────────────────────────────────────────────

router.get("/seasons/:id/doubles/matches", async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db.execute(sql`
    SELECT dm.id, dm.played_at, dm.stake, dm.elo_change, dm.game_type, dm.notes,
           dm.winner_team_id, wt.team_name AS winner_team_name,
           dm.loser_team_id, lt.team_name AS loser_team_name
    FROM doubles_matches dm
    JOIN doubles_teams wt ON wt.id = dm.winner_team_id
    JOIN doubles_teams lt ON lt.id = dm.loser_team_id
    WHERE dm.season_id = ${params.data.id}
    ORDER BY dm.played_at DESC
    LIMIT 200
  `);

  res.json((rows.rows as any[]).map(r => ({
    id: r.id,
    playedAt: r.played_at,
    stake: r.stake,
    eloChange: r.elo_change,
    gameType: r.game_type,
    notes: r.notes,
    winnerTeamId: r.winner_team_id,
    winnerTeamName: r.winner_team_name,
    loserTeamId: r.loser_team_id,
    loserTeamName: r.loser_team_name,
  })));
});

// ── Record a doubles match (against the currently active season) ───────────────

router.post("/doubles/matches", matchSubmitRateLimit, async (req, res): Promise<void> => {
  const parsed = RecordDoublesMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }
  const { winnerTeamId, loserTeamId, stake, gameType, notes } = parsed.data;

  if (winnerTeamId === loserTeamId) { res.status(400).json({ error: "A team cannot play itself" }); return; }

  // Doubles now runs its own independent season lifecycle, separate from
  // Singles — filtering by league_type is required, not just isActive,
  // since both can be active at once.
  const [activeSeason] = await db.select().from(seasonsTable)
    .where(and(eq(seasonsTable.isActive, true), eq(seasonsTable.leagueType, "doubles")))
    .limit(1);
  if (!activeSeason) { res.status(400).json({ error: "No active Doubles Event season found" }); return; }

  // Everything from here on reads two team rows, computes new balances in JS,
  // then writes them back — that read-modify-write must happen inside a
  // single locked transaction, or two doubles matches submitted for the same
  // team close together (or the process crashing mid-way) could either lose
  // one match's stat gains to the other, or leave the points/Elo update
  // applied but the match row never inserted. FOR UPDATE locks both team
  // rows for the rest of the transaction so a concurrent submission for
  // either team has to wait for this one to commit before it reads.
  try {
    const {
      match, eloChange, loserEliminated,
      winnerTeamName, loserTeamName, winnerPlayerIds, loserPlayerIds,
    } = await db.transaction(async (tx) => {
      const teamRows = await tx.execute(sql`
        SELECT * FROM doubles_teams WHERE id IN (${winnerTeamId}, ${loserTeamId}) AND season_id = ${activeSeason.id} FOR UPDATE
      `);
      const teams = teamRows.rows as any[];
      const winner = teams.find(t => t.id === winnerTeamId);
      const loser  = teams.find(t => t.id === loserTeamId);

      if (!winner || !loser) throw new DoublesConflictError("One or both teams not found in the active season's doubles event");
      if (winner.is_eliminated) throw new DoublesConflictError(`${winner.team_name} has been eliminated from doubles and cannot play`);
      if (loser.is_eliminated)  throw new DoublesConflictError(`${loser.team_name} has been eliminated from doubles and cannot play`);

      const stakeError = validateStake(
        stake,
        { points: winner.points, name: winner.team_name },
        { points: loser.points, name: loser.team_name },
      );
      if (stakeError) throw new DoublesConflictError(stakeError);

      const { newWinnerPoints, newLoserPoints, loserEliminated } = applyWager(
        stake,
        { points: winner.points },
        { points: loser.points },
      );
      const { newWinnerElo, newLoserElo, change: eloChange } = applyEloChange(winner.elo, loser.elo);

      await tx.execute(sql`
        UPDATE doubles_teams SET
          points = ${newWinnerPoints},
          peak_points = GREATEST(peak_points, ${newWinnerPoints}),
          elo = ${newWinnerElo},
          wins = wins + 1
        WHERE id = ${winner.id}
      `);
      await tx.execute(sql`
        UPDATE doubles_teams SET
          points = ${newLoserPoints},
          elo = ${newLoserElo},
          losses = losses + 1,
          is_eliminated = is_eliminated OR ${loserEliminated}
        WHERE id = ${loser.id}
      `);

      const [match] = (await tx.execute(sql`
        INSERT INTO doubles_matches (season_id, winner_team_id, loser_team_id, stake, elo_change, game_type, notes)
        VALUES (${activeSeason.id}, ${winner.id}, ${loser.id}, ${stake}, ${eloChange}, ${gameType}, ${notes ?? null})
        RETURNING *
      `)).rows as any[];

      const teamPlayerIds = (t: any): number[] =>
        [t.player1_id, t.player2_id, t.player3_id].filter((id): id is number => id != null);

      return {
        match, eloChange, loserEliminated,
        winnerTeamName: winner.team_name, loserTeamName: loser.team_name,
        winnerPlayerIds: teamPlayerIds(winner), loserPlayerIds: teamPlayerIds(loser),
      };
    });

    res.status(201).json({ match, eloChange, loserEliminated });

    // Push notifications (fire and forget — never delay the response). Doubles
    // had no notification integration at all before this; see the "no
    // individual player attribution" comment on shift-wars.ts for why the
    // team's own roster is looked up here rather than passed in.
    void sendDoublesMatchResultNotification(
      winnerTeamName, loserTeamName,
      winnerPlayerIds, loserPlayerIds,
      stake, eloChange,
    );
  } catch (err) {
    if (err instanceof DoublesConflictError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;
