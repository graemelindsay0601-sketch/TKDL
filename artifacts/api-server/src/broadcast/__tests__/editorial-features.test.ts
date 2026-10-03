import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildEditorialFeatures, weaveStudioSegments, type EditorialMatch, type EditorialPlayer } from "../editorial-features.ts";
import type { PowerRankingMatch } from "../power-rankings.ts";

const cutoff = new Date("2026-09-09T12:00:00Z");
const players: EditorialPlayer[] = [
  { id: 1, name: "Alpha", elo: 1120, points: 40, wins: 5, losses: 1, status: "ACTIVE", eliminationsCount: 3, currentWinStreak: 2, longestWinStreak: 4 },
  { id: 2, name: "Bravo", elo: 1040, points: 19, wins: 2, losses: 4, status: "ACTIVE", eliminationsCount: 0, currentWinStreak: 0, longestWinStreak: 2 },
  { id: 3, name: "Charlie", elo: 980, points: 8, wins: 1, losses: 5, status: "ACTIVE", eliminationsCount: 1, currentWinStreak: 1, longestWinStreak: 3 },
  { id: 4, name: "Delta", elo: 900, points: 0, wins: 0, losses: 6, status: "ELIMINATED", eliminationsCount: 0, currentWinStreak: 0, longestWinStreak: 1 },
  { id: 5, name: "Echo", elo: 1080, points: 25, wins: 3, losses: 3, status: "ACTIVE", eliminationsCount: 0, currentWinStreak: 1, longestWinStreak: 3 },
];
const matches: EditorialMatch[] = [
  { id: 10, winnerId: 1, loserId: 2, winnerName: "Alpha", loserName: "Bravo", stake: 4, playedAt: new Date("2026-09-07T18:00:00Z") },
  { id: 11, winnerId: 3, loserId: 1, winnerName: "Charlie", loserName: "Alpha", stake: 9, playedAt: new Date("2026-09-08T18:00:00Z") },
  { id: 12, winnerId: 2, loserId: 3, winnerName: "Bravo", loserName: "Charlie", stake: 6, playedAt: new Date("2026-09-10T18:00:00Z") },
];
const powerRankingMatches: PowerRankingMatch[] = [
  { leagueType: "doubles", id: 201, winnerId: 20, winnerName: "Alpha & Bravo", loserId: 21, loserName: "Charlie & Delta", stake: 5, playedAt: "2026-09-08T19:00:00Z", wasUpsetWin: false },
  { leagueType: "doubles", id: 202, winnerId: 20, winnerName: "Alpha & Bravo", loserId: 22, loserName: "Echo & Foxtrot", stake: 7, playedAt: "2026-09-09T19:00:00Z", wasUpsetWin: false },
  { leagueType: "doubles", id: 203, winnerId: 22, winnerName: "Echo & Foxtrot", loserId: 21, loserName: "Charlie & Delta", stake: 4, playedAt: "2026-09-09T20:00:00Z", wasUpsetWin: false },
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
    powerRankingMatches,
  });
}

describe("recurring editorial features", () => {
  test("uses cutoff-safe verified data and labels non-ranking upset evidence accurately", () => {
    const segments = broad();
    const allText = segments.flatMap(segment => segment.dialogue.map(turn => turn.text)).join(" ");
    const wager = segments.find(segment => segment.facts?.featureTitle === "Wager of the Week");
    assert.equal(wager?.facts?.stake, 9);
    assert.doesNotMatch(allText, /giant-killer/i);
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

  test("player focus rotates a real player with only verified profile facts", () => {
    const focus = broad().find(segment => segment.purpose === "player_focus");
    assert.ok(focus);
    assert.equal(focus?.facts?.featureTitle, "Player Focus");
    assert.ok(players.some(player => player.id === focus?.facts?.playerId));
    assert.match(focus?.dialogue.map(turn => turn.text).join(" ") ?? "", /current Singles table/);
  });

  test("power rankings create a reverse countdown from verified form rows", () => {
    const ranking = broad().find(segment => segment.purpose === "power_rankings");
    assert.ok(ranking);
    assert.equal(ranking?.leagueType, "doubles");
    assert.equal(ranking?.facts?.featureTitle, "Power Rankings: On Air");
    assert.ok(Array.isArray(ranking?.facts?.rows));
    assert.match(ranking?.dialogue[0]?.text ?? "", /Power Rankings time/);
    assert.match(ranking?.dialogue.at(-1)?.text ?? "", /number one spot/);
    assert.ok((ranking?.dialogue.length ?? 0) > 3);
  });

  test("pundit picks give the presenters distinct calls and a bounded studio stake", () => {
    const segments = buildEditorialFeatures({
      players, matches, stories: [], cutoff, rotationKey: "broad-opinion", broad: true,
    });
    const opinion = segments.find(segment => segment.facts?.featureTitle === "Pundit Picks");
    if (opinion) {
      assert.ok(Number(opinion.facts?.opinionStake) <= Number(opinion.facts?.legalMaximum));
      assert.notEqual(opinion.facts?.chalkyPickId, opinion.facts?.tonPickId);
      assert.match(opinion.dialogue.map(turn => turn.text).join(" "), /studio points/i);
      assert.deepEqual(opinion.dialogue.map(turn => turn.speaker), ["A", "B", "A", "B"]);
    }
  });

  test("ordinary magazine rotation can select two desks and rests recently aired titles", () => {
    const first = buildEditorialFeatures({ players, matches, stories: [], cutoff, rotationKey: "magazine-two", broad: false, maxFeatures: 2 });
    assert.equal(first.length, 2);
    const recent = new Set(first.map(segment => String(segment.facts?.featureTitle)));
    const next = buildEditorialFeatures({ players, matches, stories: [], cutoff, rotationKey: "magazine-two", broad: false, maxFeatures: 2, recentlyAiredFeatureTitles: recent });
    assert.equal(next.length, 2);
    assert.ok(next.every(segment => !recent.has(String(segment.facts?.featureTitle))));
  });

  test("weaves studio beats through the programme before what to watch and closing", () => {
    const make = (purpose: any): any => ({ purpose, slot: 1, importance: "utility", storyId: null, supportingStoryIds: [], storyType: null, leagueType: null, lifecycleAtBroadcast: null, dialogue: [], validityRules: [], facts: null });
    const result = weaveStudioSegments(
      [make("opening"), make("main_story"), make("supporting_story_or_checkin"), make("form_h2h_or_spotlight"), make("what_to_watch"), make("closing"), make("headlines")],
      [make("player_focus"), make("fan_verdict")],
    );
    const purposes = result.map(segment => segment.purpose);
    assert.ok(purposes.indexOf("player_focus") < purposes.indexOf("what_to_watch"));
    assert.ok(purposes.indexOf("fan_verdict") < purposes.indexOf("what_to_watch"));
    assert.equal(purposes.at(-1), "headlines");
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
