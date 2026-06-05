import { Router } from "express";
import { db, achievementsTable } from "@workspace/db";

const router = Router();

router.get("/achievements", async (_req, res): Promise<void> => {
  const achievements = await db.select().from(achievementsTable).orderBy(achievementsTable.id);
  res.json(achievements);
});

export default router;
