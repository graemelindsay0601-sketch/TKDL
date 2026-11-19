/**
 * Achievements v2, saved and awarded.
 *
 * The evaluators work everything out from recorded data, so "awarding" is a diff: work out every player's states, compare with
 * what is saved, save what changed and record each new unlock once. The unlock row's unique key makes paying coins race-safe
 * (only the insert that lands pays).
 *
 * Launch: the first sync after the switch is turned on is the history credit. Those unlocks are saved as source 'history'
 * with no coins, and everyone with something earned gets the one-off welcome bonus. Every unlock after that is 'live' and pays
 * its points as coins. Levels are never taken away (a track's value can drop, e.g. checkout rate; its level stays).
 */
import { sql } from "drizzle-orm";
import { computeAll, type Exec } from "./report.ts";
import { grantRewards } from "./rewards.ts";
import { CATALOGUE, levelPoints, SEASON_GOAL_POINTS, type Area } from "./catalogue.ts";
import type { AchievementState } from "./evaluate.ts";

export const WELCOME_COINS = 250;
export const ENABLED_KEY = "achievements_v2_enabled";
export const LAUNCHED_KEY = "achievements_v2_launched_at";

export type Pay = (playerId: number, coins: number, detail: string) => Promise<void>;
export type Setting = { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void> };

const ensured = new WeakMap<object, Promise<void>>();
export function ensureTables(db: Exec) {
  const have = ensured.get(db); if (have) return have;
  const p = (async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS achievement_v2_items (
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE, key TEXT NOT NULL, area TEXT NOT NULL, kind TEXT NOT NULL,
      value INTEGER NOT NULL DEFAULT 0, level INTEGER NOT NULL DEFAULT 0, earned_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (player_id, key))`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS achievement_v2_seasons (
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE, key TEXT NOT NULL, season_id INTEGER NOT NULL,
      value INTEGER NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (player_id, key, season_id))`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS achievement_v2_unlocks (
      id SERIAL PRIMARY KEY, player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE, key TEXT NOT NULL, area TEXT NOT NULL,
      kind TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 0, season_id INTEGER NOT NULL DEFAULT 0, coins INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL, seen BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (player_id, key, level, season_id))`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS achievement_v2_unlocks_player_idx ON achievement_v2_unlocks (player_id, created_at DESC)`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS achievement_v2_live (
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE, feat TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (player_id, feat))`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS achievement_v2_welcome (
      player_id INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE, coins INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  })().catch(err => { ensured.delete(db); throw err; });
  ensured.set(db, p);
  return p;
}

/** Facts only visible as they happen (e.g. the points a winner had before the match), kept for the evaluators. */
export async function recordLiveFeat(db: Exec, playerId: number, feat: string, at: Date) {
  await ensureTables(db);
  await db.execute(sql`INSERT INTO achievement_v2_live (player_id, feat, at) VALUES (${playerId}, ${feat}, ${at.toISOString()}::timestamptz) ON CONFLICT DO NOTHING`);
}

type Unlock = { playerId: number; key: string; area: Area; kind: string; level: number; seasonId: number; coins: number };
export type SyncResult = { mode: "history" | "live"; players: number; itemsWritten: number; unlocks: number; coinsPaid: number; welcomed: number; cosmetics: number; cosmeticsError?: string; ms: number };

const chunks = <T,>(list: T[], size = 250) => { const out: T[][] = []; for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size)); return out; };
const defs = new Map(CATALOGUE.map(d => [d.key, d]));
const featPoints = (key: string) => { const d = defs.get(key); return d?.kind === "FEAT" ? d.points : 0; };

/** Work everything out, save what changed and record (and, after launch, pay for) every new unlock. */
export async function syncAll(db: Exec, setting: Setting, pay: Pay, now = new Date()): Promise<SyncResult> {
  const t0 = Date.now();
  await ensureTables(db);
  const launched = !!(await setting.get(LAUNCHED_KEY));
  const mode = launched ? "live" : "history";
  const all = await computeAll(db, now);

  const items = new Map<string, { value: number; level: number; earned: boolean }>();
  for (const r of (await db.execute(sql`SELECT player_id, key, value, level, earned_at FROM achievement_v2_items`)).rows)
    items.set(`${r.player_id}|${r.key}`, { value: Number(r.value), level: Number(r.level), earned: !!r.earned_at });
  const seasons = new Map<string, { value: number; completed: number }>();
  for (const r of (await db.execute(sql`SELECT player_id, key, season_id, value, completed FROM achievement_v2_seasons`)).rows)
    seasons.set(`${r.player_id}|${r.key}|${r.season_id}`, { value: Number(r.value), completed: Number(r.completed) });

  const unlocks: Unlock[] = [];
  const playerIds = new Set<number>();
  const itemRows: ReturnType<typeof sql>[] = [], seasonRows: ReturnType<typeof sql>[] = [];
  const saveItem = (pid: number, s: AchievementState, value: number, level: number, earnedAt: Date | null) => {
    itemRows.push(sql`(${pid}, ${s.key}, ${s.area}, ${s.kind}, ${value}, ${level}, ${earnedAt ? earnedAt.toISOString() : null}::timestamptz, NOW())`);
  };

  for (const area of Object.keys(all) as (keyof typeof all)[]) for (const p of all[area]) for (const s of p.states) {
    const pid = p.playerId, saved = items.get(`${pid}|${s.key}`);
    if (s.kind === "TRACK") {
      const prevLevel = saved?.level ?? 0;
      if (!saved ? s.value > 0 : saved.value !== s.value || s.level > prevLevel) saveItem(pid, s, s.value, Math.max(prevLevel, s.level), null);
      for (let l = prevLevel + 1; l <= s.level; l++) unlocks.push({ playerId: pid, key: s.key, area: s.area, kind: s.kind, level: l, seasonId: 0, coins: levelPoints(l) });
    } else if (s.kind === "FEAT") {
      if (s.earnedAt && !saved?.earned) {
        saveItem(pid, s, 1, 1, s.earnedAt);
        unlocks.push({ playerId: pid, key: s.key, area: s.area, kind: s.kind, level: 1, seasonId: 0, coins: featPoints(s.key) });
      }
    } else {
      for (const ps of s.perSeason) {
        const k = `${pid}|${s.key}|${ps.seasonId}`, old = seasons.get(k);
        if (old && old.value === ps.value && old.completed >= ps.completed) continue;
        if (!old && ps.value === 0) continue;
        seasonRows.push(sql`(${pid}, ${s.key}, ${ps.seasonId}, ${ps.value}, ${ps.completed}, NOW())`);
        for (let l = (old?.completed ?? 0) + 1; l <= ps.completed; l++)
          unlocks.push({ playerId: pid, key: s.key, area: s.area, kind: s.kind, level: l, seasonId: ps.seasonId, coins: SEASON_GOAL_POINTS });
      }
    }
    if (s.points > 0) playerIds.add(pid);
  }

  for (const rows of chunks(itemRows)) await db.execute(sql`INSERT INTO achievement_v2_items (player_id, key, area, kind, value, level, earned_at, updated_at)
    VALUES ${sql.join(rows, sql`, `)}
    ON CONFLICT (player_id, key) DO UPDATE SET value = EXCLUDED.value, level = GREATEST(achievement_v2_items.level, EXCLUDED.level),
      earned_at = COALESCE(achievement_v2_items.earned_at, EXCLUDED.earned_at), updated_at = NOW()`);
  for (const rows of chunks(seasonRows)) await db.execute(sql`INSERT INTO achievement_v2_seasons (player_id, key, season_id, value, completed, updated_at)
    VALUES ${sql.join(rows, sql`, `)}
    ON CONFLICT (player_id, key, season_id) DO UPDATE SET value = EXCLUDED.value,
      completed = GREATEST(achievement_v2_seasons.completed, EXCLUDED.completed), updated_at = NOW()`);
  const itemsWritten = itemRows.length + seasonRows.length;

  // Only the insert that lands pays, so two syncs racing can never pay twice.
  let made = 0, coinsPaid = 0;
  const byKey = new Map(unlocks.map(u => [`${u.playerId}|${u.key}|${u.level}|${u.seasonId}`, u]));
  for (const batch of chunks(unlocks)) {
    const ins = await db.execute(sql`INSERT INTO achievement_v2_unlocks (player_id, key, area, kind, level, season_id, coins, source, seen)
      VALUES ${sql.join(batch.map(u => sql`(${u.playerId}, ${u.key}, ${u.area}, ${u.kind}, ${u.level}, ${u.seasonId}, ${mode === "live" ? u.coins : 0}, ${mode}, ${mode === "history"})`), sql`, `)}
      ON CONFLICT (player_id, key, level, season_id) DO NOTHING RETURNING player_id, key, level, season_id`);
    for (const r of ins.rows) {
      made++;
      const u = byKey.get(`${r.player_id}|${r.key}|${r.level}|${r.season_id}`);
      if (mode === "live" && u && u.coins > 0) { await pay(u.playerId, u.coins, `v2:${u.key}:${u.level}${u.seasonId ? `:s${u.seasonId}` : ""}`); coinsPaid += u.coins; }
    }
  }

  let welcomed = 0;
  if (mode === "history") {
    for (const pid of playerIds) {
      const ins = await db.execute(sql`INSERT INTO achievement_v2_welcome (player_id, coins) VALUES (${pid}, ${WELCOME_COINS}) ON CONFLICT DO NOTHING RETURNING player_id`);
      if (ins.rows.length) { await pay(pid, WELCOME_COINS, "v2:welcome"); welcomed++; coinsPaid += WELCOME_COINS; }
    }
    await setting.set(LAUNCHED_KEY, now.toISOString());
  }
  // cosmetics earned from achievements (award-only; history counts too)
  let cosmetics = 0, cosmeticsError: string | undefined;
  try {
    const byPlayer = new Map<number, AchievementState[]>();
    for (const list of Object.values(all)) for (const p of list) byPlayer.set(p.playerId, [...(byPlayer.get(p.playerId) ?? []), ...p.states]);
    cosmetics = (await grantRewards(db, byPlayer)).length;
  } catch (err) { cosmeticsError = String((err as Error)?.message ?? err); }
  return { mode, cosmetics, ...(cosmeticsError ? { cosmeticsError } : {}), players: new Set(Object.values(all).flatMap(a => a.map(p => p.playerId))).size, itemsWritten, unlocks: made, coinsPaid, welcomed, ms: Date.now() - t0 };
}
