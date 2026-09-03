import { db } from "@workspace/db";
import { featureFlagsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Feature flag names
export const FEATURES = {
  CARD_SHOP: "card_shop",
  COINS: "coins",
  CARD_CLASH: "card_clash",
  TKDL_LIVE: "tkdl_live",
} as const;

/**
 * Initialize default feature flags
 * Run once on app startup or migration (also re-runnable any time via the
 * admin panel's "Initialize" button — see POST /admin/feature-flags/initialize
 * in routes/settings.ts).
 *
 * This used to check "does the table have ANY rows at all" and bail out
 * entirely if so — which meant that on a production DB already seeded with
 * card_shop/coins/card_clash, adding a brand-new flag here (like tkdl_live)
 * would never actually get inserted, no matter how many times this ran.
 * Each flag is now upserted individually and existing rows are left exactly
 * as an admin has configured them (onConflictDoNothing, not DO UPDATE) —
 * so re-running this is always safe and only ever fills in what's missing.
 */
export async function initializeFeatureFlags() {
  try {
    await db.insert(featureFlagsTable).values([
      {
        featureName: FEATURES.CARD_SHOP,
        enabled: true,
        adminTestMode: false,
        description: "Card Shop - Players can purchase card packs",
      },
      {
        featureName: FEATURES.COINS,
        enabled: true,
        adminTestMode: false,
        description: "Coins System - Players can earn and spend coins",
      },
      {
        featureName: FEATURES.CARD_CLASH,
        enabled: true,
        adminTestMode: false,
        description: "Card Clash - Full card clash mode and seasonal features",
      },
      {
        featureName: FEATURES.TKDL_LIVE,
        enabled: false,
        adminTestMode: true,
        description: "TKDL LIVE - automated broadcast show (admin preview only until switched live for everyone)",
      },
    ]).onConflictDoNothing({ target: featureFlagsTable.featureName });

    console.log("Feature flags initialized (existing flags left untouched)");
  } catch (error) {
    console.error("Failed to initialize feature flags:", error);
  }
}

/**
 * Check if a feature is available for a user
 */
export async function isFeatureAvailable(featureName: string, isAdmin: boolean = false): Promise<boolean> {
  try {
    const flag = await db
      .select()
      .from(featureFlagsTable)
      .where(eq(featureFlagsTable.featureName, featureName))
      .limit(1);

    if (!flag[0]) {
      return false;
    }

    // If enabled (live for everyone), return true
    if (flag[0].enabled) {
      return true;
    }

    // If admin test mode and user is admin, return true
    if (flag[0].adminTestMode && isAdmin) {
      return true;
    }

    // Otherwise not available
    return false;
  } catch (error) {
    console.error(`Failed to check feature ${featureName}:`, error);
    return false;
  }
}

/**
 * Get all feature flags (admin only)
 */
export async function getAllFeatureFlags() {
  try {
    return await db.select().from(featureFlagsTable).orderBy(featureFlagsTable.featureName);
  } catch (error) {
    console.error("Failed to get feature flags:", error);
    return [];
  }
}

/**
 * Get single feature flag
 */
export async function getFeatureFlag(featureName: string) {
  try {
    const flag = await db
      .select()
      .from(featureFlagsTable)
      .where(eq(featureFlagsTable.featureName, featureName))
      .limit(1);

    return flag[0] || null;
  } catch (error) {
    console.error(`Failed to get feature flag ${featureName}:`, error);
    return null;
  }
}

/**
 * Enable feature for everyone (go live)
 */
export async function enableFeatureForAll(featureName: string): Promise<boolean> {
  try {
    await db
      .update(featureFlagsTable)
      .set({
        enabled: true,
        adminTestMode: false,
      })
      .where(eq(featureFlagsTable.featureName, featureName));

    console.log(`Feature ${featureName} enabled for all users`);
    return true;
  } catch (error) {
    console.error(`Failed to enable feature ${featureName}:`, error);
    return false;
  }
}

/**
 * Disable feature for everyone
 */
export async function disableFeature(featureName: string): Promise<boolean> {
  try {
    await db
      .update(featureFlagsTable)
      .set({
        enabled: false,
      })
      .where(eq(featureFlagsTable.featureName, featureName));

    console.log(`Feature ${featureName} disabled for all users`);
    return true;
  } catch (error) {
    console.error(`Failed to disable feature ${featureName}:`, error);
    return false;
  }
}

/**
 * Set admin test mode (accessible to admin only)
 */
export async function setAdminTestMode(featureName: string, testMode: boolean): Promise<boolean> {
  try {
    await db
      .update(featureFlagsTable)
      .set({
        adminTestMode: testMode,
        // If enabling admin test mode, disable for everyone else
        enabled: testMode ? false : undefined,
      })
      .where(eq(featureFlagsTable.featureName, featureName));

    console.log(`Feature ${featureName} admin test mode set to ${testMode}`);
    return true;
  } catch (error) {
    console.error(`Failed to set admin test mode for ${featureName}:`, error);
    return false;
  }
}

/**
 * Get feature status for frontend
 */
export async function getFeatureStatus(featureName: string, isAdmin: boolean = false) {
  const flag = await getFeatureFlag(featureName);

  if (!flag) {
    return {
      available: false,
      liveForAll: false,
      adminTestMode: false,
    };
  }

  return {
    available: flag.enabled || (flag.adminTestMode && isAdmin),
    liveForAll: flag.enabled,
    adminTestMode: flag.adminTestMode,
    isAdmin,
  };
}
