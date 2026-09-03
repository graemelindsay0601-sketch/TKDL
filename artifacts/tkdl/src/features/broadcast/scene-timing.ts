// TKDL LIVE — the player's scene state machine, pure logic half (handover
// doc 15.4: BOOT -> LOAD CURRENT EDITION -> PLAY SEGMENT -> PLAY DIALOGUE
// TURNS -> TRANSITION, looping to the next segment; poll LIVE every ~30s;
// queue JUST_IN/BREAKING inserts for the next SAFE boundary; skip a segment
// if its id becomes invalid).
//
// Deliberately has ZERO React/DOM/timer dependency — every function here
// takes plain data (segments, a clock reading, a queue) and returns a new
// plain value. BroadcastPlayer.tsx (paused — see this feature folder's own
// README note below) is what will actually wire these into React state and
// real setTimeout/rAF calls; keeping the decision logic itself framework-
// free is what makes it something a plain `node --test` file can exercise
// directly (src/lib/__tests__/scene-timing.test.ts), matching this repo's
// own existing convention for pure logic (see the api-server's own
// story-engine-math.ts-style split, which this mirrors on the frontend
// side of the same feature).
import type { DialogueTurn, LiveOverlayItem, Segment } from "./types";

// ═══════════════════════════════════════════════════════════════════════
// Playlist — which segment plays next, honouring 11.6 invalidation
// ═══════════════════════════════════════════════════════════════════════

/**
 * The next segment index at or after `fromIndex` whose id is NOT in
 * `invalidSegmentIds` — 15.4's own "Skip segment if its ID becomes
 * invalid." Returns -1 once the whole programme has been exhausted (the
 * player should then either loop back to segment 0 or re-fetch the current
 * Edition, a decision BroadcastPlayer.tsx makes, not this pure function).
 */
export function nextPlayableSegmentIndex(segments: readonly Segment[], invalidSegmentIds: ReadonlySet<string>, fromIndex: number): number {
  for (let i = fromIndex; i < segments.length; i++) {
    if (!invalidSegmentIds.has(segments[i].id)) return i;
  }
  return -1;
}

// ═══════════════════════════════════════════════════════════════════════
// Dialogue turn scheduling — 12.6's own reading pace, already baked into
// each turn's holdSeconds by the backend; this just lays turns out on a
// timeline so the player knows when to advance.
// ═══════════════════════════════════════════════════════════════════════

export type ScheduledTurn = { turnIndex: number; turn: DialogueTurn; startMs: number; endMs: number };

/** Cumulative timeline for one segment's dialogue, in milliseconds from the segment's own start. */
export function scheduleDialogueTurns(dialogue: readonly DialogueTurn[]): ScheduledTurn[] {
  let cursor = 0;
  return dialogue.map((turn, turnIndex) => {
    const startMs = cursor;
    const endMs = cursor + turn.holdSeconds * 1000;
    cursor = endMs;
    return { turnIndex, turn, startMs, endMs };
  });
}

/** Total real time (ms) this segment will occupy — the same number api-shapes.ts's own `estimatedSeconds` reports, recomputed here from the turns actually being played (post-invalidation) rather than trusted blindly from the payload. */
export function segmentDurationMs(dialogue: readonly DialogueTurn[]): number {
  return dialogue.reduce((total, turn) => total + turn.holdSeconds * 1000, 0);
}

// ═══════════════════════════════════════════════════════════════════════
// 11.4 live-insert boundaries — WHEN a JUST_IN/BREAKING overlay may safely
// interrupt the prepared programme
// ═══════════════════════════════════════════════════════════════════════

export type PlayheadPosition =
  /** Between two segments — the only boundary JUST_IN may use. */
  | { kind: "segment_boundary" }
  /** Between two dialogue turns within a segment, or at a segment boundary — the wider set BREAKING may use ("insert between turns/segments; never cut a dialogue card mid-read"). */
  | { kind: "turn_boundary" }
  /** Mid-read of a single dialogue card — no overlay of either class may interrupt here. */
  | { kind: "mid_turn" };

export function canInsertOverlayAt(overlayClass: LiveOverlayItem["overlayClass"], position: PlayheadPosition): boolean {
  if (position.kind === "mid_turn") return false;
  if (overlayClass === "just_in") return position.kind === "segment_boundary";
  return true; // "breaking" accepts either a turn_boundary or a segment_boundary
}

// ═══════════════════════════════════════════════════════════════════════
// Overlay queue — de-duplicated, priority-ordered (BREAKING jumps ahead of
// any already-queued JUST_IN, since it's the more urgent class), and
// filtered against "already seen" ids so a returning viewer isn't shown the
// same event twice within one browser session (11.5: "The browser stores
// seen live event IDs for the current session").
// ═══════════════════════════════════════════════════════════════════════

const OVERLAY_CLASS_PRIORITY: Record<LiveOverlayItem["overlayClass"], number> = { breaking: 0, just_in: 1 };

/** Drops overlays whose storyId is already in `seenStoryIds` — call this against the raw payload before ever queuing anything, so a seen id can never re-enter the queue. */
export function filterUnseenOverlays(overlays: readonly LiveOverlayItem[], seenStoryIds: ReadonlySet<number>): LiveOverlayItem[] {
  return overlays.filter(o => !seenStoryIds.has(o.storyId));
}

/**
 * Merges freshly-seen overlays into an existing queue: de-duplicates by
 * storyId (an overlay already queued is never queued twice, even if the
 * live poll keeps returning it every 30s while it's still within its
 * 10-minute age window), then sorts BREAKING-before-JUST_IN so a more
 * urgent event queue-jumps anything less urgent still waiting — but never
 * reorders two overlays of the SAME class relative to each other (stable
 * sort), so same-class events still play in the order they were noticed.
 */
export function mergeOverlayQueue(existingQueue: readonly LiveOverlayItem[], freshOverlays: readonly LiveOverlayItem[]): LiveOverlayItem[] {
  const byStoryId = new Map<number, LiveOverlayItem>();
  for (const overlay of existingQueue) byStoryId.set(overlay.storyId, overlay);
  for (const overlay of freshOverlays) if (!byStoryId.has(overlay.storyId)) byStoryId.set(overlay.storyId, overlay);

  return [...byStoryId.values()]
    .map((overlay, originalIndex) => ({ overlay, originalIndex }))
    .sort((a, b) => (OVERLAY_CLASS_PRIORITY[a.overlay.overlayClass] - OVERLAY_CLASS_PRIORITY[b.overlay.overlayClass]) || (a.originalIndex - b.originalIndex))
    .map(({ overlay }) => overlay);
}

/** Pops the next overlay the current playhead position allows inserting right now, leaving the rest of the queue untouched — or null if nothing queued may play yet. */
export function popReadyOverlay(queue: readonly LiveOverlayItem[], position: PlayheadPosition): { overlay: LiveOverlayItem; remainingQueue: LiveOverlayItem[] } | null {
  const index = queue.findIndex(o => canInsertOverlayAt(o.overlayClass, position));
  if (index === -1) return null;
  const overlay = queue[index];
  const remainingQueue = [...queue.slice(0, index), ...queue.slice(index + 1)];
  return { overlay, remainingQueue };
}

// ═══════════════════════════════════════════════════════════════════════
// Player state machine — the shape BroadcastPlayer.tsx (once built) drives;
// defined here so its transition RULES are pure and testable even though
// nothing yet renders them.
// ═══════════════════════════════════════════════════════════════════════

export type PlayerPhase = "BOOT" | "LOAD_EDITION" | "PLAY_SEGMENT" | "PLAY_DIALOGUE_TURN" | "TRANSITION" | "LIVE_INSERT";

export type PlayerState = {
  phase: PlayerPhase;
  segmentIndex: number;
  turnIndex: number;
};

export const INITIAL_PLAYER_STATE: PlayerState = { phase: "BOOT", segmentIndex: 0, turnIndex: 0 };

/**
 * One legal transition. Deliberately a plain data function (no side
 * effects, no timers) — advances by exactly one dialogue turn, rolling over
 * into TRANSITION once a segment's turns are exhausted, and back into
 * PLAY_SEGMENT for the next playable segment once a transition completes.
 * `totalTurnsInCurrentSegment` and `hasMorePlayableSegments` are supplied
 * by the caller (which knows the actual programme) rather than looked up
 * here, keeping this function's own signature framework- and data-shape-
 * agnostic.
 */
export function advancePlayerState(
  state: PlayerState,
  input: { totalTurnsInCurrentSegment: number; hasMorePlayableSegments: boolean },
): PlayerState {
  switch (state.phase) {
    case "BOOT":
      return { phase: "LOAD_EDITION", segmentIndex: 0, turnIndex: 0 };
    case "LOAD_EDITION":
      return { phase: "PLAY_SEGMENT", segmentIndex: state.segmentIndex, turnIndex: 0 };
    case "PLAY_SEGMENT":
      return { phase: "PLAY_DIALOGUE_TURN", segmentIndex: state.segmentIndex, turnIndex: 0 };
    case "PLAY_DIALOGUE_TURN": {
      const nextTurn = state.turnIndex + 1;
      if (nextTurn < input.totalTurnsInCurrentSegment) {
        return { phase: "PLAY_DIALOGUE_TURN", segmentIndex: state.segmentIndex, turnIndex: nextTurn };
      }
      return { phase: "TRANSITION", segmentIndex: state.segmentIndex, turnIndex: state.turnIndex };
    }
    case "TRANSITION":
      return input.hasMorePlayableSegments
        ? { phase: "PLAY_SEGMENT", segmentIndex: state.segmentIndex + 1, turnIndex: 0 }
        : { phase: "LOAD_EDITION", segmentIndex: 0, turnIndex: 0 }; // programme exhausted — re-fetch/loop
    case "LIVE_INSERT":
      // A LIVE_INSERT is entered/exited explicitly by the caller around a
      // TRANSITION or turn boundary (it isn't part of the normal segment/
      // turn cycle), so advancing it just resumes exactly where playback
      // was before the insert.
      return { phase: "PLAY_SEGMENT", segmentIndex: state.segmentIndex, turnIndex: state.turnIndex };
  }
}
