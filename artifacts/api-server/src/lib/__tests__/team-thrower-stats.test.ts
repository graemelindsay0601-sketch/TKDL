import { test } from "node:test";
import assert from "node:assert/strict";
import { parseThrowerStats } from "../team-match-players.ts";

const good = { playerId: 4, darts: 30, points: 501, oneEighties: 1, checkoutAttempts: 3, checkoutHits: 1 };

test("keeps stats only for players in the match", () => {
  assert.deepEqual(parseThrowerStats([good, { ...good, playerId: 99 }], [4, 5]), [good]);
});

test("drops impossible numbers", () => {
  assert.deepEqual(parseThrowerStats([{ ...good, checkoutHits: 4 }], [4]), []);          // more hits than attempts
  assert.deepEqual(parseThrowerStats([{ ...good, darts: 2, oneEighties: 1, points: 60 }], [4]), []); // a 180 needs 3 darts
  assert.deepEqual(parseThrowerStats([{ ...good, points: 5000 }], [4]), []);             // over 60 a dart
  assert.deepEqual(parseThrowerStats([{ ...good, darts: -1 }], [4]), []);
});

test("anything that isn't a list is ignored", () => {
  assert.deepEqual(parseThrowerStats(null, [4]), []);
  assert.deepEqual(parseThrowerStats({ playerId: 4 }, [4]), []);
});
