// Database side of the Boss Battle events: Daily and Weekly Boss runs and boards, the monthly
// League Raid (damage worked out from what's already recorded), and Be the Boss challenges.
// Rules in shared/darts-rules/boss-events.ts.
import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import { createNotification } from "./communityNotify";
import { postHighlight } from "./community-highlights-db";
import { mondayOf } from "./community-roundup";
import { londonMidnightUtc } from "./londonDate";
import { rosterById } from "../shared/darts-rules/boss-roster";
import { dailyBoss, weeklyBoss, raidFor, raidHealth, leagueMatchDamage, RAID_DAMAGE, validCustomCurses, TWISTS } from "../shared/darts-rules/boss-events";

async function rows(q: ReturnType<typeof sql>): Promise<any[]> { return (await db.execute(q)).rows as any[]; }
const nameOf = async (id: number) => String((await rows(sql`SELECT name FROM players WHERE id = ${id}`))[0]?.name ?? "Someone");
export const londonDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const monthOf = (d = new Date()) => londonDay(d).slice(0, 7);
const nextMonth = (month: string) => { const [y, m] = month.split("-").map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };

export const EVENT_UNLOCKS = {
  weekly: { id: "tag-bb-weekly-slayer", category: "LEADERBOARD_TAG", name: "WEEKLY SLAYER", rarity: "EPIC", color: "#ff7a45", sortOrder: 234 },
  raider: { id: "tag-bb-raider", category: "LEADERBOARD_TAG", name: "RAIDER", rarity: "RARE", color: "#94a3b8", sortOrder: 235 },
  leader: { id: "tag-bb-raid-leader", category: "LEADERBOARD_TAG", name: "RAID LEADER", rarity: "LEGENDARY", color: "#ffd24a", sortOrder: 236 },
};

let ready: Promise<unknown> | null = null;
export const ensureBossEvents = () => (ready ??= (async () => {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS boss_event_runs (
    id SERIAL PRIMARY KEY, kind TEXT NOT NULL, period TEXT NOT NULL, player_id INTEGER NOT NULL, won BOOLEAN NOT NULL,
    seconds INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_boss_event_runs ON boss_event_runs (kind, period)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS boss_event_settled (kind TEXT NOT NULL, period TEXT NOT NULL, winner_id INTEGER, settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (kind, period))`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS boss_raids (month TEXT PRIMARY KEY, hp INTEGER NOT NULL, killed_at TIMESTAMPTZ, leader_id INTEGER, settled_at TIMESTAMPTZ)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS boss_custom (
    id SERIAL PRIMARY KEY, from_id INTEGER NOT NULL, to_id INTEGER NOT NULL, curses JSONB NOT NULL, message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), played_at TIMESTAMPTZ, target_won BOOLEAN, seconds INTEGER)`);
  for (const u of Object.values(EVENT_UNLOCKS)) {
    await db.execute(sql`INSERT INTO cosmetic_definitions (id, category, name, rarity, price, color, enabled, purchasable, sort_order)
      VALUES (${u.id}, ${u.category}, ${u.name}, ${u.rarity}, 0, ${u.color}, true, false, ${u.sortOrder})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rarity = EXCLUDED.rarity, color = EXCLUDED.color, purchasable = false`);
  }
})().catch(e => { ready = null; throw e; }));

async function grant(playerId: number, cosmeticId: string): Promise<boolean> {
  const g = await db.execute(sql`INSERT INTO player_cosmetics (player_id, cosmetic_id) SELECT ${playerId}, ${cosmeticId}
    WHERE NOT EXISTS (SELECT 1 FROM player_cosmetics WHERE player_id = ${playerId} AND cosmetic_id = ${cosmeticId}) RETURNING cosmetic_id`);
  return g.rows.length > 0;
}

// ── Daily / Weekly Boss ─────────────────────────────────────────────────────

export const currentEvent = (kind: "daily" | "weekly", now = new Date()) => kind === "daily" ? dailyBoss(londonDay(now)) : weeklyBoss(mondayOf(now));

async function board(kind: string, period: string, me: number | null) {
  const best = await rows(sql`SELECT r.player_id, p.name, MIN(r.seconds) FILTER (WHERE r.won) best, COUNT(*)::int tries, BOOL_OR(r.won) won
    FROM boss_event_runs r JOIN players p ON p.id = r.player_id WHERE r.kind = ${kind} AND r.period = ${period}
    GROUP BY r.player_id, p.name ORDER BY BOOL_OR(r.won) DESC, MIN(r.seconds) FILTER (WHERE r.won) ASC NULLS LAST, COUNT(*) DESC`);
  const list = best.map(r => ({ playerId: Number(r.player_id), name: String(r.name), best: r.best == null ? null : Number(r.best), tries: Number(r.tries), won: !!r.won }));
  return { board: list.filter(r => r.won).slice(0, 10), fighters: list.length, mine: me ? list.find(r => r.playerId === me) ?? null : null };
}

export async function eventsFor(me: number | null, now = new Date()) {
  await ensureBossEvents();
  const out: Record<string, unknown> = {};
  for (const kind of ["daily", "weekly"] as const) {
    const e = currentEvent(kind, now);
    out[kind] = { ...e, twistInfo: TWISTS.find(t => t.id === e.twist), ...(await board(kind, e.period, me)),
      endsAt: kind === "daily" ? londonMidnightUtc(londonDay(new Date(now.getTime() + 86400000))).toISOString() : londonMidnightUtc(mondayOf(new Date(now.getTime() + 7 * 86400000))).toISOString() };
  }
  out.raid = await raidState(me, now);
  return out;
}

export async function recordEventRun(kind: string, pid: number, won: boolean, seconds: number | null, now = new Date()) {
  await ensureBossEvents();
  if (kind !== "daily" && kind !== "weekly") return { error: "Unknown event" };
  const e = currentEvent(kind, now);
  const before = (await rows(sql`SELECT 1 FROM boss_event_runs WHERE kind = ${kind} AND period = ${e.period} AND won LIMIT 1`)).length;
  await db.execute(sql`INSERT INTO boss_event_runs (kind, period, player_id, won, seconds) VALUES (${kind}, ${e.period}, ${pid}, ${won}, ${won ? seconds : null})`);
  if (won && !before) {
    const boss = rosterById(e.bossId)!;
    await postHighlight({ key: `boss-${kind}:${e.period}`, kind: kind === "daily" ? "boss_daily" : "boss_weekly", playerId: pid, players: [pid], link: "/boss-battle",
      title: kind === "daily" ? "DAILY BOSS DOWN" : "WEEKLY BOSS DOWN",
      line: `${await nameOf(pid)} was first to beat ${kind === "daily" ? "today's" : "this week's"} boss, ${boss.name} (${TWISTS.find(t => t.id === e.twist)!.name})${seconds ? ` in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : ""}.`,
      stat: "⚔️", statLabel: "Boss Battle" });
  }
  return { ok: true, ...(await board(kind, e.period, pid)) };
}

/** Last week's fastest kill gets the Weekly Slayer tag (once per week). */
export async function settleWeekly(now = new Date()): Promise<void> {
  await ensureBossEvents();
  const thisWeek = mondayOf(now);
  for (const r of await rows(sql`SELECT DISTINCT period FROM boss_event_runs WHERE kind = 'weekly' AND period < ${thisWeek}
      AND NOT EXISTS (SELECT 1 FROM boss_event_settled s WHERE s.kind = 'weekly' AND s.period = boss_event_runs.period)`)) {
    const top = (await board("weekly", r.period, null)).board[0];
    const done = await db.execute(sql`INSERT INTO boss_event_settled (kind, period, winner_id) VALUES ('weekly', ${r.period}, ${top?.playerId ?? null}) ON CONFLICT DO NOTHING RETURNING period`);
    if (!done.rows.length || !top) continue;
    const boss = rosterById(weeklyBoss(r.period).bossId)!;
    const unlocked = await grant(top.playerId, EVENT_UNLOCKS.weekly.id);
    void createNotification({ playerId: top.playerId, type: "achievement_unlocked", message: `Fastest kill on last week's boss!${unlocked ? " Unlocked: the Weekly Slayer tag." : ""}` });
    await postHighlight({ key: `boss-weekly-winner:${r.period}`, kind: "boss_weekly", playerId: top.playerId, players: [top.playerId], link: "/boss-battle",
      title: "WEEKLY SLAYER", line: `${top.name} had the fastest kill on last week's boss, ${boss.name}${top.best ? ` (${Math.floor(top.best / 60)}:${String(top.best % 60).padStart(2, "0")})` : ""}.`, stat: "🏅", statLabel: "Boss Battle" });
  }
}

// ── The League Raid ─────────────────────────────────────────────────────────

/** Everyone's damage this month, from league matches, boss fights and event runs. */
async function raidDamage(month: string): Promise<Map<number, number>> {
  const from = londonMidnightUtc(`${month}-01`), to = londonMidnightUtc(`${nextMonth(month)}-01`);
  const dmg = new Map<number, number>();
  const add = (id: number, n: number) => dmg.set(id, (dmg.get(id) ?? 0) + n);
  for (const r of await rows(sql`SELECT winner_id, loser_id, COALESCE(winner_180s,0) w180, COALESCE(loser_180s,0) l180 FROM matches WHERE played_at >= ${from} AND played_at < ${to}`)) {
    if (r.winner_id) add(Number(r.winner_id), leagueMatchDamage(true, Number(r.w180)));
    if (r.loser_id) add(Number(r.loser_id), leagueMatchDamage(false, Number(r.l180)));
  }
  for (const r of await rows(sql`SELECT player_id, outcome FROM arcade_runs WHERE mode = 'boss_battle' AND played_at >= ${from} AND played_at < ${to}`)) {
    add(Number(r.player_id), r.outcome === "win" ? RAID_DAMAGE.bossWin : RAID_DAMAGE.bossLoss);
  }
  for (const r of await rows(sql`SELECT player_id, won FROM boss_event_runs WHERE created_at >= ${from} AND created_at < ${to}`)) {
    add(Number(r.player_id), r.won ? RAID_DAMAGE.eventWin : RAID_DAMAGE.eventLoss);
  }
  return dmg;
}

export async function raidState(me: number | null, now = new Date()) {
  await ensureBossEvents();
  const month = monthOf(now);
  let raid = (await rows(sql`SELECT * FROM boss_raids WHERE month = ${month}`))[0];
  if (!raid) {
    const active = Number((await rows(sql`SELECT COUNT(*)::int n FROM players WHERE status <> 'INACTIVE'`))[0]?.n ?? 0);
    await db.execute(sql`INSERT INTO boss_raids (month, hp) VALUES (${month}, ${raidHealth(active)}) ON CONFLICT DO NOTHING`);
    raid = (await rows(sql`SELECT * FROM boss_raids WHERE month = ${month}`))[0];
  }
  const dmg = await raidDamage(month);
  const total = [...dmg.values()].reduce((a, b) => a + b, 0);
  const hp = Number(raid.hp);
  const names = new Map((await rows(sql`SELECT id, name FROM players`)).map(r => [Number(r.id), String(r.name)]));
  const ranked = [...dmg.entries()].sort((a, b) => b[1] - a[1]).map(([id, d]) => ({ playerId: id, name: names.get(id) ?? "?", damage: d }));
  if (total >= hp && !raid.killed_at && ranked.length) await killRaid(month, ranked);
  const killed = total >= hp || !!raid.killed_at;
  const boss = raidFor(month);
  return {
    month, boss, hp, damage: Math.min(total, hp), health: killed ? 0 : Math.max(0, 1 - total / hp), killed,
    contributors: ranked.length, top: ranked.slice(0, 5),
    mine: me ? { damage: dmg.get(me) ?? 0, rank: ranked.findIndex(r => r.playerId === me) + 1 } : null,
    endsAt: londonMidnightUtc(`${nextMonth(month)}-01`).toISOString(),
  };
}

async function killRaid(month: string, ranked: { playerId: number; name: string; damage: number }[]) {
  const done = await db.execute(sql`UPDATE boss_raids SET killed_at = NOW(), leader_id = ${ranked[0].playerId} WHERE month = ${month} AND killed_at IS NULL RETURNING month`);
  if (!done.rows.length) return;
  const boss = raidFor(month);
  for (const r of ranked) {
    const u = await grant(r.playerId, EVENT_UNLOCKS.raider.id);
    void createNotification({ playerId: r.playerId, type: "achievement_unlocked", message: `${boss.name} has fallen! You dealt ${r.damage.toLocaleString("en-GB")} damage.${u ? " Unlocked: the Raider tag." : ""}` });
  }
  const leaderNew = await grant(ranked[0].playerId, EVENT_UNLOCKS.leader.id);
  if (leaderNew) void createNotification({ playerId: ranked[0].playerId, type: "achievement_unlocked", message: "You dealt the most damage in the League Raid. Unlocked: the Raid Leader tag." });
  await postHighlight({ key: `boss-raid:${month}`, kind: "boss_raid", playerId: ranked[0].playerId, players: ranked.slice(0, 3).map(r => r.playerId), link: "/boss-battle",
    title: "RAID BOSS DOWN", line: `The league brought down ${boss.name}! ${ranked.length} players hit it; ${ranked[0].name} led the raid with ${ranked[0].damage.toLocaleString("en-GB")} damage.`, stat: "🐉", statLabel: "League Raid" });
}

// ── Be the Boss ─────────────────────────────────────────────────────────────

export async function createCustom(fromId: number, toId: number, curses: unknown, message: unknown) {
  await ensureBossEvents();
  if (fromId === toId) return { error: "You can't challenge yourself" };
  const target = (await rows(sql`SELECT id, status FROM players WHERE id = ${toId}`))[0];
  if (!target || target.status === "INACTIVE") return { error: "That player isn't active" };
  const defeated = new Set((await rows(sql`SELECT boss_id FROM boss_battle_progress WHERE player_id = ${fromId}`)).map(r => String(r.boss_id)));
  const err = validCustomCurses(curses, defeated);
  if (err) return { error: err };
  const open = (await rows(sql`SELECT COUNT(*)::int n FROM boss_custom WHERE from_id = ${fromId} AND played_at IS NULL AND created_at > NOW() - INTERVAL '7 days'`))[0];
  if (Number(open?.n ?? 0) >= 5) return { error: "You've got 5 bosses waiting already" };
  const msg = typeof message === "string" ? message.trim().slice(0, 80) : null;
  const id = Number((await rows(sql`INSERT INTO boss_custom (from_id, to_id, curses, message) VALUES (${fromId}, ${toId}, ${JSON.stringify(curses)}, ${msg || null}) RETURNING id`))[0].id);
  const who = await nameOf(fromId);
  await createNotification({ playerId: toId, type: "callout", actorId: fromId, entityId: id, entityType: "boss_custom",
    message: `${who} turned themselves into a boss and wants you to fight it.${msg ? ` "${msg}"` : ""} Find it in Boss Battle.` });
  return { id };
}

export async function getCustom(id: number) {
  await ensureBossEvents();
  const r = (await rows(sql`SELECT c.*, a.name from_name, b.name to_name FROM boss_custom c JOIN players a ON a.id = c.from_id JOIN players b ON b.id = c.to_id WHERE c.id = ${id}`))[0];
  if (!r) return null;
  return { id: Number(r.id), fromId: Number(r.from_id), fromName: String(r.from_name), toId: Number(r.to_id), toName: String(r.to_name), curses: r.curses as string[],
    message: r.message as string | null, played: r.played_at != null, targetWon: r.target_won as boolean | null, seconds: r.seconds == null ? null : Number(r.seconds) };
}

export async function customFor(me: number) {
  await ensureBossEvents();
  const list = await rows(sql`SELECT c.id FROM boss_custom c WHERE (c.to_id = ${me} OR c.from_id = ${me}) AND (c.played_at IS NOT NULL OR c.created_at > NOW() - INTERVAL '7 days') ORDER BY c.created_at DESC LIMIT 20`);
  const all = (await Promise.all(list.map(r => getCustom(Number(r.id))))).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof getCustom>>>[];
  return { incoming: all.filter(c => c.toId === me), sent: all.filter(c => c.fromId === me) };
}

export async function finishCustom(id: number, me: number, won: boolean, seconds: number | null) {
  const c = await getCustom(id);
  if (!c) return { error: "Not found" };
  if (c.toId !== me) return { error: "Only the challenged player can fight this boss" };
  if (c.played) return { error: "Already fought" };
  await db.execute(sql`UPDATE boss_custom SET played_at = NOW(), target_won = ${won}, seconds = ${won ? seconds : null} WHERE id = ${id} AND played_at IS NULL`);
  void createNotification({ playerId: c.fromId, type: "callout", actorId: me, entityId: id, entityType: "boss_custom",
    message: won ? `${c.toName} beat Boss ${c.fromName}.` : `Boss ${c.fromName} beat ${c.toName}. You make a decent boss.` });
  return { ok: true };
}

export function initializeBossEventsScheduler() {
  const tick = async () => { try { await settleWeekly(); await raidState(null); } catch (err) { logger.warn({ err }, "Boss events tick failed"); } };
  cron.schedule("25 * * * *", () => { void tick(); });
  void tick();
}

