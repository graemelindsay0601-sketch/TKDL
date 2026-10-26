import { scopedRandom } from "../world/random.ts";

/**
 * Webcam leagues: a remote league like the real online ones. Eight players from around the world, a division by level,
 * one match a week for seven weeks (first to three legs of 501), played on camera from your own board on a night you
 * choose. Two points a win; the top two go up a division and the bottom two go down; a small entry fee and prize money
 * for the top three. Every player fixture must be completed on the live scorer.
 */
export const CAM = Object.freeze({
  version: 1, size: 8, rounds: 7, bestOfLegs: 5, pointsForWin: 2, promote: 2, relegate: 2,
  /** Prize pool is funded by the eight entry fees; retain one fee for league administration. */
  prizeMultiple: [4, 2, 1] as const,
});
export const DIVISIONS = [
  { level: 1, name: "Premier Division", from: 68, fee: 3500 },
  { level: 2, name: "Championship", from: 58, fee: 2000 },
  { level: 3, name: "Division One", from: 50, fee: 1200 },
  { level: 4, name: "Division Two", from: 42, fee: 800 },
  { level: 5, name: "Division Three", from: 0, fee: 500 },
] as const;
export const divisionByLevel = (level: number) => DIVISIONS.find(d => d.level === level) ?? DIVISIONS[DIVISIONS.length - 1];
/** Where a newcomer starts: the division for their average. */
export const divisionFor = (average: number) => DIVISIONS.find(d => average >= d.from)!.level;
/** The band of averages a division's players come from. */
export const bandOf = (level: number) => { const d = divisionByLevel(level), above = DIVISIONS.find(x => x.level === level - 1); return { from: d.from, to: above ? above.from : 99 }; };
export const prizeFor = (level: number, position: number) => position <= CAM.prizeMultiple.length ? divisionByLevel(level).fee * CAM.prizeMultiple[position - 1] : 0;
/** After the last round: up (top two, not from the top), down (bottom two, not from the bottom), or staying. */
export const movement = (level: number, position: number) => position <= CAM.promote && level > 1 ? level - 1
  : position > CAM.size - CAM.relegate && level < DIVISIONS.length ? level + 1 : level;

/** Round-robin for eight (the circle method): round r's pairs of seats. */
export function roundRobin(size = CAM.size) {
  const seats = Array.from({ length: size }, (_, i) => i), rounds: [number, number][][] = [];
  for (let r = 0; r < size - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < size / 2; i++) { const a = seats[i], b = seats[size - 1 - i]; pairs.push(r % 2 ? [b, a] : [a, b]); }
    rounds.push(pairs);
    seats.splice(1, 0, seats.pop()!);
  }
  return rounds;
}

export type TableRow = { key: string; played: number; won: number; lost: number; legsFor: number; legsAgainst: number; points: number };
/** The league table from played fixtures: points, then leg difference, then legs won, then the seed order. */
export function tableFrom(keys: readonly string[], fixtures: readonly { a: string; b: string; legsA: number | null; legsB: number | null }[]): TableRow[] {
  const rows = new Map(keys.map(k => [k, { key: k, played: 0, won: 0, lost: 0, legsFor: 0, legsAgainst: 0, points: 0 }]));
  for (const f of fixtures) {
    if (f.legsA === null || f.legsB === null) continue;
    const a = rows.get(f.a)!, b = rows.get(f.b)!, aWon = f.legsA > f.legsB;
    a.played++; b.played++; a.legsFor += f.legsA; a.legsAgainst += f.legsB; b.legsFor += f.legsB; b.legsAgainst += f.legsA;
    if (aWon) { a.won++; b.lost++; a.points += CAM.pointsForWin; } else { b.won++; a.lost++; b.points += CAM.pointsForWin; }
  }
  return [...rows.values()].sort((x, y) => y.points - x.points || (y.legsFor - y.legsAgainst) - (x.legsFor - x.legsAgainst) || y.legsFor - x.legsFor || keys.indexOf(x.key) - keys.indexOf(y.key));
}

/** Pick the league's seven others from candidates in the division's band: from as many countries as possible. */
export function pickOpponents<T extends { key: string; country: string }>(seed: string, leagueKey: string, candidates: readonly T[]) {
  const rng = scopedRandom(seed, CAM.version, "cam-pick", leagueKey);
  const shuffled = [...candidates].sort((a, b) => a.key.localeCompare(b.key)).map(c => ({ c, r: rng() })).sort((a, b) => a.r - b.r).map(x => x.c);
  const out: T[] = [], countries = new Set<string>();
  for (const c of shuffled) if (out.length < CAM.size - 1 && !countries.has(c.country)) { out.push(c); countries.add(c.country); }
  for (const c of shuffled) if (out.length < CAM.size - 1 && !out.includes(c)) out.push(c);
  return out;
}
