import { test } from "node:test";
import assert from "node:assert/strict";
import { placeBoardMark } from "../boardMarkConflicts";
import type { BoardMark } from "../boardMarkTypes";

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

test("cannot place Cold and Trap on the same target", () => {
  const cold = mark({ type: "cold", target: { type: "treble", value: 20 }, ownerPlayerId: "p1", affectedPlayerId: "p2", appliesTo: "opponent" });
  const trap = mark({ type: "trap", target: { type: "treble", value: 20 }, ownerPlayerId: "p2", affectedPlayerId: "p1", appliesTo: "opponent" });

  const result = placeBoardMark([cold], trap);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "negative_mark_conflict");
});

test("cannot place Trap then Cold on the same target either", () => {
  const trap = mark({ type: "trap", target: { type: "treble", value: 20 }, appliesTo: "opponent", affectedPlayerId: "p2" });
  const cold = mark({ type: "cold", target: { type: "treble", value: 20 }, appliesTo: "opponent", affectedPlayerId: "p2" });

  const result = placeBoardMark([trap], cold);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "negative_mark_conflict");
});

test("Shield blocks enemy Cold on the same target", () => {
  const shield = mark({ type: "shield", target: { type: "double", value: 16 }, ownerPlayerId: "p1", appliesTo: "self" });
  const enemyCold = mark({ type: "cold", target: { type: "double", value: 16 }, ownerPlayerId: "p2", appliesTo: "opponent", affectedPlayerId: "p1" });

  const result = placeBoardMark([shield], enemyCold);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "blocked_by_shield");
});

test("Shield blocks enemy Trap on the same target", () => {
  const shield = mark({ type: "shield", target: { type: "double", value: 16 }, ownerPlayerId: "p1", appliesTo: "self" });
  const enemyTrap = mark({ type: "trap", target: { type: "double", value: 16 }, ownerPlayerId: "p2", appliesTo: "opponent", affectedPlayerId: "p1" });

  const result = placeBoardMark([shield], enemyTrap);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "blocked_by_shield");
});

test("Shield does not block Hot", () => {
  const shield = mark({ type: "shield", target: { type: "bull", value: "bull" }, ownerPlayerId: "p1", appliesTo: "self" });
  const hot = mark({ type: "hot", target: { type: "bull", value: "bull" }, ownerPlayerId: "p2", appliesTo: "neutral" });

  const result = placeBoardMark([shield], hot);
  assert.equal(result.ok, true);
});

test("Shield does not block the shield owner's own Cold/Trap on the same target", () => {
  const shield = mark({ type: "shield", target: { type: "double", value: 16 }, ownerPlayerId: "p1", appliesTo: "self" });
  const ownCold = mark({ type: "cold", target: { type: "double", value: 16 }, ownerPlayerId: "p1", appliesTo: "opponent", affectedPlayerId: "p2" });

  const result = placeBoardMark([shield], ownCold);
  assert.equal(result.ok, true);
});

test("duplicate Hot on the same target is rejected by default", () => {
  const existing = mark({ type: "hot", target: { type: "bull", value: "bull" } });
  const duplicate = mark({ type: "hot", target: { type: "bull", value: "bull" } });

  const result = placeBoardMark([existing], duplicate);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "stacking_not_allowed");
});

test("duplicate Shield on the same target is rejected by default", () => {
  const existing = mark({ type: "shield", target: { type: "double", value: 16 }, appliesTo: "self" });
  const duplicate = mark({ type: "shield", target: { type: "double", value: 16 }, appliesTo: "self" });

  const result = placeBoardMark([existing], duplicate);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "stacking_not_allowed");
});

test("replacement works only if allowReplace is true (stacking case)", () => {
  const existing = mark({ type: "hot", target: { type: "bull", value: "bull" } });
  const blockedDuplicate = mark({ type: "hot", target: { type: "bull", value: "bull" } });
  const allowedDuplicate = mark({ type: "hot", target: { type: "bull", value: "bull" }, allowReplace: true });

  const blocked = placeBoardMark([existing], blockedDuplicate);
  assert.equal(blocked.ok, false);

  const allowed = placeBoardMark([existing], allowedDuplicate);
  assert.equal(allowed.ok, true);
  if (allowed.ok) {
    assert.equal(allowed.marks.length, 1);
    assert.equal(allowed.marks[0].id, allowedDuplicate.id);
  }
});

test("replacement works only if allowReplace is true (cold/trap conflict case)", () => {
  const cold = mark({ type: "cold", target: { type: "treble", value: 20 }, appliesTo: "opponent", affectedPlayerId: "p2" });
  const blockedTrap = mark({ type: "trap", target: { type: "treble", value: 20 }, appliesTo: "opponent", affectedPlayerId: "p2" });
  const allowedTrap = mark({ type: "trap", target: { type: "treble", value: 20 }, appliesTo: "opponent", affectedPlayerId: "p2", allowReplace: true });

  const blocked = placeBoardMark([cold], blockedTrap);
  assert.equal(blocked.ok, false);

  const allowed = placeBoardMark([cold], allowedTrap);
  assert.equal(allowed.ok, true);
  if (allowed.ok) {
    assert.equal(allowed.marks.length, 1);
    assert.equal(allowed.marks[0].type, "trap");
  }
});

test("allowReplace does NOT bypass a Shield block", () => {
  const shield = mark({ type: "shield", target: { type: "double", value: 16 }, ownerPlayerId: "p1", appliesTo: "self" });
  const enemyTrapWithReplace = mark({ type: "trap", target: { type: "double", value: 16 }, ownerPlayerId: "p2", appliesTo: "opponent", affectedPlayerId: "p1", allowReplace: true });

  const result = placeBoardMark([shield], enemyTrapWithReplace);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "blocked_by_shield");
});

test("different, non-conflicting mark types can coexist on the same target", () => {
  const hot = mark({ type: "hot", target: { type: "bull", value: "bull" }, appliesTo: "neutral" });
  const shield = mark({ type: "shield", target: { type: "bull", value: "bull" }, appliesTo: "self" });

  const result = placeBoardMark([hot], shield);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.marks.length, 2);
});

test("placement on an unrelated target never conflicts", () => {
  const existing = mark({ type: "cold", target: { type: "number", value: 20 }, appliesTo: "opponent", affectedPlayerId: "p2" });
  const newMark = mark({ type: "trap", target: { type: "double", value: 16 }, appliesTo: "opponent", affectedPlayerId: "p2" });

  const result = placeBoardMark([existing], newMark);
  assert.equal(result.ok, true);
});
