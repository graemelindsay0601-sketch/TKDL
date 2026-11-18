import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { allHistoryCredit, reportHtml } from "../lib/achievements-v2/report.ts";
import { settings, isEnabled, syncNow, lastSync } from "../lib/achievements-v2/live.ts";
import { toView, storedStates, liveStates, currentSeasonId, recentUnlocks } from "../lib/achievements-v2/view.ts";
import { ENABLED_KEY, LAUNCHED_KEY, WELCOME_COINS } from "../lib/achievements-v2/store.ts";

/**
 * Achievements v2, before launch: an admin-only, read-only report of what history credit would give every player.
 * Nothing is saved or awarded. Open /api/admin/achievements-v2/report in the browser after verifying the admin PIN.
 */
const router: IRouter = Router();
router.get("/admin/achievements-v2/report", requireAdminSession, async (req, res) => {
  const reports = await allHistoryCredit(db as never);
  res.set("Cache-Control", "no-store");
  if (req.query.format === "json") { res.json(reports); return; }
  res.type("html").send(reportHtml(reports));
});

/** The switch and its state. Turning it on runs the history credit in the background (no coins except the welcome bonus). */
router.get("/admin/achievements-v2/status", requireAdminSession, async (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ enabled: await isEnabled(), launchedAt: await settings.get(LAUNCHED_KEY), welcomeCoins: WELCOME_COINS, lastSync });
});
router.post("/admin/achievements-v2/enable", requireAdminSession, async (_req, res) => {
  await settings.set(ENABLED_KEY, "true");
  void syncNow();
  res.json({ enabled: true, started: true });
});
router.post("/admin/achievements-v2/disable", requireAdminSession, async (_req, res) => {
  await settings.set(ENABLED_KEY, "false");
  res.json({ enabled: false });
});
router.post("/admin/achievements-v2/sync", requireAdminSession, async (_req, res) => {
  if (!(await isEnabled())) { res.status(409).json({ error: "Achievements v2 is switched off" }); return; }
  res.json({ result: await syncNow() });
});

/** One player's achievements for the page and the profile shelf. Before launch only an admin can preview (worked out live). */
router.get("/achievements-v2/players/:id", async (req, res) => {
  const playerId = Number(req.params.id);
  if (!Number.isInteger(playerId) || playerId <= 0) { res.status(400).json({ error: "Invalid player" }); return; }
  const enabled = await isEnabled();
  const preview = !enabled && req.query.preview === "1" && !!(req.session as { isAdmin?: boolean } | undefined)?.isAdmin;
  if (!enabled && !preview) { res.json({ enabled: false }); return; }
  const exec = db as never;
  const states = preview ? await liveStates(exec, playerId) : await storedStates(exec, playerId);
  res.set("Cache-Control", "no-store");
  res.json({ enabled, preview, view: toView(states, await currentSeasonId(exec)), recent: preview ? [] : await recentUnlocks(exec, playerId) });
});
/** Whether the new achievements are live (the app hides the page and shelf until they are). */
router.get("/achievements-v2/status", async (_req, res) => { res.json({ enabled: await isEnabled() }); });
export default router;
