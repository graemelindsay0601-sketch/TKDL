// TKDL LIVE — FEATURE_SPOTLIGHT registry (story-detectors-filler.ts's own
// header: "One candidate per row in the broadcast_feature_spotlights
// registry... that is currently `enabled`"). Backs onto the
// broadcast_feature_spotlights table (lib/db/src/schema/broadcast.ts's
// 13.5; idempotent DDL + seed rows in
// db/migrations/add_feature_spotlights.ts) — this file is the thin
// DB-facing read used by story-engine.ts's own FILLER wiring section, kept
// separate from that orchestrator the same way story-detectors-filler.ts's
// own header anticipated ("feature-spotlight-registry.ts") rather than
// folding a raw query inline there.
//
// DB-FACING, NOT UNIT TESTED — same convention as every other thin
// DB-read helper in this folder (story-engine.ts, commentary-engine.ts):
// no dedicated test file, verified by typecheck + build clean.
import { eq } from "drizzle-orm";
import { db, broadcastFeatureSpotlightsTable } from "@workspace/db";
import type { FeatureSpotlightFacts } from "./story-detectors-filler.ts";

/** Every currently-enabled spotlight row, shaped directly as the facts detectFeatureSpotlight() expects — one candidate per row, per that detector's own header. */
export async function listEnabledFeatureSpotlights(): Promise<FeatureSpotlightFacts[]> {
  const rows = await db
    .select()
    .from(broadcastFeatureSpotlightsTable)
    .where(eq(broadcastFeatureSpotlightsTable.enabled, true));
  return rows.map(row => ({
    featureKey: row.featureKey,
    featureName: row.featureName,
    featureBlurb: row.blurb,
  }));
}
