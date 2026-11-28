// Board Curse part 2, server side: Curse a Friend challenges, the Weekly Curse League
// (Apprentice → Hexer → Warlock) and the Curse Hall of records.
import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import { createNotification } from "./communityNotify";
import { postHighlight } from "./community-highlights-db";
import { addCoinsToPlayer } from "../services/card-shop-service";
import { ensureCurseRun, grant } from "./board-curse-run-db";
import { CURSE_RANKS, LEAGUE_POINTS as P, X01_CURSE_IDS, CRICKET_CURSE_IDS, rankFor } from "../shared/darts-rules/board-curse-codex";

async function rows(q: ReturnType<typeof sql>): Promise<any[]> { return (await db.execute(q)).rows as any[]; }
const nameOf = async (id: number) => String((await rows(sql`SELECT name FROM players WHERE id = ${id}`))[0]?.name ?? "Someone");

let ready: Promise<unknown> | null = null;
export const ensureCurseSocial = () => (ready ??= (async () => {
  await ensureCurseRun();
  await db.execute(sql`CREATE TABLE IF NOT EXISTS board_curse_challenges (id SERIAL PRIMARY KEY, from_id INTEGER NOT NULL, to_id INTEGER NOT NULL,
    game_type TEXT NOT NULL, seed TEXT NOT NULL, from_visits INTEGER NOT NULL, to_visits INTEGER, to_won BOOLEAN, message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), played_at TIMESTAMPTZ)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS board_curse_challenges_to ON board_curse_challenges (to_id, played_at)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS board_curse_weeks (week DATE PRIMARY KEY, top_id INTEGER, top_points INTEGER, settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
})().catch(e => { ready = null; throw e; }));

// ── Curse a Friend ──
export async function createChallenge(fromId: number, b: any) {
  await ensureCurseSocial();
  const toId = Number(b?.toId), visits = Math.round(Number(b?.visits));
  const game = b?.gameType === "CRICKET" ? "CRICKET" : b?.gameType === "X01" ? "X01" : null;
  const seed = typeof b?.seed === "string" && /^[\w:.-]{4,80}$/.test(b.seed) ? b.seed : null;
  if (!game || !seed || !Number.isInteger(toId)) return { error: "Invalid challenge" };
  if (!Number.isInteger(visits) || visits < 3 || visits > 60) return { error: "Invalid visit count" };
  if (toId === fromId) return { error: "You can't curse yourself" };
  const target = (await rows(sql`SELECT status FROM players WHERE id = ${toId}`))[0];
  if (!target || target.status === "INACTIVE") return { error: "That player isn't active" };
  const open = (await rows(sql`SELECT COUNT(*)::int n FROM board_curse_challenges WHERE from_id = ${fromId} AND played_at IS NULL AND created_at > NOW() - INTERVAL '7 days'`))[0];
  if (Number(open?.n ?? 0) >= 5) return { error: "You've got 5 curses waiting already" };
  const msg = typeof b?.message === "string" ? b.message.trim().slice(0, 80) || null : null;
  const id = Number((await rows(sql`INSERT INTO board_curse_challenges (from_id, to_id, game_type, seed, from_visits, message)
    VALUES (${fromId}, ${toId}, ${game}, ${seed}, ${visits}, ${msg}) RETURNING id`))[0].id);
  const who = await nameOf(fromId);
  await createNotification({ playerId: toId, type: "callout", actorId: fromId, entityId: id, entityType: "board_curse_challenge",
    message: `${who} put a curse on you: beat their ${visits} visits on the same cursed ${game === "X01" ? "501" : "Cricket"} leg.${msg ? ` "${msg}"` : ""} Find it in Board Curse.` });
  return { id };
}

const challengeOut = (r: any) => ({ id: Number(r.id), fromId: Number(r.from_id), fromName: String(r.from_name), toId: Number(r.to_id), toName: String(r.to_name),
  gameType: String(r.game_type), seed: String(r.seed), fromVisits: Number(r.from_visits), toVisits: r.to_visits == null ? null : Number(r.to_visits),
  toWon: r.to_won as boolean | null, message: r.message as string | null, played: r.played_at != null, createdAt: r.created_at });

export async function challengesFor(pid: number) {
  await ensureCurseSocial();
  const all = (await rows(sql`SELECT c.*, a.name from_name, b.name to_name FROM board_curse_challenges c JOIN players a ON a.id = c.from_id JOIN players b ON b.id = c.to_id
    WHERE (c.to_id = ${pid} OR c.from_id = ${pid}) AND c.created_at > NOW() - INTERVAL '14 days' ORDER BY c.created_at DESC LIMIT 30`)).map(challengeOut);
  return { incoming: all.filter(c => c.toId === pid && !c.played), sent: all.filter(c => c.fromId === pid), done: all.filter(c => c.toId === pid && c.played) };
}

export async function finishChallenge(id: number, me: number, b: any) {
  await ensureCurseSocial();
  const r = (await rows(sql`SELECT c.*, a.name from_name, b.name to_name FROM board_curse_challenges c JOIN players a ON a.id = c.from_id JOIN players b ON b.id = c.to_id WHERE c.id = ${id}`))[0];
  if (!r) return { error: "Not found" };
  const c = challengeOut(r);
  if (c.toId !== me) return { error: "Only the cursed player can play this" };
  if (c.played) return { error: "Already played" };
  const cleared = b?.cleared === true, visits = Math.round(Number(b?.visits));
  if (cleared && (!Number.isInteger(visits) || visits < 3 || visits > 60)) return { error: "Invalid visit count" };
  // Beat it = clear the leg in fewer visits. A tie goes to whoever set it.
  const won = cleared && visits < c.fromVisits;
  await db.execute(sql`UPDATE board_curse_challenges SET played_at = NOW(), to_visits = ${cleared ? visits : null}, to_won = ${won} WHERE id = ${id} AND played_at IS NULL`);
  void createNotification({ playerId: c.fromId, type: "callout", actorId: me, entityId: id, entityType: "board_curse_challenge",
    message: won ? `${c.toName} broke your curse: ${visits} visits to your ${c.fromVisits}.`
      : cleared ? `Your curse held: ${c.toName} needed ${visits} visits to your ${c.fromVisits}.` : `Your curse held: ${c.toName} couldn't clear the leg.` });
  return { ok: true, won };
}

// ── Weekly Curse League ──
/** Monday 00:00 UK time of the week containing `at` (or this week). */
const weekStart = (offsetWeeks = 0) => sql`(date_trunc('week', NOW() AT TIME ZONE 'Europe/London') - ${sql.raw(String(Math.trunc(offsetWeeks)))} * INTERVAL '7 days')`;
/** Points values go in as literals (bound params arrive as text and SUM() rejects them). */
const n = (v: number) => sql.raw(String(Math.trunc(v)));

async function weekPoints(offsetWeeks: number): Promise<{ playerId: number; name: string; points: number }[]> {
  const from = weekStart(offsetWeeks), to = sql`(${weekStart(offsetWeeks)} + INTERVAL '7 days')`;
  const inWeek = (col: ReturnType<typeof sql>) => sql`(${col} AT TIME ZONE 'Europe/London') >= ${from} AND (${col} AT TIME ZONE 'Europe/London') < ${to}`;
  const r = await rows(sql`
    WITH arcade AS (
      SELECT player_id, LEAST(SUM(CASE WHEN outcome = 'win' THEN (CASE WHEN mode = 'board_curse_daily' THEN ${n(P.dailyClear)} ELSE ${n(P.win)} END) ELSE ${n(P.loss)} END), ${n(P.dailyArcadeCap)}) pts
      FROM arcade_runs WHERE mode IN ('board_curse', 'board_curse_daily') AND ${inWeek(sql`played_at`)}
      GROUP BY player_id, (played_at AT TIME ZONE 'Europe/London')::date
    ), other AS (
      SELECT player_id, legs * ${n(P.runLeg)} pts FROM board_curse_runs WHERE ${inWeek(sql`played_at`)}
      UNION ALL SELECT player_id, ${n(P.codexCurse)} FROM board_curse_codex WHERE ${inWeek(sql`beaten_at`)}
      UNION ALL SELECT to_id, CASE WHEN to_won THEN ${n(P.challengeWon)} ELSE ${n(P.challengeLost)} END FROM board_curse_challenges WHERE played_at IS NOT NULL AND ${inWeek(sql`played_at`)}
    ), allp AS (SELECT player_id, pts FROM arcade UNION ALL SELECT player_id, pts FROM other)
    SELECT a.player_id, p.name, SUM(a.pts)::int points FROM allp a JOIN players p ON p.id = a.player_id
    GROUP BY a.player_id, p.name HAVING SUM(a.pts) > 0 ORDER BY points DESC, p.name ASC`);
  return r.map(x => ({ playerId: Number(x.player_id), name: String(x.name), points: Number(x.points) }));
}

export async function leagueFor(pid: number | null) {
  await ensureCurseSocial();
  const table = await weekPoints(0);
  const mine = pid ? table.find(t => t.playerId === pid) : undefined;
  const ends = (await rows(sql`SELECT (${weekStart(0)} + INTERVAL '7 days')::text t`))[0].t as string;
  return {
    ranks: CURSE_RANKS, endsAt: ends,
    table: table.slice(0, 20).map((t, i) => ({ ...t, place: i + 1, rank: rankFor(t.points).id })),
    me: pid ? { points: mine?.points ?? 0, place: mine ? table.indexOf(mine) + 1 : null, rank: rankFor(mine?.points ?? 0).id } : null,
  };
}

/** Pay out last week once: coins for Hexers and Warlocks, WARLOCK SUPREME for the top Warlock. */
export async function settleLastWeek() {
  await ensureCurseSocial();
  const wk = String((await rows(sql`SELECT ${weekStart(1)}::date::text d`))[0].d);
  if ((await rows(sql`SELECT 1 FROM board_curse_weeks WHERE week = ${wk}`)).length) return;
  const table = await weekPoints(1); // work the table out before claiming the week, so a failure here retries next hour
  const claim = await db.execute(sql`INSERT INTO board_curse_weeks (week) VALUES (${wk}) ON CONFLICT DO NOTHING RETURNING week`);
  if (!claim.rows.length) return;
  for (const t of table) {
    const r = rankFor(t.points);
    if (r.coins > 0) {
      await addCoinsToPlayer(t.playerId, r.coins, "achievement", `Weekly Curse League: ${r.name}`).catch(err => logger.warn({ err }, "Curse League coins failed"));
      void createNotification({ playerId: t.playerId, type: "achievement_unlocked", message: `Weekly Curse League: you finished as a ${r.name} with ${t.points} points. +${r.coins} coins.` });
    }
  }
  const top = table[0];
  if (top && rankFor(top.points).id === "warlock") {
    await db.execute(sql`UPDATE board_curse_weeks SET top_id = ${top.playerId}, top_points = ${top.points} WHERE week = ${wk}`);
    await grant(top.playerId, "tag-bc-warlock-supreme");
    await postHighlight({ key: `curse-warlock:${wk}`, kind: "curse_record", playerId: top.playerId, players: [top.playerId], link: "/board-curse",
      title: "WARLOCK SUPREME", line: `${top.name} topped the Weekly Curse League with ${top.points} points.`, stat: top.points, statLabel: "league points" }).catch(() => {});
  }
}

export function initializeCurseLeagueScheduler() {
  const tick = async () => { try { await settleLastWeek(); } catch (err) { logger.warn({ err }, "Curse League settle failed"); } };
  cron.schedule("45 * * * *", () => { void tick(); });
  void tick();
}

// ── Hex Duel wins (Hex Master frame) ──
export async function afterHexWin(pid: number) {
  await ensureCurseSocial();
  const n = Number((await rows(sql`SELECT COUNT(*)::int n FROM arcade_runs WHERE player_id = ${pid} AND mode = 'board_curse' AND outcome = 'win' AND metadata->>'hex' = 'true'`))[0].n);
  return n >= 10 && await grant(pid, "frame-bc-hex-master") ? ["frame-bc-hex-master"] : [];
}

// ── Curse Hall ──
export async function curseHall() {
  await ensureCurseSocial();
  const top = (q: ReturnType<typeof sql>) => rows(q).then(r => r.map(x => ({ playerId: Number(x.player_id), name: String(x.name), value: Number(x.v), extra: x.extra == null ? null : String(x.extra) })));
  const total = X01_CURSE_IDS.length + CRICKET_CURSE_IDS.length;
  const [runs, x01, cricket, atw, streak, codex, completed, hex, friends, warlocks] = await Promise.all([
    top(sql`SELECT DISTINCT ON (r.player_id) r.player_id, p.name, r.score v, r.legs::text extra FROM board_curse_runs r JOIN players p ON p.id = r.player_id ORDER BY r.player_id, r.score DESC`),
    top(sql`SELECT b.player_id, p.name, b.best_visits v FROM board_curse_best b JOIN players p ON p.id = b.player_id WHERE b.game_type = 'X01' AND b.best_visits IS NOT NULL ORDER BY v ASC, b.updated_at ASC LIMIT 5`),
    top(sql`SELECT b.player_id, p.name, b.best_visits v FROM board_curse_best b JOIN players p ON p.id = b.player_id WHERE b.game_type = 'CRICKET' AND b.best_visits IS NOT NULL ORDER BY v ASC, b.updated_at ASC LIMIT 5`),
    top(sql`SELECT b.player_id, p.name, b.best_visits v FROM board_curse_best b JOIN players p ON p.id = b.player_id WHERE b.game_type = 'ATW' AND b.best_visits IS NOT NULL ORDER BY v ASC, b.updated_at ASC LIMIT 5`),
    top(sql`SELECT b.player_id, p.name, MAX(b.best_streak) v FROM board_curse_best b JOIN players p ON p.id = b.player_id WHERE b.best_streak IS NOT NULL GROUP BY b.player_id, p.name ORDER BY v DESC LIMIT 5`),
    top(sql`SELECT c.player_id, p.name, COUNT(*)::int v FROM board_curse_codex c JOIN players p ON p.id = c.player_id GROUP BY c.player_id, p.name ORDER BY v DESC, MAX(c.beaten_at) ASC LIMIT 5`),
    top(sql`SELECT c.player_id, p.name, COUNT(*)::int v, to_char(MAX(c.beaten_at) AT TIME ZONE 'Europe/London', 'DD Mon YYYY') extra FROM board_curse_codex c JOIN players p ON p.id = c.player_id
      GROUP BY c.player_id, p.name HAVING COUNT(*) >= ${total} ORDER BY MAX(c.beaten_at) ASC LIMIT 5`),
    top(sql`SELECT a.player_id, p.name, COUNT(*)::int v FROM arcade_runs a JOIN players p ON p.id = a.player_id WHERE a.mode = 'board_curse' AND a.outcome = 'win' AND a.metadata->>'hex' = 'true'
      GROUP BY a.player_id, p.name ORDER BY v DESC LIMIT 5`),
    top(sql`SELECT c.to_id player_id, p.name, COUNT(*)::int v FROM board_curse_challenges c JOIN players p ON p.id = c.to_id WHERE c.to_won GROUP BY c.to_id, p.name ORDER BY v DESC LIMIT 5`),
    top(sql`SELECT w.top_id player_id, p.name, w.top_points v, to_char(w.week, 'DD Mon') extra FROM board_curse_weeks w JOIN players p ON p.id = w.top_id ORDER BY w.week DESC LIMIT 8`),
  ]);
  return { bestRuns: runs.sort((a, b) => b.value - a.value).slice(0, 5), fewestX01: x01, fewestCricket: cricket, fewestAtw: atw, longestStreak: streak,
    codexLeaders: codex, codexComplete: completed, hexWins: hex, cursesBroken: friends, warlocks, codexTotal: total };
}
