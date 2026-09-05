export const FACT_SNAPSHOT_CUTOFF_KEY = "__snapshotCutoff";

export type FactSnapshotStory = {
  id: number;
  detectedAt: Date;
  updatedAt: Date;
  facts: Record<string, unknown>;
};

export type FactCutoffViolation = {
  storyId: number;
  reason: "detected_after_cutoff" | "updated_after_cutoff" | "missing_snapshot_cutoff" | "invalid_snapshot_cutoff" | "snapshot_after_cutoff";
  timestamp: string | null;
};

export function factsWithSnapshotCutoff(
  facts: Record<string, unknown>,
  cutoff: Date,
): Record<string, unknown> {
  return { ...facts, [FACT_SNAPSHOT_CUTOFF_KEY]: cutoff.toISOString() };
}

/**
 * Verifies the provenance envelope attached when a story's facts are
 * calculated. This is deliberately fail-closed: a selected story without a
 * valid snapshot marker cannot be published in a new Edition.
 */
export function validateStoryFactCutoffs(
  stories: readonly FactSnapshotStory[],
  cutoff: Date,
): FactCutoffViolation[] {
  const cutoffMs = cutoff.getTime();
  const violations: FactCutoffViolation[] = [];

  for (const story of stories) {
    if (story.detectedAt.getTime() > cutoffMs) {
      violations.push({
        storyId: story.id,
        reason: "detected_after_cutoff",
        timestamp: story.detectedAt.toISOString(),
      });
    }
    if (story.updatedAt.getTime() > cutoffMs) {
      violations.push({
        storyId: story.id,
        reason: "updated_after_cutoff",
        timestamp: story.updatedAt.toISOString(),
      });
    }

    const rawSnapshotCutoff = story.facts[FACT_SNAPSHOT_CUTOFF_KEY];
    if (rawSnapshotCutoff === undefined) {
      violations.push({
        storyId: story.id,
        reason: "missing_snapshot_cutoff",
        timestamp: null,
      });
      continue;
    }
    if (typeof rawSnapshotCutoff !== "string") {
      violations.push({
        storyId: story.id,
        reason: "invalid_snapshot_cutoff",
        timestamp: null,
      });
      continue;
    }

    const snapshotMs = Date.parse(rawSnapshotCutoff);
    if (!Number.isFinite(snapshotMs)) {
      violations.push({
        storyId: story.id,
        reason: "invalid_snapshot_cutoff",
        timestamp: rawSnapshotCutoff,
      });
    } else if (snapshotMs > cutoffMs) {
      violations.push({
        storyId: story.id,
        reason: "snapshot_after_cutoff",
        timestamp: rawSnapshotCutoff,
      });
    }
  }

  return violations;
}