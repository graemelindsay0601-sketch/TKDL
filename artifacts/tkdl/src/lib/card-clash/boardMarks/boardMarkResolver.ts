/**
 * Board Marks v1 — resolver.
 *
 * Runs AFTER a dart has already been scored normally. Checks active marks
 * against the dart result and reports what the Card Clash effect layer
 * should do (block/cancel a trigger) — it never touches scoring itself.
 * `scoringPayload` is always passed straight through unchanged; see the
 * scoring-safety tests for the guarantee this module makes.
 *
 * Shield marks are placement-time-only protection (see boardMarkConflicts.ts)
 * and are never resolved here — they don't "trigger" on a dart hit.
 */

import type { BoardMark, BoardMarkDartResult, BoardMarkEvent, BoardMarkResolveResult } from "./boardMarkTypes";
import { doesDartMatchBoardMarkTarget } from "./boardMarkMatcher";
import { removeBoardMarks } from "./boardMarkState";

export interface ResolveBoardMarksContext<TScoringPayload = unknown> {
  dartResult: BoardMarkDartResult;
  scoringPayload?: TScoringPayload;
}

/** Is this player eligible to trigger/be affected by this mark, per its appliesTo? */
function isPlayerEligible(mark: BoardMark, playerId: string): boolean {
  switch (mark.appliesTo) {
    case "neutral":
    case "both":
      return true;
    case "self":
      return playerId === mark.ownerPlayerId;
    case "opponent":
      return playerId === mark.affectedPlayerId;
    default:
      return false;
  }
}

export function resolveBoardMarksForDart<TScoringPayload = unknown>(
  activeMarks: BoardMark[],
  context: ResolveBoardMarksContext<TScoringPayload>
): BoardMarkResolveResult<TScoringPayload> {
  const { dartResult, scoringPayload } = context;
  const events: BoardMarkEvent[] = [];
  const toRemove: string[] = [];
  let blockCardClashTriggers = false;
  let cancelCardClashTriggers = false;

  for (const mark of activeMarks) {
    if (mark.type === "shield") continue; // placement-time protection only, never resolves on a hit
    if (!doesDartMatchBoardMarkTarget(dartResult, mark.target)) continue;
    if (!isPlayerEligible(mark, dartResult.throwingPlayerId)) continue;

    switch (mark.type) {
      case "hot":
        events.push({
          type: "board_mark_hot_triggered",
          markId: mark.id,
          triggeredByPlayerId: dartResult.throwingPlayerId,
          dartResult,
        });
        toRemove.push(mark.id); // Hot is removed after triggering
        break;

      case "cold":
        blockCardClashTriggers = true;
        events.push({
          type: "card_clash_trigger_blocked_by_cold_mark",
          markId: mark.id,
          target: mark.target,
          dartResult,
        });
        // Cold persists until the affected player's visit ends (lifecycle), not removed on hit
        break;

      case "trap":
        cancelCardClashTriggers = true;
        events.push({
          type: "card_clash_trigger_cancelled_by_trap_mark",
          markId: mark.id,
          target: mark.target,
          triggeredByPlayerId: dartResult.throwingPlayerId,
          dartResult,
        });
        toRemove.push(mark.id); // Trap is removed after triggering
        break;
    }
  }

  const marks = toRemove.length > 0 ? removeBoardMarks(activeMarks, toRemove) : activeMarks;

  return {
    marks,
    events,
    blockCardClashTriggers,
    cancelCardClashTriggers,
    scoringPayload,
  };
}
