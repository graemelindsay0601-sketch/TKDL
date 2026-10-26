import { test } from "node:test";
import assert from "node:assert/strict";
import { COUNTY_SQUAD_FORMAT, countyFixtures, countySelectionRanking, countyTables, selectCountySquads } from "../../career/club/county-squads.ts";

test("UKDA-style A/B squads rank prior-season points separately by category", () => {
  const players = Array.from({ length: 40 }, (_, i) => ({
    key: `m${i}`, points: 100 - i, women: false,
  })).concat(Array.from({ length: 20 }, (_, i) => ({
    key: `w${i}`, points: 80 - i, women: true,
  })));
  const squads = selectCountySquads(players);
  assert.equal(squads.MEN.A.length, 12);
  assert.equal(squads.MEN.B.length, 12);
  assert.equal(squads.WOMEN.A.length, 6);
  assert.equal(squads.WOMEN.B.length, 6);
  assert.equal(squads.MEN.A[0].key, "m0");
  assert.equal(squads.MEN.B[0].key, "m12");
  assert.equal(squads.WOMEN.B[0].key, "w6");
  assert.equal(COUNTY_SQUAD_FORMAT.menABestOf, 7);
  assert.equal(COUNTY_SQUAD_FORMAT.menBBestOfByDivision.ONE, 5);
  assert.equal(COUNTY_SQUAD_FORMAT.womenBestOf, 5);
});

test("a county-trial win earns a labelled B-squad place without adding ranking points", () => {
  const players = Array.from({ length: 25 }, (_, i) => ({ key: `m${i}`, points: 100 - i, women: false }));
  const squads = selectCountySquads([...players, { key: "HUMAN", points: 0, women: false }], "MEN");
  assert.deepEqual(squads.MEN.A.map(p => p.key), players.slice(0, 12).map(p => p.key));
  assert.equal(squads.MEN.B.length, 12);
  assert.equal(squads.MEN.B.at(-1)?.key, "HUMAN");
  assert.equal(squads.MEN.B.at(-1)?.selectionSource, "COUNTY_TRIAL");
  assert.equal(squads.MEN.B.at(-1)?.points, 0);
  assert.equal(squads.WOMEN.B.length, 0);
});

test("county individual results can move a trial-earned B player into A next season", () => {
  const players = Array.from({ length: 30 }, (_, i) => ({ key: `m${i}`, points: 80 - i, women: false }));
  const human = { key: "HUMAN", points: 100, women: false };
  const squads = selectCountySquads([...players, human], "MEN");
  const progress = countySelectionRanking([...players, human], "MEN");
  assert.equal(progress.rank, 1);
  assert.equal(progress.projectedTeam, "A");
  assert.equal(squads.MEN.A[0].key, "HUMAN");
  assert.ok(!squads.MEN.B.some(player => player.key === "HUMAN"), "ranking selection takes precedence over the trial's B place");

  const lowerRanked = countySelectionRanking([...players, { ...human, points: 60 }], "MEN");
  assert.equal(lowerRanked.projectedTeam, "B");
  assert.equal(lowerRanked.aCutoffPoints, 69);
});

test("county fixture schedule is single round-robin and county table counts only match results", () => {
  const counties = ["A", "B", "C", "D"];
  const fixtures = countyFixtures(counties, [4, 8, 12]);
  assert.equal(fixtures.length, 6);
  for (const a of counties) for (const b of counties) if (a !== b) {
    assert.equal(fixtures.filter(f => f.home === a && f.away === b).length +
      fixtures.filter(f => f.home === b && f.away === a).length, 1);
  }
  const table = countyTables(counties, [
    { category: "MEN", team: "A", home: "A", away: "B", homeSets: 8, awaySets: 4, homeLegs: 34, awayLegs: 24, homeAverage: 75, awayAverage: 68 },
    { category: "MEN", team: "A", home: "C", away: "A", homeSets: 6, awaySets: 6, homeLegs: 30, awayLegs: 31, homeAverage: 70, awayAverage: 72 },
  ]);
  const mensA = table.filter(row => row.category === "MEN" && row.team === "A");
  assert.deepEqual([mensA[0].county, mensA[0].points, mensA[0].played], ["A", 14, 2]);
  assert.deepEqual([mensA.find(t => t.county === "B")?.points, mensA.find(t => t.county === "B")?.lost], [4, 1]);
  assert.deepEqual(table.filter(row => row.category === "WOMEN" && row.team === "A").map(t => t.points), [0, 0, 0, 0]);
});
