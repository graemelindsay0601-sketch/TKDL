/** Database side of the daily drill: loading sessions, and the "you've been passed" alert. */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { drillFor, leaderboard, londonDay, passedPlayers, type DrillSession } from "./daily-drill";
import { createNotification } from "../services/notificationService";

export type DrillRow = DrillSession & { id: number };

export async function loadDrillSessions(since: Date): Promise<DrillRow[]> {
  const rows = (await db.execute(sql`SELECT s.id, s.player1_id, p.name, s.game_type_key, s.p1_darts, s.p1_score, (s.session_data->>'p1Score')::numeric sd_score, s.winner_idx, s.created_at
    FROM practice_sessions s JOIN players p ON p.id = s.player1_id
    WHERE s.created_at >= ${since.toISOString()} AND s.player2_id IS NULL`)).rows as Record<string, unknown>[];
  return rows.map(r => ({ id: Number(r.id), playerId: Number(r.player1_id), name: String(r.name), gameTypeKey: String(r.game_type_key), darts: r.p1_darts === null ? null : Number(r.p1_darts),
    score: r.p1_score === null ? null : Number(r.p1_score), sdScore: r.sd_score === null || r.sd_score === undefined ? null : Number(r.sd_score), winnerIdx: r.winner_idx === null ? null : Number(r.winner_idx), createdAt: new Date(String(r.created_at)) }));
}

/** After a solo practice session is saved: tell anyone it knocked down today's drill board. */
export async function notifyDrillOvertakes(playerId: number, sessionId: number): Promise<void> {
  const now = new Date(), today = londonDay(now), drill = drillFor(today);
  const todays = (await loadDrillSessions(new Date(now.getTime() - 36 * 3600000))).filter(s => londonDay(s.createdAt) === today);
  const after = leaderboard(drill, todays), before = leaderboard(drill, todays.filter(s => s.id !== sessionId));
  const passed = passedPlayers(before.map(b => b.playerId), after.map(b => b.playerId), playerId);
  if (!passed.length) return;
  const me = after.find(b => b.playerId === playerId)!;
  for (const id of passed) {
    const rank = after.findIndex(b => b.playerId === id) + 1;
    await createNotification({ playerId: id, type: "rank_change", title: "🎯 Daily drill: you've been passed",
      body: `${me.name} beat your ${drill.title} score with ${me.value}${drill.unit ? ` ${drill.unit}` : ""}. You're now #${rank} today.`,
      data: { kind: "drill_overtaken", url: "/practice" }, dedupeKey: `drill-pass:${today}:${sessionId}:${id}` });
  }
}
