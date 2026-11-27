/**
 * League records that a single new singles result can break. Pure helpers (tested); the DB side is in
 * league-records-db.ts. A record only counts as "broken" when there was a previous holder and the new value
 * is strictly better, so a first-ever value or a tie never fires.
 */
export type RecordKey = "fewest_darts_501" | "fewest_darts_301" | "most_180s" | "win_streak";
export const RECORD_LABELS: Record<RecordKey, { title: string; unit: string; better: "low" | "high"; min?: number }> = {
  fewest_darts_501: { title: "Fewest darts to win a 501", unit: "darts", better: "low" },
  fewest_darts_301: { title: "Fewest darts to win a 301", unit: "darts", better: "low" },
  most_180s: { title: "Most 180s in a match", unit: "180s", better: "high", min: 2 },
  win_streak: { title: "Longest winning run", unit: "wins in a row", better: "high", min: 5 },
};

export function beats(key: RecordKey, value: number | null | undefined, previous: number | null | undefined): boolean {
  if (value == null || previous == null || !Number.isFinite(value) || !Number.isFinite(previous)) return false;
  const def = RECORD_LABELS[key];
  if (def.min != null && value < def.min) return false;
  return def.better === "low" ? value < previous : value > previous;
}

/** Single-leg x01 game keys that a darts-count record is fair for. */
export const dartsRecordKey = (gameType: string): RecordKey | null =>
  /^501(_double_out)?$/i.test(gameType) ? "fewest_darts_501" : /^301(_double_out)?$/i.test(gameType) ? "fewest_darts_301" : null;

/** Each player's longest run of consecutive singles wins, plus the run they're on now, over results oldest first. */
export function winRuns(results: { winnerId: number; loserId: number }[]): { longest: Map<number, number>; current: Map<number, number> } {
  const longest = new Map<number, number>(), current = new Map<number, number>();
  for (const r of results) {
    const run = (current.get(r.winnerId) ?? 0) + 1;
    current.set(r.winnerId, run); current.set(r.loserId, 0);
    if (run > (longest.get(r.winnerId) ?? 0)) longest.set(r.winnerId, run);
  }
  return { longest, current };
}
