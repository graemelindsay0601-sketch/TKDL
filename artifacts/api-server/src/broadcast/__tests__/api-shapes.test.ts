/**
 * Tests for api-shapes.ts — the 14.4/14.5 API response-shaping layer.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  sceneForSegment, GRAPHIC_KIND_BY_STORY_TYPE, serializeSegment, humanizeStoryType, editionTitle,
  type GraphicKind,
} from "../api-shapes.ts";
import { STORY_TYPES_BY_FAMILY, STORY_FAMILIES, type StoryType } from "../story-types.ts";
import type { ProgrammeSegment, EditionProgramme } from "../director-math.ts";

function segment(overrides: Partial<ProgrammeSegment>): ProgrammeSegment {
  return {
    slot: 2, purpose: "main_story", importance: "major", storyId: 1, supportingStoryIds: [],
    storyType: "UPSET", leagueType: "singles", lifecycleAtBroadcast: "HOT",
    dialogue: [{ speaker: "A", text: "hello", holdSeconds: 3 }],
    validityRules: [{ kind: "storyStillActive", storyId: 1 }],
    facts: { playerId: 1 },
    ...overrides,
  };
}

describe("GRAPHIC_KIND_BY_STORY_TYPE", () => {
  test("every story type across every family has a graphic kind assigned", () => {
    for (const family of STORY_FAMILIES) {
      for (const storyType of STORY_TYPES_BY_FAMILY[family]) {
        assert.ok((storyType in GRAPHIC_KIND_BY_STORY_TYPE), `missing graphic kind for ${storyType}`);
      }
    }
  });

  test("wager-shaped stories map to WagerGraphic", () => {
    assert.equal(GRAPHIC_KIND_BY_STORY_TYPE.HIGH_STAKE_WIN, "WagerGraphic");
    assert.equal(GRAPHIC_KIND_BY_STORY_TYPE.HIGH_STAKE_LOSS, "WagerGraphic");
  });

  test("title-probability stories map to TitlePredictorGraphic", () => {
    for (const t of ["TITLE_SWING", "NEW_FAVOURITE", "DEAD_HEAT", "TITLE_RACE"] as StoryType[]) {
      assert.equal(GRAPHIC_KIND_BY_STORY_TYPE[t], "TitlePredictorGraphic");
    }
  });
});

describe("sceneForSegment", () => {
  test("opening_headlines is always the headlines scene", () => {
    assert.equal(sceneForSegment(segment({ purpose: "opening_headlines" })), "headlines");
  });

  test("closing is always the desk scene", () => {
    assert.equal(sceneForSegment(segment({ purpose: "closing", storyId: null, storyType: null })), "desk");
  });

  test("a CHAMPION story is always the champion scene, regardless of purpose", () => {
    assert.equal(sceneForSegment(segment({ purpose: "main_story", storyType: "CHAMPION" })), "champion");
  });

  test("a null storyId (slot 9's no-LEAGUE-story fallback) reads from the desk", () => {
    assert.equal(sceneForSegment(segment({ purpose: "what_to_watch", storyId: null, storyType: null })), "desk");
  });

  test("a MAJOR-importance breaking-worthy story type gets the breaking scene", () => {
    assert.equal(sceneForSegment(segment({ purpose: "main_story", importance: "major", storyType: "MAJOR_UPSET" })), "breaking");
  });

  test("the same breaking-worthy story type at featured importance does NOT get the breaking scene", () => {
    assert.notEqual(sceneForSegment(segment({ purpose: "main_story", importance: "featured", storyType: "MAJOR_UPSET" })), "breaking");
  });

  test("analysis_or_predictor and what_to_watch (with a real story) both read as analysis", () => {
    assert.equal(sceneForSegment(segment({ purpose: "analysis_or_predictor", storyType: "TITLE_RACE" })), "analysis");
    assert.equal(sceneForSegment(segment({ purpose: "what_to_watch", storyType: "TITLE_RACE" })), "analysis");
  });

  test("form_h2h_or_spotlight reads as spotlight", () => {
    assert.equal(sceneForSegment(segment({ purpose: "form_h2h_or_spotlight", storyType: "RIVALRY" })), "spotlight");
  });

  test("third_league_current_state and supporting_story_or_checkin read as result", () => {
    assert.equal(sceneForSegment(segment({ purpose: "third_league_current_state", storyType: "NEW_LEADER" })), "result");
    assert.equal(sceneForSegment(segment({ purpose: "supporting_story_or_checkin", storyType: "WIN_STREAK" })), "result");
  });

  test("lighter_or_archive_or_callback: an ARCHIVE-family story reads as graphic, everything else as spotlight", () => {
    assert.equal(sceneForSegment(segment({ purpose: "lighter_or_archive_or_callback", storyType: "LAST_MEETING" })), "graphic");
    assert.equal(sceneForSegment(segment({ purpose: "lighter_or_archive_or_callback", storyType: "QUIET_CLIMBER" })), "spotlight");
  });

  test("main_story / second_major_story default to desk when not breaking-worthy", () => {
    assert.equal(sceneForSegment(segment({ purpose: "main_story", storyType: "WIN_STREAK" })), "desk");
    assert.equal(sceneForSegment(segment({ purpose: "second_major_story", storyType: "NEW_LEADER" })), "desk");
  });
});

describe("serializeSegment", () => {
  test("a real story segment gets a non-null graphic built from its own facts", () => {
    const api = serializeSegment(segment({ storyType: "HIGH_STAKE_WIN", facts: { playerId: 5, wagerAmount: 10 } }), "slot-2");
    assert.equal(api.id, "slot-2");
    assert.equal(api.type, "HIGH_STAKE_WIN");
    assert.deepEqual(api.graphic, { kind: "WagerGraphic", data: { playerId: 5, wagerAmount: 10 } });
    assert.equal(api.estimatedSeconds, 3);
  });

  test("a utility segment (no storyType/facts) gets type falling back to purpose and a null graphic", () => {
    const api = serializeSegment(segment({ purpose: "closing", storyId: null, storyType: null, facts: null, dialogue: [{ speaker: "A", text: "bye", holdSeconds: 2 }, { speaker: "B", text: "bye2", holdSeconds: 4 }] }), "slot-10");
    assert.equal(api.type, "closing");
    assert.equal(api.graphic, null);
    assert.equal(api.estimatedSeconds, 6);
  });

  test("the real (possibly wider-than-4-value) importance passes through untouched", () => {
    const api = serializeSegment(segment({ importance: "headline_ticker" as ProgrammeSegment["importance"] }), "slot-1");
    assert.equal(api.importance, "headline_ticker");
  });
});

describe("humanizeStoryType", () => {
  test("a plain multi-word type", () => {
    assert.equal(humanizeStoryType("NEW_LEADER"), "New Leader");
  });
  test("a leading numeric segment is preserved as-is", () => {
    assert.equal(humanizeStoryType("180_MILESTONE"), "180 Milestone");
  });
  test("a single-word type", () => {
    assert.equal(humanizeStoryType("REVENGE"), "Revenge");
  });
});

describe("editionTitle", () => {
  const emptyProgramme: EditionProgramme = { segments: [] };

  test("includes the slot label and date even with no main_story segment", () => {
    const title = editionTitle({ slotType: "evening", scheduledFor: new Date("2026-09-02T18:00:00Z") }, emptyProgramme);
    assert.match(title, /^TKDL LIVE — Evening Edition, 2 September$/);
  });

  test("appends a humanized suffix from the programme's own main_story segment", () => {
    const programme: EditionProgramme = { segments: [segment({ purpose: "main_story", storyType: "NEW_LEADER" })] };
    const title = editionTitle({ slotType: "midday", scheduledFor: new Date("2026-01-15T11:30:00Z") }, programme);
    assert.equal(title, "TKDL LIVE — Midday Edition, 15 January: New Leader");
  });

  test("night slot uses the 'Late Night' label", () => {
    const title = editionTitle({ slotType: "night", scheduledFor: new Date("2026-09-03T00:00:00Z") }, emptyProgramme);
    assert.match(title, /^TKDL LIVE — Late Night Edition,/);
  });
});
