import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogueFor } from "../../career/calendar/catalogue.ts";
import { generateSeason, calendarHashOf } from "../../career/calendar/generation.ts";
import { LOCALITIES } from "../../career/calendar/geography.ts";
import { CURRENT_EVENT_DATABASE_VERSION } from "../../career/calendar/config.ts";
import { FEE_OVERRIDES, PRIZE_OVERRIDES, prizeForPosition } from "../../career/finance/config.ts";
import { FREE_ENTRY_EVERY_WEEKS } from "../../career/content/season-v14.ts";

const seed = "f".repeat(64);

test("v14 Free Entry Night: every home area, at most four weeks apart, free, local, paying a cash pot", () => {
  assert.ok(CURRENT_EVENT_DATABASE_VERSION >= 14);
  const def = catalogueFor(14).find(d => d.key === "free-entry-night")!;
  assert.ok(def && !catalogueFor(13).some(d => d.key === "free-entry-night"));
  assert.equal(FEE_OVERRIDES["free-entry-night"].entryFeePence, 0);
  assert.deepEqual([1, 2, 3, 4, 5].map(p => prizeForPosition(PRIZE_OVERRIDES["free-entry-night"], p)), [4000, 2000, 1000, 1000, 0]);
  assert.equal(def.rankingCategory, null);
  for (const season of [1, 2]) {
    const nights = generateSeason(seed, 14, season).filter(e => e.definitionKey === "free-entry-night");
    for (const locality of LOCALITIES) {
      const weeks = nights.filter(e => e.localityKey === locality.key).map(e => e.startWeek).sort((a, b) => a - b);
      assert.ok(weeks.length >= 12, `${locality.key}: ${weeks.length} nights`);
      assert.ok(weeks[0] <= FREE_ENTRY_EVERY_WEEKS && 52 - weeks.at(-1)! < FREE_ENTRY_EVERY_WEEKS, `${locality.key} season edges`);
      assert.ok(weeks.slice(1).every((w, i) => w - weeks[i] === FREE_ENTRY_EVERY_WEEKS), `${locality.key} cadence`);
    }
  }
});

test("v14 leaves v13 seasons untouched", () => {
  const v13 = generateSeason(seed, 13, 1);
  assert.equal(calendarHashOf(v13), "7dce40e283ee2a0ac4d16111f8cfe13d839bcf71b4aeadc42be3f6f13026a161"); // v13 season 1 before v14 (generation change must not move it)
  const v14 = generateSeason(seed, 14, 1).filter(e => e.definitionKey !== "free-entry-night");
  assert.equal(v14.length, v13.length);
  assert.deepEqual(v14.map(e => [e.definitionKey, e.startWeek, e.venueKey]), v13.map(e => [e.definitionKey, e.startWeek, e.venueKey]));
});
