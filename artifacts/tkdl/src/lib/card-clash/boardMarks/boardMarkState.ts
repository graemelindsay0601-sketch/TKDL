/**
 * Board Marks v1 — state helpers.
 *
 * Small, dependency-free helpers for working with an activeBoardMarks array.
 * Deliberately kept trivial — placement conflict logic lives in
 * boardMarkConflicts.ts, and duration expiry lives in boardMarkLifecycle.ts.
 */

import type { BoardMark } from "./boardMarkTypes";

/** Safe default for state that hasn't been initialized yet. */
export function emptyBoardMarks(): BoardMark[] {
  return [];
}

/** Generates a Board Mark id. Uses crypto.randomUUID where available (all modern browsers + Node 19+). */
export function generateBoardMarkId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for any environment without crypto.randomUUID
  return `mark_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function findBoardMarksOnTarget(marks: BoardMark[], targetType: BoardMark["target"]["type"], targetValue: BoardMark["target"]["value"]): BoardMark[] {
  return marks.filter((m) => m.target.type === targetType && m.target.value === targetValue);
}

export function removeBoardMark(marks: BoardMark[], markId: string): BoardMark[] {
  return marks.filter((m) => m.id !== markId);
}

export function removeBoardMarks(marks: BoardMark[], markIds: string[]): BoardMark[] {
  if (markIds.length === 0) return marks;
  const idSet = new Set(markIds);
  return marks.filter((m) => !idSet.has(m.id));
}

export function addBoardMark(marks: BoardMark[], mark: BoardMark): BoardMark[] {
  return [...marks, mark];
}
