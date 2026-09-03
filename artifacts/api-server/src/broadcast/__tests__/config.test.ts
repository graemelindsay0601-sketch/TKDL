/**
 * Tests for config-math.ts's pure validation helpers (parseHHMM,
 * parseSettingInt, resolveBroadcastConfig) — config.ts's own DB-facing
 * getBroadcastConfig()/seedBroadcastSettings() follow this folder's
 * established convention of no dedicated test for DB-facing code (see
 * history-reconstruction.ts, story-engine.ts, etc.).
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseHHMM, parseSettingInt, resolveBroadcastConfig, validateBroadcastSettingValue, BROADCAST_SETTING_DEFAULTS } from "../config-math.ts";

describe("parseHHMM", () => {
  test("accepts a valid 24-hour time", () => {
    assert.equal(parseHHMM("broadcast_evening_time", "19:00"), "19:00");
    assert.equal(parseHHMM("broadcast_night_time", "00:00"), "00:00");
    assert.equal(parseHHMM("broadcast_midday_time", "23:59"), "23:59");
  });

  test("falls back to the documented default on garbage input", () => {
    assert.equal(parseHHMM("broadcast_evening_time", "not a time"), BROADCAST_SETTING_DEFAULTS.broadcast_evening_time);
  });

  test("rejects an out-of-range hour or minute", () => {
    assert.equal(parseHHMM("broadcast_evening_time", "24:00"), BROADCAST_SETTING_DEFAULTS.broadcast_evening_time);
    assert.equal(parseHHMM("broadcast_evening_time", "19:60"), BROADCAST_SETTING_DEFAULTS.broadcast_evening_time);
  });

  test("rejects a 12-hour-style or unpadded time", () => {
    assert.equal(parseHHMM("broadcast_evening_time", "7:00pm"), BROADCAST_SETTING_DEFAULTS.broadcast_evening_time);
    assert.equal(parseHHMM("broadcast_evening_time", "7:00"), BROADCAST_SETTING_DEFAULTS.broadcast_evening_time);
  });
});

describe("parseSettingInt", () => {
  test("accepts a valid positive integer string", () => {
    assert.equal(parseSettingInt("broadcast_change_threshold", "30"), 30);
  });

  test("falls back to the default on non-numeric input", () => {
    assert.equal(parseSettingInt("broadcast_change_threshold", "thirty"), Number(BROADCAST_SETTING_DEFAULTS.broadcast_change_threshold));
  });

  test("falls back to the default on a non-integer (float) value", () => {
    assert.equal(parseSettingInt("broadcast_simulation_count", "2500.5"), Number(BROADCAST_SETTING_DEFAULTS.broadcast_simulation_count));
  });

  test("rejects a value below the default min (1) and falls back", () => {
    assert.equal(parseSettingInt("broadcast_live_poll_seconds", "0"), Number(BROADCAST_SETTING_DEFAULTS.broadcast_live_poll_seconds));
    assert.equal(parseSettingInt("broadcast_live_poll_seconds", "-5"), Number(BROADCAST_SETTING_DEFAULTS.broadcast_live_poll_seconds));
  });

  test("a custom min of 0 accepts 0 (banterLevel's own case)", () => {
    assert.equal(parseSettingInt("broadcast_banter_level", "0", 0), 0);
  });

  test("still rejects negative values even with min 0", () => {
    assert.equal(parseSettingInt("broadcast_banter_level", "-1", 0), Number(BROADCAST_SETTING_DEFAULTS.broadcast_banter_level));
  });
});

describe("resolveBroadcastConfig", () => {
  test("an empty lookup (nothing stored) resolves to every documented default", () => {
    const config = resolveBroadcastConfig(() => "");
    // An empty string fails every validator, so this also proves the
    // fallback path produces a fully valid, typed BroadcastConfig.
    assert.equal(config.middayTime, BROADCAST_SETTING_DEFAULTS.broadcast_midday_time);
    assert.equal(config.timezone, BROADCAST_SETTING_DEFAULTS.broadcast_timezone);
    assert.equal(config.changeThreshold, Number(BROADCAST_SETTING_DEFAULTS.broadcast_change_threshold));
    assert.equal(config.simulationCount, Number(BROADCAST_SETTING_DEFAULTS.broadcast_simulation_count));
    assert.equal(config.commentaryVersion, Number(BROADCAST_SETTING_DEFAULTS.broadcast_commentary_version));
  });

  test("valid stored overrides flow straight through", () => {
    const overrides: Record<string, string> = {
      broadcast_midday_time: "12:15", broadcast_evening_time: "20:00", broadcast_night_time: "23:30",
      broadcast_timezone: "Europe/London", broadcast_change_threshold: "45", broadcast_simulation_count: "5000",
      broadcast_live_poll_seconds: "15", broadcast_banter_level: "2", broadcast_commentary_version: "3",
      broadcast_programme_version: "2", broadcast_single_daily_episode: "0",
    };
    const config = resolveBroadcastConfig(key => overrides[key]);
    assert.equal(config.middayTime, "12:15");
    assert.equal(config.changeThreshold, 45);
    assert.equal(config.simulationCount, 5000);
    assert.equal(config.banterLevel, 2);
    assert.equal(config.commentaryVersion, 3);
    assert.equal(config.programmeVersion, 2);
    assert.equal(config.singleDailyEpisode, false);
  });

  describe("singleDailyEpisode", () => {
    test("defaults to true (one guaranteed daily episode) when nothing is stored", () => {
      const config = resolveBroadcastConfig(() => "");
      assert.equal(config.singleDailyEpisode, true);
    });

    test("\"1\" resolves true, \"0\" resolves false", () => {
      assert.equal(resolveBroadcastConfig(key => (key === "broadcast_single_daily_episode" ? "1" : "")).singleDailyEpisode, true);
      assert.equal(resolveBroadcastConfig(key => (key === "broadcast_single_daily_episode" ? "0" : "")).singleDailyEpisode, false);
    });
  });

  test("one malformed key falls back independently without disturbing the others", () => {
    const overrides: Record<string, string> = {
      broadcast_midday_time: "not-a-time", broadcast_evening_time: "20:00", broadcast_night_time: "00:00",
      broadcast_timezone: "Europe/London", broadcast_change_threshold: "45", broadcast_simulation_count: "2500",
      broadcast_live_poll_seconds: "30", broadcast_banter_level: "1", broadcast_commentary_version: "1",
      broadcast_programme_version: "1",
    };
    const config = resolveBroadcastConfig(key => overrides[key]);
    assert.equal(config.middayTime, BROADCAST_SETTING_DEFAULTS.broadcast_midday_time);
    assert.equal(config.eveningTime, "20:00");
    assert.equal(config.changeThreshold, 45);
  });
});

describe("validateBroadcastSettingValue", () => {
  test("accepts every documented default value for its own key", () => {
    for (const [key, value] of Object.entries(BROADCAST_SETTING_DEFAULTS)) {
      assert.equal(validateBroadcastSettingValue(key as keyof typeof BROADCAST_SETTING_DEFAULTS, value), null, `expected ${key}="${value}" to be valid`);
    }
  });

  test("rejects a malformed HH:MM time, unlike parseHHMM's own tolerant fallback", () => {
    assert.notEqual(validateBroadcastSettingValue("broadcast_evening_time", "7:00pm"), null);
    assert.notEqual(validateBroadcastSettingValue("broadcast_night_time", "24:00"), null);
  });

  test("accepts a valid IANA timezone and rejects a garbage one", () => {
    assert.equal(validateBroadcastSettingValue("broadcast_timezone", "America/New_York"), null);
    assert.notEqual(validateBroadcastSettingValue("broadcast_timezone", "Not/AZone"), null);
  });

  test("rejects a non-integer or below-minimum count/threshold", () => {
    assert.notEqual(validateBroadcastSettingValue("broadcast_change_threshold", "0"), null); // min 1
    assert.notEqual(validateBroadcastSettingValue("broadcast_simulation_count", "abc"), null);
    assert.notEqual(validateBroadcastSettingValue("broadcast_commentary_version", "1.5"), null);
  });

  test("banter level uniquely allows 0", () => {
    assert.equal(validateBroadcastSettingValue("broadcast_banter_level", "0"), null);
    assert.notEqual(validateBroadcastSettingValue("broadcast_banter_level", "-1"), null);
  });

  test("single_daily_episode only accepts the literal strings \"0\" or \"1\"", () => {
    assert.equal(validateBroadcastSettingValue("broadcast_single_daily_episode", "0"), null);
    assert.equal(validateBroadcastSettingValue("broadcast_single_daily_episode", "1"), null);
    assert.notEqual(validateBroadcastSettingValue("broadcast_single_daily_episode", "true"), null);
    assert.notEqual(validateBroadcastSettingValue("broadcast_single_daily_episode", "2"), null);
  });
});
