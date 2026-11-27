import { Router } from "express";
import { recentRecords } from "../lib/league-records-db";

const router = Router();
router.get("/league-records/recent", async (_req, res): Promise<void> => { res.json(await recentRecords(7)); });
export default router;
