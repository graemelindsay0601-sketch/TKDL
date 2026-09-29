import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildFanVerdictSegment } from "../fan-verdict-math.ts";

describe("buildFanVerdictSegment", () => {
  test("calculates frozen vote shares and identifies the leader", () => {
    const segment = buildFanVerdictSegment({
      pollId: 7,
      question: "Who starts as favourite?",
      activityAt: new Date("2026-09-28T20:00:00.000Z"),
      options: [
        { id: 1, label: "Graeme", votes: 3 },
        { id: 2, label: "Sean", votes: 1 },
      ],
    });
    assert.equal(segment.purpose, "fan_verdict");
    assert.equal(segment.facts?.totalVotes, 4);
    assert.equal(segment.facts?.leaderLabel, "Graeme");
    assert.deepEqual(segment.facts?.options, [
      { id: 1, label: "Graeme", votes: 3, percentage: 75 },
      { id: 2, label: "Sean", votes: 1, percentage: 25 },
    ]);
  });

  test("reports a tied verdict without inventing a winner", () => {
    const segment = buildFanVerdictSegment({
      pollId: 8,
      question: "Best finish?",
      activityAt: new Date("2026-09-28T20:00:00.000Z"),
      options: [
        { id: 1, label: "Top", votes: 2 },
        { id: 2, label: "Bottom", votes: 2 },
      ],
    });
    assert.equal(segment.facts?.isTie, true);
    assert.equal(segment.facts?.leaderLabel, "Top and Bottom");
  });
});
