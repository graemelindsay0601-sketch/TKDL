// Board Curse part 1, server side: Curse Run results and leaderboards, and the Curse Codex.
// Rules live in shared/darts-rules/board-curse-codex.ts; the run itself is played in the app.
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import { createNotification } from "./communityNotify";
import { postHighlight } from "./community-highlights-db";
import { CURSE_REWARDS, RUN_MAX_LEGS, codexRewards, isCurseId, maxRunScore, type CodexGame } from "../shared/darts-rules/board-curse-codex";

async function rows(q: ReturnType<typeof sql>): Promise<any[]> { return (await db.execute(q)).rows as any[]; }
const today = () => new Date().toISOString().slice(0, 10);

let ready: Promise<unknown> | null = null;
export const ensureCurseRun = () => (ready ??= (async () => {
  for (const c of CURSE_REWARDS) await db.execute(sql`INSERT INTO cosmetic_definitions (id, category, name, rarity, price, color, gradient, glow, enabled, purchasable, sort_order)
    VALUES (${c.id}, ${c.category}, ${c.name}, ${c.rarity}, 0, ${c.color ?? null}, ${c.gradient ?? null}, ${c.glow ?? null}, true, false, 240)
    ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, name = EXCLUDED.name, rarity = EXCLUDED.rarity, color = EXCLUDED.color,
      gradient = EXCLUDED.gradient, glow = EXCLUDED.glow, purchasable = false, sort_order = EXCLUDED.sort_order`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS board_curse_runs (id SERIAL PRIMARY KEY, player_id INTEGER NOT NULL, run_date DATE NOT NULL,
    daily BOOLEAN NOT NULL DEFAULT false, counted BOOLEAN NOT NULL DEFAULT false, legs INTEGER NOT NULL, score INTEGER NOT NULL, pacts INTEGER NOT NULL DEFAULT 0,
    picks JSONB NOT NULL DEFAULT '[]'::jsonb, played_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_curse_runs_daily ON board_curse_runs (run_date, counted, score DESC)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS board_curse_codex (player_id INTEGER NOT NULL, game_type TEXT NOT NULL, curse_id TEXT NOT NULL,
    beaten_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (player_id, game_type, curse_id))`);
})().catch(e => { ready = null; throw e; }));

export async function grant(pid: number, id: string): Promise<boolean> {
  const g = await db.execute(sql`INSERT INTO player_cosmetics (player_id, cosmetic_id) SELECT ${pid}, ${id}
    WHERE NOT EXISTS (SELECT 1 FROM player_cosmetics WHERE player_id = ${pid} AND cosmetic_id = ${id}) RETURNING cosmetic_id`);
  if (!g.rows.length) return false;
  const r = CURSE_REWARDS.find(x => x.id === id);
  void createNotification({ playerId: pid, type: "achievement_unlocked", message: `Board Curse unlock: ${r?.name ?? id}.` });
  return true;
}
export const rewardOut = (ids: string[]) => ids.map(id => { const r = CURSE_REWARDS.find(x => x.id === id)!; return { id, name: r.name, category: r.category }; });

export type RunInput = { playerId: number; daily: boolean; legs: number; score: number; pacts: number; maxPactsCleared: number; picks: string[] };
export function validRun(b: any): RunInput | null {
  const n = (v: unknown) => Math.round(Number(v));
  const r = { playerId: n(b?.playerId), daily: b?.daily === true, legs: n(b?.legs), score: n(b?.score), pacts: n(b?.pacts), maxPactsCleared: n(b?.maxPactsCleared ?? 0),
    picks: Array.isArray(b?.picks) ? b.picks.filter((p: unknown) => typeof p === "string").slice(0, RUN_MAX_LEGS).map((p: string) => p.slice(0, 40)) : [] };
  if (![r.playerId, r.legs, r.score, r.pacts, r.maxPactsCleared].every(Number.isFinite)) return null;
  if (r.legs < 0 || r.legs > RUN_MAX_LEGS || r.score < 0 || r.score > maxRunScore(r.legs) || r.pacts < 0 || r.pacts > r.legs || r.maxPactsCleared > r.pacts) return null;
  if (r.legs === 0 && r.score > 0) return null;
  return r;
}

export async function recordRun(r: RunInput) {
  await ensureCurseRun();
  const player = (await rows(sql`SELECT name FROM players WHERE id = ${r.playerId}`))[0];
  if (!player) return null;
  const date = today();
  // The first Daily Run of the day is the one that counts for the board; later goes are practice.
  const counted = r.daily && !(await rows(sql`SELECT 1 FROM board_curse_runs WHERE player_id = ${r.playerId} AND run_date = ${date} AND daily AND counted LIMIT 1`)).length;
  const prevTop = Number((await rows(sql`SELECT COALESCE(MAX(score), 0)::int s FROM board_curse_runs`))[0].s);
  await db.execute(sql`INSERT INTO board_curse_runs (player_id, run_date, daily, counted, legs, score, pacts, picks)
    VALUES (${r.playerId}, ${date}, ${r.daily}, ${counted}, ${r.legs}, ${r.score}, ${r.pacts}, ${JSON.stringify(r.picks)}::jsonb)`);
  const won: string[] = [];
  try {
    if (r.maxPactsCleared >= 3 && await grant(r.playerId, "tag-bc-pact-keeper")) won.push("tag-bc-pact-keeper");
    const record = r.legs >= 3 && r.score > prevTop;
    if (record) {
      if (await grant(r.playerId, "tag-bc-run-king")) won.push("tag-bc-run-king");
      await postHighlight({ key: `curse-run-record:${r.score}:${r.playerId}`, kind: "curse_record", playerId: r.playerId, players: [r.playerId], link: "/board-curse",
        title: "CURSE RUN RECORD", line: `${String(player.name)} set a new Curse Run record: ${r.score.toLocaleString("en-GB")} over ${r.legs} legs.`, stat: r.legs, statLabel: "legs survived" });
    }
  } catch (err) { logger.warn({ err }, "Curse Run rewards failed (non-fatal)"); }
  const best = Number((await rows(sql`SELECT COALESCE(MAX(score), 0)::int s FROM board_curse_runs WHERE player_id = ${r.playerId}`))[0].s);
  return { counted, best, personalBest: best === r.score && r.score > 0, record: r.legs >= 3 && r.score > prevTop, rewards: rewardOut(won) };
}

export async function runBoards(playerId?: number) {
  await ensureCurseRun();
  const row = (r: any) => ({ playerName: String(r.name), playerId: Number(r.player_id), score: Number(r.score), legs: Number(r.legs) });
  const daily = (await rows(sql`SELECT r.player_id, p.name, r.score, r.legs FROM board_curse_runs r JOIN players p ON p.id = r.player_id
    WHERE r.run_date = ${today()} AND r.daily AND r.counted ORDER BY r.score DESC, r.played_at ASC LIMIT 10`)).map(row);
  const allTime = (await rows(sql`SELECT DISTINCT ON (r.player_id) r.player_id, p.name, r.score, r.legs FROM board_curse_runs r JOIN players p ON p.id = r.player_id
    ORDER BY r.player_id, r.score DESC, r.played_at ASC`)).map(row).sort((a, b) => b.score - a.score).slice(0, 10);
  const me = playerId ? (await rows(sql`SELECT COALESCE(MAX(score), 0)::int best, BOOL_OR(daily AND counted AND run_date = ${today()}) AS done FROM board_curse_runs WHERE player_id = ${playerId}`))[0] : null;
  return { date: today(), daily, allTime, myBest: me ? Number(me.best) : null, dailyDone: !!me?.done };
}

export async function codexFor(pid: number) {
  await ensureCurseRun();
  const r = await rows(sql`SELECT game_type, curse_id FROM board_curse_codex WHERE player_id = ${pid}`);
  return { X01: r.filter(x => x.game_type === "X01").map(x => String(x.curse_id)), CRICKET: r.filter(x => x.game_type === "CRICKET").map(x => String(x.curse_id)) };
}

/** Log curses beaten; returns the new ones and any unlocks. */
export async function addToCodex(pid: number, game: CodexGame, ids: string[]) {
  await ensureCurseRun();
  const clean = [...new Set(ids.filter(id => isCurseId(game, id)))];
  const fresh: string[] = [];
  for (const id of clean) {
    const ins = await db.execute(sql`INSERT INTO board_curse_codex (player_id, game_type, curse_id) VALUES (${pid}, ${game}, ${id}) ON CONFLICT DO NOTHING RETURNING curse_id`);
    if (ins.rows.length) fresh.push(id);
  }
  const won: string[] = [];
  if (fresh.length) {
    for (const id of codexRewards(await codexFor(pid))) if (await grant(pid, id)) won.push(id);
  }
  return { fresh, rewards: rewardOut(won) };
}
