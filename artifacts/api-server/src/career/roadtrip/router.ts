import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import type { createCareerRoadTripService } from "./service.ts";

/** Road trips: towns, set off, haggle and play the locals (or a visitor at your club). */
export function createCareerRoadTripRouter(service: ReturnType<typeof createCareerRoadTripService>) {
  const router = Router();
  router.use("/saves/:id/road-trips", (req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    res.locals.careerActor = { playerId: s!.playerId!, isAdmin: s?.isAdmin === true };
    next();
  });
  const id = (req: Request) => careerIdSchema.parse(String(req.params.id));
  router.get("/saves/:id/road-trips", async (req, res) => { res.json(await service.read(res.locals.careerActor, id(req))); });
  router.post("/saves/:id/road-trips", authedWriteRateLimit, async (req, res) => { res.json(await service.go(res.locals.careerActor, id(req), req.body)); });
  router.post("/saves/:id/road-trips/offer", authedWriteRateLimit, async (req, res) => { res.json(await service.offer(res.locals.careerActor, id(req), req.body)); });
  router.post("/saves/:id/road-trips/play", authedWriteRateLimit, async (req, res) => { res.json(await service.play(res.locals.careerActor, id(req), req.body)); });
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.includes("/road-trips")) { next(error); return; }
    if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else if (error instanceof ZodError) res.status(400).json({ error: "Invalid road trip request" });
    else { req.log?.error({ err: error }, "Career road trip request failed"); res.status(500).json({ error: "Road trip request failed" }); }
  });
  return router;
}
