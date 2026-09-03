/**
 * Tests for decideSinglesChampion() — the pure decision logic pulled out of
 * performSeasonReset() so the tie-handling rule can be tested without a
 * database. This exists because the season-close code used to sort a
 * points tie by Elo and crown whoever came out on top, contradicting the
 * Rules page's documented one-off no-stake tiebreaker. See seasonReset.ts.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { decideSinglesChampion } from "../singles-champion.ts";

type P = { id: number; points: number; name: string };

const alice: P = { id: 1, points: 40, name: "Alice" };
const bob:   P = { id: 2, points: 30, name: "Bob" };
const carol: P = { id: 3, points: 40, name: "Carol" };
const dave:  P = { id: 4, points: 40, name: "Dave" };

describe("decideSinglesChampion", () => {
  test("crowns the outright points leader when nobody is tied", () => {
    const result = decideSinglesChampion([alice, bob], null);
    assert.deepEqual(result, { kind: "champion", player: alice });
  });

  test("never falls back to Elo to break a points tie — flags it instead", () => {
    // alice and carol are both on 40; the old code would have sorted this
    // by Elo and silently crowned one of them.
    const result = decideSinglesChampion([alice, bob, carol], null);
    assert.equal(result.kind, "tied");
    if (result.kind === "tied") {
      assert.equal(result.points, 40);
      assert.deepEqual(new Set(result.tied.map(p => p.id)), new Set([alice.id, carol.id]));
    }
  });

  test("a three-way tie is still just 'tied', not arbitrarily narrowed to two", () => {
    const result = decideSinglesChampion([alice, carol, dave], null);
    assert.equal(result.kind, "tied");
    if (result.kind === "tied") assert.equal(result.tied.length, 3);
  });

  test("no contenders at all resolves to 'none', not a crash", () => {
    assert.deepEqual(decideSinglesChampion([], null), { kind: "none" });
  });

  test("a recorded championId (from the playoff-match admin flow) is honored over current standings", () => {
    // Even though alice is the outright leader now, a tiebreak already
    // named bob champion — that result must win.
    const result = decideSinglesChampion([alice, bob], bob.id);
    assert.deepEqual(result, { kind: "champion", player: bob });
  });

  test("a recorded championId who's no longer a contender resolves to 'none' rather than silently dropping the recorded result", () => {
    // e.g. the tiebreak winner has since gone inactive — the caller is
    // expected to fall back to the season row's own championId/Name in
    // this case, not treat it as unresolved.
    const result = decideSinglesChampion([alice, bob], 999);
    assert.deepEqual(result, { kind: "none" });
  });

  test("a recorded championId takes priority even while other players are still tied", () => {
    const result = decideSinglesChampion([alice, carol, dave], alice.id);
    assert.deepEqual(result, { kind: "champion", player: alice });
  });
});
