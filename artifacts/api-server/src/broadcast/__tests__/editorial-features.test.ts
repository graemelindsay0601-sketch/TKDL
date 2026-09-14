import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildEditorialFeatures, type EditorialMatch, type EditorialPlayer } from "../editorial-features.ts";

const cutoff = new Date("2026-09-09T12:00:00Z");
const players: EditorialPlayer[] = [
  { id: 1, name: "Alpha", points: 40, wins: 5, losses: 1, status: "ACTIVE", eliminationsCount: 3 },
  { id: 2, name: "Bravo", points: 19, wins: 2, losses: 4, status: "ACTIVE", eliminationsCount: 0 },
  { id: 3, name: "Charlie", points: 8, wins: 1, losses: 5, status: "ACTIVE", eliminationsCount: 1 },
  { id: 4, name: "Delta", points: 0, wins: 0, losses: 6, status: "ELIMINATED", eliminationsCount: 0 },
  { id: 5, name: "Echo", points: 25, wins: 3, losses: 3, status: "ACTIVE", eliminationsCount: 0 },
];
const matches: EditorialMatch[] = [
  { id: 10, winnerId: 1, loserId: 2, winnerName: "Alpha", loserName: "Bravo", stake: 4, playedAt: new Date("2026-09-07T18:00:00Z") },
  { id: 11, winnerId: 3, loserId: 1, winnerName: "Charlie", loserName: "Alpha", stake: 9, playedAt: new Date("2026-09-08T18:00:00Z") },
  { id: 12, winnerId: 2, loserId: 3, winnerName: "Bravo", loserName: "Charlie", stake: 6, playedAt: new Date("2026-09-10T18:00:00Z") },
];

function broad(representedMatchIds = new Set<number>()) {
  return buildEditorialFeatures({
    players,
    matches,
    stories: [
      { id: 100, storyType: "MATCH_RESULT", anchorMatchId: 11, facts: { winnerId: 3, loserId: 1, playedAt: "2026-09-08T18:00:00Z", winnerPointsBefore: 4, winnerPointsAfter: 13, loserPointsBefore: 49, loserPointsAfter: 40 } },
      { id: 101, storyType: "MODEL_SHOCK", anchorMatchId: 11, facts: { winnerId: 3 } },
      { id: 102, storyType: "HIGH_STAKE_WIN", anchorMatchId: 11, facts: { winnerId: 3 } },
      { id: 103, storyType: "HIGH_STAKE_LOSS", anchorMatchId: 11, facts: { loserId: 1 } },
      { id: 104, storyType: "SCORING_POWER", score: 77, anchorMatchId: 11, facts: { playerId: 3 } },
    ],
    cutoff,
    rotationKey: "week-37",
    broad: true,
    representedMatchIds,
  });
}

describe("recurring editorial features", () => {
  test("uses cutoff-safe verified data and labels non-ranking upset evidence accurately", () => {
    const segments = broad();
    const allText = segments.flatMap(segment => segment.dialogue.map(turn => turn.text)).join(" ");
    const wager = segments.find(segment => segment.facts?.featureTitle === "Wager of the Week");
    assert.equal(wager?.facts?.stake, 9);
    assert.doesNotMatch(allText, /giant-killer|rankings/i);
    assert.doesNotMatch(allText, /2026-09-10|6 points.*Wager of the Week/i);
  });

  test("points swing aggregates snapshots without owning or repeating a result story", () => {
    const segments = broad();
    const swing = segments.find(segment => segment.facts?.featureTitle === "Points Swing");
    assert.equal(swing?.facts?.netGain, 9);
    assert.equal(swing?.facts?.netFall, -9);
    assert.ok(segments.every(segment => segment.storyId === null));
  });

  test("points swing excludes a match that already has its own dedicated result segment", () => {
    // Match 11 (Charlie beat Alpha) already carries a persisted MATCH_RESULT
    // story with its own dedicated segment elsewhere in the programme — this
    // desk's Points Swing shouldn't re-narrate it. Match 10 (Alpha beat
    // Bravo) has no such segment, so it's the only one representedMatchIds
    // should leave in the aggregate.
    const segments = buildEditorialFeatures({
      players, matches,
      stories: [
        { id: 100, storyType: "MATCH_RESULT", anchorMatchId: 11, facts: { winnerId: 3, loserId: 1, playedAt: "2026-09-08T18:00:00Z", winnerPointsBefore: 4, winnerPointsAfter: 13, loserPointsBefore: 49, loserPointsAfter: 40 } },
        { id: 105, storyType: "MATCH_RESULT", anchorMatchId: 10, facts: { winnerId: 1, loserId: 2, playedAt: "2026-09-07T18:00:00Z", winnerPointsBefore: 30, winnerPointsAfter: 34, loserPointsBefore: 23, loserPointsAfter: 19 } },
      ],
      cutoff,
      rotationKey: "week-37",
      broad: true,
      representedMatchIds: new Set([11]),
    });
    const swing = segments.find(segment => segment.facts?.featureTitle === "Points Swing");
    assert.equal(swing?.facts?.gainingPlayerName, "Alpha");
    assert.equal(swing?.facts?.netGain, 4);
    assert.equal(swing?.facts?.fallingPlayerName, "Bravo");
    assert.equal(swing?.facts?.netFall, -4);
    assert.ok(segments.every(segment => segment.storyId === null));
  });

  test("escape act tracks a player's full weekly points trajectory even when one of their matches is already represented", () => {
    // Escape Act needs every match's points movement to report an accurate
    // low point and final total for the week — unlike Points Swing, it
    // isn't exempted by representedMatchIds, since excluding a match here
    // would silently corrupt the trajectory rather than avoid a duplicate
    // narrative. Match 11 (the earlier, lower-points match) is the one
    // marked represented; if it were wrongly excluded from the trajectory
    // too, the danger point below would read 5, not 2.
    const segments = buildEditorialFeatures({
      players, matches,
      stories: [
        { id: 100, storyType: "MATCH_RESULT", anchorMatchId: 11, facts: { winnerId: 3, loserId: 5, playedAt: "2026-09-07T10:00:00Z", winnerPointsBefore: 2, winnerPointsAfter: 5, loserPointsBefore: 30, loserPointsAfter: 27 } },
        { id: 106, storyType: "MATCH_RESULT", anchorMatchId: 12, facts: { winnerId: 3, loserId: 2, playedAt: "2026-09-09T09:00:00Z", winnerPointsBefore: 5, winnerPointsAfter: 15, loserPointsBefore: 24, loserPointsAfter: 14 } },
      ],
      cutoff,
      rotationKey: "week-37",
      broad: true,
      representedMatchIds: new Set([11]),
    });
    const escape = segments.find(segment => segment.facts?.featureTitle === "Escape Act");
    assert.equal(escape?.facts?.playerName, "Charlie");
    assert.equal(escape?.facts?.dangerPoint, 2);
    assert.equal(escape?.facts?.recoveredTo, 15);
  });

  test("ordinary rotation is bounded and deterministic", () => {
    const first = buildEditorialFeatures({
      players, matches, stories: [], cutoff, rotationKey: "ordinary-slot", broad: false,
    });
    const second = buildEditorialFeatures({
      players: [...players].reverse(), matches: [...matches].reverse(), stories: [],
      cutoff, rotationKey: "ordinary-slot", broad: false,
    });
    assert.equal(first.length, 1);
    assert.deepEqual(first, second);
  });

  test("host wager opinion is bounded by balances and explicitly not a recommendation", () => {
    const segments = buildEditorialFeatures({
      players, matches, stories: [], cutoff, rotationKey: "broad-opinion", broad: true,
    });
    const opinion = segments.find(segment => segment.facts?.featureTitle === "What Would You Wager?");
    if (opinion) {
      assert.ok(Number(opinion.facts?.opinionStake) <= Number(opinion.facts?.legalMaximum));
      assert.match(opinion.dialogue.map(turn => turn.text).join(" "), /Host opinion/i);
      assert.match(opinion.dialogue.map(turn => turn.text).join(" "), /not a recommendation/i);
    }
  });

  test("weekly performance award uses persisted detector score and match timing", () => {
    const award = broad().find(segment => segment.facts?.featureTitle === "Performance of the Week");
    assert.equal(award?.facts?.playerName, "Charlie");
    assert.equal(award?.facts?.detectorScore, 77);
  });

  test("presenter dialogue never exposes internal labels or awkward hyphenated compounds", () => {
    const spokenText = broad().flatMap(segment => segment.dialogue.map(turn => turn.text)).join(" ");
    assert.doesNotMatch(spokenText, /\b[A-Z]+_[A-Z_]+\b/);
    assert.doesNotMatch(spokenText, /\b(?:high-stake|highest-scoring|zero-point|before-and-after|\d+-match)\b/i);
    assert.doesNotMatch(spokenText, /\b(?:persisted detector|the detector was|weekly snapshots)\b/i);
  });
});