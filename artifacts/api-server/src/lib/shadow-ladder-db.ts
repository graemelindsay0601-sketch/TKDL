// Database side of the Shadow Ladder (rules in shadow-ladder.ts). Runs once a night
// (03:35 London, or on boot if last night's run was missed) while Shadow League is on.
import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import { getDefaultLeagueId } from "./currentLeague";
import { getSettingBool } from "./settingsService";
import { entrants } from "./shadow-cup-db";
import { simulateMatch } from "./shadow-cup";
import { START_RATING, NIGHT_ROUNDS, LADDER_LEGS, eloUpdate, nightPairs, ranks } from "./shadow-ladder";

async function rows(q: ReturnType<typeof sql>): Promise<any[]> { return (await db.execute(q)).rows as any[]; }
export const londonDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const londonHour = (d = new Date()) => Number(d.toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }));

let ready: Promise<unknown> | null = null;
export const ensureShadowLadder = () => (ready ??= (async () => {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS shadow_ladder (
    player_id INTEGER PRIMARY KEY, rating REAL NOT NULL DEFAULT ${sql.raw(String(START_RATING))}, played INTEGER NOT NULL DEFAULT 0,
    won INTEGER NOT NULL DEFAULT 0, rank INTEGER, prev_rank INTEGER, form TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS shadow_ladder_log (
    id SERIAL PRIMARY KEY, night TEXT NOT NULL, round INTEGER NOT NULL, p1_id INTEGER NOT NULL, p2_id INTEGER NOT NULL,
    winner_id INTEGER NOT NULL, score TEXT NOT NULL, result JSONB, created_at TIMESTAMPTZ DEFAULT NOW())`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_shadow_ladder_log_night ON shadow_ladder_log (night)`);
})().catch(e => { ready = null; throw e; }));

/** Play one night of the ladder. Returns the number of matches played (0 if it already ran tonight). */
export async function runLadderNight(now = new Date()): Promise<number> {
  await ensureShadowLadder();
  if (!(await getSettingBool(await getDefaultLeagueId(), "shadow_league_enabled").catch(() => false))) return 0;
  const night = londonDay(now);
  if ((await rows(sql`SELECT 1 FROM shadow_ladder_log WHERE night = ${night} LIMIT 1`)).length) return 0;
  const ents = await entrants();
  if (ents.length < 2) return 0;
  const existing = new Map((await rows(sql`SELECT * FROM shadow_ladder`)).map(r => [Number(r.player_id), r]));
  const state = new Map(ents.map(e => {
    const r = existing.get(e.playerId);
    return [e.playerId, { e, rating: r ? Number(r.rating) : START_RATING, played: r ? Number(r.played) : 0, won: r ? Number(r.won) : 0, form: r ? String(r.form) : "", oldRank: r?.rank != null ? Number(r.rank) : null }];
  }));
  let n = 0;
  for (let round = 0; round < NIGHT_ROUNDS; round++) {
    const ordered = [...state.values()].sort((a, b) => b.rating - a.rating || a.e.playerId - b.e.playerId);
    for (const [a, b] of nightPairs(ordered, round)) {
      const m = simulateMatch(a.e.profile, b.e.profile, `ladder:${night}:${round}:${a.e.playerId}:${b.e.playerId}`, LADDER_LEGS);
      const aWon = m.winner === 0;
      [a.rating, b.rating] = eloUpdate(a.rating, b.rating, aWon, Math.abs(m.score[0] - m.score[1]));
      for (const [s, w] of [[a, aWon], [b, !aWon]] as const) { s.played++; if (w) s.won++; s.form = (s.form + (w ? "W" : "L")).slice(-5); }
      await db.execute(sql`INSERT INTO shadow_ladder_log (night, round, p1_id, p2_id, winner_id, score, result)
        VALUES (${night}, ${round}, ${a.e.playerId}, ${b.e.playerId}, ${aWon ? a.e.playerId : b.e.playerId}, ${`${m.score[0]}-${m.score[1]}`}, ${JSON.stringify(m)})`);
      n++;
    }
  }
  const rk = ranks([...state.values()].map(s => ({ id: s.e.playerId, rating: s.rating })));
  for (const s of state.values()) {
    await db.execute(sql`INSERT INTO shadow_ladder (player_id, rating, played, won, rank, prev_rank, form, updated_at)
      VALUES (${s.e.playerId}, ${s.rating}, ${s.played}, ${s.won}, ${rk.get(s.e.playerId)!}, ${s.oldRank}, ${s.form}, NOW())
      ON CONFLICT (player_id) DO UPDATE SET rating = EXCLUDED.rating, played = EXCLUDED.played, won = EXCLUDED.won,
        prev_rank = EXCLUDED.prev_rank, rank = EXCLUDED.rank, form = EXCLUDED.form, updated_at = NOW()`);
  }
  // Shadows that dropped out (no longer unlocked or inactive) leave the ladder's ranks.
  await db.execute(sql`UPDATE shadow_ladder SET rank = NULL WHERE player_id NOT IN (${sql.join([...state.keys()].map(id => sql`${id}`), sql`, `)})`);
  return n;
}

export async function ladderTable() {
  await ensureShadowLadder();
  const last = (await rows(sql`SELECT MAX(night) night FROM shadow_ladder_log`))[0]?.night ?? null;
  const results = last ? await rows(sql`SELECT l.*, a.name a_name, b.name b_name FROM shadow_ladder_log l
    JOIN players a ON a.id = l.p1_id JOIN players b ON b.id = l.p2_id WHERE night = ${last} ORDER BY round, id`) : [];
  const table = await rows(sql`SELECT s.*, p.name FROM shadow_ladder s JOIN players p ON p.id = s.player_id WHERE s.rank IS NOT NULL ORDER BY s.rank, p.name`);
  return {
    night: last,
    rows: table.map(r => ({ playerId: Number(r.player_id), name: String(r.name), rating: Math.round(Number(r.rating)), rank: Number(r.rank),
      move: r.prev_rank == null ? null : Number(r.prev_rank) - Number(r.rank), played: Number(r.played), won: Number(r.won), form: String(r.form),
      lastNight: results.filter(x => Number(x.p1_id) === Number(r.player_id) || Number(x.p2_id) === Number(r.player_id)).map(x => {
        const me1 = Number(x.p1_id) === Number(r.player_id);
        const [s1, s2] = String(x.score).split("-");
        return { id: Number(x.id), opp: me1 ? x.b_name : x.a_name, won: Number(x.winner_id) === Number(r.player_id), score: me1 ? `${s1}-${s2}` : `${s2}-${s1}` };
      }) })),
  };
}

/** A played ladder match, in the same shape as a cup match so the replay can show it. */
export async function ladderMatch(id: number) {
  await ensureShadowLadder();
  const m = (await rows(sql`SELECT l.*, a.name a_name, b.name b_name FROM shadow_ladder_log l
    JOIN players a ON a.id = l.p1_id JOIN players b ON b.id = l.p2_id WHERE l.id = ${id}`))[0];
  if (!m?.result) return null;
  return { id: Number(m.id), round: Number(m.round), p1: { id: Number(m.p1_id), name: m.a_name }, p2: { id: Number(m.p2_id), name: m.b_name }, result: m.result };
}

export function initializeShadowLadderScheduler() {
  const run = async () => { try { const n = await runLadderNight(); if (n) logger.info({ n }, "Shadow Ladder night played"); } catch (err) { logger.warn({ err }, "Shadow Ladder run failed"); } };
  cron.schedule("35 3 * * *", () => { void run(); }, { timezone: "Europe/London" });
  // Missed last night's run (e.g. the server was asleep): catch up once it's past 03:35.
  if (londonHour() >= 4) void run();
}
