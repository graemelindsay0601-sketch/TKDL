/**
 * Admin: the week in the league, ready to paste into the group chat, plus a few league-health checks
 * (pairings that haven't met this season, and results that look like they were entered twice).
 */
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAdminSession } from "../middleware/requireAdminSession";

const router = Router();
const rows = async <T = Record<string, unknown>>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows as T[];
const fmtDay = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
const SINGLES = sql`m.game_type NOT LIKE 'team_%' AND m.game_type <> 'multi_killer'`;

export type Digest = { from: string; to: string; matches: number; table: { name: string; points: number }[];
  topWinner: { name: string; wins: number } | null; upset: { winner: string; loser: string; elo: number } | null;
  max180s: { name: string; n: number }[]; unlocks: number; text: string };

/** The digest for the 7 days up to `to`. Pure apart from the queries; `link` goes at the end of the text. */
export async function weeklyDigest(to: Date, link: string): Promise<Digest> {
  const from = new Date(to.getTime() - 7 * 86400000);
  const [count] = await rows<{ n: number }>(sql`SELECT COUNT(*)::int n FROM matches m WHERE m.played_at >= ${from.toISOString()} AND m.played_at < ${to.toISOString()}`);
  const winners = await rows<{ name: string; wins: number }>(sql`SELECT m.winner_name name, COUNT(*)::int wins FROM matches m
    WHERE ${SINGLES} AND m.played_at >= ${from.toISOString()} AND m.played_at < ${to.toISOString()} GROUP BY m.winner_name ORDER BY wins DESC, name LIMIT 1`);
  const upsets = await rows<{ winner: string; loser: string; elo: number }>(sql`SELECT m.winner_name winner, m.loser_name loser, m.elo_change elo FROM matches m
    WHERE ${SINGLES} AND m.played_at >= ${from.toISOString()} AND m.played_at < ${to.toISOString()} AND m.elo_change > 0 ORDER BY m.elo_change DESC LIMIT 1`);
  const maxes = await rows<{ name: string; n: number }>(sql`SELECT name, SUM(n)::int n FROM (
      SELECT m.winner_name name, COALESCE(m.winner_180s,0) n FROM matches m WHERE m.played_at >= ${from.toISOString()} AND m.played_at < ${to.toISOString()}
      UNION ALL SELECT m.loser_name, COALESCE(m.loser_180s,0) FROM matches m WHERE m.played_at >= ${from.toISOString()} AND m.played_at < ${to.toISOString()}) x
    GROUP BY name HAVING SUM(n) > 0 ORDER BY n DESC, name LIMIT 3`);
  const table = await rows<{ name: string; points: number }>(sql`SELECT name, points FROM players WHERE is_active = true AND status <> 'ELIMINATED' ORDER BY points DESC, elo DESC LIMIT 5`);
  let unlocks = 0;
  try { unlocks = (await rows<{ n: number }>(sql`SELECT COUNT(*)::int n FROM achievement_v2_unlocks WHERE source = 'live' AND created_at >= ${from.toISOString()}`))[0]?.n ?? 0; } catch { unlocks = 0; }
  const d: Digest = { from: from.toISOString(), to: to.toISOString(), matches: Number(count?.n ?? 0), table: table.map(t => ({ name: t.name, points: Number(t.points) })),
    topWinner: winners[0] ? { name: winners[0].name, wins: Number(winners[0].wins) } : null, upset: upsets[0] ? { ...upsets[0], elo: Number(upsets[0].elo) } : null,
    max180s: maxes.map(m => ({ name: m.name, n: Number(m.n) })), unlocks, text: "" };
  const lines = [`🎯 TKDL weekly round-up · ${fmtDay(from)} – ${fmtDay(new Date(to.getTime() - 1))}`, ""];
  lines.push(`${d.matches} match${d.matches === 1 ? "" : "es"} played this week.`);
  if (d.topWinner && d.topWinner.wins > 1) lines.push(`🔥 Most wins: ${d.topWinner.name} (${d.topWinner.wins})`);
  if (d.upset) lines.push(`⚡ Biggest upset: ${d.upset.winner} beat ${d.upset.loser} (+${d.upset.elo} ELO)`);
  if (d.max180s.length) lines.push(`💯 180s: ${d.max180s.map(m => `${m.name}${m.n > 1 ? ` ×${m.n}` : ""}`).join(", ")}`);
  if (d.unlocks) lines.push(`🏆 ${d.unlocks} achievement${d.unlocks === 1 ? "" : "s"} unlocked`);
  if (d.table.length) { lines.push("", "Top of the table:"); d.table.forEach((t, i) => lines.push(`${i + 1}. ${t.name} · ${t.points} pts`)); }
  lines.push("", `Full table: ${link}`);
  d.text = lines.join("\n");
  return d;
}

router.get("/admin/league-week", requireAdminSession, async (req, res): Promise<void> => {
  const host = `${(req.get("x-forwarded-proto") ?? req.protocol).split(",")[0]}://${req.get("host")}`;
  const digest = await weeklyDigest(new Date(), `${host}/leaderboard`);
  // Pairings in the active singles season that haven't played each other yet
  const players = await rows<{ id: number; name: string }>(sql`SELECT id, name FROM players WHERE is_active = true AND status <> 'ELIMINATED' ORDER BY name`);
  const met = new Set((await rows<{ a: number; b: number }>(sql`SELECT LEAST(m.winner_id, m.loser_id) a, GREATEST(m.winner_id, m.loser_id) b FROM matches m
    JOIN seasons s ON s.id = m.season_id AND s.is_active = true AND COALESCE(s.league_type, 'singles') = 'singles' WHERE ${SINGLES} GROUP BY 1, 2`)).map(r => `${r.a}|${r.b}`));
  const notMet: { a: string; b: string }[] = [];
  for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
    const a = players[i], b = players[j]; if (!met.has(`${Math.min(a.id, b.id)}|${Math.max(a.id, b.id)}`)) notMet.push({ a: a.name, b: b.name });
  }
  // The same result entered twice: same winner and loser within five minutes, last 30 days
  const dupes = await rows<{ id1: number; id2: number; winner: string; loser: string; at: string }>(sql`SELECT a.id id1, b.id id2, a.winner_name winner, a.loser_name loser, a.played_at at
    FROM matches a JOIN matches b ON b.id > a.id AND b.winner_id = a.winner_id AND b.loser_id = a.loser_id AND ABS(EXTRACT(EPOCH FROM (b.played_at - a.played_at))) <= 300
    WHERE a.played_at >= NOW() - INTERVAL '30 days' ORDER BY a.played_at DESC LIMIT 20`);
  res.json({ digest, health: { activePlayers: players.length, pairings: players.length * (players.length - 1) / 2, notMet: notMet.slice(0, 60), notMetCount: notMet.length,
    possibleDuplicates: dupes.map(d => ({ ids: [Number(d.id1), Number(d.id2)], winner: d.winner, loser: d.loser, at: d.at })) } });
});

export default router;
