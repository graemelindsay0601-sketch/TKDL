import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  BROADCAST_SETTING_DEFAULTS,
  resolveBroadcastConfig,
  validateBroadcastSettingValue,
} from "../config-math.ts";
import { PROGRAMME_PACING_RULES } from "../director-math.ts";

describe("programme profile settings", () => {
  test("defaults preserve the current editorial profiles", () => {
    const config = resolveBroadcastConfig(key => BROADCAST_SETTING_DEFAULTS[key]);
    assert.deepEqual(config.programmeProfiles, PROGRAMME_PACING_RULES);
  });

  test("accepts and resolves a valid override", () => {
    const override = JSON.stringify({
      maxHeadlineTeases: 2,
      maxStorySegments: 4,
      estimatedRuntimeSeconds: { min: 120, max: 260 },
      contentMix: ["news", "feature", "analysis", "news"],
    });
    assert.equal(validateBroadcastSettingValue("broadcast_news_profile", override), null);
    const config = resolveBroadcastConfig(key => key === "broadcast_news_profile" ? override : BROADCAST_SETTING_DEFAULTS[key]);
    assert.equal(config.programmeProfiles.NEWS.maxStorySegments, 4);
    assert.deepEqual(config.programmeProfiles.NEWS.contentMix, ["news", "feature", "analysis", "news"]);
  });

  test("rejects malformed profiles before saving", () => {
    const malformed = [
      "{",
      JSON.stringify({ maxHeadlineTeases: 9, maxStorySegments: 1, estimatedRuntimeSeconds: { min: 120, max: 240 }, contentMix: ["news"] }),
      JSON.stringify({ maxHeadlineTeases: 1, maxStorySegments: 2, estimatedRuntimeSeconds: { min: 300, max: 200 }, contentMix: ["news", "feature"] }),
      JSON.stringify({ maxHeadlineTeases: 1, maxStorySegments: 2, estimatedRuntimeSeconds: { min: 120, max: 240 }, contentMix: ["news"] }),
      JSON.stringify({ maxHeadlineTeases: 1, maxStorySegments: 1, estimatedRuntimeSeconds: { min: 120, max: 240 }, contentMix: ["sport"] }),
      JSON.stringify({ maxHeadlineTeases: 3, maxStorySegments: 2, estimatedRuntimeSeconds: { min: 120, max: 240 }, contentMix: ["news", "feature"] }),
      JSON.stringify({ maxHeadlineTeases: 1, maxStorySegments: 4, estimatedRuntimeSeconds: { min: 120, max: 121 }, contentMix: ["news", "feature", "analysis", "news"] }),
      JSON.stringify({ maxHeadlineTeases: 1, maxStorySegments: 3, estimatedRuntimeSeconds: { min: 120, max: 240 }, contentMix: ["news", "feature", "analysis"] }),
      JSON.stringify({ maxHeadlineTeases: 1, maxStorySegments: 4, estimatedRuntimeSeconds: { min: 600, max: 630 }, contentMix: ["news", "feature", "analysis", "news"] }),
    ];
    for (const raw of malformed) assert.notEqual(validateBroadcastSettingValue("broadcast_news_profile", raw), null);
  });

  test("malformed stored profiles fall back to current defaults", () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const config = resolveBroadcastConfig(key => key === "broadcast_magazine_profile" ? "{}" : BROADCAST_SETTING_DEFAULTS[key]);
      assert.deepEqual(config.programmeProfiles.MAGAZINE, PROGRAMME_PACING_RULES.MAGAZINE);
    } finally {
      console.warn = originalWarn;
    }
  });
});