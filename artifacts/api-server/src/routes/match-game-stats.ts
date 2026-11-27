/**
 * Per-player stats for Cricket and Around the World league matches played on
 * the live scorer (darts, marks, best visit…). Saved straight after the match
 * is recorded, like match_dart_logs; read by League Records and the Halls.
 */
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { cleanGameStats, gameStatsKind } from "../lib/match-game-stats";

const router = Router();

let ready: Promise<unknown> | null = null;
export const ensureMatchGameStats = () => (ready ??= db.execute(sql`CREATE TABLE IF NOT EXISTS match_game_stats (
  match_id INTEGER PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  game TEXT NOT NULL, winner JSONB NOT NULL, loser JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).catch(e => { ready = null; throw e; }));

router.post("/matches/:id/game-stats", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Bad match" }); return; }
  // Only for a match recorded in the last few hours, and only once.
  const m = (await db.execute(sql`SELECT id, game_type FROM matches WHERE id = ${id} AND played_at >= NOW() - INTERVAL '6 hours'`)).rows[0] as { game_type: string } | undefined;
  if (!m) { res.status(404).json({ error: "Match not found or too old" }); return; }
  const kind = gameStatsKind(m.game_type);
  const w = kind && cleanGameStats(kind, req.body?.winner), l = kind && cleanGameStats(kind, req.body?.loser);
  if (!kind || !w || !l) { res.status(400).json({ error: "Bad game stats" }); return; }
  await ensureMatchGameStats();
  await db.execute(sql`INSERT INTO match_game_stats (match_id, game, winner, loser) VALUES (${id}, ${kind}, ${JSON.stringify(w)}::jsonb, ${JSON.stringify(l)}::jsonb) ON CONFLICT (match_id) DO NOTHING`);
  res.json({ ok: true });
});

export default router;
