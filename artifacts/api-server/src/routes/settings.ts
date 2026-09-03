import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable, featureFlagsTable } from "@workspace/db";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { paramStr } from "../lib/http";
import {
  getAllFeatureFlags, initializeFeatureFlags,
  enableFeatureForAll, disableFeature, setAdminTestMode,
} from "../services/feature-flags-service";

const router = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(settingsTable);
  const flags = await db.select().from(featureFlagsTable);
  
  const out: Record<string, boolean | string> = {};
  
  // Add settings table values
  for (const r of rows) {
    out[r.key] = r.value === "true" ? true : r.value === "false" ? false : r.value;
  }
  
  // Add feature flags
  for (const flag of flags) {
    if (flag.featureName === "card_clash") out["card_clash_enabled"] = flag.enabled;
    if (flag.featureName === "card_shop") out["card_shop_enabled"] = flag.enabled;
    if (flag.featureName === "coins") out["coins_enabled"] = flag.enabled;
    // Only reflects "live for everyone" — the admin-preview-only state is
    // NOT exposed here (this endpoint is public/unauthenticated). The nav
    // link additionally shows for an admin session regardless of this flag
    // (see layout.tsx), and the real gate is GET /api/broadcast/status,
    // which does know the caller's session.
    if (flag.featureName === "tkdl_live") out["tkdl_live_enabled"] = flag.enabled;
  }
  
  res.json(out);
});

router.patch("/admin/settings/:key", requireAdminSession, async (req, res): Promise<void> => {
  const key = paramStr(req.params.key);
  const { value } = req.body as { value?: unknown };
  if (value === undefined) { res.status(400).json({ error: "value required" }); return; }
  const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (existing.length === 0) {
    await db.insert(settingsTable).values({ key, value: String(value) });
  } else {
    await db.update(settingsTable).set({ value: String(value), updatedAt: new Date() }).where(eq(settingsTable.key, key));
  }
  res.json({ ok: true, key, value });
});

// ── Feature flags admin panel — the featureFlagsTable/service already existed,
// these were just never registered as routes ─────────────────────────────────

router.get("/admin/feature-flags", requireAdminSession, async (_req, res): Promise<void> => {
  const flags = await getAllFeatureFlags();
  res.json(flags);
});

router.post("/admin/feature-flags/initialize", requireAdminSession, async (_req, res): Promise<void> => {
  await initializeFeatureFlags();
  const flags = await getAllFeatureFlags();
  res.json(flags);
});

router.post("/admin/feature-flags/:name/admin-test", requireAdminSession, async (req, res): Promise<void> => {
  const { enabled } = req.body as { enabled?: boolean };
  const ok = await setAdminTestMode(paramStr(req.params.name), !!enabled);
  if (!ok) { res.status(500).json({ error: "Failed to update admin test mode" }); return; }
  res.json({ ok: true });
});

router.post("/admin/feature-flags/:name/enable-all", requireAdminSession, async (req, res): Promise<void> => {
  const ok = await enableFeatureForAll(paramStr(req.params.name));
  if (!ok) { res.status(500).json({ error: "Failed to enable feature" }); return; }
  res.json({ ok: true });
});

router.post("/admin/feature-flags/:name/disable", requireAdminSession, async (req, res): Promise<void> => {
  const ok = await disableFeature(paramStr(req.params.name));
  if (!ok) { res.status(500).json({ error: "Failed to disable feature" }); return; }
  res.json({ ok: true });
});

export default router;
