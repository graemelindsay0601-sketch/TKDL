/**
 * The Gaffer, DB side.
 *
 * Month M's row is created on the first tick in M: the Gaffer is elected from the votes cast in the last
 * days of M-1 (or, with no votes, whoever played most in M-1). The Gaffer picks a challenge and level in the
 * first PICK_DAYS days; otherwise Meet the League (Steady) runs. The target is fixed when it's picked.
 * Finished months are settled once.
 *
 * Silent mode: everything runs, but unlocks are only granted for months settled while the `gaffer` flag is
 * switched on for everyone ("live").
 */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import { isFeatureAvailable } from "../services/feature-flags-service";
import { monthName, notifyAll, notifyOnce, notifyUnlocks } from "./league-challenge-notify";
import { monthKey, shiftMonth } from "./league-target";
import { activePlayers, bounds, monthStats } from "./league-target-db";
import { drillFor, leaderboard, londonDay } from "./daily-drill";
import { loadDrillSessions } from "./daily-drill-db";
import {
  CANDIDATE_MIN_MATCHES, CHALLENGES, DEFAULT_CHALLENGE, GAFFER_LADDER, PICK_DAYS, SQUAD_LADDER, VOTE_DAYS,
  electGaffer, gameKey, levelTargets, revengeWins, scorerDataReady, unlocksFor, type ChallengeKey, type LadderStep,
} from "./gaffer";

export const GAFFER_FLAG = "gaffer";
const DAY = 86400000;

let ready: Promise<void> | null = null;
export function ensureGafferTables(): Promise<void> {
  ready ??= (async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS gaffer_months (
      month TEXT PRIMARY KEY, gaffer_id INTEGER, chosen_by TEXT NOT NULL DEFAULT 'none',
      challenge TEXT, level INTEGER, target INTEGER, param TEXT, picked_at TIMESTAMPTZ,
      final_value INTEGER, hit BOOLEAN, live BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), settled_at TIMESTAMPTZ)`);
    // Admin controls: a void month counts for nothing; pick_until gives a Gaffer swapped in by an admin a fresh window.
    await db.execute(sql`ALTER TABLE gaffer_months ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE gaffer_months ADD COLUMN IF NOT EXISTS pick_until TIMESTAMPTZ`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS gaffer_votes (
      month TEXT NOT NULL, voter_id INTEGER NOT NULL, candidate_id INTEGER NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (month, voter_id))`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS gaffer_contributors (
      month TEXT NOT NULL, player_id INTEGER NOT NULL, value INTEGER NOT NULL, PRIMARY KEY (month, player_id))`);
    for (const { cosmetic: c } of [...GAFFER_LADDER, ...SQUAD_LADDER]) await db.execute(sql`INSERT INTO cosmetic_definitions (id, category, name, rarity, price, color, gradient, glow, icon_key, enabled, purchasable, sort_order)
      VALUES (${c.id}, ${c.category}, ${c.name}, ${c.rarity}, 0, ${c.color ?? null}, ${c.gradient ?? null}, ${c.glow ?? null}, ${c.iconKey ?? null}, true, false, ${c.sortOrder})
      ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, name = EXCLUDED.name, rarity = EXCLUDED.rarity, color = EXCLUDED.color,
        gradient = EXCLUDED.gradient, glow = EXCLUDED.glow, icon_key = EXCLUDED.icon_key, purchasable = false, sort_order = EXCLUDED.sort_order`);
  })().catch(err => { ready = null; throw err; });
  return ready;
}

async function rows(q: ReturnType<typeof sql>): Promise<any[]> {
  try { return (await db.execute(q)).rows as any[]; } catch { return []; }
}

export type Progress = { value: number; perPlayer: Map<number, number>; contributors: number[] };

/** A challenge's value for one month, and who contributed. `param` is the game for Game of the Month. */
export async function challengeProgress(key: ChallengeKey, month: string, target: number, param: string | null): Promise<Progress> {
  const { from, to } = bounds(month);
  const perPlayer = new Map<number, number>();
  const add = (id: number, n = 1) => perPlayer.set(id, (perPlayer.get(id) ?? 0) + n);

  if (key === "meet") {
    const s = await monthStats(month);
    for (const p of s.pairList) for (const id of p.split("-").map(Number)) add(id);
    const contributors = [...perPlayer].filter(([, n]) => n >= 3).map(([id]) => id);
    return { value: contributors.length, perPlayer, contributors };
  }
  if (key === "oneEighties") {
    for (const r of await rows(sql`SELECT winner_id, loser_id, COALESCE(winner_180s,0) w, COALESCE(loser_180s,0) l FROM matches WHERE played_at >= ${from} AND played_at < ${to}`)) {
      if (Number(r.w)) add(r.winner_id, Number(r.w));
      if (Number(r.l)) add(r.loser_id, Number(r.l));
    }
    return { value: [...perPlayer.values()].reduce((a, b) => a + b, 0), perPlayer, contributors: [...perPlayer.keys()] };
  }
  if (key === "gotm") {
    const g = gameKey(param);
    let value = 0;
    for (const r of await rows(sql`SELECT winner_id, loser_id FROM matches WHERE played_at >= ${from} AND played_at < ${to} AND LOWER(TRIM(game_type)) = ${g}`)) { value++; add(r.winner_id); add(r.loser_id); }
    for (const r of await rows(sql`SELECT tm.id, array_agg(tp.player_id) ids FROM team_matches tm JOIN team_match_participants tp ON tp.team_match_id = tm.id
        WHERE tm.played_at >= ${from} AND tm.played_at < ${to} AND LOWER(TRIM(tm.game_type)) = ${g} GROUP BY tm.id`)) { value++; for (const id of r.ids) add(Number(id)); }
    for (const [comp, table] of [["doubles", "doubles_matches"], ["shift_wars", "shift_wars_matches"]] as const) {
      for (const r of await rows(sql`SELECT t.id, (SELECT array_agg(x.player_id) FROM team_match_players x WHERE x.competition = ${comp} AND x.match_kind = 'match' AND x.match_id = t.id) ids
          FROM ${sql.raw(table)} t WHERE t.played_at >= ${from} AND t.played_at < ${to} AND LOWER(TRIM(t.game_type)) = ${g}`)) { value++; for (const id of r.ids ?? []) add(Number(id)); }
    }
    return { value, perPlayer, contributors: [...perPlayer.keys()] };
  }
  if (key === "revenge") {
    const hist = (await rows(sql`SELECT winner_id, loser_id, played_at FROM matches WHERE played_at < ${to} ORDER BY played_at, id`))
      .map(r => ({ winner: Number(r.winner_id), loser: Number(r.loser_id), at: new Date(r.played_at) }));
    for (const [id, n] of revengeWins(hist, from, to)) add(id, n);
    return { value: [...perPlayer.values()].reduce((a, b) => a + b, 0), perPlayer, contributors: [...perPlayer.keys()] };
  }
  if (key === "finishing") {
    const att = new Map<number, [number, number]>();
    const put = (id: number, h: number, a: number) => { const x = att.get(id) ?? [0, 0]; att.set(id, [x[0] + h, x[1] + a]); };
    for (const r of await rows(sql`SELECT winner_id, loser_id, winner_checkout_hits wh, winner_checkout_attempts wa, loser_checkout_hits lh, loser_checkout_attempts la
        FROM matches WHERE played_at >= ${from} AND played_at < ${to}`)) {
      if (Number(r.wa)) put(r.winner_id, Number(r.wh) || 0, Number(r.wa));
      if (Number(r.la)) put(r.loser_id, Number(r.lh) || 0, Number(r.la));
    }
    let h = 0, a = 0;
    for (const [id, [hh, aa]] of att) { h += hh; a += aa; perPlayer.set(id, Math.round((hh / aa) * 100)); }
    const value = a >= 20 ? Math.round((h / a) * 100) : 0;
    const contributors = [...att].filter(([, [hh, aa]]) => aa >= 5 && (hh / aa) * 100 >= target).map(([id]) => id);
    return { value, perPlayer, contributors };
  }
  // drill: one per player per day they're on that day's drill board
  const sessions = (await loadDrillSessions(from)).filter(s => s.createdAt < to);
  const byDay = new Map<string, typeof sessions>();
  for (const s of sessions) { const d = londonDay(s.createdAt); byDay.set(d, [...(byDay.get(d) ?? []), s]); }
  for (const [d, list] of byDay) for (const row of leaderboard(drillFor(d), list)) add(row.playerId);
  return { value: [...perPlayer.values()].reduce((a, b) => a + b, 0), perPlayer, contributors: [...perPlayer.keys()] };
}

/** Games for Game of the Month: the league's most-played over the last 3 months, plus 501 and Cricket. */
export async function gameOptions(month: string): Promise<{ key: string; label: string; count: number }[]> {
  const from = bounds(shiftMonth(month, -3)).from, to = bounds(month).from;
  const r = await rows(sql`SELECT LOWER(TRIM(game_type)) k, MODE() WITHIN GROUP (ORDER BY game_type) label, COUNT(*)::int n FROM matches
    WHERE played_at >= ${from} AND played_at < ${to} AND game_type IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 5`);
  const out = r.map(x => ({ key: String(x.k), label: String(x.label), count: Number(x.n) }));
  for (const [key, label] of [["501", "501"], ["cricket", "Cricket"]]) if (!out.some(o => o.key === key)) out.push({ key, label, count: 0 });
  return out;
}

/** The two months before `month`, most recent first. */
async function previousValues(key: ChallengeKey, month: string, param: string | null): Promise<number[]> {
  const prev = [];
  for (const m of [shiftMonth(month, -1), shiftMonth(month, -2)]) prev.push((await challengeProgress(key, m, CHALLENGES[key].floor, param)).value);
  return prev;
}

/** The three levels for a challenge in month `month`, from the two months before it. */
export async function optionsFor(key: ChallengeKey, month: string, param: string | null): Promise<[number, number, number]> {
  return levelTargets(key, await previousValues(key, month, param));
}

/** Whether a scorer-only challenge (180s, checkouts) has enough scorer data behind it to be offered. */
export async function challengeReady(key: ChallengeKey, month: string): Promise<boolean> {
  return scorerDataReady(key, await previousValues(key, month, null));
}

export async function candidatesFor(month: string): Promise<{ id: number; name: string; matches: number }[]> {
  const s = await monthStats(month);
  const prev = (await db.execute(sql`SELECT gaffer_id FROM gaffer_months WHERE month = ${month}`)).rows[0] as any;
  const ids = [...s.perPlayer].filter(([id, n]) => n >= CANDIDATE_MIN_MATCHES && id !== prev?.gaffer_id);
  if (!ids.length) return [];
  const names = new Map(((await db.execute(sql`SELECT id, name FROM players WHERE id IN (${sql.join(ids.map(([id]) => sql`${id}`), sql`, `)})`)).rows as any[]).map(r => [Number(r.id), String(r.name)]));
  return ids.filter(([id]) => names.has(id)).map(([id, matches]) => ({ id, name: names.get(id)!, matches })).sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name));
}

export type GafferRow = { month: string; gaffer_id: number | null; chosen_by: string; challenge: ChallengeKey | null; level: number | null; target: number | null;
  param: string | null; picked_at: string | null; final_value: number | null; hit: boolean | null; live: boolean; settled_at: string | null;
  voided?: boolean; pick_until?: string | null };

export const pickDeadline = (month: string) => new Date(bounds(month).from.getTime() + PICK_DAYS * DAY);
/** A row's pick deadline: the usual first days of the month, or the fresh window an admin gave a replacement Gaffer. */
export const pickDeadlineFor = (row: GafferRow) => (row.pick_until ? new Date(row.pick_until) : pickDeadline(row.month));
export const voteOpens = (month: string) => new Date(bounds(month).to.getTime() - VOTE_DAYS * DAY);

/** Lock in a challenge for a month. Only while unpicked. */
export async function pickChallenge(month: string, key: ChallengeKey, level: number, param: string | null): Promise<boolean> {
  const targets = await optionsFor(key, month, param);
  const r = await db.execute(sql`UPDATE gaffer_months SET challenge = ${key}, level = ${level}, target = ${targets[level - 1]}, param = ${param}, picked_at = NOW()
    WHERE month = ${month} AND challenge IS NULL RETURNING month`);
  return r.rows.length > 0;
}

/** This month's row: elects on first ask, and falls back to the default challenge once the pick window has gone. */
export async function currentGaffer(now = new Date()): Promise<GafferRow> {
  await ensureGafferTables();
  const key = monthKey(now);
  let row = (await db.execute(sql`SELECT * FROM gaffer_months WHERE month = ${key}`)).rows[0] as GafferRow | undefined;
  if (!row) {
    const prev = shiftMonth(key, -1);
    const cands = await candidatesFor(prev);
    const votes = ((await db.execute(sql`SELECT voter_id, candidate_id FROM gaffer_votes WHERE month = ${key}`)).rows as any[]).map(v => ({ voter: Number(v.voter_id), candidate: Number(v.candidate_id) }));
    const won = electGaffer(cands, votes);
    await db.execute(sql`INSERT INTO gaffer_months (month, gaffer_id, chosen_by) VALUES (${key}, ${won?.id ?? null}, ${won?.by ?? "none"}) ON CONFLICT (month) DO NOTHING`);
    row = (await db.execute(sql`SELECT * FROM gaffer_months WHERE month = ${key}`)).rows[0] as GafferRow;
  }
  if (!row.challenge && (row.gaffer_id == null || now >= pickDeadlineFor(row))) {
    await pickChallenge(key, DEFAULT_CHALLENGE, 1, null);
    row = (await db.execute(sql`SELECT * FROM gaffer_months WHERE month = ${key}`)).rows[0] as GafferRow;
  }
  return row;
}

async function hitsFor(ids: number[], who: "gaffer" | "squad"): Promise<Map<number, number>> {
  if (!ids.length) return new Map();
  const list = sql.join(ids.map(i => sql`${Number(i)}`), sql`, `);
  const r = who === "gaffer"
    ? await db.execute(sql`SELECT gaffer_id AS player_id, COUNT(*)::int n FROM gaffer_months WHERE hit AND live AND gaffer_id IN (${list}) GROUP BY gaffer_id`)
    : await db.execute(sql`SELECT c.player_id, COUNT(*)::int n FROM gaffer_contributors c JOIN gaffer_months g ON g.month = c.month WHERE g.hit AND g.live AND c.player_id IN (${list}) GROUP BY c.player_id`);
  return new Map((r.rows as any[]).map(x => [Number(x.player_id), Number(x.n)]));
}
export const gafferHits = (ids: number[]) => hitsFor(ids, "gaffer");
export const squadHits = (ids: number[]) => hitsFor(ids, "squad");

async function grant(ids: number[], ladder: LadderStep[], hits: Map<number, number>) {
  const given: { playerId: number; cosmeticId: string }[] = [];
  for (const pid of ids) for (const step of unlocksFor(ladder, hits.get(pid) ?? 0)) {
    const r = await db.execute(sql`INSERT INTO player_cosmetics (player_id, cosmetic_id) SELECT ${pid}, ${step.cosmetic.id}
      WHERE NOT EXISTS (SELECT 1 FROM player_cosmetics WHERE player_id = ${pid} AND cosmetic_id = ${step.cosmetic.id}) RETURNING cosmetic_id`);
    if (r.rows.length) given.push({ playerId: pid, cosmeticId: step.cosmetic.id });
  }
  return given;
}
const UNLOCK_NAMES: Record<string, string> = Object.fromEntries([...GAFFER_LADDER, ...SQUAD_LADDER].map(s => [s.cosmetic.id, s.cosmetic.name]));
async function gafferName(id: number | null): Promise<string | null> {
  if (id == null) return null;
  return ((await db.execute(sql`SELECT name FROM players WHERE id = ${id}`)).rows[0] as any)?.name ?? null;
}

/** Settle every finished month. Safe to run as often as you like. */
export async function settleGaffer(now = new Date()): Promise<string[]> {
  await ensureGafferTables();
  const open = (await db.execute(sql`SELECT * FROM gaffer_months WHERE settled_at IS NULL AND month < ${monthKey(now)} ORDER BY month`)).rows as GafferRow[];
  const done: string[] = [];
  for (const g of open) {
    if (g.voided) { await db.execute(sql`UPDATE gaffer_months SET settled_at = NOW() WHERE month = ${g.month} AND settled_at IS NULL`); continue; }
    if (!g.challenge || g.target == null) await pickChallenge(g.month, DEFAULT_CHALLENGE, 1, null);
    const row = (await db.execute(sql`SELECT * FROM gaffer_months WHERE month = ${g.month}`)).rows[0] as GafferRow;
    const prog = await challengeProgress(row.challenge!, row.month, row.target!, row.param);
    const hit = prog.value >= row.target!;
    const live = await isFeatureAvailable(GAFFER_FLAG, false);
    const claimed = await db.execute(sql`UPDATE gaffer_months SET final_value = ${prog.value}, hit = ${hit}, live = ${live}, settled_at = NOW()
      WHERE month = ${row.month} AND settled_at IS NULL RETURNING month`);
    if (!claimed.rows.length) continue;
    done.push(row.month);
    const def = CHALLENGES[row.challenge!], who = await gafferName(row.gaffer_id);
    if (live) await notifyAll(await activePlayers(row.month), `gf-result:${row.month}`, hit ? "👑 Gaffer's challenge hit!" : "👑 Gaffer's challenge missed",
      `${def.label}: ${prog.value} of ${row.target}${row.challenge === "finishing" ? "%" : ` ${def.unit}`}${who ? ` under ${who}` : ""}.${hit ? "" : " Nothing lost."}`);
    if (!hit) continue;
    for (const id of prog.contributors) await db.execute(sql`INSERT INTO gaffer_contributors (month, player_id, value) VALUES (${row.month}, ${id}, ${prog.perPlayer.get(id) ?? 0}) ON CONFLICT DO NOTHING`);
    if (!live) continue;
    if (row.gaffer_id) await notifyUnlocks(await grant([row.gaffer_id], GAFFER_LADDER, await gafferHits([row.gaffer_id])), UNLOCK_NAMES, "The Gaffer");
    await notifyUnlocks(await grant(prog.contributors, SQUAD_LADDER, await squadHits(prog.contributors)), UNLOCK_NAMES, "The Gaffer");
  }
  if (done.length) logger.info({ done }, "Gaffer months settled");
  return done;
}

/** The month's pushes, while live: new Gaffer, pick reminder, challenge set, vote open (once each). */
export async function gafferNotices(now = new Date()): Promise<void> {
  if (!(await isFeatureAvailable(GAFFER_FLAG, false))) return;
  const g = await currentGaffer(now);
  if (g.voided) return;
  const ids = await activePlayers(g.month), who = await gafferName(g.gaffer_id), m = monthName(g.month);
  if (g.gaffer_id && who) {
    const by = pickDeadlineFor(g).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
    if (!g.challenge) await notifyOnce(g.gaffer_id, `gf-elected:${g.month}`, `👑 You're ${m}'s Gaffer`, `Pick the league's challenge by ${by}, or Meet the League runs.`);
    await notifyAll(ids.filter(i => i !== g.gaffer_id), `gf-new:${g.month}`, `👑 ${who} is ${m}'s Gaffer`,
      g.chosen_by === "vote" ? "Voted in by the league." : g.chosen_by === "admin" ? "Appointed by the league admin." : "No votes, so the player with the most matches takes charge.");
  }
  if (g.challenge && g.target != null) {
    const def = CHALLENGES[g.challenge];
    await notifyAll(ids, `gf-set:${g.month}`, `👑 ${m}'s challenge: ${def.label}`,
      `${g.target}${g.challenge === "finishing" ? "% checkout" : ` ${def.unit}`} this month${who ? `, set by ${who}` : ""}. To help: ${def.contributes.toLowerCase()}.`);
  }
  if (now >= voteOpens(g.month)) {
    const next = shiftMonth(g.month, 1);
    await notifyAll(ids, `gf-vote:${next}`, `🗳️ Vote for ${monthName(next)}'s Gaffer`, "Voting's open on the Hub until the end of the month.");
  }
}

/** Hourly: elect/lock this month, settle anything finished, send the month's pushes. */
export function initializeGafferScheduler() {
  const tick = () => void currentGaffer().then(() => settleGaffer()).then(() => gafferNotices()).catch(err => logger.error({ err }, "Gaffer tick failed"));
  tick();
  setInterval(tick, 60 * 60 * 1000).unref?.();
}

/** Admin: put a different player in charge this month. They get a fresh pick window. */
export async function adminSetGaffer(month: string, playerId: number): Promise<void> {
  await db.execute(sql`UPDATE gaffer_months SET gaffer_id = ${playerId}, chosen_by = 'admin', challenge = NULL, level = NULL, target = NULL, param = NULL, picked_at = NULL,
    pick_until = ${new Date(Date.now() + PICK_DAYS * DAY)} WHERE month = ${month} AND settled_at IS NULL`);
}

/** Admin: this month counts for nothing (no result, no unlocks, no more pushes). */
export async function adminVoidGaffer(month: string): Promise<void> {
  await db.execute(sql`UPDATE gaffer_months SET voided = true WHERE month = ${month} AND settled_at IS NULL`);
}
