/**
 * The darts world's records book. Every entry comes from a recorded match statistic and keeps its source:
 * SIMULATED (the A2 tour simulation), QUICK_SIM (your match simulated at your level) or LIVE (your real darts).
 * Nothing is estimated; a record only exists once a match has produced it.
 */
export const RECORDS = Object.freeze({
  "nine-darter": { label: "Nine-dart finishes", unit: "legs", keep: Infinity },
  "match-average": { label: "Highest match average", unit: "average", keep: 10 },
  "tv-average": { label: "Highest televised average", unit: "average", keep: 10 },
  "match-180s": { label: "Most 180s in a match", unit: "180s", keep: 10 },
  "checkout": { label: "Highest checkout", unit: "checkout", keep: 10 },
});
export type RecordKey = keyof typeof RECORDS;
export const RECORD_KEYS = Object.keys(RECORDS) as RecordKey[];
export type RecordSource = "SIMULATED" | "QUICK_SIM" | "LIVE";
export type RecordEntry = { key: RecordKey; participantKey: string; matchId: string; eventId: string; value: number; season: number; day: number; source: RecordSource };

/** A short match can post a freak average; averages count from six legs (a real best-of-11 or longer). */
export const AVERAGE_MIN_LEGS = 6;
const TV_TIERS = new Set(["TELEVISED", "MAJOR", "WORLD"]);

export type RecordMatch = {
  id: string; eventId: string; aKey: string | null; bKey: string | null; legsA: number; legsB: number; day: number; season: number;
  resultSource: string | null; summary: Record<string, unknown> | null; tier: string; pairs: boolean;
};
const pair = (v: unknown): [number, number] | null => Array.isArray(v) && v.length === 2 && v.every(n => typeof n === "number") ? [v[0], v[1]] : null;

/** Record candidates from finished matches (singles only; a pairs side is a team, not a player). */
export function candidatesFrom(matches: readonly RecordMatch[]): RecordEntry[] {
  const out: RecordEntry[] = [];
  for (const m of matches) {
    if (m.pairs || !m.aKey || !m.bKey || !m.summary || ["BYE", "WALKOVER"].includes(m.resultSource ?? "")) continue;
    const s = m.summary, keys = [m.aKey, m.bKey] as const, longEnough = m.legsA + m.legsB >= AVERAGE_MIN_LEGS;
    const add = (key: RecordKey, side: 0 | 1, value: number, source: RecordSource) => {
      if (Number.isFinite(value) && value > 0) out.push({ key, participantKey: keys[side], matchId: m.id, eventId: m.eventId, value, season: m.season, day: m.day, source });
    };
    const live = (s.live as { facts?: { human?: Stats; opponent?: Stats } } | undefined)?.facts;
    if (live?.human && live.opponent) {
      // A live match: the human's side is a_key or b_key; the opponent is the bot standing in for an NPC (its darts are simulated).
      const humanSide: 0 | 1 = m.aKey === "HUMAN" ? 0 : 1;
      for (const [side, stats, source] of [[humanSide, live.human, "LIVE"], [(1 - humanSide) as 0 | 1, live.opponent, "SIMULATED"]] as const) {
        if (longEnough) add("match-average", side, stats.average, source);
        if (longEnough && TV_TIERS.has(m.tier)) add("tv-average", side, stats.average, source);
        add("match-180s", side, stats.maximums, source); add("checkout", side, stats.highestCheckout, source);
        add("nine-darter", side, stats.nineDarters ?? 0, source);
      }
      continue;
    }
    const averages = pair(s.averages), maximums = pair(s.maximums), checkouts = pair(s.highestCheckouts), nines = pair(s.nineDarters);
    for (const side of [0, 1] as const) {
      const source: RecordSource = keys[side] === "HUMAN" ? (s.quickSim ? "QUICK_SIM" : "SIMULATED") : "SIMULATED";
      if (averages && longEnough) { add("match-average", side, averages[side], source); if (TV_TIERS.has(m.tier)) add("tv-average", side, averages[side], source); }
      if (maximums) add("match-180s", side, maximums[side], source);
      if (checkouts) add("checkout", side, checkouts[side], source);
      if (nines) add("nine-darter", side, nines[side], source);
    }
  }
  return out;
}
type Stats = { average: number; maximums: number; highestCheckout: number; nineDarters?: number };

/** Higher is better; ties go to whoever did it first (then a stable id order). */
export const recordOrder = (a: RecordEntry, b: RecordEntry) => b.value - a.value || a.season - b.season || a.day - b.day || a.matchId.localeCompare(b.matchId) || a.participantKey.localeCompare(b.participantKey);
/** Nine-darters are listed in the order they happened. */
const nineOrder = (a: RecordEntry, b: RecordEntry) => a.season - b.season || a.day - b.day || a.matchId.localeCompare(b.matchId) || a.participantKey.localeCompare(b.participantKey);

/** The kept entries per record after adding candidates: the top N (every nine-darter). */
export function mergeRecords(existing: readonly RecordEntry[], candidates: readonly RecordEntry[]): RecordEntry[] {
  const all = new Map<string, RecordEntry>();
  for (const e of [...existing, ...candidates]) all.set(`${e.key}|${e.matchId}|${e.participantKey}`, e);
  return RECORD_KEYS.flatMap(key => {
    const rows = [...all.values()].filter(e => e.key === key);
    return key === "nine-darter" ? rows.sort(nineOrder) : rows.sort(recordOrder).slice(0, RECORDS[key].keep);
  });
}

/** Nine-dart legs in a live match log: a won 501 leg in exactly nine darts (straight-in; cricket and corked legs never count). */
export function liveNineDarters(state: { format: { startingScore: number; inRule?: string }; legsLog: readonly { winner: number; darts: readonly number[]; cork?: boolean; game?: string }[] }, side: 0 | 1) {
  if (state.format.startingScore !== 501 || (state.format.inRule && state.format.inRule !== "STRAIGHT")) return 0;
  return state.legsLog.filter(l => l.winner === side && !l.cork && (!l.game || l.game === "X01") && l.darts[side] === 9).length;
}

/** Nine-dart legs in a simulated match, per side: a won 501 straight-in leg checked out in exactly nine darts (cricket and corked legs record no checkout). */
export function simulatedNineDarters(legs: readonly { winner: number; checkout: number; darts: readonly number[] }[],
  format: { gameType?: string; startingScore?: number | null; inRule?: string | null }): [number, number] {
  if ((format.gameType && format.gameType !== "X01") || format.startingScore !== 501 || (format.inRule && format.inRule !== "STRAIGHT")) return [0, 0];
  const count = (side: 0 | 1) => legs.filter(l => l.winner === side && l.checkout > 0 && l.darts[side] === 9).length;
  return [count(0), count(1)];
}
