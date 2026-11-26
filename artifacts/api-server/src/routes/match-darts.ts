/**
 * Dart-by-dart logs for league matches played on the scorer (X01 for now). Saved straight after the match is
 * recorded; used by the dart map and the automatic match report.
 */
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router = Router();
export type LoggedDart = { seg: number; mult: number; val: number; phase?: string; typed?: boolean };

let ready: Promise<unknown> | null = null;
export const ensureMatchDartLogs = () => (ready ??= db.execute(sql`CREATE TABLE IF NOT EXISTS match_dart_logs (
  match_id INTEGER PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  winner_darts JSONB NOT NULL, loser_darts JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).catch(e => { ready = null; throw e; }));

const clean = (list: unknown): LoggedDart[] | null => {
  if (!Array.isArray(list) || list.length > 3000) return null;
  const out: LoggedDart[] = [];
  for (const d of list) {
    if (!d || typeof d !== "object") return null;
    const x = d as Record<string, unknown>, seg = Number(x.seg), mult = Number(x.mult), val = Number(x.val);
    if (!Number.isInteger(seg) || seg < 0 || seg > 25 || ![1, 2, 3].includes(mult) || !Number.isFinite(val) || val < 0 || val > 60) return null;
    out.push({ seg, mult, val, ...(typeof x.phase === "string" ? { phase: x.phase.slice(0, 12) } : {}), ...(x.typed ? { typed: true } : {}) });
  }
  return out;
};

router.post("/matches/:id/darts", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const w = clean(req.body?.winnerDarts), l = clean(req.body?.loserDarts);
  if (!Number.isInteger(id) || id <= 0 || !w || !l || (!w.length && !l.length)) { res.status(400).json({ error: "Bad dart log" }); return; }
  // Only for a match recorded in the last hour, and only once.
  const m = (await db.execute(sql`SELECT id FROM matches WHERE id = ${id} AND played_at >= NOW() - INTERVAL '6 hours'`)).rows[0];
  if (!m) { res.status(404).json({ error: "Match not found or too old" }); return; }
  await ensureMatchDartLogs();
  await db.execute(sql`INSERT INTO match_dart_logs (match_id, winner_darts, loser_darts) VALUES (${id}, ${JSON.stringify(w)}::jsonb, ${JSON.stringify(l)}::jsonb) ON CONFLICT (match_id) DO NOTHING`);
  res.json({ ok: true });
});

export default router;
