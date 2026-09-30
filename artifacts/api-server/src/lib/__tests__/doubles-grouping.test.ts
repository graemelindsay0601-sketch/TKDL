import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildFairDoublesGroups, type PreviousTriple } from "../doubles-grouping.ts";

const players = Array.from({ length: 7 }, (_, index) => ({ id: index + 1 }));

describe("buildFairDoublesGroups", () => {
  test("creates one triple and pairs everyone else when the roster is odd", () => {
    const groups = buildFairDoublesGroups(players, [], () => 0.4);

    assert.deepEqual(groups.map(group => group.length).sort(), [2, 2, 3]);
    assert.deepEqual(new Set(groups.flat().map(player => player.id)), new Set(players.map(player => player.id)));
  });

  test("creates pairs only when the roster is even", () => {
    const groups = buildFairDoublesGroups(players.slice(0, 6), [], () => 0.4);
    assert.deepEqual(groups.map(group => group.length), [2, 2, 2]);
  });

  test("prioritises players with fewer previous triple appearances", () => {
    const history: PreviousTriple[] = [
      { seasonId: 1, player1Id: 1, player2Id: 2, player3Id: 3 },
      { seasonId: 2, player1Id: 4, player2Id: 5, player3Id: 6 },
    ];

    const triple = buildFairDoublesGroups(players, history, () => 0.4).find(group => group.length === 3)!;
    assert.ok(triple.some(player => player.id === 7));
  });

  test("uses least-recent triple duty when appearance counts are equal", () => {
    const history: PreviousTriple[] = [
      { seasonId: 1, player1Id: 1, player2Id: 2, player3Id: 3 },
      { seasonId: 2, player1Id: 4, player2Id: 5, player3Id: 6 },
      { seasonId: 3, player1Id: 7, player2Id: 1, player3Id: 2 },
    ];

    const tripleIds = new Set(buildFairDoublesGroups(players, history, () => 0.4)
      .find(group => group.length === 3)!
      .map(player => player.id));

    assert.deepEqual(tripleIds, new Set([3, 4, 5]));
  });
});
