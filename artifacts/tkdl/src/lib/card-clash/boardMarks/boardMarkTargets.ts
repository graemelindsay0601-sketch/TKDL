/**
 * Board Marks v1 — targets.
 *
 * Converts TKDL's own dart representation into the minimal
 * BoardMarkDartResult shape this module needs, and provides small helpers
 * for describing/normalising BoardMarkTarget values.
 */

import type { BoardMarkDartResult, BoardMarkTarget } from "./boardMarkTypes";

/** The subset of TKDL's `Dart` shape (lib/dartboard.tsx) this module needs. */
export interface TkdlDartLike {
  segment: number;
  multiplier: 1 | 2 | 3;
}

/**
 * Converts a scored TKDL dart into a BoardMarkDartResult.
 * TKDL represents bull as segment 25 (multiplier 1 = outer bull/25, multiplier
 * 2 = bullseye/50) — that's carried straight through, since board mark
 * matching for "bull" targets treats both as bull (see boardMarkMatcher.ts).
 */
export function toBoardMarkDartResult(
  dart: TkdlDartLike,
  throwingPlayerId: string
): BoardMarkDartResult {
  return {
    segment: dart.segment,
    multiplier: dart.multiplier,
    throwingPlayerId,
  };
}

/** True if this dart result represents a bull hit (either outer bull or bullseye). */
export function isBullDart(dart: BoardMarkDartResult): boolean {
  return dart.segment === 25;
}

/** Human-readable label for a target, e.g. "T20", "D16", "20 bed", "Bull", "Every Treble". Useful for logs/UI. */
export function describeBoardMarkTarget(target: BoardMarkTarget): string {
  if (target.type === "bull") return "Bull";
  if (target.value === "any") {
    if (target.type === "number") return "Every Number";
    if (target.type === "treble") return "Every Treble";
    if (target.type === "double") return "Every Double";
  }
  if (target.type === "number") return `${target.value} bed`;
  if (target.type === "treble") return `T${target.value}`;
  if (target.type === "double") return `D${target.value}`;
  return "Unknown target";
}

/** Structural equality for two targets — same type and same value. */
export function isSameBoardMarkTarget(a: BoardMarkTarget, b: BoardMarkTarget): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "bull") return true; // there's only one bull target
  return a.value === b.value;
}
