import { Router } from "express";
import { sql } from "drizzle-orm";
import { requireAdminSession } from "../middleware/requireAdminSession.ts";
import type { CareerDatabase } from "./database.ts";

export const CAREER_RESET_CONFIRMATION = "DELETE ALL CAREER SAVES";

/** Mounted outside the player/feature gates so an admin can reset while Hidden. */
export function createCareerAdminRouter(database: CareerDatabase) {
  const router = Router();
  router.post("/admin/career/reset", requireAdminSession, async (req, res) => {
    if (req.body?.confirmation !== CAREER_RESET_CONFIRMATION) {
      res.status(400).json({ error: `Type ${CAREER_RESET_CONFIRMATION} to permanently delete every player's Career saves and all their Career progress.` });
      return;
    }
    const deletedSaves = await database.transaction(async tx => {
      // Every Career-owned world, event, finance and live-session row is rooted
      // in career_saves through ON DELETE CASCADE. Deleting the child saves
      // never deletes their parent TKDL players. No TRUNCATE CASCADE or resets
      // of shared tables, balances, feature flags or sequences.
      const result = await tx.execute(sql`DELETE FROM career_saves RETURNING id`);
      return result.rows.length;
    });
    res.json({ deletedSaves });
  });
  return router;
}
