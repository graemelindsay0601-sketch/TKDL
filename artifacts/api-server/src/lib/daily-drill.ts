/**
 * Daily drill: one practice target a day for everyone, picked from a pool by the London date so it's the same for
 * every player. Results come from practice sessions saved that day for the drill's game. Only games whose sessions
 * record the number we rank by are in the pool.
 */
export type DrillDef = { key: string; title: string; goal: string; gameKey: string; metric: "darts" | "average" | "score"; better: "low" | "high"; unit: string };

export const DRILLS: DrillDef[] = [
  { key: "301-sprint", title: "301 sprint", goal: "Check out 301 in as few darts as you can (solo, double out)", gameKey: "301_double_out", metric: "darts", better: "low", unit: "darts" },
  { key: "501-average", title: "501 average", goal: "Play a 501 leg and post your best 3-dart average", gameKey: "501_double_out", metric: "average", better: "high", unit: "avg" },
  { key: "nine-darts", title: "Nine darts", goal: "Best total from 9 darts (Best of 9 Darts)", gameKey: "high_score_9", metric: "score", better: "high", unit: "pts" },
  { key: "halve-it", title: "Halve-It", goal: "Post your best Halve-It score", gameKey: "halve_it", metric: "score", better: "high", unit: "pts" },
  { key: "99-at-20", title: "99 darts", goal: "Throw 99 darts at one target and post your score (99 Darts)", gameKey: "99_darts_standard", metric: "score", better: "high", unit: "pts" },
  { key: "501-sprint", title: "501 sprint", goal: "Check out 501 in as few darts as you can (solo, double out)", gameKey: "501_double_out", metric: "darts", better: "low", unit: "darts" },
  { key: "301-average", title: "301 average", goal: "Play a 301 leg and post your best 3-dart average", gameKey: "301_double_out", metric: "average", better: "high", unit: "avg" },
];

const LONDON = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });
export const londonDay = (d: Date) => LONDON.format(d); // YYYY-MM-DD

/** Same drill for everyone on a given London day; consecutive days never repeat. */
export function drillFor(day: string): DrillDef {
  const n = Math.floor(Date.parse(day + "T12:00:00Z") / 86400000);
  return DRILLS[((n % DRILLS.length) + DRILLS.length) % DRILLS.length];
}

export type DrillSession = { playerId: number; name: string; gameTypeKey: string; darts: number | null; score: number | null; sdScore: number | null; winnerIdx: number | null; createdAt: Date };

/** The value a session posts for a drill, or null if it doesn't count (unfinished, too short, wrong game). */
export function drillValue(d: DrillDef, s: DrillSession): number | null {
  if (s.gameTypeKey !== d.gameKey) return null;
  if (d.metric === "darts") return s.winnerIdx === 0 && s.darts && s.darts >= 6 ? s.darts : null;
  if (d.metric === "average") return s.darts && s.darts >= 9 && s.score !== null ? Math.round((s.score / s.darts) * 3 * 10) / 10 : null;
  const v = s.sdScore ?? s.score; return v === null || v === undefined ? null : v;
}

/** Each player's best for the day, ranked. */
export function leaderboard(d: DrillDef, sessions: DrillSession[]) {
  const best = new Map<number, { playerId: number; name: string; value: number }>();
  for (const s of sessions) { const v = drillValue(d, s); if (v === null) continue;
    const cur = best.get(s.playerId); if (!cur || (d.better === "low" ? v < cur.value : v > cur.value)) best.set(s.playerId, { playerId: s.playerId, name: s.name, value: v }); }
  return [...best.values()].sort((a, b) => d.better === "low" ? a.value - b.value : b.value - a.value);
}

/** Days in a row (ending today, or yesterday if today isn't done yet) that a player posted a result for that day's drill. */
export function streak(playerId: number, sessions: DrillSession[], today: string): number {
  const done = new Set<string>();
  for (const s of sessions) { if (s.playerId !== playerId) continue; const day = londonDay(s.createdAt); if (drillValue(drillFor(day), s) !== null) done.add(day); }
  const prev = (day: string) => londonDay(new Date(Date.parse(day + "T12:00:00Z") - 86400000));
  let day = done.has(today) ? today : prev(today), n = 0;
  while (done.has(day)) { n++; day = prev(day); }
  return n;
}
