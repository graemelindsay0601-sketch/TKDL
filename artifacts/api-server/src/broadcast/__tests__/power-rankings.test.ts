import test from "node:test";
import assert from "node:assert/strict";
import { buildPowerRankings, type PowerRankingMatch } from "../power-rankings.ts";

function match(id: number, winnerId: number, winnerName: string, loserId: number, loserName: string, stake = 5): PowerRankingMatch {
  return { leagueType: "singles", id, winnerId, winnerName, loserId, loserName, stake, playedAt: new Date(Date.UTC(2026, 8, id)).toISOString(), wasUpsetWin: false };
}

test("recent wins put the in-form player at the top without changing source data", () => {
  const matches = [match(1, 1, "Graeme", 2, "Robert"), match(2, 1, "Graeme", 3, "Kyle"), match(3, 1, "Graeme", 2, "Robert")];
  const before = JSON.stringify(matches);
  const rows = buildPowerRankings(matches, "singles");
  assert.equal(rows[0].name, "Graeme");
  assert.deepEqual(rows[0].recentForm, ["W", "W", "W"]);
  assert.deepEqual(rows[0].streak, { result: "W", count: 3 });
  assert.equal(JSON.stringify(matches), before);
});

test("movement compares the latest five appearances with the preceding window", () => {
  const matches: PowerRankingMatch[] = [];
  for (let id = 1; id <= 5; id++) matches.push(match(id, 2, "Robert", 1, "Graeme"));
  for (let id = 6; id <= 10; id++) matches.push(match(id, 1, "Graeme", 2, "Robert"));
  const rows = buildPowerRankings(matches, "singles");
  const graeme = rows.find(row => row.name === "Graeme")!;
  assert.equal(graeme.rank, 1);
  assert.ok(graeme.movement !== null && graeme.movement > 0);
});

test("league tables stay isolated", () => {
  const singles = match(1, 1, "Graeme", 2, "Robert");
  const doubles: PowerRankingMatch = { ...match(2, 10, "Team A", 20, "Team B"), leagueType: "doubles" };
  assert.deepEqual(buildPowerRankings([singles, doubles], "doubles").map(row => row.name), ["Team A", "Team B"]);
});
