/**
 * Board Marks v1 — core types.
 *
 * Board Marks are temporary tactical states placed onto dartboard targets by
 * Chaos Lab cards. They affect only the Card Clash effect layer — never
 * normal darts scoring, bust rules, checkout rules, or Cricket mark/point
 * logic. See artifacts/tkdl/docs/card-clash-board-marks-v1.md for the full
 * design spec this module implements.
 */

export type BoardMarkType = "hot" | "cold" | "trap" | "shield";

export type BoardMarkTargetType = "number" | "double" | "treble" | "bull";

export type BoardMarkDuration =
  | "until_hit"
  | "until_visit_end"
  | "until_owner_next_visit_end"
  | "until_affected_player_visit_end";

export type BoardMarkAppliesTo = "self" | "opponent" | "both" | "neutral";

export interface BoardMarkTarget {
  type: BoardMarkTargetType;
  /** Segment number (1-20) for number/double/treble targets. Omit (or "bull") for bull targets. */
  value?: number | "bull";
}

export interface BoardMark {
  id: string;
  type: BoardMarkType;
  target: BoardMarkTarget;
  ownerPlayerId: string;
  affectedPlayerId?: string;
  appliesTo: BoardMarkAppliesTo;
  duration: BoardMarkDuration;
  createdByCardId?: string;
  createdAtVisitId?: string;
  createdAtTurnId?: string;
  allowReplace?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * The minimal shape Board Marks needs from a scored dart. Kept independent
 * of TKDL's own `Dart` type (segment/multiplier/value/label) so this module
 * has no import-time dependency on the scorer — see boardMarkTargets.ts for
 * the adapter that converts one into the other.
 */
export interface BoardMarkDartResult {
  /** 1-20 for a numbered segment, 25 for bull (any multiplier). */
  segment: number;
  multiplier: 1 | 2 | 3;
  /** The player who threw this dart. */
  throwingPlayerId: string;
}

export type BoardMarkEvent =
  | { type: "board_mark_placed"; markId: string; mark: BoardMark }
  | { type: "board_mark_hot_triggered"; markId: string; triggeredByPlayerId: string; dartResult: BoardMarkDartResult }
  | { type: "card_clash_trigger_blocked_by_cold_mark"; markId: string; target: BoardMarkTarget; dartResult: BoardMarkDartResult }
  | { type: "card_clash_trigger_cancelled_by_trap_mark"; markId: string; target: BoardMarkTarget; triggeredByPlayerId: string; dartResult: BoardMarkDartResult }
  | { type: "board_mark_blocked_by_shield"; attemptedMark: BoardMark; shieldMark: BoardMark }
  | { type: "board_mark_expired"; markId: string; mark: BoardMark };

export type BoardMarkPlacementResult =
  | {
      ok: true;
      marks: BoardMark[];
      placedMark: BoardMark;
    }
  | {
      ok: false;
      reason:
        | "target_already_marked"
        | "blocked_by_shield"
        | "negative_mark_conflict"
        | "stacking_not_allowed";
      existingMark?: BoardMark;
    };

export interface BoardMarkResolveResult<TScoringPayload = unknown> {
  marks: BoardMark[];
  events: BoardMarkEvent[];
  blockCardClashTriggers?: boolean;
  cancelCardClashTriggers?: boolean;
  /** Always the same reference/value that was passed in — Board Marks never touch scoring. */
  scoringPayload?: TScoringPayload;
}
