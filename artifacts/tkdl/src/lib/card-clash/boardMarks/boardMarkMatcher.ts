/**
 * Board Marks v1 — matcher.
 *
 * Checks whether a scored dart matches a Board Mark target. This is pure
 * target-matching logic — it never looks at active marks or decides
 * anything about triggering; see boardMarkResolver.ts for that.
 */

import type { BoardMarkDartResult, BoardMarkTarget } from "./boardMarkTypes";
import { isBullDart } from "./boardMarkTargets";

/**
 * Does this scored dart match the given Board Mark target?
 *
 * - "number" (a bed, e.g. 20) matches any multiplier on that segment: S20/D20/T20.
 * - "treble" matches only that exact treble (multiplier 3 on that segment).
 * - "double" matches only that exact double (multiplier 2 on that segment).
 * - "bull" matches any bull hit (outer bull or bullseye).
 */
export function doesDartMatchBoardMarkTarget(
  dartResult: BoardMarkDartResult,
  boardMarkTarget: BoardMarkTarget
): boolean {
  switch (boardMarkTarget.type) {
    case "bull":
      return isBullDart(dartResult);

    case "number":
      return (
        typeof boardMarkTarget.value === "number" &&
        dartResult.segment === boardMarkTarget.value &&
        dartResult.segment !== 25 // bull is never a numbered bed
      );

    case "treble":
      return (
        typeof boardMarkTarget.value === "number" &&
        dartResult.segment === boardMarkTarget.value &&
        dartResult.multiplier === 3
      );

    case "double":
      return (
        typeof boardMarkTarget.value === "number" &&
        dartResult.segment === boardMarkTarget.value &&
        dartResult.multiplier === 2
      );

    default:
      return false;
  }
}
