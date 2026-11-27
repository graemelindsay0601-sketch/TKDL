/**
 * League Target, DB side. The month's target is locked the first time anything asks for it (on the 1st, via
 * the hourly tick) and never moves. Past months are settled once: final value, hit or missed, and who shared.
 *
 * Silent mode: tracking and settling always run. Unlocks are only granted for months settled while the
 * `league_target` flag is switched on for everyone ("live"), so a background trial run never hands anything out.
 */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { londonMidnightUtc } from "./londonDate";
import { logger } from "./logger";
import { isFeatureAvailable } from "../services/feature-flags-service";
import { monthName, notifyAll, notifyUnlocks } from "./league-challenge-notify";
import {
  KIND_INFO, LADDER, MIN_MATCHES, monthKey, pairKey, pickKind, shiftMonth, targetFor, unlocksFor,
  type MonthStats, type TargetKind,
} from "./league-target";

export const LEAGUE_TARGET_FLAG = "league_target";

let ready: Promise<void> | null = null;
export function ensureLeagueTargetTables(): Promise<void> {
  ready ??= (async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS league_targets (
      month TEXT PRIMARY KEY, kind TEXT NOT NULL, target INTEGER NOT NULL,
      final_value INTEGER, hit BOOLEAN, live BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), settled_at TIMESTAMPTZ)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS league_target_shares (
      month TEXT NOT NULL, player_id INTEGER NOT NULL, matches INTEGER NOT NULL,
      PRIMARY KEY (month, player_id))`);
    await db.execute(sql`ALTER TABLE league_targets ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT false`);
    for (const { cosmetic: c } of LADDER) await db.execute(sql`INSERT INTO cosmetic_definitions (id, category, name, rarity, price, color, gradient, glow, icon_key, enabled, purchasable, sort_order)
      VALUES (${c.id}, ${c.category}, ${c.name}, ${c.rarity}, 0, ${c.color ?? null}, ${c.gradient ?? null}, ${c.glow ?? null}, ${c.iconKey ?? null}, true, false, ${c.sortOrder})
      ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, name = EXCLUDED.name, rarity = EXCLUDED.rarity, color = EXCLUDED.color,
        gradient = EXCLUDED.gradient, glow = EXCLUDED.glow, icon_key = EXCLUDED.icon_key, purchasable = false, sort_order = EXCLUDED.sort_order`);
  })().catch(err => { ready = null; throw err; });
  return ready;
}

export const bounds = (key: string) => ({ from: londonMidnightUtc(`${key}-01`), to: londonMidnightUtc(`${shiftMonth(key, 1)}-01`) });

async function rows(q: ReturnType<typeof sql>): Promise<any[]> {
  try { return (await db.execute(q)).rows as any[]; } catch { return []; } // a table missing on an old database just counts as empty
}

/** Everything the targets count for one month, plus each player's match count. */
export async function monthStats(key: string): Promise<MonthStats & { perPlayer: Map<number, number>; pairList: string[] }> {
  const { from, to } = bounds(key);
  const perPlayer = new Map<number, number>();
  const pairs = new Set<string>();
  let matches = 0, oneEighties = 0;
  const addMatch = (sides: number[][]) => {
    matches++;
    const everyone = [...new Set(sides.flat())];
    for (const p of everyone) perPlayer.set(p, (perPlayer.get(p) ?? 0) + 1);
    for (let i = 0; i < sides.length; i++) for (let j = i + 1; j < sides.length; j++)
      for (const a of sides[i]) for (const b of sides[j]) if (a !== b) pairs.add(pairKey(a, b));
  };

  // Singles (and multi-player singles, whose players sit in match_participants).
  const singles = await rows(sql`SELECT m.id, m.winner_id, m.loser_id, COALESCE(m.winner_180s,0) + COALESCE(m.loser_180s,0) AS t,
      (SELECT json_agg(json_build_object('p', mp.player_id, 't', mp.team)) FROM match_participants mp WHERE mp.match_id = m.id) AS parts
    FROM matches m WHERE m.played_at >= ${from} AND m.played_at < ${to}`);
  for (const r of singles) {
    oneEighties += Number(r.t) || 0;
    const parts = (r.parts ?? []) as { p: number; t: string }[];
    if (parts.length > 2) {
      const byTeam = new Map<string, number[]>();
      for (const x of parts) byTeam.set(String(x.t ?? x.p), [...(byTeam.get(String(x.t ?? x.p)) ?? []), x.p]);
      addMatch([...byTeam.values()]);
    } else addMatch([[r.winner_id], [r.loser_id]]);
  }

  // League team games.
  const team = await rows(sql`SELECT tm.id, json_agg(json_build_object('p', tp.player_id, 't', tp.team)) AS parts
    FROM team_matches tm JOIN team_match_participants tp ON tp.team_match_id = tm.id
    WHERE tm.played_at >= ${from} AND tm.played_at < ${to} GROUP BY tm.id`);
  for (const r of team) {
    const byTeam = new Map<number, number[]>();
    for (const x of r.parts as { p: number; t: number }[]) byTeam.set(x.t, [...(byTeam.get(x.t) ?? []), x.p]);
    addMatch([...byTeam.values()]);
  }

  // Doubles and Shift Wars (single, combined and multi matches). Who threw is in team_match_players when it was picked.
  const sources: [string, string, string][] = [
    ["doubles", "match", "doubles_matches"], ["doubles", "combined", "doubles_combined_matches"], ["doubles", "multi", "doubles_multi_matches"],
    ["shift_wars", "match", "shift_wars_matches"], ["shift_wars", "combined", "shift_wars_combined_matches"], ["shift_wars", "multi", "shift_wars_multi_matches"],
  ];
  for (const [comp, kind, table] of sources) {
    const list = await rows(sql`SELECT t.id, (SELECT json_agg(json_build_object('p', x.player_id, 't', x.team_id)) FROM team_match_players x
        WHERE x.competition = ${comp} AND x.match_kind = ${kind} AND x.match_id = t.id) AS parts
      FROM ${sql.raw(table)} t WHERE t.played_at >= ${from} AND t.played_at < ${to}`);
    for (const r of list) {
      const byTeam = new Map<number, number[]>();
      for (const x of (r.parts ?? []) as { p: number; t: number }[]) byTeam.set(x.t, [...(byTeam.get(x.t) ?? []), x.p]);
      if (byTeam.size) addMatch([...byTeam.values()]); else matches++; // still a match even if nobody was ticked as playing
    }
  }

  // 180s thrown in team matches on the team scorer (doubles, Shift Wars, 2v2), stored per thrower.
  for (const r of await rows(sql`SELECT COALESCE(SUM(one_eighties), 0)::int n FROM team_thrower_stats WHERE played_at >= ${from} AND played_at < ${to}`)) oneEighties += Number(r.n) || 0;

  const players = [...perPlayer.values()].filter(n => n >= MIN_MATCHES).length;
  return { matches, pairings: pairs.size, oneEighties, players, perPlayer, pairList: [...pairs] };
}

export type TargetRow = { month: string; kind: TargetKind; target: number; final_value: number | null; hit: boolean | null; live: boolean; voided?: boolean };

/** This month's target, locking it in on first ask. */
export async function currentTarget(now = new Date()): Promise<TargetRow> {
  await ensureLeagueTargetTables();
  const key = monthKey(now);
  const existing = (await db.execute(sql`SELECT * FROM league_targets WHERE month = ${key}`)).rows[0] as TargetRow | undefined;
  if (existing) return existing;
  const history = [await monthStats(shiftMonth(key, -1)), await monthStats(shiftMonth(key, -2))];
  const kind = pickKind(key, history);
  const target = targetFor(kind, history.map(h => h[kind]));
  await db.execute(sql`INSERT INTO league_targets (month, kind, target) VALUES (${key}, ${kind}, ${target}) ON CONFLICT (month) DO NOTHING`);
  return (await db.execute(sql`SELECT * FROM league_targets WHERE month = ${key}`)).rows[0] as TargetRow;
}

/** How many live League Targets each player has shared in. */
export async function hitsByPlayer(ids?: number[]): Promise<Map<number, number>> {
  await ensureLeagueTargetTables();
  const r = await db.execute(sql`SELECT s.player_id, COUNT(*)::int AS n FROM league_target_shares s JOIN league_targets t ON t.month = s.month
    WHERE t.hit AND t.live ${ids?.length ? sql`AND s.player_id IN (${sql.join(ids.map(i => sql`${Number(i)}`), sql`, `)})` : sql``} GROUP BY s.player_id`);
  return new Map((r.rows as any[]).map(x => [Number(x.player_id), Number(x.n)]));
}

/** Settle every finished month that hasn't been settled. Safe to run as often as you like. */
export async function settleLeagueTargets(now = new Date()): Promise<string[]> {
  await ensureLeagueTargetTables();
  const key = monthKey(now);
  const open = (await db.execute(sql`SELECT * FROM league_targets WHERE settled_at IS NULL AND month < ${key} ORDER BY month`)).rows as TargetRow[];
  const settled: string[] = [];
  for (const t of open) {
    if (t.voided) { await db.execute(sql`UPDATE league_targets SET settled_at = NOW() WHERE month = ${t.month} AND settled_at IS NULL`); continue; }
    const stats = await monthStats(t.month);
    const value = stats[t.kind];
    const hit = value >= t.target;
    const live = await isFeatureAvailable(LEAGUE_TARGET_FLAG, false); // true only when switched on for everyone
    const claimed = await db.execute(sql`UPDATE league_targets SET final_value = ${value}, hit = ${hit}, live = ${live}, settled_at = NOW()
      WHERE month = ${t.month} AND settled_at IS NULL RETURNING month`);
    if (!claimed.rows.length) continue; // another tick got there first
    settled.push(t.month);
    if (live && !hit) await notifyAll(stats.perPlayer.keys(), `lt-result:${t.month}`, "🎯 League Target missed",
      `${monthName(t.month)} finished on ${value} of ${t.target} ${KIND_INFO[t.kind].unit}. Nothing lost — a new target starts now.`);
    if (!hit) continue;
    const sharers = [...stats.perPlayer].filter(([, n]) => n >= MIN_MATCHES);
    for (const [pid, n] of sharers) await db.execute(sql`INSERT INTO league_target_shares (month, player_id, matches) VALUES (${t.month}, ${pid}, ${n}) ON CONFLICT DO NOTHING`);
    if (live) await notifyUnlocks(await grantLadder(sharers.map(([pid]) => pid)), LADDER_NAMES, "League Targets");
  }
  if (settled.length) logger.info({ settled }, "League Target months settled");
  return settled;
}

/** Give each player any ladder unlocks they've reached and don't own yet. */
export async function grantLadder(ids: number[]): Promise<{ playerId: number; cosmeticId: string }[]> {
  if (!ids.length) return [];
  const hits = await hitsByPlayer(ids);
  const given: { playerId: number; cosmeticId: string }[] = [];
  for (const pid of ids) for (const step of unlocksFor(hits.get(pid) ?? 0)) {
    const r = await db.execute(sql`INSERT INTO player_cosmetics (player_id, cosmetic_id) SELECT ${pid}, ${step.cosmetic.id}
      WHERE NOT EXISTS (SELECT 1 FROM player_cosmetics WHERE player_id = ${pid} AND cosmetic_id = ${step.cosmetic.id}) RETURNING cosmetic_id`);
    if (r.rows.length) given.push({ playerId: pid, cosmeticId: step.cosmetic.id });
  }
  return given;
}

const LADDER_NAMES: Record<string, string> = Object.fromEntries(LADDER.map(s => [s.cosmetic.id, s.cosmetic.name]));

/** Players who've played this month or last: who the monthly pushes go to. */
export async function activePlayers(key: string): Promise<number[]> {
  const a = await monthStats(key), b = await monthStats(shiftMonth(key, -1));
  return [...new Set([...a.perPlayer.keys(), ...b.perPlayer.keys()])];
}

/** The month's pushes, while live: new target, a week left, hit (once each). */
export async function leagueTargetNotices(now = new Date()): Promise<void> {
  if (!(await isFeatureAvailable(LEAGUE_TARGET_FLAG, false))) return;
  const t = await currentTarget(now);
  if (t.voided) return;
  const stats = await monthStats(t.month), info = KIND_INFO[t.kind], value = stats[t.kind];
  const ids = await activePlayers(t.month);
  const { to } = bounds(t.month);
  const daysLeft = Math.ceil((to.getTime() - now.getTime()) / 86400000);
  const goal: Record<TargetKind, string> = { matches: `${t.target} matches played`, pairings: `${t.target} different match-ups`,
    players: `${t.target} players with ${MIN_MATCHES}+ matches`, oneEighties: `${t.target} 180s on the scorer` };
  await notifyAll(ids, `lt-new:${t.month}`, `🎯 ${monthName(t.month)}'s League Target`,
    `The league's going for ${goal[t.kind]}. Play ${MIN_MATCHES}+ matches this month to share in it.`);
  if (value >= t.target) await notifyAll(ids, `lt-hit:${t.month}`, "🎯 League Target hit!",
    `${value} of ${t.target} ${info.unit}. Everyone with ${MIN_MATCHES}+ matches this month shares in it.`);
  else if (daysLeft <= 7) await notifyAll(ids, `lt-week:${t.month}`, "🎯 A week left on the League Target",
    `${t.target - value} ${info.unit} to go (${value} of ${t.target}).`);
}

/** Hourly: lock this month's target, settle anything finished, send the month's pushes. */
export function initializeLeagueTargetScheduler() {
  const tick = () => void currentTarget().then(() => settleLeagueTargets()).then(() => leagueTargetNotices()).catch(err => logger.error({ err }, "League Target tick failed"));
  tick();
  setInterval(tick, 60 * 60 * 1000).unref?.();
}

export { KIND_INFO };

/** Admin: this month's target counts for nothing (no result, no unlocks, no more pushes). */
export async function adminVoidTarget(month: string): Promise<void> {
  await db.execute(sql`UPDATE league_targets SET voided = true WHERE month = ${month} AND settled_at IS NULL`);
}
