/**
 * Regression coverage for getIsoWeekNumber(), used by challenge-manager.ts
 * to bucket weekly-challenge progress by week.
 *
 * Before the backend TypeScript cleanup, weekly challenge rows were keyed
 * by a broken getWeekStart() helper that no longer matched the
 * week_number column it was written into (the column had since been
 * changed from a week-starting date to an ISO week number elsewhere in the
 * app). That mismatch meant a player's weekly-challenge row from this file
 * was never found again on a later request — a fresh row got created every
 * time instead of the existing one being updated, so weekly progress
 * silently never accumulated. getIsoWeekNumber() replaced it to match the
 * column's real meaning; these tests pin down that it computes a standard
 * ISO-8601 week number, and that the same real date always lands on the
 * same week number the app already expects it to.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getIsoWeekNumber } from "../iso-week.ts";

describe("getIsoWeekNumber", () => {
  test("January 1st, 2026 (a Thursday) is ISO week 1", () => {
    // ISO 8601: week 1 is the week containing the year's first Thursday.
    assert.equal(getIsoWeekNumber(new Date(2026, 0, 1)), 1);
  });

  test("late December can roll into week 1 of the following ISO year", () => {
    // Dec 31, 2029 is a Monday, in the same ISO week as Jan 1-4, 2030 —
    // which is week 1 of 2030, not a 53rd week of 2029.
    assert.equal(getIsoWeekNumber(new Date(2029, 11, 31)), 1);
  });

  test("every day within the same Mon-Sun week returns the same week number", () => {
    // Mon 2026-08-24 through Sun 2026-08-30.
    const monday = getIsoWeekNumber(new Date(2026, 7, 24));
    for (let i = 1; i <= 6; i++) {
      const day = getIsoWeekNumber(new Date(2026, 7, 24 + i));
      assert.equal(day, monday, `day offset +${i} should share Monday's week number`);
    }
  });

  test("the week after rolls the number forward by exactly one", () => {
    const thisWeek = getIsoWeekNumber(new Date(2026, 7, 24)); // Monday
    const nextWeek = getIsoWeekNumber(new Date(2026, 7, 31)); // the following Monday
    assert.equal(nextWeek, thisWeek + 1);
  });
});
