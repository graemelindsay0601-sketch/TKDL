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
// Wall-clock-synchronized playhead — real user feedback: "if I started
// watching the show right now and someone else started it in 5 mins, we'd
// both be at the same part, same as how a live TV show actually works."
//
// This used to be a per-client chained-setTimeout state machine (a
// PlayerState advanced one dialogue turn/segment at a time by
// advancePlayerState() below, each call scheduled by BroadcastPlayer.tsx's
// own setTimeout) — every browser tab paced itself independently starting
// from whenever IT happened to mount, so two people watching the same
// Edition were never actually watching the same instant, and anything that
// could pause or drift one tab's own timers (a backgrounded tab throttling
// them, or a phone fully reloading the page — see BroadcastPlayer.tsx's own
// former resume-point mitigation, superseded by this) only pulled that
// viewer further from everyone else's.
//
// `computeTimedPosition` below replaces that with a pure function of two
// inputs every viewer already shares: this Edition's own `generatedAt`
// timestamp (identical for everyone watching it) and `Date.now()`. Two tabs
// opened minutes apart compute the exact same segment/turn from the exact
// same formula — no per-tab state to advance, drift, or lose on a reload.
// advancePlayerState/PlayerState/PlayerPhase (the old discrete machine) are
// gone rather than kept alongside this as dead code, matching this file's
// own established precedent (kit.tsx's removed v1 skin, same reasoning).
// ═══════════════════════════════════════════════════════════════════════

/** The fixed beat between one segment ending and the next starting — previously TRANSITION's own hard-coded `setTimeout(..., 500)` in BroadcastPlayer.tsx, folded in here so the shared clock accounts for it too. */
export const TRANSITION_HOLD_MS = 500;

export type TimedPosition =
  | { kind: "segment"; segmentIndex: number; turnIndex: number }
  /** The trailing beat after `segmentIndex` finishes and before the next playable segment starts — the moment BroadcastPlayer.tsx should keep showing that segment's own last turn (nothing new to show yet) and treat as a `segment_boundary` for overlay purposes. */
  | { kind: "transition"; segmentIndex: number };

/**
 * This Edition's own total on-screen runtime — every playable segment's
 * dialogue plus its trailing transition beat, invalidated (11.6) segments
 * skipped entirely. Once elapsed time since the Edition started reaches
 * this, the prepared programme has played out in full; the caller wraps
 * `elapsedMs` back into [0, this) to loop the same Edition (still perfectly
 * in sync — every viewer wraps at the identical instant) while it asks for
 * whatever Edition is current now, mirroring the old advancePlayerState's
 * own TRANSITION -> LOAD_EDITION rule. Zero when nothing is playable at all
 * (an empty programme, or every segment invalidated).
 */
export function totalPlayableDurationMs(playlist: readonly Segment[], invalidSegmentIds: ReadonlySet<string>): number {
  let total = 0;
  for (const segment of playlist) {
    if (invalidSegmentIds.has(segment.id)) continue;
    total += segmentDurationMs(segment.dialogue) + TRANSITION_HOLD_MS;
  }
  return total;
}

/**
 * Where the shared clock says playback is right now, `elapsedMs` after the
 * programme's own start — a pure function of the programme data and a
 * clock reading, so any two callers with the same inputs get the identical
 * answer. `elapsedMs` is assumed already wrapped into [0,
 * totalPlayableDurationMs(...)) by the caller; this returns null only for
 * the degenerate case of nothing playable to show (an empty playlist, or
 * every segment invalidated — `totalPlayableDurationMs` would be 0 too).
 *
 * A segment invalidated (11.6) after some viewers have already played
 * through it, in wall-clock terms, still simply isn't in this walk — every
 * CURRENT viewer's timeline shifts uniformly to skip it, the same as a real
 * broadcast schedule adjusting for a story getting pulled, rather than only
 * affecting whoever's local state hadn't reached it yet (the old model's
 * own, weaker, per-client version of the same idea).
 */
export function computeTimedPosition(playlist: readonly Segment[], invalidSegmentIds: ReadonlySet<string>, elapsedMs: number): TimedPosition | null {
  let cursor = 0;
  for (let i = 0; i < playlist.length; i++) {
    const segment = playlist[i];
    if (invalidSegmentIds.has(segment.id)) continue;

    const dialogueMs = segmentDurationMs(segment.dialogue);
    if (elapsedMs < cursor + dialogueMs) {
      const offset = elapsedMs - cursor;
      const schedule = scheduleDialogueTurns(segment.dialogue);
      const turn = schedule.find(t => offset < t.endMs) ?? schedule[schedule.length - 1];
      return { kind: "segment", segmentIndex: i, turnIndex: turn?.turnIndex ?? 0 };
    }
    cursor += dialogueMs;

    if (elapsedMs < cursor + TRANSITION_HOLD_MS) {
      return { kind: "transition", segmentIndex: i };
    }
    cursor += TRANSITION_HOLD_MS;
  }
  return null;
}
