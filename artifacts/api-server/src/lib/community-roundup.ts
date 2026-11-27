/**
 * The Monday round-up for Off the Oche: one post a week summing up the week
 * just gone (Mon–Sun, London time). Posted from 08:00 on Monday by an hourly
 * check, so a server asleep at 08:00 still posts later; keyed by the week's
 * Monday so it can only ever post once.
 */
import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import { londonMidnightUtc } from "./londonDate";
import { getDefaultLeagueId } from "./currentLeague";
import { getSettingBool } from "./settingsService";
import { rangeStats } from "./league-target-db";
import { bigFinish } from "./community-highlights";

type Who = { playerId: number; name: string; value: number };
export type Roundup = {
  hkey: string; weekOf: string; label: string;
  matches: number; oneEighties: number; players: number;
  topWinner: Who | null; mostActive: Who | null; climber: Who | null; bestFinish: Who | null;
  moments: number; records: { title: string; name: string; value: number }[];
};

/** London calendar date (YYYY-MM-DD) of the Monday that starts the week containing `d`. */
export function mondayOf(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  const day = new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")) - dow));
  return day.toISOString().slice(0, 10);
}

const addDays = (ymd: string, n: number) => new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10) + n)).toISOString().slice(0, 10);
const nice = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

async function rows(q: ReturnType<typeof sql>): Promise<any[]> { try { return (await db.execute(q)).rows as any[]; } catch { return []; } }
const top = (list: any[]): Who | null => list[0] ? { playerId: Number(list[0].id), name: String(list[0].name), value: Number(list[0].v) } : null;

export async function buildRoundup(weekOf: string): Promise<Roundup> {
  const from = londonMidnightUtc(weekOf), to = londonMidnightUtc(addDays(weekOf, 7));
  const stats = await rangeStats(from, to);
  const names = new Map((await rows(sql`SELECT id, name FROM players`)).map(r => [Number(r.id), String(r.name)]));
  const busiest = [...stats.perPlayer.entries()].sort((a, b) => b[1] - a[1] || (names.get(a[0]) ?? "").localeCompare(names.get(b[0]) ?? ""))[0];
  const singlesOnly = sql`m.game_type NOT LIKE 'team_%' AND m.game_type <> 'multi_killer'`;
  const topWinner = top(await rows(sql`SELECT m.winner_id id, MAX(m.winner_name) name, COUNT(*)::int v FROM matches m
    WHERE m.played_at >= ${from} AND m.played_at < ${to} AND ${singlesOnly} GROUP BY m.winner_id ORDER BY v DESC, MAX(m.played_at) LIMIT 1`));
  const climber = top(await rows(sql`SELECT x.id, MAX(x.name) name, SUM(x.d)::int v FROM (
      SELECT winner_id id, winner_name name, stake d FROM matches m WHERE m.played_at >= ${from} AND m.played_at < ${to} AND ${singlesOnly}
      UNION ALL SELECT loser_id, loser_name, -stake FROM matches m WHERE m.played_at >= ${from} AND m.played_at < ${to} AND ${singlesOnly}) x
    GROUP BY x.id HAVING SUM(x.d) > 0 ORDER BY v DESC LIMIT 1`));
  let bestFinish: Who | null = null;
  for (const r of await rows(sql`SELECT m.winner_id id, m.winner_name name, l.winner_darts log FROM match_dart_logs l JOIN matches m ON m.id = l.match_id
    WHERE m.played_at >= ${from} AND m.played_at < ${to} AND m.game_type ~ '^(301|501|701)'`)) {
    const v = bigFinish(((r.log ?? []) as { val: number; typed?: boolean }[]).filter(d => !d.typed));
    // bigFinish only reports 100+; smaller finishes still count for "best of the week".
    const log = ((r.log ?? []) as { val: number }[]);
    const last = log.slice(-(((log.length - 1) % 3) + 1)).reduce((n, d) => n + Number(d.val || 0), 0);
    const val = v ?? (last >= 2 && last <= 170 ? last : 0);
    if (val && (!bestFinish || val > bestFinish.value)) bestFinish = { playerId: Number(r.id), name: String(r.name), value: val };
  }
  const moments = Number((await rows(sql`SELECT COUNT(*)::int n FROM community_posts WHERE post_type = 'highlight' AND created_at >= ${from} AND created_at < ${to}`))[0]?.n ?? 0);
  const { RECORD_LABELS } = await import("./league-records");
  const records = (await rows(sql`SELECT record_key, player_name, value FROM league_records_broken WHERE created_at >= ${from} AND created_at < ${to} ORDER BY created_at`))
    .map(r => ({ title: (RECORD_LABELS as any)[r.record_key]?.title ?? String(r.record_key), name: String(r.player_name), value: Number(r.value) }));
  return {
    hkey: `roundup:${weekOf}`, weekOf, label: `${nice(weekOf)} – ${nice(addDays(weekOf, 6))}`,
    matches: stats.matches, oneEighties: stats.oneEighties, players: stats.perPlayer.size,
    topWinner, mostActive: busiest ? { playerId: busiest[0], name: names.get(busiest[0]) ?? "?", value: busiest[1] } : null,
    climber, bestFinish, moments, records,
  };
}

let ready: Promise<unknown> | null = null;
const ensureIndex = () => (ready ??= db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS community_posts_roundup_key_idx
  ON community_posts ((auto_meta->>'hkey')) WHERE post_type = 'roundup'`).catch(e => { ready = null; throw e; }));

/** Post last week's round-up if it's Monday 08:00+ (London) or later in the week and it isn't posted yet. Quiet weeks post nothing. */
export async function postRoundup(now = new Date(), force = false): Promise<number | null> {
  try {
    if (!(await getSettingBool(await getDefaultLeagueId(), "community_enabled"))) return null;
    const thisMonday = mondayOf(now);
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(now));
    const isMonday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" }).format(now) === "Mon";
    if (!force && isMonday && hour < 8) return null; // wait for Monday 08:00
    const weekOf = addDays(thisMonday, -7);
    await ensureIndex();
    const done = await rows(sql`SELECT 1 FROM community_posts WHERE post_type = 'roundup' AND auto_meta->>'hkey' = ${`roundup:${weekOf}`}`);
    if (done.length) return null;
    const r = await buildRoundup(weekOf);
    if (r.matches === 0) return null;
    const author = r.topWinner?.playerId ?? r.mostActive?.playerId;
    if (!author) return null;
    const text = `Week of ${r.label}: ${r.matches} matches, ${r.oneEighties} 180s.${r.topWinner ? ` Most wins: ${r.topWinner.name} (${r.topWinner.value}).` : ""}`;
    const res = await db.execute(sql`INSERT INTO community_posts (player_id, content, post_type, auto_meta, status, approved_at)
      VALUES (${author}, ${text}, 'roundup', ${JSON.stringify(r)}::jsonb, 'approved', NOW())
      ON CONFLICT ((auto_meta->>'hkey')) WHERE post_type = 'roundup' DO NOTHING RETURNING id`);
    return (res.rows[0] as { id: number } | undefined)?.id ?? null;
  } catch (err) {
    logger.warn({ err }, "postRoundup failed (non-fatal)");
    return null;
  }
}

export function initializeRoundupScheduler() {
  cron.schedule("5 * * * *", () => { void postRoundup(); });
  void postRoundup();
}
