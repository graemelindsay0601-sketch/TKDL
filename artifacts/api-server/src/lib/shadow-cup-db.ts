// Database side of the weekly Shadow Cup (rules and simulation in shadow-cup.ts).
import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import { londonMidnightUtc } from "./londonDate";
import { createNotification } from "./communityNotify";
import { getDefaultLeagueId } from "./currentLeague";
import { getSettingBool } from "./settingsService";
import { postHighlight } from "./community-highlights-db";
import { mondayOf } from "./community-roundup";
import { UNLOCK_DARTS, buildProfile } from "./shadow-profile";
import { loggedDarts, unlockDarts } from "./shadow-profile-db";
import { simulateMatch, firstRound, revealDays, roundName, CUP_UNLOCK, type CupEntrant, type CupMatch } from "./shadow-cup";
export { CUP_EARNED_BY } from "./shadow-cup";

export const MIN_ENTRANTS = 4;

async function rows(q: ReturnType<typeof sql>): Promise<any[]> { return (await db.execute(q)).rows as any[]; }

let ready: Promise<unknown> | null = null;
export const ensureShadowCup = () => (ready ??= (async () => {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS shadow_cup (
    week TEXT PRIMARY KEY, rounds INTEGER NOT NULL, champion_id INTEGER, settled_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS shadow_cup_matches (
    id SERIAL PRIMARY KEY, week TEXT NOT NULL, round INTEGER NOT NULL, slot INTEGER NOT NULL,
    p1_id INTEGER, p1_name TEXT, p1_avg REAL, p2_id INTEGER, p2_name TEXT, p2_avg REAL,
    winner_id INTEGER, score TEXT, result JSONB, reveal_at TIMESTAMPTZ NOT NULL, UNIQUE (week, round, slot))`);
  await db.execute(sql`INSERT INTO cosmetic_definitions (id, category, name, rarity, price, color, enabled, purchasable, sort_order)
    VALUES (${CUP_UNLOCK.id}, ${CUP_UNLOCK.category}, ${CUP_UNLOCK.name}, ${CUP_UNLOCK.rarity}, 0, ${CUP_UNLOCK.color}, true, false, ${CUP_UNLOCK.sortOrder})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rarity = EXCLUDED.rarity, color = EXCLUDED.color, purchasable = false`);
})().catch(e => { ready = null; throw e; }));

async function entrants(): Promise<CupEntrant[]> {
  const players = await rows(sql`SELECT id, name FROM players WHERE status <> 'INACTIVE' ORDER BY id`);
  const out: CupEntrant[] = [];
  for (const p of players) {
    const counts = await unlockDarts(Number(p.id));
    if (counts.total < UNLOCK_DARTS) continue;
    const prof = buildProfile(await loggedDarts(Number(p.id)), "current");
    const thin = prof.scoringDist.reduce((n, x) => n + x.n, 0) < 60;
    const avg = thin ? (counts.practiceAvg ?? prof.computedAvg) : prof.computedAvg;
    out.push({ playerId: Number(p.id), name: String(p.name), avg, profile: { ...prof, computedAvg: avg, thin } });
  }
  return out;
}

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** From Monday 09:00 (London), play this week's cup once: every round is simulated now, then revealed day by day. */
export async function createCup(now = new Date()): Promise<string | null> {
  await ensureShadowCup();
  // Runs alongside the Shadow League: switching that off in admin stops new cups.
  if (!(await getSettingBool(await getDefaultLeagueId(), "shadow_league_enabled").catch(() => false))) return null;
  const week = mondayOf(now);
  if ((await rows(sql`SELECT 1 FROM shadow_cup WHERE week = ${week}`)).length) return null;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(now));
  const isMonday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" }).format(now) === "Mon";
  if (isMonday && hour < 9) return null;
  const field = await entrants();
  if (field.length < MIN_ENTRANTS) return null;
  const pairs = firstRound(field);
  const rounds = Math.log2(pairs.length * 2);
  const days = revealDays(rounds);
  const noon = new Date(londonMidnightUtc(week).getTime() + 12 * 3600000);
  // Too late in the week to run it properly (e.g. first switched on on a Thursday):
  // wait for next Monday rather than settling the whole cup at once.
  if (rounds > 1 && now.getTime() >= addDays(noon, days[1]).getTime()) return null;
  // Late in the week (server asleep on Monday): reveal what's due straight away rather than in the past.
  const revealAt = (r: number) => new Date(Math.max(addDays(noon, days[r - 1]).getTime(), r === 1 ? now.getTime() : 0));
  const claimed = await db.execute(sql`INSERT INTO shadow_cup (week, rounds) VALUES (${week}, ${rounds}) ON CONFLICT DO NOTHING RETURNING week`);
  if (!claimed.rows.length) return null;
  let current: (CupEntrant | null)[][] = pairs;
  for (let r = 1; r <= rounds; r++) {
    const winners: (CupEntrant | null)[] = [];
    for (let slot = 0; slot < current.length; slot++) {
      const [a, b] = current[slot];
      let w: CupEntrant | null = a ?? b;
      let result: CupMatch | null = null;
      if (a && b) {
        result = simulateMatch(a.profile, b.profile, `${week}:${r}:${slot}:${a.playerId}:${b.playerId}`);
        w = result.winner === 0 ? a : b;
      }
      winners.push(w);
      await db.execute(sql`INSERT INTO shadow_cup_matches (week, round, slot, p1_id, p1_name, p1_avg, p2_id, p2_name, p2_avg, winner_id, score, result, reveal_at)
        VALUES (${week}, ${r}, ${slot}, ${a?.playerId ?? null}, ${a?.name ?? null}, ${a?.avg ?? null}, ${b?.playerId ?? null}, ${b?.name ?? null}, ${b?.avg ?? null},
          ${w?.playerId ?? null}, ${result ? `${result.score[0]}-${result.score[1]}` : null}, ${result ? JSON.stringify(result) : null}::jsonb, ${revealAt(r)})
        ON CONFLICT DO NOTHING`);
    }
    current = [];
    for (let i = 0; i < winners.length; i += 2) current.push([winners[i], winners[i + 1] ?? null]);
  }
  return week;
}

/** Once the final is revealed: crown the champion, post the moment, grant the unlock. */
export async function settleCups(now = new Date()): Promise<void> {
  await ensureShadowCup();
  for (const c of await rows(sql`SELECT * FROM shadow_cup WHERE settled_at IS NULL`)) {
    const final = (await rows(sql`SELECT * FROM shadow_cup_matches WHERE week = ${c.week} AND round = ${c.rounds} AND slot = 0`))[0];
    if (!final || new Date(final.reveal_at) > now) continue;
    const done = await db.execute(sql`UPDATE shadow_cup SET champion_id = ${final.winner_id}, settled_at = NOW() WHERE week = ${c.week} AND settled_at IS NULL RETURNING week`);
    if (!done.rows.length || !final.winner_id) continue;
    const champ = Number(final.winner_id);
    const won = champ === Number(final.p1_id);
    const name = won ? final.p1_name : final.p2_name, opp = won ? final.p2_name : final.p1_name;
    const score = String(final.score ?? "").split("-").map(Number);
    await postHighlight({ key: `shadow-cup:${c.week}`, kind: "shadow_cup", playerId: champ, players: [champ], link: "/shadow-bot",
      title: "SHADOW CUP CHAMPION", line: `Shadow ${name} won this week's Shadow Cup${opp ? `, beating Shadow ${opp} ${Math.max(...score)}-${Math.min(...score)} in the final` : ""}.`,
      stat: "🏆", statLabel: "Shadow Cup" });
    const g = await db.execute(sql`INSERT INTO player_cosmetics (player_id, cosmetic_id) SELECT ${champ}, ${CUP_UNLOCK.id}
      WHERE NOT EXISTS (SELECT 1 FROM player_cosmetics WHERE player_id = ${champ} AND cosmetic_id = ${CUP_UNLOCK.id}) RETURNING cosmetic_id`);
    void createNotification({ playerId: champ, type: "achievement_unlocked",
      message: `Your shadow won the Shadow Cup!${g.rows.length ? " Unlocked: the Shadow Cup Champion tag." : ""}` });
  }
}

/** This week's cup (or last week's until a new one starts), with only revealed results shown. */
export async function currentCup(now = new Date()) {
  await ensureShadowCup();
  const c = (await rows(sql`SELECT * FROM shadow_cup ORDER BY week DESC LIMIT 1`))[0];
  if (!c) return null;
  const ms = await rows(sql`SELECT id, round, slot, p1_id, p1_name, p1_avg, p2_id, p2_name, p2_avg, winner_id, score, reveal_at,
      (result->'avgs') avgs FROM shadow_cup_matches WHERE week = ${c.week} ORDER BY round, slot`);
  const rounds = Array.from({ length: Number(c.rounds) }, (_, i) => i + 1).map(r => {
    const list = ms.filter(m => Number(m.round) === r);
    const revealAt = list[0] ? new Date(list[0].reveal_at) : now;
    const revealed = revealAt <= now;
    // Who's in a later round isn't known until the round before it is revealed.
    const prevRevealed = r === 1 || new Date(ms.find(m => Number(m.round) === r - 1)?.reveal_at ?? now) <= now;
    return {
      round: r, name: roundName(Number(c.rounds) - r + 1), revealAt: revealAt.toISOString(), revealed,
      matches: list.map(m => ({
        id: Number(m.id), slot: Number(m.slot),
        p1: prevRevealed && m.p1_id ? { id: Number(m.p1_id), name: m.p1_name, avg: Number(m.p1_avg) } : null,
        p2: prevRevealed && m.p2_id ? { id: Number(m.p2_id), name: m.p2_name, avg: Number(m.p2_avg) } : null,
        bye: prevRevealed && (!m.p1_id || !m.p2_id),
        winnerId: revealed ? (m.winner_id ? Number(m.winner_id) : null) : null,
        score: revealed ? m.score : null,
        avgs: revealed ? m.avgs : null,
      })),
    };
  });
  return { week: c.week, championId: c.champion_id ? Number(c.champion_id) : null, rounds };
}

export async function cupMatch(id: number, now = new Date()) {
  await ensureShadowCup();
  const m = (await rows(sql`SELECT * FROM shadow_cup_matches WHERE id = ${id}`))[0];
  if (!m || new Date(m.reveal_at) > now || !m.result) return null;
  return { id: Number(m.id), week: m.week, round: Number(m.round), p1: { id: Number(m.p1_id), name: m.p1_name }, p2: { id: Number(m.p2_id), name: m.p2_name }, result: m.result as CupMatch };
}

export function initializeShadowCupScheduler() {
  const tick = async () => {
    try { await createCup(); await settleCups(); } catch (err) { logger.warn({ err }, "Shadow Cup tick failed"); }
  };
  cron.schedule("20 * * * *", () => { void tick(); });
  void tick();
}
