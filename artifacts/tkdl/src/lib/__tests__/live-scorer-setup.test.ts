import { test } from "node:test";
import assert from "node:assert/strict";
import { teamRoster, wagerShares, totalWagerError, validCombinedSelection } from "../live-scorer-setup.ts";

test("official rosters use team balances even when a player's singles points are zero", () => {
  const players = [{ id: 1, name: "Graeme", points: 0, elo: 800, status: "ELIMINATED" }];
  const roster = teamRoster(players, { name: "Graeme & partner", points: 75, elo: 1050, players: [{ id: 1 }] });
  assert.equal(roster[0].points, 75);
  assert.equal(roster[0].elo, 1050);
  assert.equal(roster[0].balanceName, "Graeme & partner");
  assert.equal(players[0].points, 0);
  assert.equal(teamRoster(players, { name: "Fresh", points: 100, players: [{ id: 1 }] })[0].points, 100);
});

test("wager preview validates all contributing teams, not just the first two", () => {
  const sideA = [{ name: "Graeme's team", points: 20, weight: 1 }];
  const sideB = [{ name: "Jamie's team", points: 10, weight: 1 }, { name: "Kyle's team", points: 9, weight: 1 }];
  assert.deepEqual(wagerShares(20, sideB), [10, 10]);
  assert.match(totalWagerError(20, [sideA, sideB]), /Kyle.*10pts.*9pts/);
  sideB[1].points = 10;
  assert.equal(totalWagerError(20, [sideA, sideB]), "");
  assert.match(totalWagerError(21, [sideA, sideB]), /Graeme/);
  assert.notEqual(totalWagerError(1.5, [sideA, sideB]), "");
  assert.notEqual(totalWagerError(0, [sideA, sideB]), "");
  assert.notEqual(totalWagerError(NaN, [sideA, sideB]), "");
});

test("preview shares conserve odd pots and account for differing fielded counts", () => {
  const side = [{ name: "Jamie", points: 100, weight: 1 }, { name: "Kyle", points: 100, weight: 1 }];
  assert.deepEqual(wagerShares(21, side), [11, 10]);
  side[1].weight = 2;
  assert.deepEqual(wagerShares(20, side), [7, 13]);
});

test("combined mode cannot start with no extra team, stale members or duplicate teams", () => {
  const roster = (id: string) => id === "3" ? [{ id: 30 }] : [];
  assert.equal(validCombinedSelection("1", "2", [], {}, roster), false);
  assert.equal(validCombinedSelection("1", "2", [""], {}, roster), false);
  assert.equal(validCombinedSelection("1", "2", ["3"], {}, roster), false);
  assert.equal(validCombinedSelection("1", "2", ["3"], { "3": ["99"] }, roster), false);
  assert.equal(validCombinedSelection("1", "2", ["3", "3"], { "3": ["30"] }, roster), false);
  assert.equal(validCombinedSelection("1", "2", ["3"], { "3": ["30"] }, roster), true);
});
