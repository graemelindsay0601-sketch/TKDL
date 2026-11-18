import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { leagueHistoryCredit, reportHtml, summarise } from "../lib/achievements-v2/report.ts";

/**
 * Achievements v2, before launch: an admin-only, read-only report of what history credit would give every player.
 * Nothing is saved or awarded. Open /api/admin/achievements-v2/report in the browser after verifying the admin PIN.
 */
const router: IRouter = Router();
router.get("/admin/achievements-v2/report", requireAdminSession, async (req, res) => {
  const summary = summarise(await leagueHistoryCredit(db as never));
  res.set("Cache-Control", "no-store");
  if (req.query.format === "json") { res.json(summary); return; }
  res.type("html").send(reportHtml(summary));
});
export default router;
