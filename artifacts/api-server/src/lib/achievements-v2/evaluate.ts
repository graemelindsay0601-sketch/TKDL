import { CATALOGUE, SEASON_GOAL_POINTS, goalText, levelPoints, metalFor, type AchievementDef, type Area, type Metal } from "./catalogue.ts";

/** One achievement's state for one player, ready for the page and for the report. */
export type TrackState = { kind: "TRACK"; key: string; area: Area; title: string; value: number; level: number; levels: number; metal: Metal | null;
  next: { target: number; text: string } | null; progress: number; points: number };
export type FeatState = { kind: "FEAT"; key: string; area: Area; title: string; goal: string; earnedAt: Date | null; secret: boolean; liveOnly: boolean; points: number };
export type SeasonState = { kind: "SEASON"; key: string; area: Area; title: string; perSeason: { seasonId: number; value: number; completed: number }[]; points: number };
export type AchievementState = TrackState | FeatState | SeasonState;

export type AreaFacts = { metrics: Record<string, number>; feats: Record<string, Date | null>; seasons: Map<number, Record<string, number>> };

export function evaluate(defs: readonly AchievementDef[], facts: AreaFacts): AchievementState[] {
  return defs.map((d): AchievementState => {
    if (d.kind === "TRACK") {
      const value = facts.metrics[d.metric] ?? 0;
      const level = d.levels.filter(t => value >= t).length;
      const nextTarget = d.levels[level];
      const prev = level > 0 ? d.levels[level - 1] : 0;
      const progress = nextTarget === undefined ? 1 : Math.max(0, Math.min(1, (value - prev) / (nextTarget - prev)));
      let points = 0; for (let i = 1; i <= level; i++) points += levelPoints(i);
      return { kind: "TRACK", key: d.key, area: d.area, title: d.title, value, level, levels: d.levels.length, metal: metalFor(level, d.levels.length),
        next: nextTarget === undefined ? null : { target: nextTarget, text: goalText(d.goal, nextTarget) }, progress, points };
    }
    if (d.kind === "FEAT") {
      const earnedAt = d.liveOnly ? null : facts.feats[d.metric] ?? null;
      return { kind: "FEAT", key: d.key, area: d.area, title: d.title, goal: d.goal, earnedAt, secret: !!d.secret, liveOnly: !!d.liveOnly, points: earnedAt ? d.points : 0 };
    }
    const perSeason = [...facts.seasons].map(([seasonId, m]) => { const value = m[d.metric] ?? 0; return { seasonId, value, completed: d.targets.filter(t => value >= t).length }; })
      .sort((a, b) => a.seasonId - b.seasonId);
    return { kind: "SEASON", key: d.key, area: d.area, title: d.title, perSeason, points: perSeason.reduce((n, s) => n + s.completed * SEASON_GOAL_POINTS, 0) };
  });
}

export const catalogueFor = (area: Area) => CATALOGUE.filter(d => d.area === area);
