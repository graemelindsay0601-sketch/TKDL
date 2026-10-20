import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import type { createCareerProAmService } from "./service.ts";

/** Pro-Am nights: this week's nights, take one, play your leg against the pro (or let the night play out). */
export function createCareerProAmRouter(service: ReturnType<typeof createCareerProAmService>) {
  const router = Router();
  router.use("/saves/:id/pro-am", (req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    res.locals.careerActor = { playerId: s!.playerId!, isAdmin: s?.isAdmin === true };
    next();
  });
  const id = (req: Request) => careerIdSchema.parse(String(req.params.id));
  const night = (req: Request) => careerIdSchema.parse(String(req.params.nightId));
  router.get("/saves/:id/pro-am", async (req, res) => {
    const week = req.query.week === undefined ? undefined : Number(req.query.week);
    res.json(await service.read(res.locals.careerActor, id(req), week));
  });
  router.post("/saves/:id/pro-am/book", authedWriteRateLimit, async (req, res) => { res.json(await service.book(res.locals.careerActor, id(req), req.body)); });
  router.get("/saves/:id/pro-am/nights/:nightId", async (req, res) => { res.json(await service.session(res.locals.careerActor, id(req), night(req))); });
  router.post("/saves/:id/pro-am/nights/:nightId/darts", async (req, res) => { res.json(await service.darts(res.locals.careerActor, id(req), night(req), req.body)); });
  router.post("/saves/:id/pro-am/nights/:nightId/simulate", authedWriteRateLimit, async (req, res) => { res.json(await service.simulate(res.locals.careerActor, id(req), night(req))); });
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.includes("/pro-am")) { next(error); return; }
    if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else if (error instanceof ZodError) res.status(400).json({ error: "Invalid Pro-Am request" });
    else { req.log?.error({ err: error }, "Career Pro-Am request failed"); res.status(500).json({ error: "Pro-Am request failed" }); }
  });
  return router;
}
