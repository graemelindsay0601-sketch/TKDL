import type { Area, TrackView } from "./api";

/** How far from the next level, in the track's own unit (a ranking counts down). */
export const remaining = (t: TrackView) => t.nextTarget === null ? null : t.unit === "rank" ? (t.value > 0 ? t.value - t.nextTarget : null) : t.nextTarget - t.value;
/** Close enough to be worth a nudge: at least half way, and within a small number (or 10%) of the target. */
export function nearest(areas: { area: Area; tracks: TrackView[] }[], only?: Area[], limit = 2) {
  return areas.filter(a => !only || only.includes(a.area)).flatMap(a => a.tracks.map(t => ({ ...t, area: a.area, left: remaining(t) })))
    .filter(t => t.left !== null && t.left > 0 && t.progress >= 0.5 && (t.left <= 3 || t.left <= (t.nextTarget ?? 0) * 0.1))
    .sort((a, b) => b.progress - a.progress).slice(0, limit);
}

