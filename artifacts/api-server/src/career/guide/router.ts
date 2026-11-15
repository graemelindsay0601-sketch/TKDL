import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import type { createCareerGuideService } from "./service.ts";

/** The Career Guide: today, your path, next steps and what you are missing. */
export function createCareerGuideRouter(service: ReturnType<typeof createCareerGuideService>) {
  const router = Router();
  router.use("/saves/:id/guide", (req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    res.locals.careerActor = { playerId: s!.playerId!, isAdmin: s?.isAdmin === true };
    next();
  });
  const id = (req: Request) => careerIdSchema.parse(String(req.params.id));
  router.get("/saves/:id/guide", async (req, res) => { res.json(await service.read(res.locals.careerActor, id(req))); });
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.includes("/guide")) { next(error); return; }
    if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else if (error instanceof ZodError) res.status(400).json({ error: "Invalid guide request" });
    else { req.log?.error({ err: error }, "Career guide request failed"); res.status(500).json({ error: "Guide request failed" }); }
  });
  return router;
}
