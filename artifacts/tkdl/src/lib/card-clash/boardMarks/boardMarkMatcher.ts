/**
 * Board Marks v1 — matcher.
 *
 * Checks whether a scored dart matches a Board Mark target. This is pure
 * target-matching logic — it never looks at active marks or decides
 * anything about triggering; see boardMarkResolver.ts for that.
 */

import type { BoardMarkDartResult, BoardMarkTarget } from "./boardMarkTypes";
import { isBullDart } from "./boardMarkTargets";

/** Board Marks only ever target 15-20 (plus Bull, handled separately) — these are exactly the numbers Cricket scores, so every mark stays relevant in both engines. "any" category targets (leg-wide cards) match within this same range, not literally every number on the board. */
const BOARD_MARK_IN_RANGE = new Set([15, 16, 17, 18, 19, 20]);

/**
 * Does this scored dart match the given Board Mark target?
 *
 * - "number" (a bed, e.g. 20) matches any multiplier on that segment: S20/D20/T20.
 *   value: "any" matches any number bed 15-20 (but never bull).
 * - "treble" matches only that exact treble (multiplier 3 on that segment).
 *   value: "any" matches any treble 15-20 (leg-wide rule-benders).
 * - "double" matches only that exact double (multiplier 2 on that segment).
 *   value: "any" matches any double 15-20.
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
      if (dartResult.segment === 25) return false; // bull is never a numbered bed
      if (boardMarkTarget.value === "any") return BOARD_MARK_IN_RANGE.has(dartResult.segment);
      return typeof boardMarkTarget.value === "number" && dartResult.segment === boardMarkTarget.value;

    case "treble":
      if (dartResult.multiplier !== 3) return false;
      if (boardMarkTarget.value === "any") return BOARD_MARK_IN_RANGE.has(dartResult.segment);
      return typeof boardMarkTarget.value === "number" && dartResult.segment === boardMarkTarget.value;

    case "double":
      if (dartResult.multiplier !== 2 || dartResult.segment === 25) return false; // bullseye isn't a "double" for this purpose — use type "bull" for that
      if (boardMarkTarget.value === "any") return BOARD_MARK_IN_RANGE.has(dartResult.segment);
      return typeof boardMarkTarget.value === "number" && dartResult.segment === boardMarkTarget.value;

    default:
      return false;
  }
}
