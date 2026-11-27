import { Router } from "express";
import { drillFor, leaderboard, londonDay, streak } from "../lib/daily-drill";
import { loadDrillSessions } from "../lib/daily-drill-db";

const router = Router();

router.get("/daily-drill", async (req, res): Promise<void> => {
  const playerId = Number(req.query.playerId) || null;
  const now = new Date(), today = londonDay(now), drill = drillFor(today);
  const since = new Date(now.getTime() - 62 * 86400000);
  const sessions = await loadDrillSessions(since);
  const todays = sessions.filter(s => londonDay(s.createdAt) === today);
  const board = leaderboard(drill, todays);
  const meIdx = playerId ? board.findIndex(b => b.playerId === playerId) : -1;
  const tomorrow = new Date(Date.parse(today + "T00:00:00Z") + 86400000);
  res.json({ day: today, drill, leaderboard: board.slice(0, 10), players: board.length,
    me: playerId ? { best: meIdx >= 0 ? board[meIdx].value : null, rank: meIdx >= 0 ? meIdx + 1 : null, streak: streak(playerId, sessions, today) } : null,
    resetsAt: tomorrow.toISOString() });
});

export default router;
