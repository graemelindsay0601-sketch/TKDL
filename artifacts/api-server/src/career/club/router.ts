import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import type { createCareerClubService } from "./service.ts";

/** Your home club (read-only). */
export function createCareerClubRouter(service: ReturnType<typeof createCareerClubService>) {
  const router = Router();
  router.get("/saves/:id/club", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    res.json(await service.read({ playerId: s!.playerId!, isAdmin: s?.isAdmin === true }, careerIdSchema.parse(String(req.params.id))));
  });
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.endsWith("/club")) { next(error); return; }
    if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else if (error instanceof ZodError) res.status(400).json({ error: "Invalid Career club request" });
    else { req.log?.error({ err: error }, "Career club request failed"); res.status(500).json({ error: "Career club request failed" }); }
  });
  return router;
}
