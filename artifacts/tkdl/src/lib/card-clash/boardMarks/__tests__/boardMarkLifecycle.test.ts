import { test } from "node:test";
import assert from "node:assert/strict";
import { expireBoardMarksForVisitEnd, expireBoardMarksForDartHit } from "../boardMarkLifecycle";
import type { BoardMark } from "../boardMarkTypes";

let nextId = 0;
function mark(overrides: Partial<BoardMark>): BoardMark {
  nextId++;
  return {
    id: `test-mark-${nextId}`,
    type: "hot",
    target: { type: "bull", value: "bull" },
    ownerPlayerId: "p1",
    appliesTo: "neutral",
    duration: "until_hit",
    createdAtVisitId: "visit-1",
    ...overrides,
  };
}

test("Hot Mark is removed after being triggered (via dart-hit expiry)", () => {
  const hot = mark({ type: "hot", duration: "until_hit" });
  const result = expireBoardMarksForDartHit([hot], { hitMarkIds: [hot.id] });
  assert.equal(result.length, 0);
});

test("Trap Mark is removed after being triggered (via dart-hit expiry)", () => {
  const trap = mark({ type: "trap", duration: "until_hit" });
  const result = expireBoardMarksForDartHit([trap], { hitMarkIds: [trap.id] });
  assert.equal(result.length, 0);
});

test("dart-hit expiry only removes marks that were actually reported as hit", () => {
  const trap = mark({ type: "trap", duration: "until_hit" });
  const unrelated = mark({ type: "hot", duration: "until_hit" });
  const result = expireBoardMarksForDartHit([trap, unrelated], { hitMarkIds: [trap.id] });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, unrelated.id);
});

test("Cold Mark is removed after affected player's visit ends", () => {
  const cold = mark({
    type: "cold",
    ownerPlayerId: "p1",
    affectedPlayerId: "p2",
    appliesTo: "opponent",
    duration: "until_affected_player_visit_end",
    createdAtVisitId: "visit-1",
  });

  // Owner's own visit ending should not expire it
  const afterOwnerVisit = expireBoardMarksForVisitEnd([cold], { visitId: "visit-1", visitPlayerId: "p1" });
  assert.equal(afterOwnerVisit.length, 1, "should not expire on the owner's visit");

  // Affected player's next visit ending should expire it
  const afterAffectedVisit = expireBoardMarksForVisitEnd(afterOwnerVisit, { visitId: "visit-2", visitPlayerId: "p2" });
  assert.equal(afterAffectedVisit.length, 0);
});

test("Shield Mark is removed after owner's next visit ends", () => {
  const shield = mark({
    type: "shield",
    ownerPlayerId: "p1",
    appliesTo: "self",
    duration: "until_owner_next_visit_end",
    createdAtVisitId: "visit-1",
  });

  // Does not expire on the same visit it was created during
  const sameVisit = expireBoardMarksForVisitEnd([shield], { visitId: "visit-1", visitPlayerId: "p1" });
  assert.equal(sameVisit.length, 1, "should not expire on the visit it was created in");

  // Opponent's visit ending in between should not expire it either
  const opponentVisit = expireBoardMarksForVisitEnd(sameVisit, { visitId: "visit-1.5", visitPlayerId: "p2" });
  assert.equal(opponentVisit.length, 1);

  // Owner's next visit ending expires it
  const ownerNextVisit = expireBoardMarksForVisitEnd(opponentVisit, { visitId: "visit-2", visitPlayerId: "p1" });
  assert.equal(ownerNextVisit.length, 0);
});

test("until_visit_end marks expire at the end of any visit", () => {
  const anyVisitMark = mark({ duration: "until_visit_end" });
  const result = expireBoardMarksForVisitEnd([anyVisitMark], { visitId: "visit-1", visitPlayerId: "p2" });
  assert.equal(result.length, 0);
});

test("until_hit marks are left alone by visit-end expiry", () => {
  const untilHit = mark({ type: "trap", duration: "until_hit" });
  const result = expireBoardMarksForVisitEnd([untilHit], { visitId: "visit-99", visitPlayerId: "p1" });
  assert.equal(result.length, 1);
});

test("expired marks do not trigger later — once removed from state they simply can't match again", () => {
  const cold = mark({
    type: "cold",
    ownerPlayerId: "p1",
    affectedPlayerId: "p2",
    appliesTo: "opponent",
    duration: "until_affected_player_visit_end",
    createdAtVisitId: "visit-1",
  });
  const afterExpiry = expireBoardMarksForVisitEnd([cold], { visitId: "visit-2", visitPlayerId: "p2" });
  assert.equal(afterExpiry.find(m => m.id === cold.id), undefined);
});
