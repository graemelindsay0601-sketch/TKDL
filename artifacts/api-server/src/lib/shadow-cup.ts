/**
 * The Shadow Cup (pure, unit-tested): a weekly knockout between every unlocked
 * shadow, simulated dart by dart with the same planner the scorer uses
 * (shared/darts-rules/shadow.ts) and a seeded random, so every match can be
 * replayed exactly. Rounds are revealed through the week; the final on Friday.
 */
import { planShadowX01Visit, seededRandom, type ShadowDarts } from "../shared/darts-rules/index.ts";

export type CupEntrant = { playerId: number; name: string; avg: number; profile: ShadowDarts };
export type CupDart = { seg: number; mult: number; val: number };
export type CupVisit = { p: 0 | 1; darts: CupDart[]; score: number; left: number; bust?: boolean; checkout?: boolean };
export type CupLeg = { starter: 0 | 1; visits: CupVisit[]; winner: 0 | 1 };
export type CupMatch = { legs: CupLeg[]; score: [number, number]; winner: 0 | 1; avgs: [number, number]; best: [number, number]; checkouts: [number, number] };

export const CUP_UNLOCK = { id: "tag-sh-shadow-cup", category: "LEADERBOARD_TAG", name: "SHADOW CUP CHAMPION", rarity: "EPIC", color: "#a78bfa", sortOrder: 220 };
export const CUP_EARNED_BY: Record<string, string> = { [CUP_UNLOCK.id]: "Your shadow wins the weekly Shadow Cup" };
export const LEGS_TO_WIN = 3;

/** One 501 double-out match, best of 5, alternating throw; pressure when the other player is on a finish. */
export function simulateMatch(a: ShadowDarts, b: ShadowDarts, seed: string, legsToWin = LEGS_TO_WIN): CupMatch {
  const rng = seededRandom("shadow-cup", seed);
  const prof = [a, b];
  const score: [number, number] = [0, 0];
  const legs: CupLeg[] = [];
  const pts: [number, number] = [0, 0], darts: [number, number] = [0, 0], best: [number, number] = [0, 0], cos: [number, number] = [0, 0];
  let legNo = 0;
  while (score[0] < legsToWin && score[1] < legsToWin) {
    const starter = (legNo % 2) as 0 | 1;
    const left: [number, number] = [501, 501];
    const visits: CupVisit[] = [];
    let turn = starter, winner: 0 | 1 | null = null;
    for (let v = 0; v < 400 && winner === null; v++) {
      const opp = (turn === 0 ? 1 : 0) as 0 | 1;
      const plan = planShadowX01Visit(left[turn], prof[turn], { doubleOut: true, pressure: left[opp] <= 170, rng });
      let rem = left[turn];
      const thrown: CupDart[] = [];
      let bust = false, checkout = false;
      for (const d of plan) {
        thrown.push({ seg: d.segment, mult: d.multiplier, val: d.value });
        const after = rem - d.value;
        if (after < 0 || after === 1 || (after === 0 && d.multiplier !== 2)) { bust = true; break; }
        rem = after;
        if (rem === 0) { checkout = true; break; }
      }
      const scored = bust ? 0 : left[turn] - rem;
      darts[turn] += thrown.length; pts[turn] += scored; best[turn] = Math.max(best[turn], scored);
      if (!bust) left[turn] = rem;
      visits.push({ p: turn, darts: thrown, score: scored, left: left[turn], ...(bust ? { bust: true } : {}), ...(checkout ? { checkout: true } : {}) });
      if (checkout) { winner = turn; cos[turn] = Math.max(cos[turn], scored); }
      turn = opp;
    }
    const w = (winner ?? (left[0] <= left[1] ? 0 : 1)) as 0 | 1;
    score[w]++;
    legs.push({ starter, visits, winner: w });
    legNo++;
  }
  const avg = (i: 0 | 1) => (darts[i] ? Math.round((pts[i] / darts[i]) * 3 * 10) / 10 : 0);
  return { legs, score, winner: score[0] > score[1] ? 0 : 1, avgs: [avg(0), avg(1)], best, checkouts: cos };
}

/** Seeds by average, best first; first round pairs 1 v last, 2 v second-last…, with byes for the top seeds. */
export function firstRound<T extends { avg: number }>(entrants: T[]): (T | null)[][] {
  const seeded = [...entrants].sort((x, y) => y.avg - x.avg);
  let size = 2; while (size < seeded.length) size *= 2;
  const slots: (T | null)[] = [...seeded, ...Array(size - seeded.length).fill(null)];
  const order = bracketOrder(size);
  const placed = order.map(i => slots[i]);
  const pairs: (T | null)[][] = [];
  for (let i = 0; i < placed.length; i += 2) pairs.push([placed[i], placed[i + 1]]);
  return pairs;
}

/** Standard bracket positions so seed 1 and seed 2 can only meet in the final. */
export function bracketOrder(size: number): number[] {
  let order = [0];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap(i => [i, n - 1 - i]);
  }
  return order;
}

export function roundName(roundsLeft: number): string {
  return roundsLeft === 1 ? "Final" : roundsLeft === 2 ? "Semi-finals" : roundsLeft === 3 ? "Quarter-finals" : `Round of ${2 ** roundsLeft}`;
}

/** Day offsets from Monday for each round's reveal, final always Friday (day 4). */
export function revealDays(rounds: number): number[] {
  if (rounds <= 1) return [4];
  return Array.from({ length: rounds }, (_, i) => Math.round((i * 4) / (rounds - 1)));
}

/** Short commentary line for a visit, for the replay. */
export function callVisit(name: string, v: CupVisit): string | null {
  if (v.checkout) return v.score >= 100 ? `${name} takes out ${v.score}!` : `${name} checks out ${v.score}.`;
  if (v.bust) return `${name} busts.`;
  if (v.score === 180) return `ONE HUNDRED AND EIGHTY! ${name}.`;
  if (v.score >= 140) return `${name} hits ${v.score}.`;
  if (v.score >= 100) return `Ton-plus for ${name}: ${v.score}.`;
  return null;
}
