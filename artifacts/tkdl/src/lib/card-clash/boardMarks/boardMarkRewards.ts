/**
 * Board Marks — reward magnitudes.
 *
 * Hot rewards and Trap penalizes with a REAL score effect (not just an
 * event) — see the design decision in scorers.tsx. The harder the target
 * is to hit, the bigger the swing: a number bed is easy and only worth a
 * modest amount, a treble/double is meaningfully harder and worth more,
 * and Bull — the single hardest, highest-stakes target — pays out the
 * most. This is what makes card choice and target choice both matter:
 * drawing (or placing) a Bull-based mark is a much bigger swing than a
 * number-bed one.
 *
 * Cold intentionally has no entry here — it stays pure denial, no score
 * effect, per the original design.
 */

import type { BoardMarkTargetType } from "./boardMarkTypes";

export type BoardMarkEngine = "X01" | "CRICKET";
export type BoardMarkRewardKind = "hot" | "trap";

interface MagnitudeTable {
  number: number;
  treble: number;
  double: number;
  bull: number;
}

// X01: these are REMAINING-score deltas — Hot subtracts (helps), Trap adds (hurts).
const X01_HOT: MagnitudeTable    = { number: 35, treble: 55, double: 55, bull: 90 };
const X01_TRAP: MagnitudeTable   = { number: 30, treble: 45, double: 45, bull: 75 };
// Cricket: these are POINT deltas — Hot adds (helps), Trap subtracts (hurts).
const CRICKET_HOT: MagnitudeTable  = { number: 18, treble: 28, double: 28, bull: 45 };
const CRICKET_TRAP: MagnitudeTable = { number: 15, treble: 22, double: 22, bull: 38 };

function tableFor(engine: BoardMarkEngine, kind: BoardMarkRewardKind): MagnitudeTable {
  if (engine === "X01") return kind === "hot" ? X01_HOT : X01_TRAP;
  return kind === "hot" ? CRICKET_HOT : CRICKET_TRAP;
}

/** The magnitude of a Hot reward or Trap penalty for a given target difficulty and engine. Always a positive number — the caller applies the correct sign. */
export function getBoardMarkMagnitude(
  targetType: BoardMarkTargetType,
  engine: BoardMarkEngine,
  kind: BoardMarkRewardKind
): number {
  const table = tableFor(engine, kind);
  if (targetType === "bull") return table.bull;
  if (targetType === "treble") return table.treble;
  if (targetType === "double") return table.double;
  return table.number;
}
