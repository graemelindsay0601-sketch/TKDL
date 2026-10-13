/**
 * Standard Cricket (soft-tip mixed matches). Pure helpers shared by the scorer, the
 * Career server's replay and the NPC simulation.
 *
 * Targets are 20 down to 15 and the bull. A single is one mark, a double two, a treble
 * three; the outer bull is one mark and the inner bull two (cricket has no fat bull).
 * Three marks close a number. Marks beyond three score the number's value (bull 25)
 * while the opponent has not closed it. A player wins the moment every target is closed
 * and their points are at least the opponent's. Darts outside the targets do nothing.
 */
import type { Dart, PlayerIdx } from "./x01.ts";

export const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25] as const;
/** DARTSLIVE standard cricket: 20 rounds, then higher points wins; level points go to a cork. */
export const CRICKET_ROUND_LIMIT = 20;
export type CricketBoard = { marks: [number[], number[]]; points: [number, number] };

export const emptyCricket = (): CricketBoard => ({ marks: [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]], points: [0, 0] });
export const copyCricket = (b: CricketBoard): CricketBoard => ({ marks: [[...b.marks[0]], [...b.marks[1]]], points: [b.points[0], b.points[1]] });
export const cricketTarget = (segment: number) => (CRICKET_TARGETS as readonly number[]).indexOf(segment);
export const cricketMarksOf = (d: Pick<Dart, "segment" | "multiplier">) =>
  cricketTarget(d.segment) < 0 ? 0 : d.segment === 25 ? (d.multiplier === 2 ? 2 : 1) : d.multiplier;

/** Apply one dart in place; returns the marks and points it added. */
export function applyCricketDart(board: CricketBoard, p: PlayerIdx, d: Pick<Dart, "segment" | "multiplier">): { marks: number; points: number } {
  const i = cricketTarget(d.segment);
  if (i < 0) return { marks: 0, points: 0 };
  const o = (p === 0 ? 1 : 0) as PlayerIdx;
  const m = cricketMarksOf(d), have = board.marks[p][i];
  const extra = Math.max(0, m - Math.max(0, 3 - have));
  board.marks[p][i] = Math.min(3, have + m);
  const points = extra > 0 && board.marks[o][i] < 3 ? extra * (d.segment === 25 ? 25 : d.segment) : 0;
  board.points[p] += points;
  return { marks: m, points };
}

export const allClosed = (board: CricketBoard, p: PlayerIdx) => board.marks[p].every(x => x >= 3);
export const cricketWon = (board: CricketBoard, p: PlayerIdx) => allClosed(board, p) && board.points[p] >= board.points[p === 0 ? 1 : 0];

/**
 * Target a sensible player aims at: when behind on points, score on a number they have
 * closed and the opponent has not; otherwise close the highest open number (20 → 15, then bull).
 */
export function cricketAim(board: CricketBoard, me: PlayerIdx): number {
  const o = (me === 0 ? 1 : 0) as PlayerIdx;
  if (board.points[me] < board.points[o] || allClosed(board, me)) {
    const scoring = CRICKET_TARGETS.findIndex((_, i) => board.marks[me][i] >= 3 && board.marks[o][i] < 3);
    if (scoring >= 0) return CRICKET_TARGETS[scoring];
  }
  const open = CRICKET_TARGETS.findIndex((_, i) => board.marks[me][i] < 3);
  return open >= 0 ? CRICKET_TARGETS[open] : 20;
}
