import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogueFor } from "../../career/calendar/catalogue.ts";
import { CURRENT_EVENT_DATABASE_VERSION } from "../../career/calendar/config.ts";
import { rankingListsFor, rankingRulesVersionFor, tourCardRulesFor, tourCardRulesVersionFor } from "../../career/sporting/config.ts";

test("v12 Development Tour: 16–23 on the event date, its own ranking category; older databases unchanged", () => {
  assert.equal(CURRENT_EVENT_DATABASE_VERSION, 12);
  const v12 = catalogueFor(12), v11 = catalogueFor(11);
  const dev = v12.find(d => d.key === "development-tour")!;
  assert.deepEqual(dev.eligibility, { type: "AGE", minAge: 16, maxAgeExclusive: 24 });
  assert.equal(dev.rankingCategory, "DEVELOPMENT");
  assert.equal(dev.classification, "RANKING");
  assert.match(dev.content?.summary ?? "", /Tour Card/);
  for (const key of ["youth-masters", "youth-world-championship"]) assert.deepEqual(v12.find(d => d.key === key)!.eligibility, { type: "AGE", maxAgeExclusive: 24 });
  assert.equal(v11.find(d => d.key === "development-tour")!.rankingCategory, "YOUTH", "v11 is immutable");
  assert.equal(v12.length, v11.length);
  for (const d of v12) if (!["development-tour", "youth-masters", "youth-world-championship"].includes(d.key))
    assert.deepEqual({ ...d, eventDatabaseVersion: 11 }, v11.find(o => o.key === d.key), `${d.key} unchanged apart from the version`);
});

test("ranking rules v4: a Development Tour Order of Merit; Development results still count for the Youth Order of Merit", () => {
  assert.equal(rankingRulesVersionFor(12), 4); assert.equal(rankingRulesVersionFor(11), 3);
  const lists = rankingListsFor(4);
  const dev = lists.find(l => l.key === "development")!;
  assert.deepEqual([dev.categories, dev.window], [["DEVELOPMENT"], { kind: "SEASON" }]);
  assert.deepEqual(lists.find(l => l.key === "youth")!.categories, ["YOUTH", "DEVELOPMENT"]);
  assert.ok(!rankingListsFor(3).some(l => l.key === "development"));
  for (const l of lists) if (l.key !== "development") assert.ok(!["pro-world", "challenger", "amateur"].includes(l.key) || !l.categories.includes("DEVELOPMENT"), `${l.key} ignores Development results`);
});

test("Tour Card rules v3: two Development cards, Final Stage 3rd–16th, Open Championship 3rd–10th; v2 unchanged", () => {
  assert.equal(tourCardRulesVersionFor(12), 3);
  const v3 = tourCardRulesFor(3), v2 = tourCardRulesFor(2);
  assert.deepEqual(v3.developmentCards, { list: "development", count: 2 });
  assert.deepEqual(v3.developmentPlaces, { qSchoolPositions: [3, 16], openChampionshipPositions: [3, 10] });
  assert.equal(v2.developmentCards, undefined);
  assert.deepEqual({ ...v3, developmentCards: undefined, developmentPlaces: undefined }, { ...v2, developmentCards: undefined, developmentPlaces: undefined });
});
