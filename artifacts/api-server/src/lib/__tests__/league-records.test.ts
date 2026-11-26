import { test } from "node:test";
import assert from "node:assert/strict";
import { beats, dartsRecordKey, winRuns } from "../league-records.ts";

test("a record needs a previous holder and a strictly better value", () => {
  assert.equal(beats("fewest_darts_501", 15, 18), true);
  assert.equal(beats("fewest_darts_501", 18, 18), false);
  assert.equal(beats("fewest_darts_501", 12, null), false);
  assert.equal(beats("most_180s", 3, 2), true);
  assert.equal(beats("most_180s", 1, 0), false); // below the minimum
  assert.equal(beats("win_streak", 4, 3), false);
  assert.equal(beats("win_streak", 6, 5), true);
});

test("darts records only for single-leg 501/301", () => {
  assert.equal(dartsRecordKey("501"), "fewest_darts_501");
  assert.equal(dartsRecordKey("301_double_out"), "fewest_darts_301");
  assert.equal(dartsRecordKey("501_best_of_3"), null);
  assert.equal(dartsRecordKey("cricket"), null);
});

test("win runs reset on a loss", () => {
  const { longest, current } = winRuns([{ winnerId: 1, loserId: 2 }, { winnerId: 1, loserId: 3 }, { winnerId: 2, loserId: 1 }, { winnerId: 1, loserId: 2 }]);
  assert.equal(longest.get(1), 2); assert.equal(current.get(1), 1); assert.equal(current.get(2), 0);
});
