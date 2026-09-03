/**
 * Tests for live-events-math.ts — 11.4-11.6's pure classification and
 * validity-rule generation logic.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  titleProbabilityBand, validityRulesForStory, classifyLiveScore, isWithinOverlayAgeWindow,
  LONGSHOT_BAND_THRESHOLD, FAVOURITE_BAND_THRESHOLD,
  type ValidityRule,
} from "../live-events-math.ts";
import type { BroadcastStory } from "@workspace/db/schema";

type StoryInput = Pick<BroadcastStory, "id" | "storyType" | "leagueType" | "facts" | "updatedAt">;

function story(overrides: Partial<StoryInput> & { storyType: string; facts: Record<string, unknown> }): StoryInput {
  return { id: 1, leagueType: "singles", updatedAt: new Date("2026-09-01T12:00:00Z"), ...overrides };
}

function rulesOfKind(rules: ValidityRule[], kind: ValidityRule["kind"]): ValidityRule[] {
  return rules.filter(r => r.kind === kind);
}

describe("titleProbabilityBand", () => {
  test("below the longshot threshold is a longshot", () => {
    assert.equal(titleProbabilityBand(0), "longshot");
    assert.equal(titleProbabilityBand(LONGSHOT_BAND_THRESHOLD - 0.001), "longshot");
  });
  test("at or above the longshot threshold but below favourite is a contender", () => {
    assert.equal(titleProbabilityBand(LONGSHOT_BAND_THRESHOLD), "contender");
    assert.equal(titleProbabilityBand(0.25), "contender");
    assert.equal(titleProbabilityBand(FAVOURITE_BAND_THRESHOLD - 0.001), "contender");
  });
  test("at or above the favourite threshold is a favourite", () => {
    assert.equal(titleProbabilityBand(FAVOURITE_BAND_THRESHOLD), "favourite");
    assert.equal(titleProbabilityBand(0.9), "favourite");
  });
});

describe("classifyLiveScore", () => {
  test("below 45 is not overlay-eligible", () => {
    assert.equal(classifyLiveScore(0), null);
    assert.equal(classifyLiveScore(44), null);
  });
  test("45-89 (including the doc's undefined 85-89 gap) classifies as just_in", () => {
    assert.equal(classifyLiveScore(45), "just_in");
    assert.equal(classifyLiveScore(84), "just_in");
    assert.equal(classifyLiveScore(85), "just_in");
    assert.equal(classifyLiveScore(89), "just_in");
  });
  test("90+ classifies as breaking", () => {
    assert.equal(classifyLiveScore(90), "breaking");
    assert.equal(classifyLiveScore(100), "breaking");
  });
});

describe("isWithinOverlayAgeWindow", () => {
  const playedAt = new Date("2026-09-01T12:00:00Z");
  test("just after playedAt is within the window", () => {
    assert.equal(isWithinOverlayAgeWindow(playedAt, new Date("2026-09-01T12:00:01Z")), true);
  });
  test("exactly 10 minutes later is still within the window", () => {
    assert.equal(isWithinOverlayAgeWindow(playedAt, new Date("2026-09-01T12:10:00Z")), true);
  });
  test("just past 10 minutes is outside the window", () => {
    assert.equal(isWithinOverlayAgeWindow(playedAt, new Date("2026-09-01T12:10:01Z")), false);
  });
  test("a 'now' before playedAt (clock skew) is never treated as fresh", () => {
    assert.equal(isWithinOverlayAgeWindow(playedAt, new Date("2026-09-01T11:59:00Z")), false);
  });
});

describe("validityRulesForStory — universal storyStillActive", () => {
  test("every story gets a storyStillActive rule keyed to its own id", () => {
    const rules = validityRulesForStory(story({ id: 42, storyType: "UPSET", facts: {} }));
    const active = rulesOfKind(rules, "storyStillActive");
    assert.equal(active.length, 1);
    assert.deepEqual(active[0], { kind: "storyStillActive", storyId: 42 });
  });

  test("a type with no mapped rule generation (e.g. a permanently-true past event) gets storyStillActive alone", () => {
    const rules = validityRulesForStory(story({ storyType: "MAJOR_UPSET", facts: { winnerId: 1, loserId: 2 } }));
    assert.equal(rules.length, 1);
    assert.equal(rules[0].kind, "storyStillActive");
  });
});

describe("validityRulesForStory — win-streak-shaped claims", () => {
  test("WIN_STREAK generates a winStreakIntactSince rule for the player, since the story's own updatedAt", () => {
    const rules = validityRulesForStory(story({ storyType: "WIN_STREAK", facts: { playerId: 7, currentWinStreak: 5, tier: "strong" }, updatedAt: new Date("2026-09-01T09:00:00Z") }));
    const streak = rulesOfKind(rules, "winStreakIntactSince");
    assert.deepEqual(streak, [{ kind: "winStreakIntactSince", leagueType: "singles", entityId: 7, sinceInstant: "2026-09-01T09:00:00.000Z" }]);
  });

  test("UNBEATEN_PAIR generates the same rule shape for the team, using the doubles leagueType", () => {
    const rules = validityRulesForStory(story({ storyType: "UNBEATEN_PAIR", leagueType: "doubles", facts: { teamId: 3, wins: 4 } }));
    const streak = rulesOfKind(rules, "winStreakIntactSince");
    assert.equal(streak.length, 1);
    assert.equal((streak[0] as { entityId: number }).entityId, 3);
    assert.equal((streak[0] as { leagueType: string }).leagueType, "doubles");
  });
});

describe("validityRulesForStory — leadership claims", () => {
  test("NEW_LEADER generates leaderIs + entityActive for the new leader", () => {
    const rules = validityRulesForStory(story({ storyType: "NEW_LEADER", facts: { newLeaderEntityId: 11, previousLeaderEntityId: 12, points: 30 } }));
    assert.deepEqual(rulesOfKind(rules, "leaderIs"), [{ kind: "leaderIs", leagueType: "singles", entityId: 11 }]);
    assert.deepEqual(rulesOfKind(rules, "entityActive"), [{ kind: "entityActive", leagueType: "singles", entityId: 11 }]);
  });

  test("LEAD_TIGHTENS / LEAD_WIDENS generate leaderIs + entityActive for the leader", () => {
    for (const storyType of ["LEAD_TIGHTENS", "LEAD_WIDENS"]) {
      const rules = validityRulesForStory(story({ storyType, facts: { leaderEntityId: 9, previousGap: 10, currentGap: 4 } }));
      assert.deepEqual(rulesOfKind(rules, "leaderIs"), [{ kind: "leaderIs", leagueType: "singles", entityId: 9 }]);
      assert.equal(rulesOfKind(rules, "entityActive").length, 1);
    }
  });

  test("SHIFT_LEAD_CHANGE / SHIFT_MOMENTUM generate leaderIs only (Shift Wars teams have no elimination concept)", () => {
    const leadChange = validityRulesForStory(story({ storyType: "SHIFT_LEAD_CHANGE", leagueType: "shift_wars", facts: { newLeaderTeamId: 2, previousLeaderTeamId: 1, points: 15 } }));
    assert.deepEqual(rulesOfKind(leadChange, "leaderIs"), [{ kind: "leaderIs", leagueType: "shift_wars", entityId: 2 }]);
    assert.equal(rulesOfKind(leadChange, "entityActive").length, 0);

    const momentum = validityRulesForStory(story({ storyType: "SHIFT_MOMENTUM", leagueType: "shift_wars", facts: { leaderTeamId: 2, previousGap: 5, currentGap: 8, direction: "widening" } }));
    assert.deepEqual(rulesOfKind(momentum, "leaderIs"), [{ kind: "leaderIs", leagueType: "shift_wars", entityId: 2 }]);
  });
});

describe("validityRulesForStory — title-probability claims", () => {
  test("TITLE_SWING generates entityActive + a titleProbabilityBand from currentProbability", () => {
    const rules = validityRulesForStory(story({ storyType: "TITLE_SWING", facts: { entityId: 5, previousProbability: 0.2, currentProbability: 0.45, deltaPoints: 0.25 } }));
    assert.deepEqual(rulesOfKind(rules, "entityActive"), [{ kind: "entityActive", leagueType: "singles", entityId: 5 }]);
    assert.deepEqual(rulesOfKind(rules, "titleProbabilityBand"), [{ kind: "titleProbabilityBand", leagueType: "singles", entityId: 5, band: "favourite" }]);
  });

  test("NEW_FAVOURITE generates rules for the new favourite entity", () => {
    const rules = validityRulesForStory(story({ storyType: "NEW_FAVOURITE", facts: { newFavouriteEntityId: 6, previousFavouriteEntityId: 5, probability: 0.5 } }));
    assert.deepEqual(rulesOfKind(rules, "titleProbabilityBand"), [{ kind: "titleProbabilityBand", leagueType: "singles", entityId: 6, band: "favourite" }]);
  });

  test("DEAD_HEAT generates rules for BOTH tied entities", () => {
    const rules = validityRulesForStory(story({ storyType: "DEAD_HEAT", facts: { firstEntityId: 1, firstProbability: 0.3, secondEntityId: 2, secondProbability: 0.28 } }));
    assert.equal(rulesOfKind(rules, "entityActive").length, 2);
    const bands = rulesOfKind(rules, "titleProbabilityBand") as Extract<ValidityRule, { kind: "titleProbabilityBand" }>[];
    assert.deepEqual(bands.map(b => b.entityId).sort(), [1, 2]);
    assert.ok(bands.every(b => b.band === "contender"));
  });

  test("TITLE_RACE generates rules for every viable entity, zipping ids with probabilities", () => {
    const rules = validityRulesForStory(story({ storyType: "TITLE_RACE", facts: { viableEntityIds: [1, 2, 3], probabilities: [0.5, 0.3, 0.05] } }));
    const bands = rulesOfKind(rules, "titleProbabilityBand") as Extract<ValidityRule, { kind: "titleProbabilityBand" }>[];
    assert.equal(bands.length, 3);
    assert.equal(bands.find(b => b.entityId === 1)?.band, "favourite");
    assert.equal(bands.find(b => b.entityId === 2)?.band, "contender");
    assert.equal(bands.find(b => b.entityId === 3)?.band, "longshot");
    assert.equal(rulesOfKind(rules, "entityActive").length, 3);
  });

  test("a malformed TITLE_RACE facts object (mismatched array lengths) safely produces no title rules, not a crash", () => {
    const rules = validityRulesForStory(story({ storyType: "TITLE_RACE", facts: { viableEntityIds: [1, 2], probabilities: [0.5] } }));
    assert.equal(rulesOfKind(rules, "titleProbabilityBand").length, 0);
    assert.equal(rules.length, 1); // storyStillActive only
  });
});
