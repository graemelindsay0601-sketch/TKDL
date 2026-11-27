// Database side of Moment of the Month, call-out streaks and bounties (rules in oche-extras.ts).
import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import { londonMidnightUtc } from "./londonDate";
import { getDefaultLeagueId } from "./currentLeague";
import { getSettingBool } from "./settingsService";
import { createNotification } from "./communityNotify";
import { postHighlight } from "./community-highlights-db";
import {
  OO_UNLOCKS, MOTM_VOTE_DAYS, STREAK_MOMENTS, LEVEL_NAMES, BOUNTY_CALLOUT_STREAK,
  motmShortlist, motmWinner, calloutStreaks, bountyTargets, bountyLevel, bountyUnlocks, bountyReasonText,
  type Cosmetic, type BountyReason,
} from "./oche-extras";

async function rows(q: ReturnType<typeof sql>): Promise<any[]> { return (await db.execute(q)).rows as any[]; }
const on = async () => getSettingBool(await getDefaultLeagueId(), "community_enabled").catch(() => false);

let ready: Promise<unknown> | null = null;
export const ensureOcheExtras = () => (ready ??= (async () => {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS community_motm (
    month TEXT PRIMARY KEY, shortlist JSONB NOT NULL, opens_at TIMESTAMPTZ NOT NULL, closes_at TIMESTAMPTZ NOT NULL,
    winner_post_id INTEGER, settled_at TIMESTAMPTZ)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS community_motm_votes (
    month TEXT NOT NULL, player_id INTEGER NOT NULL, post_id INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (month, player_id))`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS community_bounties (
    id SERIAL PRIMARY KEY, player_id INTEGER NOT NULL, reason TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_by INTEGER, claimed_level INTEGER, claimed_match_id INTEGER, claimed_at TIMESTAMPTZ, ended_at TIMESTAMPTZ)`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS community_bounties_live_idx ON community_bounties (player_id) WHERE claimed_at IS NULL AND ended_at IS NULL`);
  for (const c of Object.values(OO_UNLOCKS) as Cosmetic[]) await db.execute(sql`INSERT INTO cosmetic_definitions (id, category, name, rarity, price, color, gradient, glow, icon_key, enabled, purchasable, sort_order)
    VALUES (${c.id}, ${c.category}, ${c.name}, ${c.rarity}, 0, ${c.color ?? null}, ${c.gradient ?? null}, ${c.glow ?? null}, ${c.iconKey ?? null}, true, false, ${c.sortOrder})
    ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category, name = EXCLUDED.name, rarity = EXCLUDED.rarity, color = EXCLUDED.color,
      gradient = EXCLUDED.gradient, glow = EXCLUDED.glow, purchasable = false, sort_order = EXCLUDED.sort_order`);
})().catch(e => { ready = null; throw e; }));

async function grant(playerId: number, list: Cosmetic[], why: string): Promise<void> {
  for (const c of list) {
    const r = await db.execute(sql`INSERT INTO player_cosmetics (player_id, cosmetic_id) SELECT ${playerId}, ${c.id}
      WHERE NOT EXISTS (SELECT 1 FROM player_cosmetics WHERE player_id = ${playerId} AND cosmetic_id = ${c.id}) RETURNING cosmetic_id`);
    if (r.rows.length) void createNotification({ playerId, type: "achievement_unlocked", message: `Unlocked: ${c.name} (${why}). Find it in your cosmetics.` });
  }
}

// ── Moment of the Month ──────────────────────────────────────────────────────
const monthKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit" }).format(d).slice(0, 7);
const prevMonth = (key: string) => { const [y, m] = key.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
const monthLabel = (key: string) => new Date(`${key}-01T12:00:00Z`).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });

async function momentScores(from: Date, to: Date) {
  return (await rows(sql`SELECT cp.id, cp.player_id, cp.auto_meta, cp.created_at,
      ((SELECT COUNT(*) FROM post_reactions r WHERE r.post_id = cp.id) + 2 * (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = cp.id))::int AS score
    FROM community_posts cp WHERE cp.post_type = 'highlight' AND cp.status = 'approved'
      AND cp.auto_meta->>'kind' NOT IN ('motm', 'bounty_on')
      AND cp.created_at >= ${from} AND cp.created_at < ${to}`))
    .map(r => ({ id: Number(r.id), playerId: Number(r.player_id), meta: r.auto_meta, at: new Date(r.created_at).toISOString(), score: Number(r.score), kind: String(r.auto_meta?.kind ?? "") }));
}

/** From the 1st (London), open last month's vote once: the shortlist is fixed then. Needs 2+ moments. */
export async function openMotm(now = new Date()): Promise<void> {
  const month = prevMonth(monthKey(now));
  if ((await rows(sql`SELECT 1 FROM community_motm WHERE month = ${month}`)).length) return;
  const from = londonMidnightUtc(`${month}-01`), to = londonMidnightUtc(`${monthKey(now)}-01`);
  const moments = await momentScores(from, to);
  const ids = motmShortlist(moments);
  if (ids.length < 2) return;
  // Normally closes at the end of the 5th; if it only opens later (e.g. the server was asleep), it still gets 5 full days.
  const usual = londonMidnightUtc(`${monthKey(now)}-${String(1 + MOTM_VOTE_DAYS).padStart(2, "0")}`);
  const closes = new Date(Math.max(usual.getTime(), now.getTime() + MOTM_VOTE_DAYS * 86400000));
  await db.execute(sql`INSERT INTO community_motm (month, shortlist, opens_at, closes_at) VALUES (${month}, ${JSON.stringify(ids)}::jsonb, NOW(), ${closes}) ON CONFLICT DO NOTHING`);
}

export async function settleMotm(now = new Date()): Promise<void> {
  for (const m of await rows(sql`SELECT * FROM community_motm WHERE settled_at IS NULL AND closes_at <= ${now}`)) {
    const ids = (m.shortlist as number[]) ?? [];
    if (!ids.length) continue;
    const list = await rows(sql`SELECT cp.id, cp.player_id, cp.auto_meta, cp.created_at,
        ((SELECT COUNT(*) FROM post_reactions r WHERE r.post_id = cp.id) + 2 * (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = cp.id))::int AS score,
        (SELECT COUNT(*)::int FROM community_motm_votes v WHERE v.month = ${m.month} AND v.post_id = cp.id) AS votes
      FROM community_posts cp WHERE cp.id IN (${sql.join(ids.map(i => sql`${i}`), sql`, `)})`);
    const win = motmWinner(list.map(r => ({ id: Number(r.id), votes: Number(r.votes), score: Number(r.score), at: new Date(r.created_at).toISOString() })));
    const claimed = await db.execute(sql`UPDATE community_motm SET winner_post_id = ${win}, settled_at = NOW() WHERE month = ${m.month} AND settled_at IS NULL RETURNING month`);
    if (!claimed.rows.length || !win) continue;
    const w = list.find(r => Number(r.id) === win)!;
    const meta = w.auto_meta ?? {};
    const players: number[] = (meta.players?.length ? meta.players : [w.player_id]).map(Number);
    const star = Number(w.player_id);
    await postHighlight({ key: `motm:${m.month}`, kind: "motm", playerId: star, players, link: "/community",
      title: "MOMENT OF THE MONTH", line: `${monthLabel(m.month)}'s Moment of the Month: ${meta.line ?? "the league's favourite moment"}`,
      stat: Number(w.votes), statLabel: Number(w.votes) === 1 ? "vote" : "votes" });
    const wins = Number((await rows(sql`SELECT COUNT(*)::int n FROM community_motm cm JOIN community_posts cp ON cp.id = cm.winner_post_id WHERE cp.player_id = ${star}`))[0]?.n ?? 0);
    await grant(star, wins >= 3 ? [OO_UNLOCKS.motm, OO_UNLOCKS.motm3] : [OO_UNLOCKS.motm], "Moment of the Month");
  }
}

/** The open vote (or the latest result for a few days after), shaped for the Off the Oche card. */
export async function currentMotm(me: number | null) {
  await ensureOcheExtras();
  const m = (await rows(sql`SELECT * FROM community_motm WHERE settled_at IS NULL OR settled_at > NOW() - INTERVAL '3 days' ORDER BY month DESC LIMIT 1`))[0];
  if (!m) return null;
  const ids = (m.shortlist as number[]) ?? [];
  if (!ids.length) return null;
  const list = await rows(sql`SELECT cp.id, cp.player_id, cp.auto_meta, cp.created_at,
      (SELECT COUNT(*)::int FROM community_motm_votes v WHERE v.month = ${m.month} AND v.post_id = cp.id) AS votes
    FROM community_posts cp WHERE cp.id IN (${sql.join(ids.map(i => sql`${i}`), sql`, `)})`);
  const mine = me ? (await rows(sql`SELECT post_id FROM community_motm_votes WHERE month = ${m.month} AND player_id = ${me}`))[0]?.post_id ?? null : null;
  return {
    month: m.month, label: monthLabel(m.month), closesAt: new Date(m.closes_at).toISOString(), open: !m.settled_at,
    winnerPostId: m.winner_post_id ?? null, myVote: mine != null ? Number(mine) : null,
    options: ids.map(id => list.find(r => Number(r.id) === id)).filter(Boolean).map(r => ({
      postId: Number(r.id), playerId: Number(r.player_id), players: ((r.auto_meta?.players ?? [r.player_id]) as number[]).map(Number),
      kind: r.auto_meta?.kind ?? "", title: r.auto_meta?.title ?? "", line: r.auto_meta?.line ?? "", stat: r.auto_meta?.stat ?? null, statLabel: r.auto_meta?.statLabel ?? null,
      votes: Number(r.votes),
    })),
  };
}

export async function voteMotm(me: number, postId: number): Promise<string | null> {
  await ensureOcheExtras();
  const m = (await rows(sql`SELECT * FROM community_motm WHERE settled_at IS NULL AND closes_at > NOW() ORDER BY month DESC LIMIT 1`))[0];
  if (!m) return "Voting isn't open";
  if (!((m.shortlist as number[]) ?? []).includes(postId)) return "That moment isn't on the shortlist";
  const p = (await rows(sql`SELECT player_id, auto_meta FROM community_posts WHERE id = ${postId}`))[0];
  const involved: number[] = ((p?.auto_meta?.players ?? [p?.player_id]) as number[]).map(Number);
  if (involved.includes(me)) return "You can't vote for your own moment";
  await db.execute(sql`INSERT INTO community_motm_votes (month, player_id, post_id) VALUES (${m.month}, ${me}, ${postId})
    ON CONFLICT (month, player_id) DO UPDATE SET post_id = EXCLUDED.post_id, created_at = NOW()`);
  return null;
}

// ── Call-out streaks ─────────────────────────────────────────────────────────
export async function allCalloutStreaks() {
  const settled = await rows(sql`SELECT auto_meta FROM community_posts WHERE post_type = 'callout' AND auto_meta->>'status' = 'settled'`);
  return calloutStreaks(settled.map(r => ({ challengerId: Number(r.auto_meta.challengerId), targetId: Number(r.auto_meta.targetId),
    winnerId: Number(r.auto_meta.winnerId), at: String(r.auto_meta.settledAt ?? "") })));
}

/** After a call-out settles: streak moments (3, 5, 10) and their unlocks. */
export async function afterCalloutSettled(calloutId: number, winnerId: number, winnerName: string): Promise<void> {
  try {
    await ensureOcheExtras();
    const s = (await allCalloutStreaks()).get(winnerId);
    if (!s || !STREAK_MOMENTS.includes(s.current)) return;
    await postHighlight({ key: `callout-streak:${winnerId}:${calloutId}`, kind: "callout_streak", playerId: winnerId, players: [winnerId], link: "/community",
      title: "CALL-OUT KING", line: `${winnerName} has won ${s.current} call-outs in a row.`, stat: s.current, statLabel: "in a row" });
    if (s.current >= 3) await grant(winnerId, s.current >= 5 ? [OO_UNLOCKS.calloutKing, OO_UNLOCKS.unbeaten] : [OO_UNLOCKS.calloutKing], "call-out streak");
  } catch (err) { logger.warn({ err }, "afterCalloutSettled failed (non-fatal)"); }
}

// ── Bounties ─────────────────────────────────────────────────────────────────
/** Place, keep or lift bounties so they match who should have one right now. */
export async function syncBounties(now = new Date()): Promise<void> {
  if (!(await on())) return;
  await ensureOcheExtras();
  const leader = (await rows(sql`SELECT id FROM players WHERE status = 'ACTIVE' AND season_games_played > 0 ORDER BY points DESC, elo DESC, id LIMIT 1`))[0];
  const runs = await rows(sql`SELECT id, current_win_streak streak FROM players WHERE status = 'ACTIVE' AND current_win_streak > 0`);
  const streaks = await allCalloutStreaks();
  const top = [...streaks.entries()].filter(([, v]) => v.current >= BOUNTY_CALLOUT_STREAK).sort((a, b) => b[1].current - a[1].current)[0];
  const want = bountyTargets({ leaderId: leader ? Number(leader.id) : null, runs: runs.map(r => ({ id: Number(r.id), streak: Number(r.streak) })),
    calloutTop: top ? { id: top[0], streak: top[1].current } : null });
  const live = await rows(sql`SELECT * FROM community_bounties WHERE claimed_at IS NULL AND ended_at IS NULL`);
  for (const b of live) {
    const why = want.get(Number(b.player_id));
    if (!why) await db.execute(sql`UPDATE community_bounties SET ended_at = NOW() WHERE id = ${b.id}`);
    else if (why !== b.reason) await db.execute(sql`UPDATE community_bounties SET reason = ${why} WHERE id = ${b.id}`);
  }
  const have = new Set(live.map(b => Number(b.player_id)));
  for (const [pid, why] of want) {
    if (have.has(pid)) continue;
    // A bounty claimed in the last 24 hours isn't put straight back on the same player.
    const recent = await rows(sql`SELECT 1 FROM community_bounties WHERE player_id = ${pid} AND claimed_at > ${new Date(now.getTime() - 86400000)}`);
    if (recent.length) continue;
    const r = await db.execute(sql`INSERT INTO community_bounties (player_id, reason) VALUES (${pid}, ${why}) ON CONFLICT DO NOTHING RETURNING id`);
    const id = (r.rows[0] as any)?.id;
    if (!id) continue;
    const name = (await rows(sql`SELECT name FROM players WHERE id = ${pid}`))[0]?.name ?? "?";
    await postHighlight({ key: `bounty-on:${id}`, kind: "bounty_on", playerId: pid, players: [pid], link: "/leaderboard",
      title: "WANTED", line: `${name} is wanted: ${bountyReasonText(why as BountyReason)}. Beat them in a league match to claim the bounty.`, stat: "Bronze", statLabel: "bounty" });
  }
}

/** After a singles result: if the loser had a live bounty, the winner claims it. */
export async function claimBounty(match: { id: number; winnerId: number; loserId: number; winnerName: string; loserName: string }): Promise<void> {
  try {
    if (!(await on())) return;
    await ensureOcheExtras();
    const b = (await rows(sql`SELECT * FROM community_bounties WHERE player_id = ${match.loserId} AND claimed_at IS NULL AND ended_at IS NULL`))[0];
    if (!b) return;
    const level = bountyLevel(new Date(b.created_at).toISOString());
    const done = await db.execute(sql`UPDATE community_bounties SET claimed_by = ${match.winnerId}, claimed_level = ${level}, claimed_match_id = ${match.id}, claimed_at = NOW()
      WHERE id = ${b.id} AND claimed_at IS NULL RETURNING id`);
    if (!done.rows.length) return;
    await postHighlight({ key: `bounty:${b.id}`, kind: "bounty_claimed", playerId: match.winnerId, players: [match.winnerId, match.loserId], matchId: match.id,
      link: `/match-centre/league-${match.id}`, title: "BOUNTY CLAIMED", line: `${match.winnerName} claimed the ${LEVEL_NAMES[level].toLowerCase()} bounty on ${match.loserName}.`,
      stat: LEVEL_NAMES[level], statLabel: "bounty" });
    await grant(match.winnerId, bountyUnlocks(level), `${LEVEL_NAMES[level]} bounty`);
  } catch (err) { logger.warn({ err }, "claimBounty failed (non-fatal)"); }
}

export async function liveBounties() {
  await ensureOcheExtras();
  return (await rows(sql`SELECT b.id, b.player_id, b.reason, b.created_at, p.name FROM community_bounties b JOIN players p ON p.id = b.player_id
    WHERE b.claimed_at IS NULL AND b.ended_at IS NULL ORDER BY b.created_at`)).map(r => {
    const level = bountyLevel(new Date(r.created_at).toISOString());
    return { id: Number(r.id), playerId: Number(r.player_id), name: String(r.name), reason: r.reason as BountyReason, reasonText: bountyReasonText(r.reason),
      level, levelName: LEVEL_NAMES[level], since: new Date(r.created_at).toISOString() };
  });
}

export function initializeOcheExtrasScheduler() {
  const tick = async () => {
    try { if (!(await on())) return; await ensureOcheExtras(); await openMotm(); await settleMotm(); await syncBounties(); }
    catch (err) { logger.warn({ err }, "Off the Oche extras tick failed"); }
  };
  cron.schedule("10 * * * *", () => { void tick(); });
  void tick();
}
