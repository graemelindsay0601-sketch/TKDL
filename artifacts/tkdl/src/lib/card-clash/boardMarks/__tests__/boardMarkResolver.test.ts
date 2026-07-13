import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveBoardMarksForDart } from "../boardMarkResolver";
import type { BoardMark, BoardMarkDartResult } from "../boardMarkTypes";

let nextId = 0;
function mark(overrides: Partial<BoardMark>): BoardMark {
  nextId++;
  return {
    id: `test-mark-${nextId}`,
    type: "hot",
    target: { type: "number", value: 20 },
    ownerPlayerId: "p1",
    appliesTo: "neutral",
    duration: "until_hit",
    ...overrides,
  };
}

function dart(segment: number, multiplier: 1 | 2 | 3, throwingPlayerId = "p2"): BoardMarkDartResult {
  return { segment, multiplier, throwingPlayerId };
}

test("Cold 20s blocks Card Clash trigger from T20 but does not change scoring", () => {
  const cold = mark({ type: "cold", target: { type: "number", value: 20 }, ownerPlayerId: "p1", affectedPlayerId: "p2", appliesTo: "opponent" });
  const scoringPayload = { score: 60, busted: false };

  const result = resolveBoardMarksForDart([cold], { dartResult: dart(20, 3, "p2"), scoringPayload });

  assert.equal(result.blockCardClashTriggers, true);
  assert.equal(result.cancelCardClashTriggers, false);
  assert.deepEqual(result.scoringPayload, scoringPayload, "scoring payload must pass through unchanged");
  assert.equal(result.events.some(e => e.type === "card_clash_trigger_blocked_by_cold_mark"), true);
  // Cold is not removed on hit — it persists until the affected player's visit ends
  assert.equal(result.marks.length, 1);
});

test("Trap T20 cancels Card Clash trigger from T20 but does not change scoring, and is removed", () => {
  const trap = mark({ type: "trap", target: { type: "treble", value: 20 }, ownerPlayerId: "p1", affectedPlayerId: "p2", appliesTo: "opponent" });
  const scoringPayload = { score: 60, busted: false };

  const result = resolveBoardMarksForDart([trap], { dartResult: dart(20, 3, "p2"), scoringPayload });

  assert.equal(result.cancelCardClashTriggers, true);
  assert.equal(result.blockCardClashTriggers, false);
  assert.deepEqual(result.scoringPayload, scoringPayload);
  assert.equal(result.events.some(e => e.type === "card_clash_trigger_cancelled_by_trap_mark"), true);
  assert.equal(result.marks.length, 0, "Trap is removed after triggering");
});

test("Hot Bull emits trigger event when Bull is hit", () => {
  const hot = mark({ type: "hot", target: { type: "bull", value: "bull" }, ownerPlayerId: "p1", appliesTo: "neutral" });

  const result = resolveBoardMarksForDart([hot], { dartResult: dart(25, 2, "p2") });

  assert.equal(result.events.some(e => e.type === "board_mark_hot_triggered"), true);
  assert.equal(result.marks.length, 0, "Hot is removed after triggering");
});

test("unmarked dart behaves as before (no marks match, nothing happens)", () => {
  const cold = mark({ type: "cold", target: { type: "number", value: 20 }, ownerPlayerId: "p1", affectedPlayerId: "p2", appliesTo: "opponent" });
  const scoringPayload = { score: 45, busted: false };

  const result = resolveBoardMarksForDart([cold], { dartResult: dart(19, 1, "p2"), scoringPayload });

  assert.equal(result.blockCardClashTriggers, false);
  assert.equal(result.cancelCardClashTriggers, false);
  assert.equal(result.events.length, 0);
  assert.deepEqual(result.scoringPayload, scoringPayload);
  assert.equal(result.marks.length, 1, "unrelated mark is untouched");
});

test("Cold mark on the owner's own dart does not trigger (appliesTo: opponent)", () => {
  const cold = mark({ type: "cold", target: { type: "number", value: 20 }, ownerPlayerId: "p1", affectedPlayerId: "p2", appliesTo: "opponent" });

  // p1 (the owner) throws — not the affected opponent
  const result = resolveBoardMarksForDart([cold], { dartResult: dart(20, 1, "p1") });

  assert.equal(result.blockCardClashTriggers, false);
  assert.equal(result.events.length, 0);
});

test("Shield marks are never resolved on a dart hit (placement-time only)", () => {
  const shield = mark({ type: "shield", target: { type: "double", value: 16 }, ownerPlayerId: "p1", appliesTo: "self" });

  const result = resolveBoardMarksForDart([shield], { dartResult: dart(16, 2, "p1") });

  assert.equal(result.events.length, 0);
  assert.equal(result.marks.length, 1, "shield is untouched by dart resolution");
});

test("X01 scoring payload of any shape is preserved exactly", () => {
  const payload = { visitTotal: 140, checkout: false, bust: false, remaining: 361 };
  const result = resolveBoardMarksForDart([], { dartResult: dart(20, 3, "p1"), scoringPayload: payload });
  assert.deepEqual(result.scoringPayload, payload);
});

test("Cricket scoring payload of any shape is preserved exactly", () => {
  const payload = { marks: { "20": 3, "19": 1 }, points: 4, closed: ["20"] };
  const result = resolveBoardMarksForDart([], { dartResult: dart(20, 1, "p1"), scoringPayload: payload });
  assert.deepEqual(result.scoringPayload, payload);
});

test("D16 checkout scoring payload is preserved when Shield D16 is active", () => {
  const shield = mark({ type: "shield", target: { type: "double", value: 16 }, ownerPlayerId: "p1", appliesTo: "self" });
  const checkoutPayload = { checkedOut: true, remaining: 0 };
  const result = resolveBoardMarksForDart([shield], { dartResult: dart(16, 2, "p1"), scoringPayload: checkoutPayload });
  assert.deepEqual(result.scoringPayload, checkoutPayload);
});
