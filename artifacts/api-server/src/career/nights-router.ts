import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import type { CareerDatabase } from "./database.ts";
import { CareerError } from "./service.ts";
import { careerIdSchema } from "./validation.ts";
import { lockRoot } from "./world/service.ts";
import { weekPlan } from "./nights.ts";

/** Nights Out: what each night of this week holds. */
export function createCareerNightsRouter(database: CareerDatabase) {
  const router = Router();
  router.get("/saves/:id/nights", async (req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    try {
      const out = await database.transaction(async tx => {
        const root = await lockRoot(tx, { playerId: s!.playerId!, isAdmin: s?.isAdmin === true }, careerIdSchema.parse(String(req.params.id)), false) as unknown as { id: string; current_season: number; current_week: number };
        const season = Number(root.current_season), week = Number(root.current_week);
        return { season, week, days: await weekPlan(tx, String(root.id), season, week) };
      });
      res.json(out);
    } catch (error) {
      if (error instanceof CareerError) { res.status(error.status).json({ error: error.message }); return; }
      next(error);
    }
  });
  return router;
}
