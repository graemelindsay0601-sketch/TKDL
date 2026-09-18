import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  FACT_SNAPSHOT_CUTOFF_KEY,
  factsWithSnapshotCutoff,
  validateStoryFactCutoffs,
  type FactSnapshotStory,
} from "../cutoff-snapshot-math.ts";

const cutoff = new Date("2026-09-05T12:00:00.000Z");

function story(overrides: Partial<FactSnapshotStory> = {}): FactSnapshotStory {
  return {
    id: 1,
    detectedAt: new Date("2026-09-05T10:00:00.000Z"),
    updatedAt: cutoff,
    facts: { [FACT_SNAPSHOT_CUTOFF_KEY]: cutoff.toISOString() },
    ...overrides,
  };
}

describe("factsWithSnapshotCutoff", () => {
  test("preserves display facts and adds the cutoff provenance marker", () => {
    assert.deepEqual(factsWithSnapshotCutoff({ winnerId: 7 }, cutoff), {
      winnerId: 7,
      [FACT_SNAPSHOT_CUTOFF_KEY]: cutoff.toISOString(),
    });
  });
});

describe("validateStoryFactCutoffs", () => {
  test("accepts facts calculated exactly at the Edition cutoff", () => {
    assert.deepEqual(validateStoryFactCutoffs([story()], cutoff), []);
  });

  test("fails closed when snapshot provenance is absent", () => {
    assert.deepEqual(validateStoryFactCutoffs([story({ facts: {} })], cutoff), [{
      storyId: 1,
      reason: "missing_snapshot_cutoff",
      timestamp: null,
    }]);
  });

  test("rejects malformed snapshot provenance", () => {
    assert.equal(validateStoryFactCutoffs([
      story({ facts: { [FACT_SNAPSHOT_CUTOFF_KEY]: "not-a-date" } }),
    ], cutoff)[0]?.reason, "invalid_snapshot_cutoff");
  });

  test("rejects a fact snapshot newer than the Edition cutoff", () => {
    const future = new Date(cutoff.getTime() + 1).toISOString();
    assert.equal(validateStoryFactCutoffs([
      story({ facts: { [FACT_SNAPSHOT_CUTOFF_KEY]: future } }),
    ], cutoff)[0]?.reason, "snapshot_after_cutoff");
  });

  test("rejects stories detected or updated after the Edition cutoff", () => {
    const future = new Date(cutoff.getTime() + 1);
    assert.deepEqual(
      validateStoryFactCutoffs([story({ detectedAt: future, updatedAt: future })], cutoff)
        .map(violation => violation.reason),
      ["detected_after_cutoff", "updated_after_cutoff"],
    );
  });
});