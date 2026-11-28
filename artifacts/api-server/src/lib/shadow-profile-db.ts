// Loads every logged dart for a player (practice + live-scored league matches) for the Shadow Bot.
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import type { LoggedDart } from "./shadow-profile";

export async function loggedDarts(playerId: number): Promise<LoggedDart[]> {
  const prac = (await db.execute(sql`
    SELECT (d->>'seg')::int seg, (d->>'mult')::int mult, COALESCE((d->>'val')::int, 0) val, d->>'phase' phase, ps.created_at at
    FROM practice_sessions ps, jsonb_array_elements(ps.session_data->'dartLog') d
    WHERE ps.player1_id = ${playerId} AND ps.session_data ? 'dartLog' AND NOT (d ? 'typed') AND d ? 'seg'`)).rows as any[];
  const league = (await db.execute(sql`
    SELECT (d->>'seg')::int seg, (d->>'mult')::int mult, COALESCE((d->>'val')::int, 0) val, d->>'phase' phase, m.played_at at
    FROM match_dart_logs l JOIN matches m ON m.id = l.match_id,
      jsonb_array_elements(CASE WHEN m.winner_id = ${playerId} THEN l.winner_darts ELSE l.loser_darts END) d
    WHERE (m.winner_id = ${playerId} OR m.loser_id = ${playerId}) AND NOT (d ? 'typed') AND d ? 'seg'`).catch(() => ({ rows: [] }))).rows as any[];
  const map = (r: any, source: LoggedDart["source"]): LoggedDart => ({
    seg: Number(r.seg) || 0, mult: Number(r.mult) || 0, val: Number(r.val) || 0, phase: String(r.phase ?? "scoring"),
    at: new Date(r.at).toISOString(), source,
  });
  return [...prac.map(r => map(r, "practice")), ...league.map(r => map(r, "league"))];
}

/** Darts that count towards unlocking a shadow, the same count the Shadow Bot page shows: every practice dart plus every league dart recorded on a result. */
export async function unlockDarts(playerId: number): Promise<{ practice: number; league: number; total: number; practiceAvg: number | null }> {
  const p = (await db.execute(sql`SELECT COALESCE(SUM(p1_darts),0)::int n, COALESCE(SUM(p1_score),0)::int s FROM practice_sessions WHERE player1_id = ${playerId}`)).rows[0] as any;
  const l = (await db.execute(sql`SELECT COALESCE(SUM(CASE WHEN winner_id = ${playerId} THEN COALESCE(winner_darts,0) ELSE COALESCE(loser_darts,0) END),0)::int n
    FROM matches WHERE winner_id = ${playerId} OR loser_id = ${playerId}`)).rows[0] as any;
  const practice = Number(p?.n ?? 0), league = Number(l?.n ?? 0);
  return { practice, league, total: practice + league, practiceAvg: practice > 0 ? Math.round((Number(p.s) / practice) * 3 * 10) / 10 : null };
}
