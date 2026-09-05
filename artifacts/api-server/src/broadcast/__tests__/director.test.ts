import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { directorSelect, selectProgrammeMode } from "../director.ts";
import { isRuntimeWithinProgrammeMode, PROGRAMME_PACING_RULES, type OrdinaryProgrammeMode } from "../director-math.ts";
import type { BroadcastStory } from "@workspace/db/schema";

function story(overrides: Partial<BroadcastStory> & Pick<BroadcastStory, "storyType">): BroadcastStory {
  return {
    id: 1,
    storyKey: `story-${overrides.storyType}`,
    leagueType: "singles",
    subjectKeys: ["singles:1"],
    anchorMatchId: null,
    seasonId: 1,
    detectedAt: new Date("2026-09-05T10:00:00Z"),
    updatedAt: new Date("2026-09-05T10:00:00Z"),
    resolvedAt: null,
    lifecycle: "ACTIVE",
    score: 50,
    confidence: 1,
    sentiment: "neutral",
    facts: { playedAt: "2026-09-05T09:00:00Z" },
    tags: [],
    lastFullEditionId: null,
    lastHeadlineEditionId: null,
    fullCount: 0,
    headlineCount: 0,
    ...overrides,
  };
}

describe("selectProgrammeMode", () => {
  test("selects NEWS for multiple strong fresh competitive stories", () => {
    const pool = [
      story({ id: 1, storyType: "MAJOR_UPSET", lifecycle: "NEW", score: 92 }),
      story({ id: 2, storyType: "NEW_LEADER", lifecycle: "HOT", score: 75 }),
    ];
    assert.equal(selectProgrammeMode(pool), "NEWS");
  });

  test("uses the real treatment scale: two headline-level results make a busy News Edition", () => {
    const pool = [
      story({ id: 10, storyType: "UPSET", lifecycle: "NEW", score: 30, anchorMatchId: 10 }),
      story({ id: 11, storyType: "LEADER_BEATEN", lifecycle: "HOT", score: 31, anchorMatchId: 11 }),
    ];
    assert.equal(selectProgrammeMode(pool), "NEWS");
  });

  test("one Supporting-or-better fresh result can lead a News Edition by itself", () => {
    assert.equal(selectProgrammeMode([
      story({ id: 12, storyType: "MAJOR_UPSET", lifecycle: "NEW", score: 50, anchorMatchId: 12 }),
    ]), "NEWS");
  });

  test("several detectors describing one match count as one competitive storyline", () => {
    const pool = [
      story({ id: 13, storyType: "REVENGE", lifecycle: "NEW", score: 42, anchorMatchId: 13 }),
      story({ id: 14, storyType: "FIRST_H2H_WIN", lifecycle: "NEW", score: 38, anchorMatchId: 13 }),
    ];
    assert.equal(selectProgrammeMode(pool), "BALANCED");
  });

  test("historical catch-up results discovered now produce Magazine context, not fresh competition", () => {
    const pool = [
      story({ id: 15, storyType: "REVENGE", lifecycle: "NEW", score: 42, anchorMatchId: 15, facts: { playedAt: "2026-06-01T20:00:00Z" } }),
      story({ id: 16, storyType: "LEADER_BEATEN", lifecycle: "NEW", score: 41, anchorMatchId: 16, facts: { playedAt: "2026-06-02T20:00:00Z" } }),
    ];
    assert.equal(selectProgrammeMode(pool, new Date("2026-09-05T10:00:00Z")), "MAGAZINE");
  });

  test("selects BALANCED for one fresh headline-level match plus feature material", () => {
    const pool = [
      story({ storyType: "UPSET", lifecycle: "NEW", score: 30, anchorMatchId: 1 }),
      story({ id: 2, storyType: "FEATURE_SPOTLIGHT", lifecycle: "ACTIVE", score: 35 }),
    ];
    assert.equal(selectProgrammeMode(pool), "BALANCED");
  });

  test("selects MAGAZINE when only evergreen, archive, or feature material is available", () => {
    const pool = [
      story({ storyType: "FEATURE_SPOTLIGHT", lifecycle: "ACTIVE", score: 35 }),
      story({ id: 2, storyType: "LAST_MEETING", lifecycle: "ACTIVE", score: 40 }),
      story({ id: 3, storyType: "SHADOW_BOT_PROMO", lifecycle: "HOT", score: 45 }),
    ];
    assert.equal(selectProgrammeMode(pool), "MAGAZINE");
  });
});

describe("mode-specific running orders", () => {
  const mixedPool = [
    story({ id: 1, storyType: "MAJOR_UPSET", lifecycle: "NEW", score: 92, subjectKeys: ["match:1"] }),
    story({ id: 2, storyType: "UPSET", lifecycle: "HOT", score: 76, leagueType: "doubles", subjectKeys: ["match:2"] }),
    story({ id: 3, storyType: "NEW_LEADER", lifecycle: "HOT", score: 74, leagueType: "shift_wars", subjectKeys: ["table:1"] }),
    story({ id: 4, storyType: "WIN_STREAK", lifecycle: "ACTIVE", score: 68, leagueType: "doubles", subjectKeys: ["player:4"] }),
    story({ id: 5, storyType: "FEATURE_SPOTLIGHT", lifecycle: "ACTIVE", score: 55, leagueType: "shift_wars", subjectKeys: ["feature:5"] }),
    story({ id: 6, storyType: "LAST_MEETING", lifecycle: "ACTIVE", score: 48, leagueType: "shift_wars", subjectKeys: ["archive:6"] }),
  ];

  function order(mode: OrdinaryProgrammeMode) {
    return directorSelect({ pool: mixedPool, previousProgramme: null, slotKey: `test-${mode}`, mode }).runningOrder;
  }

  test("NEWS leads with a fresh result and uses the fastest headline pace", () => {
    const result = order("NEWS");
    assert.equal(result.find(e => e.purpose === "main_story")?.group?.primary.storyType, "MAJOR_UPSET");
    assert.equal(result.filter(e => e.purpose === "headlines").length, 3);
    assert.deepEqual(PROGRAMME_PACING_RULES.NEWS.estimatedRuntimeSeconds, { min: 135, max: 300 });
  });

  test("BALANCED alternates news, analysis, and feature beats with fewer headlines", () => {
    const result = order("BALANCED");
    const body = result.filter(e => e.group && !["headlines", "what_to_watch", "closing"].includes(e.purpose));
    assert.equal(body[0].group?.primary.storyType, "MAJOR_UPSET");
    assert.equal(body[1].group?.primary.storyType, "NEW_LEADER");
    assert.equal(body[2].group?.primary.storyType, "LAST_MEETING");
    assert.equal(body[3].group?.primary.storyType, "UPSET");
    assert.equal(body[4].group?.primary.storyType, "WIN_STREAK");
    assert.equal(result.filter(e => e.purpose === "headlines").length, 2);
    assert.deepEqual(PROGRAMME_PACING_RULES.BALANCED.contentMix, ["news", "analysis", "feature", "news", "analysis", "feature"]);
  });

  test("MAGAZINE opens on a feature premise and has the loosest runtime band", () => {
    const result = order("MAGAZINE");
    assert.equal(result.find(e => e.purpose === "main_story")?.group?.primary.storyType, "FEATURE_SPOTLIGHT");
    assert.equal(result.filter(e => e.purpose === "headlines").length, 1);
    assert.equal(result.filter(e => e.group && e.purpose !== "headlines" && e.purpose !== "closing").length <= 6, true);
    assert.deepEqual(PROGRAMME_PACING_RULES.MAGAZINE.estimatedRuntimeSeconds, { min: 100, max: 420 });
  });

  test("every ordinary mode has a bounded runtime and content-mix rule", () => {
    for (const mode of ["NEWS", "BALANCED", "MAGAZINE"] as const) {
      const rule = PROGRAMME_PACING_RULES[mode];
      assert.ok(rule.estimatedRuntimeSeconds.min > 0);
      assert.ok(rule.estimatedRuntimeSeconds.max > rule.estimatedRuntimeSeconds.min);
      assert.equal(rule.contentMix.length, rule.maxStorySegments);
      assert.equal(isRuntimeWithinProgrammeMode(mode, rule.estimatedRuntimeSeconds.min), true);
      assert.equal(isRuntimeWithinProgrammeMode(mode, rule.estimatedRuntimeSeconds.max), true);
      assert.equal(isRuntimeWithinProgrammeMode(mode, rule.estimatedRuntimeSeconds.min - 0.4), true);
      assert.equal(isRuntimeWithinProgrammeMode(mode, rule.estimatedRuntimeSeconds.min - 0.6), false);
      assert.equal(isRuntimeWithinProgrammeMode(mode, rule.estimatedRuntimeSeconds.min - 1), false);
      assert.equal(isRuntimeWithinProgrammeMode(mode, rule.estimatedRuntimeSeconds.max + 1), false);
    }
  });

  test("applies a valid producer override to caps and mix", () => {
    const pacing = {
      maxHeadlineTeases: 1,
      maxStorySegments: 4,
      estimatedRuntimeSeconds: { min: 120, max: 240 },
      contentMix: ["feature", "news", "analysis", "feature"] as const,
    };
    const result = directorSelect({
      pool: mixedPool, previousProgramme: null, slotKey: "override", mode: "BALANCED", pacing,
    }).runningOrder;
    assert.equal(result.filter(e => e.purpose === "headlines").length, 1);
    const storyBackedBody = result.filter(e => e.group && !["headlines", "closing"].includes(e.purpose));
    assert.equal(storyBackedBody.length, 4);
    const body = storyBackedBody.filter(e => e.purpose !== "what_to_watch");
    assert.equal(body[0].group?.primary.storyType, "LAST_MEETING");
    assert.equal(isRuntimeWithinProgrammeMode("BALANCED", 180, { ...PROGRAMME_PACING_RULES, BALANCED: pacing }), true);
    assert.equal(isRuntimeWithinProgrammeMode("BALANCED", 300, { ...PROGRAMME_PACING_RULES, BALANCED: pacing }), false);
  });
});