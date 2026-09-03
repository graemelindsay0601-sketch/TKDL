/**
 * Tests for director-math.ts — the Broadcast Director's pure math (handover
 * doc sections 9.6, 10, 11.1-11.3).
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  mergeStoriesByAnchorAndNarrative, editionChangeScore, newlyCreatedGroupTreatments,
  isForcedRefresh, classifyCarryForward, isCarryForwardEligibleForFullSegment,
  fullSegmentPriority, isWithinSubjectExposureCap, isWithinLeagueAirtimeCap,
  NORMAL_RUNNING_ORDER_TEMPLATE, evaluateQualityGate,
  LEAGUE_AIRTIME_SOFT_CAP, MAX_FULL_SEGMENTS_PER_SUBJECT,
} from "../director-math.ts";
import type { BroadcastStory } from "@workspace/db/schema";

let nextId = 1;
function story(overrides: Partial<BroadcastStory> = {}): BroadcastStory {
  return {
    id: nextId++,
    storyKey: `key-${nextId}`,
    leagueType: "singles",
    storyType: "UPSET",
    subjectKeys: ["singles:1", "singles:2"],
    anchorMatchId: null,
    detectedAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
    resolvedAt: null,
    lifecycle: "NEW",
    score: 60,
    confidence: 80,
    sentiment: "neutral",
    facts: {},
    tags: [],
    lastFullEditionId: null,
    lastHeadlineEditionId: null,
    fullCount: 0,
    headlineCount: 0,
    ...overrides,
  } as BroadcastStory;
}

describe("mergeStoriesByAnchorAndNarrative", () => {
  test("groups match-anchored stories sharing the same anchorMatchId", () => {
    const a = story({ anchorMatchId: 100, score: 90, storyType: "MAJOR_UPSET" });
    const b = story({ anchorMatchId: 100, score: 40, storyType: "STREAK_BREAKER" });
    const c = story({ anchorMatchId: 200, score: 50 });
    const groups = mergeStoriesByAnchorAndNarrative([a, b, c]);
    assert.equal(groups.length, 2);
    const group100 = groups.find(g => g.groupKey === "match:100")!;
    assert.equal(group100.primary.id, a.id);
    assert.deepEqual(group100.supporting.map(s => s.id), [b.id]);
  });

  test("groups subject-anchored stories (no anchorMatchId) sharing the exact same subject-key set", () => {
    const a = story({ anchorMatchId: null, subjectKeys: ["singles:7"], storyType: "WIN_STREAK", score: 70 });
    const b = story({ anchorMatchId: null, subjectKeys: ["singles:7"], storyType: "ABOVE_BASELINE", score: 55 });
    const groups = mergeStoriesByAnchorAndNarrative([a, b]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].primary.id, a.id);
    assert.equal(groups[0].supporting.length, 1);
  });

  test("subject-key order doesn't matter — [\"a\",\"b\"] and [\"b\",\"a\"] merge together", () => {
    const a = story({ subjectKeys: ["singles:1", "singles:2"] });
    const b = story({ subjectKeys: ["singles:2", "singles:1"] });
    const groups = mergeStoriesByAnchorAndNarrative([a, b]);
    assert.equal(groups.length, 1);
  });

  test("different subject-key sets never merge", () => {
    const a = story({ subjectKeys: ["singles:1"] });
    const b = story({ subjectKeys: ["singles:2"] });
    assert.equal(mergeStoriesByAnchorAndNarrative([a, b]).length, 2);
  });

  test("a single ungrouped story is its own group with no supporting stories", () => {
    const a = story();
    const groups = mergeStoriesByAnchorAndNarrative([a]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].primary.id, a.id);
    assert.deepEqual(groups[0].supporting, []);
  });

  test("ties in score break deterministically by lowest id", () => {
    const a = story({ anchorMatchId: 1, score: 60 });
    const b = story({ anchorMatchId: 1, score: 60 });
    const groups = mergeStoriesByAnchorAndNarrative([b, a]); // deliberately out of id order
    assert.equal(groups[0].primary.id, Math.min(a.id, b.id));
  });

  test("empty input returns no groups", () => {
    assert.deepEqual(mergeStoriesByAnchorAndNarrative([]), []);
  });
});

describe("editionChangeScore", () => {
  test("counts +5 per new completed match", () => {
    assert.equal(editionChangeScore({ newCompletedMatchCount: 4, newlyCreatedGroupTreatments: [] }), 20);
  });

  test("counts +5/+10/+20 for newly created supporting/featured/major groups", () => {
    const score = editionChangeScore({ newCompletedMatchCount: 0, newlyCreatedGroupTreatments: ["supporting", "featured", "major"] });
    assert.equal(score, 5 + 10 + 20);
  });

  test("headline_ticker and archive treatments earn no bonus", () => {
    assert.equal(editionChangeScore({ newCompletedMatchCount: 0, newlyCreatedGroupTreatments: ["headline_ticker", "archive"] }), 0);
  });

  test("matches and stories combine additively", () => {
    assert.equal(editionChangeScore({ newCompletedMatchCount: 2, newlyCreatedGroupTreatments: ["major"] }), 10 + 20);
  });

  test("reaches the documented threshold example: 6 matches alone hits 30", () => {
    assert.equal(editionChangeScore({ newCompletedMatchCount: 6, newlyCreatedGroupTreatments: [] }), 30);
  });
});

describe("newlyCreatedGroupTreatments", () => {
  test("only includes groups whose PRIMARY is lifecycle NEW", () => {
    const newMajor = story({ score: 90, lifecycle: "NEW" });
    const oldActive = story({ score: 90, lifecycle: "ACTIVE", anchorMatchId: 999 });
    const groups = mergeStoriesByAnchorAndNarrative([newMajor, oldActive]);
    const treatments = newlyCreatedGroupTreatments(groups);
    assert.deepEqual(treatments, ["major"]);
  });

  test("one merged group with a newly-created primary counts once, not once per raw row (the 10.1 anti-inflation rule)", () => {
    const primary = story({ anchorMatchId: 1, score: 90, lifecycle: "NEW" });
    const supportingA = story({ anchorMatchId: 1, score: 60, lifecycle: "NEW" });
    const supportingB = story({ anchorMatchId: 1, score: 55, lifecycle: "NEW" });
    const groups = mergeStoriesByAnchorAndNarrative([primary, supportingA, supportingB]);
    assert.equal(groups.length, 1);
    assert.deepEqual(newlyCreatedGroupTreatments(groups), ["major"]);
  });

  test("a group whose primary is NOT new contributes nothing even if a supporting story is new", () => {
    const primary = story({ anchorMatchId: 2, score: 90, lifecycle: "ACTIVE" });
    const supporting = story({ anchorMatchId: 2, score: 40, lifecycle: "NEW" });
    const groups = mergeStoriesByAnchorAndNarrative([primary, supporting]);
    assert.deepEqual(newlyCreatedGroupTreatments(groups), []);
  });
});

describe("isForcedRefresh", () => {
  const base = {
    seasonChampionOrResetEventOccurred: false,
    noPublishedEditionExists: false,
    publishedEditionAgeHours: 1,
    hasAtLeastOneNewMatch: false,
    adminForced: false,
  };

  test("bootstrap: no published Edition exists", () => {
    assert.equal(isForcedRefresh({ ...base, noPublishedEditionExists: true, publishedEditionAgeHours: null }), true);
  });

  test("season champion / reset event forces refresh", () => {
    assert.equal(isForcedRefresh({ ...base, seasonChampionOrResetEventOccurred: true }), true);
  });

  test("admin force always wins", () => {
    assert.equal(isForcedRefresh({ ...base, adminForced: true }), true);
  });

  test("24h-stale requires BOTH age > 24h AND at least one new match", () => {
    assert.equal(isForcedRefresh({ ...base, publishedEditionAgeHours: 25, hasAtLeastOneNewMatch: false }), false);
    assert.equal(isForcedRefresh({ ...base, publishedEditionAgeHours: 25, hasAtLeastOneNewMatch: true }), true);
  });

  test("exactly 24h old is not yet stale (strictly greater than)", () => {
    assert.equal(isForcedRefresh({ ...base, publishedEditionAgeHours: 24, hasAtLeastOneNewMatch: true }), false);
  });

  test("none of the conditions -> not forced", () => {
    assert.equal(isForcedRefresh(base), false);
  });
});

describe("classifyCarryForward", () => {
  test("not featured in the previous Edition -> null (not a carry-forward candidate at all)", () => {
    assert.equal(classifyCarryForward({ wasFeaturedInPreviousEdition: false, currentLifecycle: "ACTIVE" }), null);
  });

  test("RESOLVED lifecycle -> RESOLVED state", () => {
    assert.equal(classifyCarryForward({ wasFeaturedInPreviousEdition: true, currentLifecycle: "RESOLVED" }), "RESOLVED");
  });

  test("ARCHIVED lifecycle -> STALE state", () => {
    assert.equal(classifyCarryForward({ wasFeaturedInPreviousEdition: true, currentLifecycle: "ARCHIVED" }), "STALE");
  });

  test("HOT or COOLING (materially changed) -> DEVELOPED", () => {
    assert.equal(classifyCarryForward({ wasFeaturedInPreviousEdition: true, currentLifecycle: "HOT" }), "DEVELOPED");
    assert.equal(classifyCarryForward({ wasFeaturedInPreviousEdition: true, currentLifecycle: "COOLING" }), "DEVELOPED");
  });

  test("ACTIVE (unchanged) -> ACTIVE", () => {
    assert.equal(classifyCarryForward({ wasFeaturedInPreviousEdition: true, currentLifecycle: "ACTIVE" }), "ACTIVE");
  });

  test("NEW (a recurrence after resolving) -> STALE (the old occurrence is over)", () => {
    assert.equal(classifyCarryForward({ wasFeaturedInPreviousEdition: true, currentLifecycle: "NEW" }), "STALE");
  });
});

describe("isCarryForwardEligibleForFullSegment", () => {
  test("ACTIVE and DEVELOPED are always eligible", () => {
    assert.equal(isCarryForwardEligibleForFullSegment("ACTIVE", false), true);
    assert.equal(isCarryForwardEligibleForFullSegment("DEVELOPED", true), true);
  });

  test("STALE is never eligible", () => {
    assert.equal(isCarryForwardEligibleForFullSegment("STALE", false), false);
  });

  test("RESOLVED is eligible exactly once", () => {
    assert.equal(isCarryForwardEligibleForFullSegment("RESOLVED", false), true);
    assert.equal(isCarryForwardEligibleForFullSegment("RESOLVED", true), false);
  });
});

describe("fullSegmentPriority", () => {
  test("no previous-Edition history -> full base score", () => {
    assert.equal(fullSegmentPriority({ baseScore: 80, carryForwardState: null, alreadyGivenResolutionSegment: false }), 80);
  });

  test("STALE is excluded outright (-Infinity)", () => {
    assert.equal(fullSegmentPriority({ baseScore: 95, carryForwardState: "STALE", alreadyGivenResolutionSegment: false }), -Infinity);
  });

  test("an already-spent RESOLVED story is excluded outright", () => {
    assert.equal(fullSegmentPriority({ baseScore: 95, carryForwardState: "RESOLVED", alreadyGivenResolutionSegment: true }), -Infinity);
  });

  test("ACTIVE takes a repetition penalty but stays eligible", () => {
    const p = fullSegmentPriority({ baseScore: 80, carryForwardState: "ACTIVE", alreadyGivenResolutionSegment: false });
    assert.ok(p < 80 && p > -Infinity);
  });

  test("DEVELOPED and a fresh RESOLVED take no penalty", () => {
    assert.equal(fullSegmentPriority({ baseScore: 80, carryForwardState: "DEVELOPED", alreadyGivenResolutionSegment: false }), 80);
    assert.equal(fullSegmentPriority({ baseScore: 80, carryForwardState: "RESOLVED", alreadyGivenResolutionSegment: false }), 80);
  });
});

describe("isWithinSubjectExposureCap", () => {
  test("under the cap is always fine", () => {
    assert.equal(isWithinSubjectExposureCap({ fullSegmentsAlreadyGivenToThisSubjectThisEdition: 0, candidateTreatment: "supporting" }), true);
    assert.equal(isWithinSubjectExposureCap({ fullSegmentsAlreadyGivenToThisSubjectThisEdition: MAX_FULL_SEGMENTS_PER_SUBJECT - 1, candidateTreatment: "supporting" }), true);
  });

  test("at the cap, only a Major story is allowed through", () => {
    assert.equal(isWithinSubjectExposureCap({ fullSegmentsAlreadyGivenToThisSubjectThisEdition: MAX_FULL_SEGMENTS_PER_SUBJECT, candidateTreatment: "featured" }), false);
    assert.equal(isWithinSubjectExposureCap({ fullSegmentsAlreadyGivenToThisSubjectThisEdition: MAX_FULL_SEGMENTS_PER_SUBJECT, candidateTreatment: "major" }), true);
  });
});

describe("isWithinLeagueAirtimeCap", () => {
  test("a Major story always overrides the cap", () => {
    assert.equal(isWithinLeagueAirtimeCap({ candidateTreatment: "major", candidateSeconds: 60, thisLeagueSecondsSoFar: 1000, totalFullSegmentSecondsSoFar: 1000, onlyLeagueWithContent: false }), true);
  });

  test("the very first segment booked is always within cap (nothing to be a share of yet)", () => {
    assert.equal(isWithinLeagueAirtimeCap({ candidateTreatment: "supporting", candidateSeconds: 30, thisLeagueSecondsSoFar: 0, totalFullSegmentSecondsSoFar: 0, onlyLeagueWithContent: false }), true);
  });

  test("pushing one league over 55% of total airtime fails the cap", () => {
    // 100s already this league, 100s total so far; adding 50 more of the
    // same league -> 150/150 = 100% share, clearly over 55%.
    assert.equal(isWithinLeagueAirtimeCap({ candidateTreatment: "featured", candidateSeconds: 50, thisLeagueSecondsSoFar: 100, totalFullSegmentSecondsSoFar: 100, onlyLeagueWithContent: false }), false);
  });

  test("a well-balanced addition stays within cap", () => {
    // 30s this league, 100s total so far; adding 20 more -> 50/120 ≈ 41.7%, under 55%.
    assert.equal(isWithinLeagueAirtimeCap({ candidateTreatment: "featured", candidateSeconds: 20, thisLeagueSecondsSoFar: 30, totalFullSegmentSecondsSoFar: 100, onlyLeagueWithContent: false }), true);
  });

  test("onlyLeagueWithContent bypasses the cap even at 100% share — a single-league club has nothing else to balance against", () => {
    // Same shape as the "pushing one league over 55%" case above (which
    // fails when a second league exists to protect airtime for) — but with
    // onlyLeagueWithContent: true this must pass, or a club with only one
    // active league would be capped at a single full segment per Edition
    // forever, no matter how many genuine stories the pool has.
    assert.equal(isWithinLeagueAirtimeCap({ candidateTreatment: "featured", candidateSeconds: 50, thisLeagueSecondsSoFar: 100, totalFullSegmentSecondsSoFar: 100, onlyLeagueWithContent: true }), true);
  });
});

describe("NORMAL_RUNNING_ORDER_TEMPLATE", () => {
  test("has exactly 10 slots, numbered 1-10 in order", () => {
    assert.equal(NORMAL_RUNNING_ORDER_TEMPLATE.length, 10);
    NORMAL_RUNNING_ORDER_TEMPLATE.forEach((s, i) => assert.equal(s.slot, i + 1));
  });

  test("opening headlines, main story, what-to-watch and closing are required; everything else is optional", () => {
    const required = NORMAL_RUNNING_ORDER_TEMPLATE.filter(s => s.required).map(s => s.purpose);
    assert.deepEqual(required, ["opening_headlines", "main_story", "what_to_watch", "closing"]);
  });
});

describe("evaluateQualityGate", () => {
  function segment(overrides: Partial<import("../director-math.ts").QualityGateSegment> = {}) {
    return { id: "s1", leagueType: "singles" as const, importance: "supporting" as const, sentiment: "neutral" as const, storyId: 1, ...overrides };
  }
  const baseInput = {
    segments: [
      segment({ id: "a", leagueType: "singles" }),
      segment({ id: "b", leagueType: "doubles" }),
      segment({ id: "c", leagueType: "shift_wars" }),
      segment({ id: "d", leagueType: "singles" }),
    ],
    isChampionOrSeasonBoundarySpecial: false,
    hasFactsOutsideCutoffSnapshot: false,
    hasInvalidFutureMatchLanguage: false,
    hasUnresolvedPlaceholders: false,
    hasDuplicateStoryIds: false,
    playersWithRepeatedNegativeBanterInCooldown: [],
  };

  test("a clean 4-segment programme passes", () => {
    assert.deepEqual(evaluateQualityGate(baseInput), { pass: true });
  });

  test("fewer than 4 meaningful segments fails, unless it's a champion/season-boundary special", () => {
    const shortInput = { ...baseInput, segments: baseInput.segments.slice(0, 2) };
    const result = evaluateQualityGate(shortInput);
    assert.equal(result.pass, false);
    assert.equal(evaluateQualityGate({ ...shortInput, isChampionOrSeasonBoundarySpecial: true }).pass, true);
  });

  test("facts outside the cutoff snapshot fails", () => {
    assert.equal(evaluateQualityGate({ ...baseInput, hasFactsOutsideCutoffSnapshot: true }).pass, false);
  });

  test("invalid future-match language fails", () => {
    assert.equal(evaluateQualityGate({ ...baseInput, hasInvalidFutureMatchLanguage: true }).pass, false);
  });

  test("unresolved placeholders fail", () => {
    assert.equal(evaluateQualityGate({ ...baseInput, hasUnresolvedPlaceholders: true }).pass, false);
  });

  test("duplicate story ids fail", () => {
    assert.equal(evaluateQualityGate({ ...baseInput, hasDuplicateStoryIds: true }).pass, false);
  });

  test("no positive or neutral segment at all fails", () => {
    const allNegative = { ...baseInput, segments: baseInput.segments.map(s => segment({ id: s.id, sentiment: "negative" as const })) };
    assert.equal(evaluateQualityGate(allNegative).pass, false);
  });

  test("repeated negative banter in cooldown fails and names the player", () => {
    const result = evaluateQualityGate({ ...baseInput, playersWithRepeatedNegativeBanterInCooldown: ["singles:7"] });
    assert.equal(result.pass, false);
    if (!result.pass) assert.ok(result.reasons.some(r => r.includes("singles:7")));
  });

  test("one league exceeding the soft cap fails when no Major story justifies it", () => {
    const segments = [
      segment({ id: "a", leagueType: "singles" }),
      segment({ id: "b", leagueType: "singles" }),
      segment({ id: "c", leagueType: "singles" }),
      segment({ id: "d", leagueType: "doubles" }),
    ];
    const result = evaluateQualityGate({ ...baseInput, segments });
    assert.equal(result.pass, false);
  });

  test("a Major story present exempts the league-cap check", () => {
    const segments = [
      segment({ id: "a", leagueType: "singles", importance: "major" }),
      segment({ id: "b", leagueType: "singles" }),
      segment({ id: "c", leagueType: "singles" }),
      segment({ id: "d", leagueType: "doubles" }),
    ];
    const result = evaluateQualityGate({ ...baseInput, segments });
    assert.equal(result.pass, true);
  });

  test("utility-importance segments (headlines/closing/what-to-watch) don't count toward the league-airtime tally", () => {
    const segments = [
      segment({ id: "a", leagueType: "singles", importance: "utility" }),
      segment({ id: "b", leagueType: "singles", importance: "supporting" }),
      segment({ id: "c", leagueType: "doubles", importance: "supporting" }),
      segment({ id: "d", leagueType: "shift_wars", importance: "supporting" }),
    ];
    assert.equal(evaluateQualityGate({ ...baseInput, segments }).pass, true);
  });

  test("a club with only one active league passes at 100% share — there's no second league it could have crowded out", () => {
    // Same shape as "one league exceeding the soft cap fails" above (3
    // singles + would normally need a second league to compare against),
    // but here EVERY full segment is singles because that's the only league
    // with any real content — a singles-only club must not be capped at a
    // single full segment per Edition forever just because 100% of nothing
    // else is still 100%.
    const segments = [
      segment({ id: "a", leagueType: "singles" }),
      segment({ id: "b", leagueType: "singles" }),
      segment({ id: "c", leagueType: "singles" }),
      segment({ id: "d", leagueType: "singles" }),
    ];
    assert.equal(evaluateQualityGate({ ...baseInput, segments }).pass, true);
  });
});

// Sanity: the exported constants match the doc's own literal numbers, so a
// future accidental edit to director-math.ts is caught here even if no
// other test happens to exercise the exact value.
describe("documented constants", () => {
  test("LEAGUE_AIRTIME_SOFT_CAP is 55%", () => assert.equal(LEAGUE_AIRTIME_SOFT_CAP, 0.55));
  test("MAX_FULL_SEGMENTS_PER_SUBJECT is 2", () => assert.equal(MAX_FULL_SEGMENTS_PER_SUBJECT, 2));
});
