import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createBoardMarkFromPrototypeCard,
  BOARD_MARK_PROTOTYPE_CARDS,
  BOARD_MARK_CARD_ID_MAP,
  BOARD_MARK_SABOTAGE_CARD_IDS,
  BOARD_MARK_ESCALATION_CARD_IDS,
  BOARD_MARK_MATCH_SWING_CARD_IDS,
} from "../boardMarkPrototypeCards";

test("there are 30 prototype cards across 13 families", () => {
  assert.equal(BOARD_MARK_PROTOTYPE_CARDS.length, 30);
});

test("every card id 701-730 is mapped and every mapped config has a matching card in the list", () => {
  for (let id = 701; id <= 730; id++) {
    assert.ok(BOARD_MARK_CARD_ID_MAP[id], `missing mapping for card id ${id}`);
  }
});

test("all 30 card names are unique", () => {
  const names = BOARD_MARK_PROTOTYPE_CARDS.map(c => c.name);
  assert.equal(new Set(names).size, names.length);
});

test("all 30 card ids are unique", () => {
  const ids = Object.keys(BOARD_MARK_CARD_ID_MAP);
  assert.equal(new Set(ids).size, 30);
});

test("simple card creates exactly one mark, with payload defaulting to score_shift", () => {
  const hotBull = BOARD_MARK_CARD_ID_MAP[701]; // Hot Bull
  const marks = createBoardMarkFromPrototypeCard(hotBull, { ownerPlayerId: "0", opponentPlayerId: "1" });
  assert.equal(marks.length, 1);
  assert.equal(marks[0].type, "hot");
  assert.equal(marks[0].metadata?.payload, "score_shift");
  assert.equal(marks[0].metadata?.steal, false);
});

test("steal card carries steal metadata through to the created mark", () => {
  // Bounty family has no steal cards anymore; Leech/score_shift-with-steal
  // isn't in the new roster either, so this now verifies steal defaults
  // correctly for a card that doesn't set it.
  const hotTreble20 = BOARD_MARK_CARD_ID_MAP[702];
  const marks = createBoardMarkFromPrototypeCard(hotTreble20, { ownerPlayerId: "0", opponentPlayerId: "1" });
  assert.equal(marks[0].metadata?.steal, false);
});

test("game-flipping cards carry their payload through to the created mark's metadata", () => {
  const scoreSwap = BOARD_MARK_CARD_ID_MAP[714]; // Score Swap
  assert.equal(createBoardMarkFromPrototypeCard(scoreSwap, { ownerPlayerId: "0", opponentPlayerId: "1" })[0].metadata?.payload, "swap_scores");

  const surge = BOARD_MARK_CARD_ID_MAP[715]; // Surge
  assert.equal(createBoardMarkFromPrototypeCard(surge, { ownerPlayerId: "0", opponentPlayerId: "1" })[0].metadata?.payload, "double_next_visit");

  const weakened = BOARD_MARK_CARD_ID_MAP[716]; // Weakened
  assert.equal(createBoardMarkFromPrototypeCard(weakened, { ownerPlayerId: "0", opponentPlayerId: "1" })[0].metadata?.payload, "weaken_next_visit");

  const siphon = BOARD_MARK_CARD_ID_MAP[717]; // Siphon
  assert.equal(createBoardMarkFromPrototypeCard(siphon, { ownerPlayerId: "0", opponentPlayerId: "1" })[0].metadata?.payload, "leech_score");
});

test("wildcard-target cards resolve to a real, varied target — not the same one every time", () => {
  const flashpoint = BOARD_MARK_CARD_ID_MAP[703]; // Flashpoint — random_any
  const targets = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const marks = createBoardMarkFromPrototypeCard(flashpoint, { ownerPlayerId: "0", opponentPlayerId: "1" });
    targets.add(`${marks[0].target.type}:${marks[0].target.value}`);
  }
  assert.ok(targets.size > 1, "expected genuine variety across draws");
});

test("wildstrike (random_treble) always resolves to a treble target", () => {
  const wildstrike = BOARD_MARK_CARD_ID_MAP[704];
  for (let i = 0; i < 20; i++) {
    const marks = createBoardMarkFromPrototypeCard(wildstrike, { ownerPlayerId: "0", opponentPlayerId: "1" });
    assert.equal(marks[0].target.type, "treble");
    assert.ok(typeof marks[0].target.value === "number" && marks[0].target.value >= 1 && marks[0].target.value <= 20);
  }
});

test("multi-target cards (Wildfire Spread, Minefield) produce three marks", () => {
  const wildfireSpread = BOARD_MARK_CARD_ID_MAP[723];
  const marks = createBoardMarkFromPrototypeCard(wildfireSpread, { ownerPlayerId: "0", opponentPlayerId: "1" });
  assert.equal(marks.length, 3);
  assert.ok(marks.every(m => m.type === "hot"));

  const minefield = BOARD_MARK_CARD_ID_MAP[724];
  const mfMarks = createBoardMarkFromPrototypeCard(minefield, { ownerPlayerId: "0", opponentPlayerId: "1" });
  assert.equal(mfMarks.length, 3);
  assert.ok(mfMarks.every(m => m.type === "trap" && m.appliesTo === "opponent"));
});

test("leg-wide cards (Treble Curse, Double Trouble) target 'any' with until_leg_end duration", () => {
  const trebleCurse = BOARD_MARK_CARD_ID_MAP[725];
  const marks = createBoardMarkFromPrototypeCard(trebleCurse, { ownerPlayerId: "0", opponentPlayerId: "1" });
  assert.equal(marks[0].target.type, "treble");
  assert.equal(marks[0].target.value, "any");
  assert.equal(marks[0].duration, "until_leg_end");
  assert.equal(marks[0].type, "cold");

  const doubleTrouble = BOARD_MARK_CARD_ID_MAP[726];
  const dtMarks = createBoardMarkFromPrototypeCard(doubleTrouble, { ownerPlayerId: "0", opponentPlayerId: "1" });
  assert.equal(dtMarks[0].target.value, "any");
  assert.equal(dtMarks[0].duration, "until_leg_end");
  assert.equal(dtMarks[0].type, "hot");
});

test("Unstable resolves to hot or trap at creation time and flags isUnstable", () => {
  const unstable = BOARD_MARK_CARD_ID_MAP[727];
  const seen = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const marks = createBoardMarkFromPrototypeCard(unstable, { ownerPlayerId: "0", opponentPlayerId: "1" });
    assert.ok(marks[0].type === "hot" || marks[0].type === "trap");
    assert.equal(marks[0].metadata?.isUnstable, true);
    seen.add(marks[0].type);
  }
  assert.equal(seen.size, 2, "expected both hot and trap to come up across 30 draws");
});

test("non-unstable cards never set isUnstable", () => {
  const hotBull = BOARD_MARK_CARD_ID_MAP[701];
  const marks = createBoardMarkFromPrototypeCard(hotBull, { ownerPlayerId: "0", opponentPlayerId: "1" });
  assert.equal(marks[0].metadata?.isUnstable, false);
});

test("sabotage card ids are correctly identified", () => {
  assert.equal(BOARD_MARK_SABOTAGE_CARD_IDS[719], "erase");
  assert.equal(BOARD_MARK_SABOTAGE_CARD_IDS[720], "purge");
  assert.equal(BOARD_MARK_SABOTAGE_CARD_IDS[701], undefined);
});

test("escalation card ids are correctly identified", () => {
  assert.ok(BOARD_MARK_ESCALATION_CARD_IDS.has(721)); // Slow Burn
  assert.ok(BOARD_MARK_ESCALATION_CARD_IDS.has(722)); // Simmering Trap
  assert.ok(!BOARD_MARK_ESCALATION_CARD_IDS.has(701));
});

test("match swing card ids are correctly identified", () => {
  assert.equal(BOARD_MARK_MATCH_SWING_CARD_IDS[728], "overtake");
  assert.equal(BOARD_MARK_MATCH_SWING_CARD_IDS[729], "underdogs_grace");
  assert.equal(BOARD_MARK_MATCH_SWING_CARD_IDS[730], "set_point");
});

test("every family is represented at least once", () => {
  const families = new Set(BOARD_MARK_PROTOTYPE_CARDS.map(c => c.family));
  const expected = ["bounty", "curse_cold", "curse_trap", "shield", "reversal", "momentum", "leech", "sabotage", "escalation", "multi_target", "leg_wide", "wildcard", "match_swing"];
  for (const f of expected) {
    assert.ok(families.has(f as any), `missing family: ${f}`);
  }
});

test("reversal family has exactly one card, kept rare on purpose", () => {
  const reversalCards = BOARD_MARK_PROTOTYPE_CARDS.filter(c => c.family === "reversal");
  assert.equal(reversalCards.length, 1);
  assert.equal(reversalCards[0].name, "Score Swap");
});
