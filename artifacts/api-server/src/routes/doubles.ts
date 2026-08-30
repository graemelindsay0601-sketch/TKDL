import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, seasonsTable } from "@workspace/db";
import { z } from "zod";
import { applyEloChange, calcTier } from "../lib/elo";
import { validateStake, applyWager } from "../lib/wager";
import { matchSubmitRateLimit } from "../middleware/writeRateLimit";

const GetSeasonParams = z.object({ id: z.coerce.number().int().positive() });

const RecordDoublesMatchBody = z.object({
  winnerTeamId: z.number().int().positive(),
  loserTeamId:  z.number().int().positive(),
  stake:        z.number().int().min(0),
  gameType:     z.string().optional().default("doubles_501"),
  notes:        z.string().optional(),
});

const router = Router();

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

  const [activeSeason] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
  if (!activeSeason) { res.status(400).json({ error: "No active season found" }); return; }

  const teamRows = await db.execute(sql`
    SELECT * FROM doubles_teams WHERE id IN (${winnerTeamId}, ${loserTeamId}) AND season_id = ${activeSeason.id}
  `);
  const teams = teamRows.rows as any[];
  const winner = teams.find(t => t.id === winnerTeamId);
  const loser  = teams.find(t => t.id === loserTeamId);

  if (!winner || !loser) { res.status(400).json({ error: "One or both teams not found in the active season's doubles event" }); return; }
  if (winner.is_eliminated) { res.status(400).json({ error: `${winner.team_name} has been eliminated from doubles and cannot play` }); return; }
  if (loser.is_eliminated)  { res.status(400).json({ error: `${loser.team_name} has been eliminated from doubles and cannot play` }); return; }

  const stakeError = validateStake(
    stake,
    { points: winner.points, name: winner.team_name },
    { points: loser.points, name: loser.team_name },
  );
  if (stakeError) { res.status(400).json({ error: stakeError }); return; }

  const { newWinnerPoints, newLoserPoints, loserEliminated } = applyWager(
    stake,
    { points: winner.points },
    { points: loser.points },
  );
  const { newWinnerElo, newLoserElo, change: eloChange } = applyEloChange(winner.elo, loser.elo);

  await db.execute(sql`
    UPDATE doubles_teams SET
      points = ${newWinnerPoints},
      peak_points = GREATEST(peak_points, ${newWinnerPoints}),
      elo = ${newWinnerElo},
      wins = wins + 1
    WHERE id = ${winner.id}
  `);
  await db.execute(sql`
    UPDATE doubles_teams SET
      points = ${newLoserPoints},
      elo = ${newLoserElo},
      losses = losses + 1,
      is_eliminated = is_eliminated OR ${loserEliminated}
    WHERE id = ${loser.id}
  `);

  const [match] = (await db.execute(sql`
    INSERT INTO doubles_matches (season_id, winner_team_id, loser_team_id, stake, elo_change, game_type, notes)
    VALUES (${activeSeason.id}, ${winner.id}, ${loser.id}, ${stake}, ${eloChange}, ${gameType}, ${notes ?? null})
    RETURNING *
  `)).rows as any[];

  res.status(201).json({ match, eloChange, loserEliminated });
});

export default router;
