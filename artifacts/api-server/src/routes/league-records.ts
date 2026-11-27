import { Router } from "express";
import { buildRecordsBoard } from "../lib/records-board";
import { recentRecords } from "../lib/league-records-db";

const router = Router();
router.get("/league-records/recent", async (_req, res): Promise<void> => { res.json(await recentRecords(7)); });

/** The League Records page: every record, worked out live. */
router.get("/league-records/board", async (req, res): Promise<void> => {
  try { res.set("Cache-Control", "no-store"); res.json(await buildRecordsBoard()); }
  catch (err) { req.log.error({ err }, "Records board failed"); res.status(500).json({ error: "Records unavailable" }); }
});
export default router;
