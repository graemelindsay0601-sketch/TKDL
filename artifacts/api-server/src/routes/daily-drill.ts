import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { drillFor, leaderboard, londonDay, streak, type DrillSession } from "../lib/daily-drill";

const router = Router();

router.get("/daily-drill", async (req, res): Promise<void> => {
  const playerId = Number(req.query.playerId) || null;
  const now = new Date(), today = londonDay(now), drill = drillFor(today);
  const since = new Date(now.getTime() - 62 * 86400000);
  const rows = (await db.execute(sql`SELECT s.player1_id, p.name, s.game_type_key, s.p1_darts, s.p1_score, (s.session_data->>'p1Score')::numeric sd_score, s.winner_idx, s.created_at
    FROM practice_sessions s JOIN players p ON p.id = s.player1_id
    WHERE s.created_at >= ${since.toISOString()} AND s.player2_id IS NULL`)).rows as Record<string, unknown>[];
  const sessions: DrillSession[] = rows.map(r => ({ playerId: Number(r.player1_id), name: String(r.name), gameTypeKey: String(r.game_type_key), darts: r.p1_darts === null ? null : Number(r.p1_darts),
    score: r.p1_score === null ? null : Number(r.p1_score), sdScore: r.sd_score === null || r.sd_score === undefined ? null : Number(r.sd_score), winnerIdx: r.winner_idx === null ? null : Number(r.winner_idx), createdAt: new Date(String(r.created_at)) }));
  const todays = sessions.filter(s => londonDay(s.createdAt) === today);
  const board = leaderboard(drill, todays);
  const meIdx = playerId ? board.findIndex(b => b.playerId === playerId) : -1;
  const tomorrow = new Date(Date.parse(today + "T00:00:00Z") + 86400000);
  res.json({ day: today, drill, leaderboard: board.slice(0, 10), players: board.length,
    me: playerId ? { best: meIdx >= 0 ? board[meIdx].value : null, rank: meIdx >= 0 ? meIdx + 1 : null, streak: streak(playerId, sessions, today) } : null,
    resetsAt: tomorrow.toISOString() });
});

export default router;
