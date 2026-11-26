import { test } from "node:test";
import assert from "node:assert/strict";
import { remainingTimeline } from "../ghost.ts";

test("ghost timeline replays visits, busts and the finish", () => {
  // 101: T20 (41 left), 20 (21), 25 busts (back to 101, visit ends); then 1 (100), D20 (60)
  const t = remainingTimeline([60, 20, 25, 1, 40], [3, 1, 1, 1, 2], 101);
  assert.deepEqual(t, [101, 41, 21, 101, 100, 60]);
});

test("finishing on a single isn't a finish with double out, fine without", () => {
  assert.deepEqual(remainingTimeline([40], [1], 40), [40, 40]);
  assert.deepEqual(remainingTimeline([40], [1], 40, false), [40, 0]);
});
