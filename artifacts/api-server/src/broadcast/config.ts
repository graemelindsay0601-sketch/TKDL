// TKDL LIVE — settings resolver and version IDs (handover doc section 16.1
// / 20.1's file map: "config.ts - Constants/settings resolver and version
// IDs"). DB-facing: reads/writes settingsTable. Every type/default/
// validation rule lives in config-math.ts (pure, directly unit tested) —
// this file is just the real database round-trip on top of it, same split
// as story-engine-math.ts/story-engine.ts and title-predictor-math.ts/
// title-predictor.ts elsewhere in this folder.
//
// broadcast_enabled — 16.1's own settings table lists this key, but this
// codebase already has a real on/off mechanism for exactly this feature:
// the `tkdl_live` feature flag (feature-flags-service.ts), which already
// ships with the doc's own required default (enabled: false, adminTestMode:
// true — see 16.2) and is already wired into GET /api/broadcast/status.
// Adding a SECOND, independent "broadcast_enabled" settings-table boolean
// alongside it would create two switches that could disagree with each
// other for no benefit. This file deliberately does not define that key;
// `isFeatureAvailable(FEATURES.TKDL_LIVE, isAdmin)` is the single source of
// truth for whether the show is on, exactly as 16.2 already established.
import { db, settingsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import {
  BROADCAST_SETTING_KEYS, BROADCAST_SETTING_DEFAULTS, resolveBroadcastConfig, validateBroadcastSettingValue,
  type BroadcastSettingKey, type BroadcastConfig,
} from "./config-math.ts";

export {
  BROADCAST_SETTING_KEYS, BROADCAST_SETTING_DEFAULTS, validateBroadcastSettingValue,
  type BroadcastSettingKey, type BroadcastConfig,
};

/**
 * Reads every broadcast_* setting in one query, falling back to the
 * documented default (and warning) for anything missing or malformed —
 * never throws, since a broadcast build with defaults is always preferable
 * to failing the whole Edition over one bad admin edit (section 17's own
 * "no raw error" philosophy). No caching: these change rarely (a handful of
 * Edition builds a day, per 16.5's free-tier framing) and an admin editing
 * a setting via PATCH /api/admin/broadcast/settings should take effect on
 * the very next build, not after some arbitrary cache TTL.
 */
export async function getBroadcastConfig(): Promise<BroadcastConfig> {
  const rows = await db.select().from(settingsTable).where(inArray(settingsTable.key, BROADCAST_SETTING_KEYS));
  const byKey = new Map(rows.map(r => [r.key as BroadcastSettingKey, r.value]));
  return resolveBroadcastConfig(key => byKey.get(key) ?? BROADCAST_SETTING_DEFAULTS[key]);
}

/**
 * Idempotent startup seed — same onConflictDoNothing pattern as
 * initializeFeatureFlags() (feature-flags-service.ts): fills in whatever's
 * missing, never overwrites a value an admin has already deliberately set.
 * app.ts calls this alongside initializeFeatureFlags() on every boot.
 */
export async function seedBroadcastSettings(): Promise<void> {
  await db
    .insert(settingsTable)
    .values(BROADCAST_SETTING_KEYS.map(key => ({ key, value: BROADCAST_SETTING_DEFAULTS[key] })))
    .onConflictDoNothing({ target: settingsTable.key });

  // The first producer-profile default set News to 150-300 seconds. A
  // real-data dress rehearsal showed a complete seven-story bulletin landing
  // naturally at 140 seconds, so the new default floor is 135. Upgrade only
  // the exact untouched legacy JSON; any producer-customised profile remains
  // authoritative.
  const legacyNewsProfile = JSON.stringify({
    maxHeadlineTeases: 3,
    maxStorySegments: 7,
    estimatedRuntimeSeconds: { min: 150, max: 300 },
    contentMix: ["news", "news", "analysis", "news", "feature", "analysis", "feature"],
  });
  await db
    .update(settingsTable)
    .set({ value: BROADCAST_SETTING_DEFAULTS.broadcast_news_profile, updatedAt: new Date() })
    .where(and(
      eq(settingsTable.key, "broadcast_news_profile"),
      eq(settingsTable.value, legacyNewsProfile),
    ));

  const legacyBalancedProfile = JSON.stringify({
    maxHeadlineTeases: 2,
    maxStorySegments: 6,
    estimatedRuntimeSeconds: { min: 180, max: 360 },
    contentMix: ["news", "analysis", "feature", "news", "analysis", "feature"],
  });
  await db
    .update(settingsTable)
    .set({ value: BROADCAST_SETTING_DEFAULTS.broadcast_balanced_profile, updatedAt: new Date() })
    .where(and(
      eq(settingsTable.key, "broadcast_balanced_profile"),
      eq(settingsTable.value, legacyBalancedProfile),
    ));

  const legacyMagazineProfile = JSON.stringify({
    maxHeadlineTeases: 1,
    maxStorySegments: 5,
    estimatedRuntimeSeconds: { min: 210, max: 420 },
    contentMix: ["feature", "analysis", "feature", "news", "feature"],
  });
  await db
    .update(settingsTable)
    .set({ value: BROADCAST_SETTING_DEFAULTS.broadcast_magazine_profile, updatedAt: new Date() })
    .where(and(
      eq(settingsTable.key, "broadcast_magazine_profile"),
      eq(settingsTable.value, legacyMagazineProfile),
    ));
}

/**
 * PATCH /api/admin/broadcast/settings (14.2) — the caller (routes/
 * broadcast.ts) has already run every value through validateBroadcastSettingValue()
 * (config-math.ts) before this is called, so this is a plain, un-validated
 * upsert; it never rejects, matching seedBroadcastSettings()'s own
 * onConflictDoUpdate-free style but updating rather than skipping existing
 * rows, since the whole point of this endpoint is to actually change them.
 */
export async function setBroadcastSettings(values: Partial<Record<BroadcastSettingKey, string>>): Promise<void> {
  const entries = Object.entries(values) as [BroadcastSettingKey, string][];
  for (const [key, value] of entries) {
    await db
      .insert(settingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
  }
}
