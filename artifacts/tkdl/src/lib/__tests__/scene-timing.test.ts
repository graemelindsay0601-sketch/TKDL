import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  nextPlayableSegmentIndex, scheduleDialogueTurns, segmentDurationMs,
  canInsertOverlayAt, filterUnseenOverlays, mergeOverlayQueue, popReadyOverlay,
  totalPlayableDurationMs, computeTimedPosition, TRANSITION_HOLD_MS, buildPlaylist,
} from "../../features/broadcast/scene-timing.ts";
import type { DialogueTurn, LiveOverlayItem, Segment } from "../../features/broadcast/types.ts";

function segment(id: string, overrides: Partial<Segment> = {}): Segment {
  return {
    id, type: "UPSET", leagueType: "singles", storyId: 1, importance: "major", scene: "desk",
    dialogue: [{ speaker: "A", text: "x", holdSeconds: 3 }], graphic: null, validityRules: [], estimatedSeconds: 3,
    ...overrides,
  };
}

describe("buildPlaylist", () => {
  test("opens first and removes headline repetitions of body topics", () => {
    const opening = segment("slot-1", { type: "opening", storyId: null });
    const mainStory = segment("slot-3", { type: "UPSET" });
    const closing = segment("slot-11", { type: "closing", storyId: null });
    const headline1 = segment("slot-2a", { type: "headline_ticker", storyId: 1 });
    const headline2 = segment("slot-2b", { type: "headline_ticker", storyId: 2 });

    const playlist = buildPlaylist([headline1, headline2], [opening, mainStory, closing]);

    assert.deepEqual(playlist.map(s => s.id), ["slot-1", "slot-2b", "slot-3", "slot-11"]);
  });

  test("an older cached Edition with no opening still removes a repeated headline", () => {
    const mainStory = segment("slot-2");
    const closing = segment("slot-10", { type: "closing", storyId: null });
    const headline1 = segment("slot-1a", { type: "headline_ticker" });

    const playlist = buildPlaylist([headline1], [mainStory, closing]);

    assert.deepEqual(playlist.map(s => s.id), ["slot-2", "slot-10"]);
  });

  test("no headlines at all still puts opening first", () => {
    const opening = segment("slot-1", { type: "opening", storyId: null });
    const mainStory = segment("slot-3");

    assert.deepEqual(buildPlaylist([], [opening, mainStory]).map(s => s.id), ["slot-1", "slot-3"]);
  });
});

function overlay(storyId: number, overlayClass: LiveOverlayItem["overlayClass"]): LiveOverlayItem {
  return { storyId, leagueType: "singles", storyType: "UPSET", subjectKeys: ["p1"], score: 80, overlayClass };
}

describe("nextPlayableSegmentIndex", () => {
  test("returns fromIndex when it is already playable", () => {
    const segments = [segment("slot-1"), segment("slot-2")];
    assert.equal(nextPlayableSegmentIndex(segments, new Set(), 0), 0);
  });

  test("skips invalidated segments", () => {
    const segments = [segment("slot-1"), segment("slot-2"), segment("slot-3")];
    assert.equal(nextPlayableSegmentIndex(segments, new Set(["slot-1", "slot-2"]), 0), 2);
  });

  test("returns -1 once the programme is exhausted", () => {
    const segments = [segment("slot-1")];
    assert.equal(nextPlayableSegmentIndex(segments, new Set(["slot-1"]), 0), -1);
  });
});

describe("scheduleDialogueTurns / segmentDurationMs", () => {
  const dialogue: DialogueTurn[] = [{ speaker: "A", text: "a", holdSeconds: 3 }, { speaker: "B", text: "b", holdSeconds: 4 }];

  test("turns lay out back to back with no gaps", () => {
    const schedule = scheduleDialogueTurns(dialogue);
    assert.deepEqual(schedule[0], { turnIndex: 0, turn: dialogue[0], startMs: 0, endMs: 3000 });
    assert.deepEqual(schedule[1], { turnIndex: 1, turn: dialogue[1], startMs: 3000, endMs: 7000 });
  });

  test("total duration is the sum of every turn's hold time", () => {
    assert.equal(segmentDurationMs(dialogue), 7000);
  });

  test("empty dialogue has zero duration and an empty schedule", () => {
    assert.deepEqual(scheduleDialogueTurns([]), []);
    assert.equal(segmentDurationMs([]), 0);
  });
});

describe("canInsertOverlayAt", () => {
  test("nothing may interrupt mid-turn", () => {
    assert.equal(canInsertOverlayAt("just_in", { kind: "mid_turn" }), false);
    assert.equal(canInsertOverlayAt("breaking", { kind: "mid_turn" }), false);
  });

  test("JUST_IN only fires at a segment boundary", () => {
    assert.equal(canInsertOverlayAt("just_in", { kind: "segment_boundary" }), true);
    assert.equal(canInsertOverlayAt("just_in", { kind: "turn_boundary" }), false);
  });

  test("BREAKING fires at either a turn or segment boundary", () => {
    assert.equal(canInsertOverlayAt("breaking", { kind: "turn_boundary" }), true);
    assert.equal(canInsertOverlayAt("breaking", { kind: "segment_boundary" }), true);
  });
});

describe("filterUnseenOverlays", () => {
  test("drops overlays whose storyId has already been seen", () => {
    const overlays = [overlay(1, "just_in"), overlay(2, "breaking")];
    const result = filterUnseenOverlays(overlays, new Set([1]));
    assert.deepEqual(result.map(o => o.storyId), [2]);
  });
});

describe("mergeOverlayQueue", () => {
  test("de-duplicates by storyId — a re-polled overlay is not queued twice", () => {
    const queue = mergeOverlayQueue([overlay(1, "just_in")], [overlay(1, "just_in"), overlay(2, "just_in")]);
    assert.deepEqual(queue.map(o => o.storyId), [1, 2]);
  });

  test("BREAKING queue-jumps ahead of an already-queued JUST_IN", () => {
    const queue = mergeOverlayQueue([overlay(1, "just_in")], [overlay(2, "breaking")]);
    assert.deepEqual(queue.map(o => [o.storyId, o.overlayClass]), [[2, "breaking"], [1, "just_in"]]);
  });

  test("same-class overlays keep their original relative order (stable sort)", () => {
    const queue = mergeOverlayQueue([], [overlay(1, "just_in"), overlay(2, "just_in"), overlay(3, "just_in")]);
    assert.deepEqual(queue.map(o => o.storyId), [1, 2, 3]);
  });
});

describe("popReadyOverlay", () => {
  test("returns null when nothing in the queue may play at this position", () => {
    const queue = [overlay(1, "just_in")];
    assert.equal(popReadyOverlay(queue, { kind: "mid_turn" }), null);
    assert.equal(popReadyOverlay(queue, { kind: "turn_boundary" }), null); // JUST_IN needs a full segment boundary
  });

  test("pops the first eligible overlay and leaves the rest untouched", () => {
    const queue = [overlay(1, "just_in"), overlay(2, "breaking")];
    // At a turn boundary only the BREAKING one (index 1) is eligible.
    const result = popReadyOverlay(queue, { kind: "turn_boundary" });
    assert.ok(result);
    assert.equal(result!.overlay.storyId, 2);
    assert.deepEqual(result!.remainingQueue.map(o => o.storyId), [1]);
  });
});

function segmentWithDialogue(id: string, dialogue: DialogueTurn[]): Segment {
  return { ...segment(id), dialogue };
}

describe("totalPlayableDurationMs", () => {
  test("sums every playable segment's dialogue plus one transition beat each", () => {
    const playlist = [
      segmentWithDialogue("s1", [{ speaker: "A", text: "a", holdSeconds: 3 }]),
      segmentWithDialogue("s2", [{ speaker: "A", text: "b", holdSeconds: 2 }, { speaker: "B", text: "c", holdSeconds: 4 }]),
    ];
    assert.equal(totalPlayableDurationMs(playlist, new Set()), 3000 + TRANSITION_HOLD_MS + 6000 + TRANSITION_HOLD_MS);
  });

  test("skips invalidated segments entirely, including their transition beat", () => {
    const playlist = [
      segmentWithDialogue("s1", [{ speaker: "A", text: "a", holdSeconds: 3 }]),
      segmentWithDialogue("s2", [{ speaker: "A", text: "b", holdSeconds: 5 }]),
    ];
    assert.equal(totalPlayableDurationMs(playlist, new Set(["s2"])), 3000 + TRANSITION_HOLD_MS);
  });

  test("zero when nothing is playable", () => {
    assert.equal(totalPlayableDurationMs([], new Set()), 0);
    assert.equal(totalPlayableDurationMs([segment("s1")], new Set(["s1"])), 0);
  });
});

describe("computeTimedPosition", () => {
  // Two segments: s1 is a 3s single-turn segment, s2 is two turns (2s, 4s).
  // Timeline: [0,3000) s1 turn0 | [3000,3500) transition | [3500,5500) s2
  // turn0 | [5500,9500) s2 turn1 | [9500,10000) transition | (loops)
  const playlist = [
    segmentWithDialogue("s1", [{ speaker: "A", text: "a", holdSeconds: 3 }]),
    segmentWithDialogue("s2", [{ speaker: "A", text: "b", holdSeconds: 2 }, { speaker: "B", text: "c", holdSeconds: 4 }]),
  ];

  test("lands on the first segment's only turn at the very start", () => {
    assert.deepEqual(computeTimedPosition(playlist, new Set(), 0), { kind: "segment", segmentIndex: 0, turnIndex: 0 });
    assert.deepEqual(computeTimedPosition(playlist, new Set(), 2999), { kind: "segment", segmentIndex: 0, turnIndex: 0 });
  });

  test("the beat right after a segment finishes is a transition, still naming that segment", () => {
    assert.deepEqual(computeTimedPosition(playlist, new Set(), 3000), { kind: "transition", segmentIndex: 0 });
    assert.deepEqual(computeTimedPosition(playlist, new Set(), 3499), { kind: "transition", segmentIndex: 0 });
  });

  test("advances into the next segment's own turns after its transition beat", () => {
    assert.deepEqual(computeTimedPosition(playlist, new Set(), 3500), { kind: "segment", segmentIndex: 1, turnIndex: 0 });
    assert.deepEqual(computeTimedPosition(playlist, new Set(), 5499), { kind: "segment", segmentIndex: 1, turnIndex: 0 });
    assert.deepEqual(computeTimedPosition(playlist, new Set(), 5500), { kind: "segment", segmentIndex: 1, turnIndex: 1 });
    assert.deepEqual(computeTimedPosition(playlist, new Set(), 9499), { kind: "segment", segmentIndex: 1, turnIndex: 1 });
  });

  test("two callers with the same elapsed time get the identical position — the whole point", () => {
    const viewerA = computeTimedPosition(playlist, new Set(), 6000);
    const viewerB = computeTimedPosition(playlist, new Set(), 6000);
    assert.deepEqual(viewerA, viewerB);
  });

  test("null once nothing is playable at all", () => {
    assert.equal(computeTimedPosition([], new Set(), 0), null);
    assert.equal(computeTimedPosition(playlist, new Set(["s1", "s2"]), 0), null);
  });

  test("an invalidated segment is skipped, shifting everything after it earlier", () => {
    // With s1 invalidated, the timeline starts straight at s2: [0,2000) turn0, [2000,6000) turn1.
    const withInvalid = new Set(["s1"]);
    assert.deepEqual(computeTimedPosition(playlist, withInvalid, 0), { kind: "segment", segmentIndex: 1, turnIndex: 0 });
    assert.deepEqual(computeTimedPosition(playlist, withInvalid, 2500), { kind: "segment", segmentIndex: 1, turnIndex: 1 });
  });
});
