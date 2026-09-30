import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  londonDateKey,
  londonMonthKey,
  londonSeasonName,
  manualResetTiming,
  monthlyRolloverTiming,
} from "../season-calendar.ts";

describe("season calendar", () => {
  test("uses London midnight during British Summer Time", () => {
    const now = new Date("2026-09-30T23:05:00.000Z");

    assert.equal(londonDateKey(now), "2026-10-01");
    assert.equal(londonMonthKey(now), "2026-10");
    assert.equal(londonSeasonName(now), "October 2026");
    assert.deepEqual(monthlyRolloverTiming(now), {
      now,
      startDate: "2026-10-01",
      endDate: "2026-09-30",
    });
  });

  test("keeps month boundaries correct after the clocks return to GMT", () => {
    const now = new Date("2026-11-03T09:00:00.000Z");

    assert.deepEqual(monthlyRolloverTiming(now), {
      now,
      startDate: "2026-11-01",
      endDate: "2026-10-31",
    });
  });

  test("handles the December to January year boundary", () => {
    const now = new Date("2027-01-01T00:00:00.000Z");

    assert.deepEqual(monthlyRolloverTiming(now), {
      now,
      startDate: "2027-01-01",
      endDate: "2026-12-31",
    });
  });

  test("manual resets use the current London date", () => {
    const now = new Date("2026-06-12T23:30:00.000Z");

    assert.deepEqual(manualResetTiming(now), {
      now,
      startDate: "2026-06-13",
      endDate: "2026-06-13",
    });
  });
});
