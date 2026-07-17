/**
 * Board Marks v1 — lifecycle.
 *
 * Handles Board Mark expiry. Hot and Trap are consumed on trigger (handled
 * by boardMarkResolver.ts as part of resolving a dart hit); this module
 * covers everything duration-based: visit-end expiry for all four types.
 *
 * Deterministic-approximation note (per design spec section 8): this app
 * doesn't have a first-class "visit id" concept threaded everywhere yet, so
 * "next visit" is approximated using the BoardMark's own createdAtVisitId —
 * a mark never expires on the very same visit it was created during, only
 * on a later one belonging to the relevant player. That's the safest
 * approximation available without deeper scorer changes, and matches every
 * example in the spec (e.g. a Shield placed mid-visit must survive past the
 * owner's own visit-end and expire on their *next* one, not immediately).
 */

import type { BoardMark, BoardMarkDuration } from "./boardMarkTypes";
import { removeBoardMarks } from "./boardMarkState";

export interface VisitEndContext {
  /** Id of the visit that just ended. */
  visitId: string;
  /** The player whose visit just ended. */
  visitPlayerId: string;
}

const EXPIRES_ON_ANY_VISIT_END: BoardMarkDuration[] = ["until_visit_end"];

function isDifferentVisitFromCreation(mark: BoardMark, context: VisitEndContext): boolean {
  // If the mark has no createdAtVisitId recorded, err on the side of allowing
  // expiry rather than a mark lingering forever.
  return !mark.createdAtVisitId || mark.createdAtVisitId !== context.visitId;
}

/** Remove marks whose duration means they expire at the end of the visit that just ended. */
export function expireBoardMarksForVisitEnd(activeMarks: BoardMark[], context: VisitEndContext): BoardMark[] {
  const toRemove: string[] = [];

  for (const mark of activeMarks) {
    if (EXPIRES_ON_ANY_VISIT_END.includes(mark.duration)) {
      toRemove.push(mark.id);
      continue;
    }

    if (
      mark.duration === "until_owner_next_visit_end" &&
      context.visitPlayerId === mark.ownerPlayerId &&
      isDifferentVisitFromCreation(mark, context)
    ) {
      toRemove.push(mark.id);
      continue;
    }

    if (
      mark.duration === "until_affected_player_visit_end" &&
      mark.affectedPlayerId !== undefined &&
      context.visitPlayerId === mark.affectedPlayerId &&
      isDifferentVisitFromCreation(mark, context)
    ) {
      toRemove.push(mark.id);
      continue;
    }
    // "until_hit" marks are left alone here — they only expire via
    // expireBoardMarksForDartHit / the resolver, not at visit end.
  }

  return removeBoardMarks(activeMarks, toRemove);
}

/**
 * Remove "until_hit" marks that were just triggered by a dart. Pass the mark
 * ids the resolver reported as triggered this dart (Hot/Trap only — Cold and
 * Shield are never removed this way).
 */
export function expireBoardMarksForDartHit(activeMarks: BoardMark[], context: { hitMarkIds: string[] }): BoardMark[] {
  const toRemove = activeMarks
    .filter((m) => context.hitMarkIds.includes(m.id) && m.duration === "until_hit")
    .map((m) => m.id);
  return removeBoardMarks(activeMarks, toRemove);
}

/**
 * Remove every "until_leg_end" mark — called specifically at an actual leg
 * transition (not a regular visit-to-visit transition), clearing leg-wide
 * rule-benders like "every treble is Cold this leg" once the leg is over.
 */
export function expireBoardMarksForLegEnd(activeMarks: BoardMark[]): BoardMark[] {
  const toRemove = activeMarks.filter((m) => m.duration === "until_leg_end").map((m) => m.id);
  return removeBoardMarks(activeMarks, toRemove);
}
