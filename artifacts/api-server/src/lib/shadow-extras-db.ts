// Database side of Haunt a friend, Legend shadows and Possession (pure rules in shadow-extras.ts).
import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import { createNotification } from "./communityNotify";
import { postHighlight } from "./community-highlights-db";
import { UNLOCK_DARTS, buildProfile, type ShadowProfileV2 } from "./shadow-profile";
import { loggedDarts, unlockDarts } from "./shadow-profile-db";
import { LEGEND_UNLOCK, EXORCIST_UNLOCK, LEGEND_TOP, HAUNT_DAYS, legendLabel, legendWindow, validateHaunt } from "./shadow-extras";

async function rows(q: ReturnType<typeof sql>): Promise<any[]> { return (await db.execute(q)).rows as any[]; }
const nameOf = async (id: number) => String((await rows(sql`SELECT name FROM players WHERE id = ${id}`))[0]?.name ?? "Someone");

let ready: Promise<unknown> | null = null;
export const ensureShadowExtras = () => (ready ??= (async () => {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS shadow_haunts (
    id SERIAL PRIMARY KEY, from_id INTEGER NOT NULL, to_id INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    played_at TIMESTAMPTZ, target_won BOOLEAN, score TEXT)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS shadow_legends (
    id SERIAL PRIMARY KEY, player_id INTEGER NOT NULL, season_id INTEGER NOT NULL, season_name TEXT NOT NULL,
    position INTEGER NOT NULL, label TEXT NOT NULL, profile JSONB NOT NULL, avg REAL NOT NULL, thin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (player_id, season_id))`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS shadow_legend_wins (
    legend_id INTEGER NOT NULL, player_id INTEGER NOT NULL, won_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (legend_id, player_id))`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS shadow_exorcisms (
    week TEXT NOT NULL, player_id INTEGER NOT NULL, boss TEXT, won_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (week, player_id))`);
  for (const u of [LEGEND_UNLOCK, EXORCIST_UNLOCK]) {
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

/** A shadow profile that plays like this player now (or at their average, if they've mostly typed visit totals). */
async function playableProfile(playerId: number, darts?: Awaited<ReturnType<typeof loggedDarts>>): Promise<(ShadowProfileV2 & { thin: boolean }) | null> {
  const counts = await unlockDarts(playerId);
  if (counts.total < UNLOCK_DARTS) return null;
  const prof = buildProfile(darts ?? await loggedDarts(playerId), darts ? "all" : "current");
  const thin = prof.scoringDist.reduce((n, x) => n + x.n, 0) < 60;
  if (thin && counts.practiceAvg) prof.computedAvg = counts.practiceAvg;
  return { ...prof, thin };
}

// ── Haunt a friend ───────────────────────────────────────────────────────────

const OPEN = sql`h.played_at IS NULL AND h.created_at > NOW() - (${HAUNT_DAYS} || ' days')::interval`;

export async function createHaunt(fromId: number, toId: number): Promise<{ id?: number; error?: string }> {
  await ensureShadowExtras();
  if ((await unlockDarts(fromId)).total < UNLOCK_DARTS) return { error: "Unlock your shadow first (250 darts)" };
  const target = (await rows(sql`SELECT id, name, status FROM players WHERE id = ${toId}`))[0];
  const open = await rows(sql`SELECT h.to_id FROM shadow_haunts h WHERE h.from_id = ${fromId} AND ${OPEN}`);
  const err = validateHaunt(fromId, toId, !!target && target.status !== "INACTIVE", open.some(r => Number(r.to_id) === toId), open.length);
  if (err) return { error: err };
  const id = Number((await rows(sql`INSERT INTO shadow_haunts (from_id, to_id) VALUES (${fromId}, ${toId}) RETURNING id`))[0].id);
  await createNotification({ playerId: toId, type: "shadow_haunt", actorId: fromId, entityId: id, entityType: "shadow_haunt",
    message: `${await nameOf(fromId)}'s shadow wants a game. Play it from Practice before it vanishes in ${HAUNT_DAYS} days.` });
  return { id };
}

/** Called when a practice game against someone's shadow is saved: settles an open haunt between them. Returns true if it did. */
export async function settleHaunt(playerId: number, shadowId: number, winnerIdx: number, detail: string | null): Promise<boolean> {
  await ensureShadowExtras();
  const h = (await rows(sql`SELECT h.id FROM shadow_haunts h WHERE h.from_id = ${shadowId} AND h.to_id = ${playerId} AND ${OPEN} ORDER BY h.id LIMIT 1`))[0];
  if (!h) return false;
  // Score winner-first ("3-1"), whoever won.
  const m = detail?.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
  const score = m ? `${Math.max(+m[1], +m[2])}-${Math.min(+m[1], +m[2])}` : null;
  await db.execute(sql`UPDATE shadow_haunts SET played_at = NOW(), target_won = ${winnerIdx === 0}, score = ${score} WHERE id = ${h.id}`);
  const who = await nameOf(playerId);
  await createNotification({ playerId: shadowId, type: "shadow_duel", actorId: playerId,
    message: winnerIdx === 0 ? `${who} saw off your shadow${score ? ` ${score}` : ""}.` : `Your shadow haunted ${who} and won${score ? ` ${score}` : ""}. It's on your profile.` });
  return true;
}

export async function hauntsFor(me: number) {
  await ensureShadowExtras();
  const incoming = await rows(sql`SELECT h.id, h.from_id, p.name, h.created_at FROM shadow_haunts h JOIN players p ON p.id = h.from_id
    WHERE h.to_id = ${me} AND ${OPEN} ORDER BY h.created_at DESC`);
  const sent = await rows(sql`SELECT h.id, h.to_id, p.name, h.created_at, h.played_at, h.target_won, h.score FROM shadow_haunts h JOIN players p ON p.id = h.to_id
    WHERE h.from_id = ${me} AND (h.played_at IS NOT NULL OR h.created_at > NOW() - (${HAUNT_DAYS} || ' days')::interval) ORDER BY h.created_at DESC LIMIT 10`);
  return {
    incoming: incoming.map(r => ({ id: Number(r.id), fromId: Number(r.from_id), name: String(r.name), createdAt: r.created_at })),
    sent: sent.map(r => ({ id: Number(r.id), toId: Number(r.to_id), name: String(r.name), createdAt: r.created_at,
      status: r.played_at == null ? "waiting" : r.target_won ? "lost" : "won", score: r.score })),
    record: await hauntRecord(me),
  };
}

/** For the profile: how your shadow's hauntings went (won = it beat the person it haunted). */
export async function hauntRecord(playerId: number) {
  await ensureShadowExtras();
  const r = (await rows(sql`SELECT COUNT(*) FILTER (WHERE target_won = false)::int won, COUNT(*) FILTER (WHERE target_won = true)::int lost,
    COALESCE(ARRAY_AGG(p.name ORDER BY h.played_at DESC) FILTER (WHERE target_won = false), '{}') victims
    FROM shadow_haunts h JOIN players p ON p.id = h.to_id WHERE h.from_id = ${playerId} AND h.played_at IS NOT NULL`))[0];
  return { won: Number(r?.won ?? 0), lost: Number(r?.lost ?? 0), victims: [...new Set((r?.victims ?? []) as string[])].slice(0, 5) };
}

// ── Legend shadows ───────────────────────────────────────────────────────────

/** Freeze the top 3 of every finished singles season as Legend shadows (once per season). */
export async function crownLegends(): Promise<number> {
  await ensureShadowExtras();
  const seasons = await rows(sql`SELECT s.id, s.name, s.start_date, s.end_date FROM seasons s
    WHERE s.league_type = 'singles' AND s.is_active = false AND s.end_date IS NOT NULL AND s.playoff_pending = false
      AND NOT EXISTS (SELECT 1 FROM shadow_legends l WHERE l.season_id = s.id) ORDER BY s.id`);
  let n = 0;
  for (const s of seasons) {
    const top = await rows(sql`SELECT player_id, position, is_champion FROM season_standings WHERE season_id = ${s.id}
      ORDER BY is_champion DESC, position ASC LIMIT ${LEGEND_TOP}`);
    let pos = 0;
    for (const t of top) {
      pos++;
      const pid = Number(t.player_id);
      const darts = legendWindow(await loggedDarts(pid), String(s.start_date), String(s.end_date));
      const prof = await playableProfile(pid, darts);
      if (!prof) continue;
      prof.eraLabel = `Legend · ${legendLabel(s.name, pos)}`;
      await db.execute(sql`INSERT INTO shadow_legends (player_id, season_id, season_name, position, label, profile, avg, thin)
        VALUES (${pid}, ${s.id}, ${s.name}, ${pos}, ${legendLabel(s.name, pos)}, ${JSON.stringify(prof)}, ${prof.computedAvg}, ${prof.thin})
        ON CONFLICT (player_id, season_id) DO NOTHING`);
      n++;
    }
  }
  return n;
}

export async function legendsList(me: number | null) {
  await ensureShadowExtras();
  return (await rows(sql`SELECT l.id, l.player_id, p.name, l.season_id, l.season_name, l.position, l.label, l.avg, l.thin,
      (SELECT COUNT(*)::int FROM shadow_legend_wins w WHERE w.legend_id = l.id) beaten_by,
      EXISTS (SELECT 1 FROM shadow_legend_wins w WHERE w.legend_id = l.id AND w.player_id = ${me ?? 0}) beaten_by_me
    FROM shadow_legends l JOIN players p ON p.id = l.player_id ORDER BY l.season_id DESC, l.position ASC`))
    .map(r => ({ id: Number(r.id), playerId: Number(r.player_id), name: String(r.name), seasonId: Number(r.season_id), seasonName: String(r.season_name),
      position: Number(r.position), label: String(r.label), avg: Math.round(Number(r.avg) * 10) / 10, thin: !!r.thin,
      beatenBy: Number(r.beaten_by), beatenByMe: !!r.beaten_by_me }));
}

export async function legendProfile(id: number, playerId: number) {
  await ensureShadowExtras();
  const r = (await rows(sql`SELECT * FROM shadow_legends WHERE id = ${id} AND player_id = ${playerId}`))[0];
  return r ? { ...(r.profile as ShadowProfileV2 & { thin: boolean }), era: `legend:${r.id}` as unknown as ShadowProfileV2["era"], legendId: Number(r.id), legendLabel: String(r.label) } : null;
}

/** A practice win over a Legend shadow: first time per legend, record it, unlock the tag, post the moment. */
export async function recordLegendWin(playerId: number, legendId: number, winnerIdx: number): Promise<void> {
  if (winnerIdx !== 0) return;
  await ensureShadowExtras();
  const l = (await rows(sql`SELECT l.*, p.name FROM shadow_legends l JOIN players p ON p.id = l.player_id WHERE l.id = ${legendId}`))[0];
  if (!l || Number(l.player_id) === playerId) return;
  const first = await db.execute(sql`INSERT INTO shadow_legend_wins (legend_id, player_id) VALUES (${legendId}, ${playerId}) ON CONFLICT DO NOTHING RETURNING legend_id`);
  if (!first.rows.length) return;
  const who = await nameOf(playerId);
  const unlocked = await grant(playerId, LEGEND_UNLOCK.id);
  await postHighlight({ key: `legend:${legendId}:${playerId}`, kind: "legend_slain", playerId, players: [playerId, Number(l.player_id)], link: "/shadow-bot",
    title: "LEGEND SLAIN", line: `${who} beat the Legend shadow of ${l.name} (${l.label}).`, stat: "👑", statLabel: "Legend shadow" });
  void createNotification({ playerId, type: "achievement_unlocked",
    message: `You beat the Legend shadow of ${l.name}!${unlocked ? " Unlocked: the Legend Slayer tag." : ""}` });
}

// ── Possession ───────────────────────────────────────────────────────────────

/** The latest Shadow Cup champion's shadow possesses one boss until the next cup is won. */
export async function currentPossession() {
  await ensureShadowExtras();
  const c = (await rows(sql`SELECT c.week, c.champion_id, p.name FROM shadow_cup c JOIN players p ON p.id = c.champion_id
    WHERE c.settled_at IS NOT NULL ORDER BY c.week DESC LIMIT 1`).catch(() => []))[0];
  if (!c) return null;
  const prof = await playableProfile(Number(c.champion_id));
  if (!prof) return null;
  return { week: String(c.week), playerId: Number(c.champion_id), name: String(c.name), profile: prof };
}

export async function exorcise(me: number, week: string, boss: string): Promise<{ unlocked: boolean } | { error: string }> {
  const p = await currentPossession();
  if (!p || p.week !== week) return { error: "That possession has ended" };
  if (p.playerId === me) return { error: "You can't exorcise your own shadow" };
  const first = await db.execute(sql`INSERT INTO shadow_exorcisms (week, player_id, boss) VALUES (${week}, ${me}, ${boss.slice(0, 40)}) ON CONFLICT DO NOTHING RETURNING week`);
  const unlocked = await grant(me, EXORCIST_UNLOCK.id);
  if (first.rows.length) {
    void createNotification({ playerId: p.playerId, type: "shadow_duel", actorId: me, message: `${await nameOf(me)} drove your shadow out of ${boss.slice(0, 40)}.` });
    if (unlocked) void createNotification({ playerId: me, type: "achievement_unlocked", message: "You beat a possessed boss! Unlocked: the Exorcist tag." });
  }
  return { unlocked };
}

export function initializeShadowLegendsScheduler() {
  const run = async () => { try { const n = await crownLegends(); if (n) logger.info({ n }, "Legend shadows crowned"); } catch (err) { logger.warn({ err }, "Crowning legend shadows failed"); } };
  cron.schedule("50 4 * * *", () => { void run(); }, { timezone: "Europe/London" });
  void run();
}

