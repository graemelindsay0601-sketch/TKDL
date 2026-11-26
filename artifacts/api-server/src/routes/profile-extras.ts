/**
 * Profile extras: a player's honours (podium finishes across Singles, Doubles and Shift Wars) and their dart map
 * (where their practice darts land, ring by ring, from the scorer's dart logs).
 */
import { Router } from "express";
import { ensureMatchDartLogs } from "./match-darts";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router = Router();
const rows = async <T = Record<string, unknown>>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows as T[];

export type Honour = { competition: "Singles" | "Doubles" | "Shift Wars"; seasonId: number; seasonName: string; position: 1 | 2 | 3; team?: string; at: string | null };

router.get("/players/:id/honours", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const out: Honour[] = [];
  const singles = await rows<{ season_id: number; name: string; position: number; end_date: string | null }>(sql`SELECT ss.season_id, s.name, ss.position, s.end_date
    FROM season_standings ss JOIN seasons s ON s.id = ss.season_id
    WHERE ss.player_id = ${id} AND ss.position BETWEEN 1 AND 3 AND s.is_active = false AND COALESCE(s.league_type, 'singles') = 'singles' AND (ss.wins + ss.losses) > 0`);
  for (const r of singles) out.push({ competition: "Singles", seasonId: Number(r.season_id), seasonName: r.name, position: Number(r.position) as 1 | 2 | 3, at: r.end_date });
  try {
    // Doubles: final table order (points, then wins) in finished doubles seasons
    const teams = await rows<{ id: number; season_id: number; name: string; end_date: string | null; team_name: string; p1: number; p2: number; p3: number | null; rnk: number }>(sql`SELECT * FROM (
        SELECT t.id, t.season_id, s.name, s.end_date, t.team_name, t.player1_id p1, t.player2_id p2, t.player3_id p3,
          ROW_NUMBER() OVER (PARTITION BY t.season_id ORDER BY t.points DESC, t.wins DESC, t.id) rnk
        FROM doubles_teams t JOIN seasons s ON s.id = t.season_id WHERE s.is_active = false AND (t.wins + t.losses) > 0) x
      WHERE rnk <= 3 AND ${id} IN (p1, p2, COALESCE(p3, -1))`);
    for (const t of teams) out.push({ competition: "Doubles", seasonId: Number(t.season_id), seasonName: t.name, position: Number(t.rnk) as 1 | 2 | 3, team: t.team_name, at: t.end_date });
  } catch { /* no doubles yet */ }
  try {
    const shift = await rows<{ season_id: number; name: string; team_name: string; recorded_at: string }>(sql`SELECT h.season_id, s.name, h.team_name, h.recorded_at
      FROM shift_wars_season_history h JOIN players p ON p.shift_wars_team_id = h.team_id JOIN seasons s ON s.id = h.season_id
      WHERE p.id = ${id} AND h.is_champion = true`);
    for (const r of shift) out.push({ competition: "Shift Wars", seasonId: Number(r.season_id), seasonName: r.name, position: 1, team: r.team_name, at: r.recorded_at });
  } catch { /* no shift wars yet */ }
  out.sort((a, b) => a.position - b.position || String(b.at ?? "").localeCompare(String(a.at ?? "")));
  res.json({ honours: out });
});

/** Where a player's practice darts land: counts per segment and ring (1–20 single/double/treble, bull 25/50). */
router.get("/players/:id/dart-map", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  await ensureMatchDartLogs();
  const cells = await rows<{ seg: number; mult: number; n: number }>(sql`SELECT (d->>'seg')::int seg, COALESCE((d->>'mult')::int, 1) mult, COUNT(*)::int n
    FROM (SELECT jsonb_array_elements(session_data->'dartLog') d FROM practice_sessions WHERE player1_id = ${id} AND session_data ? 'dartLog'
      UNION ALL SELECT jsonb_array_elements(CASE WHEN m.winner_id = ${id} THEN l.winner_darts ELSE l.loser_darts END) d
      FROM match_dart_logs l JOIN matches m ON m.id = l.match_id WHERE m.winner_id = ${id} OR m.loser_id = ${id}) t
    WHERE NOT (d ? 'typed') AND (d->>'seg') IS NOT NULL GROUP BY 1, 2`);
  let total = 0, misses = 0;
  const map: { seg: number; mult: number; n: number }[] = [];
  for (const c of cells) {
    const seg = Number(c.seg), mult = Number(c.mult), n = Number(c.n); total += n;
    if (seg === 0) { misses += n; continue; }
    if ((seg >= 1 && seg <= 20 && mult >= 1 && mult <= 3) || (seg === 25 && (mult === 1 || mult === 2))) map.push({ seg, mult, n });
  }
  res.json({ total, misses, cells: map });
});

export default router;
