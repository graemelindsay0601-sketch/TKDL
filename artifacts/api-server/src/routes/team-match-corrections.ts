import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { logAdminAction } from "../lib/adminAudit";
import { reverseTeamLedger } from "../lib/team-match-rollback";

const router = Router();
const ELO_FLOOR = 800;

type League = "doubles" | "shift_wars";
type MatchKind = "standard" | "combined";

class CorrectionConflictError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

function parseLeague(value: string): League | null {
  return value === "doubles" || value === "shift_wars" ? value : null;
}

function parseKind(value: string): MatchKind | null {
  return value === "standard" || value === "combined" ? value : null;
}

async function activeSeason(executor: any, league: League): Promise<any | null> {
  const rows = await executor.execute(sql`
    SELECT id, name, start_date
    FROM seasons
    WHERE is_active = true AND league_type = ${league}
    LIMIT 1
  `);
  return (rows.rows as any[])[0] ?? null;
}

async function latestResult(executor: any, league: League, season: any): Promise<{ kind: MatchKind; id: number; playedAt: string | Date } | null> {
  const rows = league === "doubles"
    ? await executor.execute(sql`
        SELECT kind, id, played_at
        FROM (
          SELECT 'standard'::text AS kind, id, played_at FROM doubles_matches WHERE season_id = ${season.id}
          UNION ALL
          SELECT 'combined'::text AS kind, id, played_at FROM doubles_combined_matches WHERE season_id = ${season.id}
        ) recent
        ORDER BY played_at DESC, kind ASC, id DESC
        LIMIT 1
      `)
    : await executor.execute(sql`
        SELECT kind, id, played_at
        FROM (
          SELECT 'standard'::text AS kind, id, played_at
          FROM shift_wars_matches WHERE season_id = ${season.id}
          UNION ALL
          SELECT 'combined'::text AS kind, id, played_at
          FROM shift_wars_combined_matches WHERE season_id = ${season.id}
        ) recent
        ORDER BY played_at DESC, kind ASC, id DESC
        LIMIT 1
      `);
  const row = (rows.rows as any[])[0];
  return row ? { kind: row.kind, id: row.id, playedAt: row.played_at } : null;
}

function restoredValue(current: number, delta: number): number {
  return current - delta;
}

async function buildPreview(executor: any, league: League, latest: { kind: MatchKind; id: number; playedAt: string | Date }): Promise<any> {
  if (league === "doubles" && latest.kind === "standard") {
    const rows = await executor.execute(sql`
      SELECT dm.*, wt.team_name AS winner_name, wt.points AS winner_points, wt.elo AS winner_elo,
             lt.team_name AS loser_name, lt.points AS loser_points, lt.elo AS loser_elo, lt.is_eliminated AS loser_is_eliminated
      FROM doubles_matches dm
      JOIN doubles_teams wt ON wt.id = dm.winner_team_id
      JOIN doubles_teams lt ON lt.id = dm.loser_team_id
      WHERE dm.id = ${latest.id}
    `);
    const m = (rows.rows as any[])[0];
    if (!m) return null;
    const winnerEloDelta = m.winner_elo_delta ?? m.elo_change ?? 0;
    const loserEloDelta = m.loser_elo_delta ?? (m.loser_elo > ELO_FLOOR ? -(m.elo_change ?? 0) : 0);
    return {
      league, kind: latest.kind, id: m.id, playedAt: m.played_at,
      title: `${m.winner_name} defeated ${m.loser_name}`,
      subtitle: `Standard Doubles · ${m.stake} points`, notes: m.notes,
      exact: m.winner_elo_delta !== null && m.loser_elo_delta !== null,
      teams: [
        { id: m.winner_team_id, name: m.winner_name, result: "win", pointsNow: m.winner_points, pointsAfter: m.winner_points - m.stake, eloNow: m.winner_elo, eloAfter: restoredValue(m.winner_elo, winnerEloDelta) },
        { id: m.loser_team_id, name: m.loser_name, result: "loss", pointsNow: m.loser_points, pointsAfter: m.loser_points + m.stake, eloNow: m.loser_elo, eloAfter: restoredValue(m.loser_elo, loserEloDelta), reactivates: m.loser_is_eliminated && (m.loser_points + m.stake > 0) },
      ],
    };
  }

  if (league === "doubles") {
    const parentRows = await executor.execute(sql`
      SELECT m.*, t.team_name AS solo_name, t.points AS solo_points, t.elo AS solo_elo, t.is_eliminated AS solo_is_eliminated
      FROM doubles_combined_matches m JOIN doubles_teams t ON t.id = m.solo_team_id
      WHERE m.id = ${latest.id}
    `);
    const m = (parentRows.rows as any[])[0];
    if (!m) return null;
    const sideRows = await executor.execute(sql`
      SELECT s.*, t.team_name, t.points, t.elo, t.is_eliminated
      FROM doubles_combined_match_sides s JOIN doubles_teams t ON t.id = s.team_id
      WHERE s.match_id = ${latest.id} ORDER BY s.id
    `);
    const sides = sideRows.rows as any[];
    const combinedNames = sides.map(s => s.team_name).join(" + ");
    return {
      league, kind: latest.kind, id: m.id, playedAt: m.played_at,
      title: m.solo_won ? `${m.solo_name} defeated ${combinedNames}` : `${combinedNames} defeated ${m.solo_name}`,
      subtitle: `Uneven Doubles · ${m.pot} point pot`, notes: m.notes, exact: true,
      teams: [
        { id: m.solo_team_id, name: m.solo_name, result: m.solo_won ? "win" : "loss", pointsNow: m.solo_points, pointsAfter: restoredValue(m.solo_points, m.solo_points_delta), eloNow: m.solo_elo, eloAfter: restoredValue(m.solo_elo, m.solo_elo_delta), reactivates: !m.solo_won && m.solo_is_eliminated && restoredValue(m.solo_points, m.solo_points_delta) > 0 },
        ...sides.map(s => ({ id: s.team_id, name: s.team_name, result: m.solo_won ? "loss" : "win", pointsNow: s.points, pointsAfter: restoredValue(s.points, s.points_delta), eloNow: s.elo, eloAfter: restoredValue(s.elo, s.elo_delta), reactivates: s.eliminated && s.is_eliminated && restoredValue(s.points, s.points_delta) > 0 })),
      ],
    };
  }

  if (latest.kind === "standard") {
    const rows = await executor.execute(sql`
      SELECT m.*, wt.name AS winner_name, wt.points AS winner_points,
             lt.name AS loser_name, lt.points AS loser_points
      FROM shift_wars_matches m
      JOIN shift_wars_teams wt ON wt.id = m.winner_team_id
      JOIN shift_wars_teams lt ON lt.id = m.loser_team_id
      WHERE m.id = ${latest.id}
    `);
    const m = (rows.rows as any[])[0];
    if (!m) return null;
    return {
      league, kind: latest.kind, id: m.id, playedAt: m.played_at,
      title: `${m.winner_name} defeated ${m.loser_name}`,
      subtitle: `Standard Shift Wars · ${m.stake} points`, notes: m.notes, exact: true,
      teams: [
        { id: m.winner_team_id, name: m.winner_name, result: "win", pointsNow: m.winner_points, pointsAfter: m.winner_points - m.stake },
        { id: m.loser_team_id, name: m.loser_name, result: "loss", pointsNow: m.loser_points, pointsAfter: m.loser_points + m.stake },
      ],
    };
  }

  const parentRows = await executor.execute(sql`
    SELECT m.*, t.name AS solo_name, t.points AS solo_points
    FROM shift_wars_combined_matches m JOIN shift_wars_teams t ON t.id = m.solo_team_id
    WHERE m.id = ${latest.id}
  `);
  const m = (parentRows.rows as any[])[0];
  if (!m) return null;
  const sideRows = await executor.execute(sql`
    SELECT s.*, t.name AS team_name, t.points
    FROM shift_wars_combined_match_sides s JOIN shift_wars_teams t ON t.id = s.team_id
    WHERE s.match_id = ${latest.id} ORDER BY s.id
  `);
  const sides = sideRows.rows as any[];
  const combinedNames = sides.map(s => s.team_name).join(" + ");
  return {
    league, kind: latest.kind, id: m.id, playedAt: m.played_at,
    title: m.solo_won ? `${m.solo_name} defeated ${combinedNames}` : `${combinedNames} defeated ${m.solo_name}`,
    subtitle: `Uneven Shift Wars · ${m.pot} point pot`, notes: m.notes, exact: true,
    teams: [
      { id: m.solo_team_id, name: m.solo_name, result: m.solo_won ? "win" : "loss", pointsNow: m.solo_points, pointsAfter: restoredValue(m.solo_points, m.solo_points_delta) },
      ...sides.map(s => ({ id: s.team_id, name: s.team_name, result: m.solo_won ? "loss" : "win", pointsNow: s.points, pointsAfter: restoredValue(s.points, s.points_delta) })),
    ],
  };
}

router.get("/admin/team-match-corrections/:league/latest", requireAdminSession, async (req, res): Promise<void> => {
  const league = parseLeague(String(req.params.league));
  if (!league) { res.status(400).json({ error: "Invalid league" }); return; }
  const season = await activeSeason(db, league);
  if (!season) { res.json(null); return; }
  const latest = await latestResult(db, league, season);
  if (!latest) { res.json(null); return; }
  res.json(await buildPreview(db, league, latest));
});

async function rollbackDoubles(tx: any, kind: MatchKind, id: number): Promise<void> {
  if (kind === "standard") {
    const rows = await tx.execute(sql`
      SELECT dm.*, wt.points AS winner_points, wt.elo AS winner_elo, wt.wins AS winner_wins, wt.losses AS winner_losses,
             lt.points AS loser_points, lt.elo AS loser_elo, lt.wins AS loser_wins, lt.losses AS loser_losses,
             lt.is_eliminated AS loser_is_eliminated
      FROM doubles_matches dm
      JOIN doubles_teams wt ON wt.id = dm.winner_team_id
      JOIN doubles_teams lt ON lt.id = dm.loser_team_id
      WHERE dm.id = ${id}
      FOR UPDATE OF dm, wt, lt
    `);
    const m = (rows.rows as any[])[0];
    if (!m) throw new CorrectionConflictError("Doubles result not found", 404);
    const winnerEloDelta = m.winner_elo_delta ?? m.elo_change ?? 0;
    const loserEloDelta = m.loser_elo_delta ?? (m.loser_elo > ELO_FLOOR ? -(m.elo_change ?? 0) : 0);
    const reactivates = (m.loser_eliminated === true || (m.loser_eliminated === null && m.loser_is_eliminated)) && m.loser_points + m.stake > 0;
    let winner, loser;
    try {
      winner = reverseTeamLedger(
        { points: m.winner_points, elo: m.winner_elo, wins: m.winner_wins, losses: m.winner_losses, isEliminated: false },
        { pointsDelta: m.stake, eloDelta: winnerEloDelta, won: true },
      );
      loser = reverseTeamLedger(
        { points: m.loser_points, elo: m.loser_elo, wins: m.loser_wins, losses: m.loser_losses, isEliminated: m.loser_is_eliminated },
        { pointsDelta: -m.stake, eloDelta: loserEloDelta, won: false, causedElimination: reactivates },
      );
    } catch {
      throw new CorrectionConflictError("A team balance was manually reduced after this result. Restore it before undoing the match.");
    }
    await tx.execute(sql`UPDATE doubles_teams SET points = ${winner.points}, elo = ${winner.elo!}, wins = ${winner.wins}, losses = ${winner.losses} WHERE id = ${m.winner_team_id}`);
    await tx.execute(sql`UPDATE doubles_teams SET points = ${loser.points}, elo = ${loser.elo!}, wins = ${loser.wins}, losses = ${loser.losses}, is_eliminated = ${loser.isEliminated!} WHERE id = ${m.loser_team_id}`);
    await tx.execute(sql`DELETE FROM doubles_matches WHERE id = ${id}`);
    return;
  }

  const parents = await tx.execute(sql`
    SELECT m.*, t.points AS solo_points, t.elo AS solo_elo, t.wins AS solo_wins, t.losses AS solo_losses, t.is_eliminated AS solo_is_eliminated
    FROM doubles_combined_matches m JOIN doubles_teams t ON t.id = m.solo_team_id
    WHERE m.id = ${id} FOR UPDATE OF m, t
  `);
  const m = (parents.rows as any[])[0];
  if (!m) throw new CorrectionConflictError("Uneven Doubles result not found", 404);
  const sideResult = await tx.execute(sql`
    SELECT s.*, t.points, t.elo, t.wins, t.losses, t.is_eliminated
    FROM doubles_combined_match_sides s JOIN doubles_teams t ON t.id = s.team_id
    WHERE s.match_id = ${id} ORDER BY s.id FOR UPDATE OF s, t
  `);
  const sides = sideResult.rows as any[];
  let solo;
  const restoredSides: { row: any; restored: ReturnType<typeof reverseTeamLedger> }[] = [];
  try {
    solo = reverseTeamLedger(
      { points: m.solo_points, elo: m.solo_elo, wins: m.solo_wins, losses: m.solo_losses, isEliminated: m.solo_is_eliminated },
      { pointsDelta: m.solo_points_delta, eloDelta: m.solo_elo_delta, won: m.solo_won, causedElimination: !m.solo_won && m.solo_is_eliminated && m.solo_points - m.solo_points_delta > 0 },
    );
    for (const s of sides) {
      restoredSides.push({
        row: s,
        restored: reverseTeamLedger(
          { points: s.points, elo: s.elo, wins: s.wins, losses: s.losses, isEliminated: s.is_eliminated },
          { pointsDelta: s.points_delta, eloDelta: s.elo_delta, won: !m.solo_won, causedElimination: s.eliminated },
        ),
      });
    }
  } catch {
    throw new CorrectionConflictError("A team balance was manually reduced after this result. Restore it before undoing the match.");
  }
  await tx.execute(sql`UPDATE doubles_teams SET points = ${solo.points}, elo = ${solo.elo!}, wins = ${solo.wins}, losses = ${solo.losses}, is_eliminated = ${solo.isEliminated!} WHERE id = ${m.solo_team_id}`);
  for (const { row: s, restored } of restoredSides) {
    await tx.execute(sql`
      UPDATE doubles_teams SET
        points = ${restored.points}, elo = ${restored.elo!}, wins = ${restored.wins}, losses = ${restored.losses}, is_eliminated = ${restored.isEliminated!}
      WHERE id = ${s.team_id}
    `);
  }
  await tx.execute(sql`DELETE FROM doubles_combined_matches WHERE id = ${id}`);
}

async function rollbackShiftWars(tx: any, kind: MatchKind, id: number): Promise<void> {
  if (kind === "standard") {
    const rows = await tx.execute(sql`
      SELECT m.*, wt.points AS winner_points, wt.wins AS winner_wins, wt.losses AS winner_losses,
             lt.points AS loser_points, lt.wins AS loser_wins, lt.losses AS loser_losses
      FROM shift_wars_matches m
      JOIN shift_wars_teams wt ON wt.id = m.winner_team_id
      JOIN shift_wars_teams lt ON lt.id = m.loser_team_id
      WHERE m.id = ${id} FOR UPDATE OF m, wt, lt
    `);
    const m = (rows.rows as any[])[0];
    if (!m) throw new CorrectionConflictError("Shift Wars result not found", 404);
    let winner, loser;
    try {
      winner = reverseTeamLedger({ points: m.winner_points, wins: m.winner_wins, losses: m.winner_losses }, { pointsDelta: m.stake, won: true });
      loser = reverseTeamLedger({ points: m.loser_points, wins: m.loser_wins, losses: m.loser_losses }, { pointsDelta: -m.stake, won: false });
    } catch {
      throw new CorrectionConflictError("A team balance was manually reduced after this result. Restore it before undoing the match.");
    }
    await tx.execute(sql`UPDATE shift_wars_teams SET points = ${winner.points}, wins = ${winner.wins}, losses = ${winner.losses} WHERE id = ${m.winner_team_id}`);
    await tx.execute(sql`UPDATE shift_wars_teams SET points = ${loser.points}, wins = ${loser.wins}, losses = ${loser.losses} WHERE id = ${m.loser_team_id}`);
    await tx.execute(sql`DELETE FROM shift_wars_matches WHERE id = ${id}`);
    return;
  }

  const parents = await tx.execute(sql`
    SELECT m.*, t.points AS solo_points, t.wins AS solo_wins, t.losses AS solo_losses
    FROM shift_wars_combined_matches m JOIN shift_wars_teams t ON t.id = m.solo_team_id
    WHERE m.id = ${id} FOR UPDATE OF m, t
  `);
  const m = (parents.rows as any[])[0];
  if (!m) throw new CorrectionConflictError("Uneven Shift Wars result not found", 404);
  const sideResult = await tx.execute(sql`
    SELECT s.*, t.points, t.wins, t.losses FROM shift_wars_combined_match_sides s
    JOIN shift_wars_teams t ON t.id = s.team_id
    WHERE s.match_id = ${id} ORDER BY s.id FOR UPDATE OF s, t
  `);
  const sides = sideResult.rows as any[];
  let solo;
  const restoredSides: { row: any; restored: ReturnType<typeof reverseTeamLedger> }[] = [];
  try {
    solo = reverseTeamLedger({ points: m.solo_points, wins: m.solo_wins, losses: m.solo_losses }, { pointsDelta: m.solo_points_delta, won: m.solo_won });
    for (const s of sides) restoredSides.push({ row: s, restored: reverseTeamLedger({ points: s.points, wins: s.wins, losses: s.losses }, { pointsDelta: s.points_delta, won: !m.solo_won }) });
  } catch {
    throw new CorrectionConflictError("A team balance was manually reduced after this result. Restore it before undoing the match.");
  }
  await tx.execute(sql`UPDATE shift_wars_teams SET points = ${solo.points}, wins = ${solo.wins}, losses = ${solo.losses} WHERE id = ${m.solo_team_id}`);
  for (const { row: s, restored } of restoredSides) {
    await tx.execute(sql`
      UPDATE shift_wars_teams SET points = ${restored.points}, wins = ${restored.wins}, losses = ${restored.losses}
      WHERE id = ${s.team_id}
    `);
  }
  await tx.execute(sql`DELETE FROM shift_wars_combined_matches WHERE id = ${id}`);
}

router.delete("/admin/team-match-corrections/:league/:kind/:id", requireAdminSession, async (req, res): Promise<void> => {
  const league = parseLeague(String(req.params.league));
  const kind = parseKind(String(req.params.kind));
  const id = Number(req.params.id);
  if (!league || !kind || !Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid correction target" }); return; }

  let deletedPreview: any;
  try {
    deletedPreview = await db.transaction(async (tx) => {
      const season = await activeSeason(tx, league);
      if (!season) throw new CorrectionConflictError(`No active ${league === "doubles" ? "Doubles" : "Shift Wars"} season`, 400);
      const latest = await latestResult(tx, league, season);
      if (!latest || latest.kind !== kind || latest.id !== id) {
        throw new CorrectionConflictError("Only the newest result can be undone safely. Refresh and undo newer results first.");
      }
      const preview = await buildPreview(tx, league, latest);
      if (!preview) throw new CorrectionConflictError("Result not found", 404);
      if (league === "doubles") await rollbackDoubles(tx, kind, id);
      else await rollbackShiftWars(tx, kind, id);

      // Keep generated surfaces consistent with the corrected ledger. The
      // post remains in the database for audit/recovery but no longer appears
      // in the approved Community feed. Broadcast stories are resolved rather
      // than deleted so an already-aired edition never loses its source row.
      const autoType = league === "doubles"
        ? (kind === "standard" ? "doubles_match" : "doubles_combined_match")
        : (kind === "standard" ? "shift_wars_match" : "shift_wars_combined_match");
      await tx.execute(sql`
        UPDATE community_posts SET status = 'rejected'
        WHERE post_type = 'auto'
          AND auto_meta->>'type' = ${autoType}
          AND auto_meta->>'matchId' = ${String(id)}
      `);
      if (kind === "standard") {
        await tx.execute(sql`
          UPDATE broadcast_stories
          SET lifecycle = 'RESOLVED', resolved_at = COALESCE(resolved_at, NOW()), updated_at = NOW()
          WHERE league_type = ${league} AND anchor_match_id = ${id} AND lifecycle <> 'RESOLVED'
        `);
      }
      return preview;
    });
  } catch (err) {
    if (err instanceof CorrectionConflictError) { res.status(err.status).json({ error: err.message }); return; }
    throw err;
  }

  void logAdminAction(req, `${league}.match.delete`, `${league}_${kind}_match`, id, {
    title: deletedPreview.title,
    playedAt: deletedPreview.playedAt,
    teams: deletedPreview.teams,
  });
  res.json({ deleted: true, result: deletedPreview });
});

export default router;
