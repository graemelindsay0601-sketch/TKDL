/**
 * Board Marks v1 — conflicts.
 *
 * All placement conflict handling lives here, centrally — individual cards
 * never implement their own conflict logic. See section 9 of the design
 * spec for the full rule list this implements.
 */

import type { BoardMark, BoardMarkPlacementResult } from "./boardMarkTypes";
import { isSameBoardMarkTarget } from "./boardMarkTargets";

export interface PlaceBoardMarkContext {
  // Reserved for future context (e.g. current visit/turn id) — unused in v1,
  // conflict resolution only needs the active marks list and the new mark.
}

function removeMarkById(marks: BoardMark[], markId: string): BoardMark[] {
  return marks.filter((m) => m.id !== markId);
}

/**
 * Attempt to place a new Board Mark against the currently active marks.
 *
 * Rules (in order):
 * 1. An enemy Shield on the same target blocks Cold/Trap placement outright —
 *    this cannot be bypassed by allowReplace, since that's the entire point
 *    of a defensive Shield. Shield never blocks Hot.
 * 2. Cold and Trap cannot coexist on the same target (either order). If the
 *    new mark has allowReplace: true, the conflicting mark is replaced;
 *    otherwise placement is rejected.
 * 3. Marks don't stack — two marks of the same type can't sit on the same
 *    target. Same allowReplace behavior as above.
 * 4. Otherwise, placement succeeds. Different, non-conflicting mark types
 *    (e.g. Hot + Shield) are explicitly allowed to coexist on one target.
 */
export function placeBoardMark(
  activeMarks: BoardMark[],
  newMark: BoardMark,
  _context: PlaceBoardMarkContext = {}
): BoardMarkPlacementResult {
  const sameTarget = activeMarks.filter((m) => isSameBoardMarkTarget(m.target, newMark.target));

  // 1. Shield blocks enemy Cold/Trap (never blocks Hot, never bypassable via allowReplace)
  if (newMark.type === "cold" || newMark.type === "trap") {
    const enemyShield = sameTarget.find(
      (m) => m.type === "shield" && m.ownerPlayerId !== newMark.ownerPlayerId
    );
    if (enemyShield) {
      return { ok: false, reason: "blocked_by_shield", existingMark: enemyShield };
    }
  }

  // 2. Cold and Trap cannot coexist on the same target
  if (newMark.type === "cold" || newMark.type === "trap") {
    const opposingType = newMark.type === "cold" ? "trap" : "cold";
    const conflicting = sameTarget.find((m) => m.type === opposingType);
    if (conflicting) {
      if (newMark.allowReplace) {
        return {
          ok: true,
          marks: [...removeMarkById(activeMarks, conflicting.id), newMark],
          placedMark: newMark,
        };
      }
      return { ok: false, reason: "negative_mark_conflict", existingMark: conflicting };
    }
  }

  // 3. No stacking — same type can't sit on the same target twice
  const sameType = sameTarget.find((m) => m.type === newMark.type);
  if (sameType) {
    if (newMark.allowReplace) {
      return {
        ok: true,
        marks: [...removeMarkById(activeMarks, sameType.id), newMark],
        placedMark: newMark,
      };
    }
    return { ok: false, reason: "stacking_not_allowed", existingMark: sameType };
  }

  // 4. Success — coexists fine with any other non-conflicting mark already on this target
  return { ok: true, marks: [...activeMarks, newMark], placedMark: newMark };
}
