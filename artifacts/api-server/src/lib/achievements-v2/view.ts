/**
 * What the Achievements page and the profile shelf show for one player. Built from the saved rows once the switch is on,
 * or worked out live for an admin preview before launch; both go through toView so the page sees one shape.
 */
import { sql } from "drizzle-orm";
import { CATALOGUE, SEASON_GOAL_POINTS, goalText, trackLevel, levelPoints, metalFor, type Area, type Metal } from "./catalogue.ts";
import type { AchievementState } from "./evaluate.ts";
import { computeAll, type Exec } from "./report.ts";
import { ensureTables } from "./store.ts";
import { REWARDS, REWARD_FOR_FEAT } from "./rewards.ts";

export const AREA_ORDER: { area: Area; name: string }[] = [
  { area: "LEAGUE", name: "League" }, { area: "TEAMS", name: "Doubles and Shift Wars" }, { area: "PRACTICE", name: "Practice" },
  { area: "MASTER501", name: "Master-501" }, { area: "MODES", name: "Board Curse and Boss Battle" }, { area: "CAREER", name: "Career" },
];

export type TrackView = { key: string; title: string; value: number; level: number; levels: number[]; metal: Metal | null; next: string | null;
  nextTarget: number | null; progress: number; unit: "%" | "rank" | null; scorer: boolean };
export type FeatView = { key: string; title: string; goal: string; earnedAt: string | null; secret: boolean; liveOnly: boolean; points: number; scorer: boolean; showpiece: boolean; reward: string | null };
export type SeasonView = { key: string; title: string; goal: string; targets: number[]; value: number; completed: number; seasonsCompleted: number };
export type AreaView = { area: Area; name: string; score: number; tracks: TrackView[]; feats: FeatView[]; seasonGoals: SeasonView[]; earned: number; total: number; reward: string | null };
export type PlayerView = { score: number; areas: AreaView[]; nearly: (TrackView & { area: Area })[]; metals: Record<Metal, number>; featsEarned: number };

const defs = new Map(CATALOGUE.map(d => [d.key, d]));

/** One player's page from their states (any order, any areas); the current league season picks which season goals show. */
export function toView(states: AchievementState[], currentSeasonId: number | null): PlayerView {
  const areas: AreaView[] = AREA_ORDER.map(({ area, name }) => {
    const mine = new Map(states.filter(s => s.area === area).map(s => [s.key, s]));
    const tracks: TrackView[] = [], feats: FeatView[] = [], seasonGoals: SeasonView[] = [];
    let score = 0;
    for (const d of CATALOGUE.filter(d => d.area === area)) {
      const s = mine.get(d.key); score += s?.points ?? 0;
      if (d.kind === "TRACK") {
        const value = s?.kind === "TRACK" ? s.value : 0, level = s?.kind === "TRACK" ? s.level : 0, nextTarget = d.levels[level] ?? null;
        const progress = nextTarget === null ? 1 : trackLevel(d, value).progress;
        tracks.push({ key: d.key, title: d.title, value, level, levels: d.levels, metal: metalFor(level, d.levels.length), nextTarget,
          next: nextTarget === null ? null : goalText(d.goal, nextTarget, d.unit), progress,
          unit: d.unit ?? null, scorer: !!d.scorer });
      } else if (d.kind === "FEAT") {
        const earnedAt = s?.kind === "FEAT" && s.earnedAt ? s.earnedAt.toISOString() : null;
        // A secret feat shows only its hint until it's earned.
        feats.push({ key: d.key, title: d.secret && !earnedAt ? "Secret" : d.title, goal: d.secret && !earnedAt ? d.secret.hint : d.goal, earnedAt,
          secret: !!d.secret, liveOnly: !!d.liveOnly, points: d.points, scorer: !!d.scorer, showpiece: !!d.showpiece, reward: d.secret && !earnedAt ? null : REWARD_FOR_FEAT[d.key] ?? null });
      } else {
        const per = s?.kind === "SEASON" ? s.perSeason : [];
        const cur = per.find(p => p.seasonId === currentSeasonId);
        seasonGoals.push({ key: d.key, title: d.title, goal: d.goal, targets: d.targets,
          value: cur?.value ?? 0, completed: cur?.completed ?? 0, seasonsCompleted: per.filter(p => p.completed > 0).length });
      }
    }
    const earned = tracks.filter(t => t.level > 0).length + feats.filter(f => f.earnedAt).length;
    return { area, name, score, tracks, feats, seasonGoals, earned, total: tracks.length + feats.length, reward: REWARDS.find(r => r.cosmetic.id === `frame-av2-${area.toLowerCase()}`)?.cosmetic.name ?? null };
  });
  const allTracks = areas.flatMap(a => a.tracks.map(t => ({ ...t, area: a.area })));
  const nearly = allTracks.filter(t => t.nextTarget !== null && t.progress > 0).sort((a, b) => b.progress - a.progress).slice(0, 5);
  const metals = { BRONZE: 0, SILVER: 0, GOLD: 0, PLATINUM: 0, DIAMOND: 0 } as Record<Metal, number>;
  for (const t of allTracks) if (t.metal) metals[t.metal]++;
  return { score: areas.reduce((n, a) => n + a.score, 0), areas, nearly, metals, featsEarned: areas.reduce((n, a) => n + a.feats.filter(f => f.earnedAt).length, 0) };
}

/** A player's states from the saved rows (after launch). */
export async function storedStates(db: Exec, playerId: number): Promise<AchievementState[]> {
  await ensureTables(db);
  const items = (await db.execute(sql`SELECT key, value, level, earned_at FROM achievement_v2_items WHERE player_id = ${playerId}`)).rows;
  const seasons = (await db.execute(sql`SELECT key, season_id, value, completed FROM achievement_v2_seasons WHERE player_id = ${playerId}`)).rows;
  const out: AchievementState[] = [];
  for (const r of items) {
    const d = defs.get(String(r.key)); if (!d) continue;
    if (d.kind === "TRACK") {
      const level = Number(r.level); let points = 0; for (let i = 1; i <= level; i++) points += levelPoints(i);
      out.push({ kind: "TRACK", key: d.key, area: d.area, title: d.title, value: Number(r.value), level, levels: d.levels.length, metal: metalFor(level, d.levels.length),
        next: null, progress: 0, points });
    } else if (d.kind === "FEAT" && r.earned_at) {
      out.push({ kind: "FEAT", key: d.key, area: d.area, title: d.title, goal: d.goal, earnedAt: new Date(String(r.earned_at)), secret: !!d.secret, liveOnly: !!d.liveOnly, points: d.points });
    }
  }
  for (const d of CATALOGUE) {
    if (d.kind !== "SEASON") continue;
    const per = seasons.filter(r => r.key === d.key).map(r => ({ seasonId: Number(r.season_id), value: Number(r.value), completed: Number(r.completed) }));
    if (per.length) out.push({ kind: "SEASON", key: d.key, area: d.area, title: d.title, perSeason: per, points: per.reduce((n, p) => n + p.completed * SEASON_GOAL_POINTS, 0) });
  }
  return out;
}

/** A player's states worked out now from the recorded data (admin preview before launch). */
export async function liveStates(db: Exec, playerId: number): Promise<AchievementState[]> {
  const all = await computeAll(db);
  return Object.values(all).flatMap(list => list.find(p => p.playerId === playerId)?.states ?? []);
}

export async function currentSeasonId(db: Exec): Promise<number | null> {
  const r = (await db.execute(sql`SELECT id FROM seasons WHERE is_active = true ORDER BY id DESC LIMIT 1`)).rows[0];
  return r ? Number(r.id) : null;
}

/** The latest unlocks for a player (newest first), for the page's "Recently earned" and later the result screen. */
export async function recentUnlocks(db: Exec, playerId: number, limit = 12) {
  await ensureTables(db);
  return (await db.execute(sql`SELECT key, area, kind, level, season_id, coins, source, created_at FROM achievement_v2_unlocks
    WHERE player_id = ${playerId} AND source = 'live' ORDER BY created_at DESC, id DESC LIMIT ${limit}`)).rows.map(r => {
    const d = defs.get(String(r.key));
    return { key: String(r.key), title: d?.title ?? String(r.key), area: String(r.area), kind: String(r.kind), level: Number(r.level),
      metal: d?.kind === "TRACK" ? metalFor(Number(r.level), d.levels.length) : null, coins: Number(r.coins), at: new Date(String(r.created_at)).toISOString() };
  });
}

/** Live unlocks the player hasn't been shown yet (oldest first), for the unlock pop-up. */
export async function unseenUnlocks(db: Exec, playerId: number) {
  await ensureTables(db);
  return (await db.execute(sql`SELECT id, key, area, kind, level, season_id, coins, created_at FROM achievement_v2_unlocks
    WHERE player_id = ${playerId} AND seen = false AND source = 'live' ORDER BY created_at, id LIMIT 10`)).rows.map(r => {
    const d = defs.get(String(r.key));
    const next = d?.kind === "TRACK" ? d.levels[Number(r.level)] ?? null : null;
    return { id: Number(r.id), key: String(r.key), title: d?.title ?? String(r.key), area: String(r.area), kind: String(r.kind), level: Number(r.level),
      levels: d?.kind === "TRACK" ? d.levels.length : 0, metal: d?.kind === "TRACK" ? metalFor(Number(r.level), d.levels.length) : null,
      reached: d?.kind === "TRACK" ? d.levels[Number(r.level) - 1] : null, next, nextGoal: d?.kind === "TRACK" && next !== null ? goalText(d.goal, next) : null,
      goal: d && d.kind !== "TRACK" ? (d.kind === "SEASON" ? d.goal.replace("{n}", String(d.targets[Math.min(d.targets.length, Number(r.level)) - 1])) : d.goal) : null,
      showpiece: d?.kind === "FEAT" ? !!d.showpiece : false, coins: Number(r.coins), at: new Date(String(r.created_at)).toISOString() };
  });
}
export async function markSeen(db: Exec, playerId: number, ids: number[]) {
  if (!ids.length) return;
  await db.execute(sql`UPDATE achievement_v2_unlocks SET seen = true WHERE player_id = ${playerId} AND id IN (${sql.join(ids.map(i => sql`${i}`), sql`, `)})`);
}
