import { Router } from "express";
import { db, achievementsTable } from "@workspace/db";
import { asc } from "drizzle-orm";

const router = Router();

router.get("/achievements", async (_req, res): Promise<void> => {
  const achievements = await db.select().from(achievementsTable)
    .orderBy(asc(achievementsTable.priority), asc(achievementsTable.name));
  res.json(achievements);
});

export default router;
