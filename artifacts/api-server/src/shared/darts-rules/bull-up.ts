/**
 * Canonical bull-up (throw for the bull) used by GameScorer, the Classic Tour and
 * Career live matches.
 *
 * Convention (WDF/national playing rules): each player throws one dart at the
 * bull; the dart nearer the centre throws first in the match. A re-throw is
 * called when both darts are in the same bull ring (both 50 or both 25) or when
 * nearness cannot be determined, and the re-throw is taken IN REVERSE ORDER.
 *
 * TKDL records bull throws by ring (INNER 50 / OUTER 25 / MISS). Two misses are
 * treated as "cannot determine which is nearer" (no measurement exists), so they
 * also re-throw in reverse order. There is never a coin flip.
 */
import type { PlayerIdx } from "./x01.ts";
import { other } from "./x01.ts";
import type { Random } from "./random.ts";

export type BullThrow = "INNER" | "OUTER" | "MISS";
export const BULL_RANK: Record<BullThrow, number> = { INNER: 2, OUTER: 1, MISS: 0 };
export type BullRound = { order: [PlayerIdx, PlayerIdx]; throws: Partial<Record<PlayerIdx, BullThrow>> };
export type BullUpState = { rounds: BullRound[]; winner: PlayerIdx | null; nextThrower: PlayerIdx | null };

export const isBullThrow = (v: unknown): v is BullThrow => v === "INNER" || v === "OUTER" || v === "MISS";

/** Pure replay of a bull-up from the throws made, in throwing order. */
export function resolveBullUp(firstOrder: PlayerIdx, throwsInOrder: readonly BullThrow[]): BullUpState {
  const rounds: BullRound[] = [];
  let order: [PlayerIdx, PlayerIdx] = [firstOrder, other(firstOrder)];
  let current: BullRound = { order, throws: {} };
  rounds.push(current);
  let winner: PlayerIdx | null = null;
  for (let i = 0; i < throwsInOrder.length; i++) {
    if (winner !== null) throw new Error("Bull-up already decided");
    const t = throwsInOrder[i];
    if (!isBullThrow(t)) throw new Error("Invalid bull throw");
    const thrower = current.order[current.throws[current.order[0]] === undefined ? 0 : 1];
    current.throws[thrower] = t;
    const a = current.throws[order[0]], b = current.throws[order[1]];
    if (a !== undefined && b !== undefined) {
      if (BULL_RANK[a] !== BULL_RANK[b]) winner = BULL_RANK[a] > BULL_RANK[b] ? order[0] : order[1];
      else { order = [order[1], order[0]]; current = { order, throws: {} }; rounds.push(current); } // re-throw, reverse order
    }
  }
  const last = rounds[rounds.length - 1];
  const nextThrower = winner !== null ? null : last.order[last.throws[last.order[0]] === undefined ? 0 : 1];
  if (winner !== null && Object.keys(last.throws).length === 0) rounds.pop();
  return { rounds, winner, nextThrower };
}

/**
 * Bot bull throw from its own ability (hit accuracy), not a fixed coin flip.
 * A stronger thrower hits the 50/25 more often.
 */
export function botBullThrow(hitAcc: number, rng: Random): BullThrow {
  const acc = Math.max(0, Math.min(1, hitAcc));
  const inner = 0.06 + 0.26 * acc;
  const outer = 0.22 + 0.28 * acc;
  const r = rng();
  return r < inner ? "INNER" : r < inner + outer ? "OUTER" : "MISS";
}

export const bullThrowLabel = (t: BullThrow) => (t === "INNER" ? "Inner bull (50)" : t === "OUTER" ? "Outer bull (25)" : "Missed the bull");
