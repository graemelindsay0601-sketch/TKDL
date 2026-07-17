/**
 * Board Marks — special-case card logic (Sabotage, Match Swing).
 *
 * These two families don't fit the normal "place a mark, resolve on hit"
 * model — Sabotage removes existing marks instead of placing one, and
 * Match Swing reads live match state and resolves immediately on draw.
 * Both are pure functions (no state access) so they can live here and be
 * unit tested directly, rather than only living inside scorers.tsx where
 * they'd be unverified beyond "it compiles". scorers.tsx calls these and
 * handles the actual React state mutation (setActiveBoardMarks, setLegWins,
 * etc.) itself.
 */

import type { BoardMark } from "./boardMarkTypes";

/**
 * Sabotage: removes the opponent's active mark(s) instead of placing a new
 * one. Returns how many were removed so the caller can fall back to
 * placing a default mark if none existed — never a dead draw.
 */
export function applyBoardMarkSabotage(
  activeMarks: BoardMark[],
  kind: "erase" | "purge",
  opponentPlayerId: string
): { marks: BoardMark[]; removedCount: number } {
  const opponentMarks = activeMarks.filter(m => m.ownerPlayerId === opponentPlayerId);
  if (opponentMarks.length === 0) return { marks: activeMarks, removedCount: 0 };
  if (kind === "erase") {
    const target = opponentMarks[Math.floor(Math.random() * opponentMarks.length)];
    return { marks: activeMarks.filter(m => m.id !== target.id), removedCount: 1 };
  }
  const idsToRemove = new Set(opponentMarks.map(m => m.id));
  return { marks: activeMarks.filter(m => !idsToRemove.has(m.id)), removedCount: opponentMarks.length };
}

export type MatchSwingKind = "overtake" | "underdogs_grace" | "set_point";

/**
 * Match Swing: reads live match standing and decides whether to grant/
 * remove a leg outright. `standing` should be legWins for Legs format, or
 * overall sets won for Overtake/Underdog's Grace in Sets format, and the
 * CURRENT set's legWins specifically for Set Point (which operates at set
 * granularity, not whole-match). The caller passes whichever is correct
 * for the format — this function is purely the condition/outcome logic,
 * no state access.
 */
export function computeMatchSwingOutcome(
  kind: MatchSwingKind,
  drawingPlayer: 0 | 1,
  standing: [number, number]
): { conditionMet: boolean; delta: [number, number] } {
  const opp: 0 | 1 = drawingPlayer === 0 ? 1 : 0;
  if (kind === "overtake") {
    if (standing[opp] - standing[drawingPlayer] >= 2) {
      const delta: [number, number] = [0, 0];
      delta[opp] = -1;
      return { conditionMet: true, delta };
    }
  } else if (kind === "underdogs_grace") {
    if (standing[drawingPlayer] - standing[opp] <= -2) {
      const delta: [number, number] = [0, 0];
      delta[drawingPlayer] = 1;
      return { conditionMet: true, delta };
    }
  } else if (kind === "set_point") {
    if (Math.abs(standing[0] - standing[1]) === 1) {
      const delta: [number, number] = [0, 0];
      delta[opp] = -1; // always benefits the drawer — takes a leg from their opponent when the set is tight
      return { conditionMet: true, delta };
    }
  }
  return { conditionMet: false, delta: [0, 0] };
}
