import { test } from "node:test";
import assert from "node:assert/strict";
import { createBoardMarkFromPrototypeCard, BOARD_MARK_PROTOTYPE_CARDS, BOARD_MARK_CARD_ID_MAP } from "../boardMarkPrototypeCards";

test("there are 27 prototype cards: 20 simple + 4 steal + 3 risk/reward", () => {
  assert.equal(BOARD_MARK_PROTOTYPE_CARDS.length, 27);
});

test("every card id 701-727 is mapped and every mapped config has a matching card in the list", () => {
  for (let id = 701; id <= 727; id++) {
    assert.ok(BOARD_MARK_CARD_ID_MAP[id], `missing mapping for card id ${id}`);
  }
});

test("all 27 card names are unique", () => {
  const names = BOARD_MARK_PROTOTYPE_CARDS.map(c => c.name);
  assert.equal(new Set(names).size, names.length);
});

test("simple card creates exactly one mark", () => {
  const hotBull = BOARD_MARK_CARD_ID_MAP[701];
  const marks = createBoardMarkFromPrototypeCard(hotBull, { ownerPlayerId: "0", opponentPlayerId: "1" });
  assert.equal(marks.length, 1);
  assert.equal(marks[0].type, "hot");
});

test("steal card carries steal metadata through to the created mark", () => {
  const pointThief = BOARD_MARK_CARD_ID_MAP[721]; // Point Thief
  const marks = createBoardMarkFromPrototypeCard(pointThief, { ownerPlayerId: "0", opponentPlayerId: "1" });
  assert.equal(marks.length, 1);
  assert.equal(marks[0].metadata?.steal, true);
});

test("non-steal card has no steal metadata", () => {
  const hotBull = BOARD_MARK_CARD_ID_MAP[701];
  const marks = createBoardMarkFromPrototypeCard(hotBull, { ownerPlayerId: "0", opponentPlayerId: "1" });
  assert.equal(marks[0].metadata?.steal, undefined);
});

test("compound risk/reward card creates two marks: primary + self-curse", () => {
  const wildfire = BOARD_MARK_CARD_ID_MAP[725]; // Wildfire
  const marks = createBoardMarkFromPrototypeCard(wildfire, { ownerPlayerId: "0", opponentPlayerId: "1" });
  assert.equal(marks.length, 2);
  assert.equal(marks[0].type, "hot");
  assert.equal(marks[0].target.type, "bull");
  assert.equal(marks[1].type, "trap");
  assert.equal(marks[1].appliesTo, "self");
  assert.equal(marks[1].affectedPlayerId, "0", "self-curse should affect the owner, not the opponent");
});

test("compound card's random secondary target resolves to a real number 1-20", () => {
  const wildfire = BOARD_MARK_CARD_ID_MAP[725];
  for (let i = 0; i < 20; i++) {
    const marks = createBoardMarkFromPrototypeCard(wildfire, { ownerPlayerId: "0", opponentPlayerId: "1" });
    const secondary = marks[1];
    assert.equal(secondary.target.type, "number");
    assert.ok(typeof secondary.target.value === "number" && secondary.target.value >= 1 && secondary.target.value <= 20);
  }
});

test("all three risk/reward cards produce a self-targeted secondary curse", () => {
  for (const id of [725, 726, 727]) {
    const config = BOARD_MARK_CARD_ID_MAP[id];
    const marks = createBoardMarkFromPrototypeCard(config, { ownerPlayerId: "1", opponentPlayerId: "0" });
    assert.equal(marks.length, 2, `card ${id} should produce 2 marks`);
    assert.equal(marks[1].appliesTo, "self");
    assert.equal(marks[1].ownerPlayerId, "1");
    assert.equal(marks[1].affectedPlayerId, "1");
  }
});

test("trap-steal card is opponent-targeted, not self", () => {
  const highwayRobbery = BOARD_MARK_CARD_ID_MAP[723];
  const marks = createBoardMarkFromPrototypeCard(highwayRobbery, { ownerPlayerId: "0", opponentPlayerId: "1" });
  assert.equal(marks[0].appliesTo, "opponent");
  assert.equal(marks[0].affectedPlayerId, "1");
  assert.equal(marks[0].metadata?.steal, true);
});
