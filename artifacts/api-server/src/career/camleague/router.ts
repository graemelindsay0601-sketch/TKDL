import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import type { createCareerCamLeagueService } from "./service.ts";

/** Webcam leagues: your division and table, join, book this week's match, play it on the scorer or let it play out. */
export function createCareerCamLeagueRouter(service: ReturnType<typeof createCareerCamLeagueService>) {
  const router = Router();
  router.use("/saves/:id/cam-league", (req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    res.locals.careerActor = { playerId: s!.playerId!, isAdmin: s?.isAdmin === true };
    next();
  });
  const id = (req: Request) => careerIdSchema.parse(String(req.params.id));
  const fixture = (req: Request) => careerIdSchema.parse(String(req.params.fixtureId));
  router.get("/saves/:id/cam-league", async (req, res) => { res.json(await service.read(res.locals.careerActor, id(req))); });
  router.post("/saves/:id/cam-league/join", authedWriteRateLimit, async (req, res) => { res.json(await service.join(res.locals.careerActor, id(req))); });
  router.post("/saves/:id/cam-league/book", authedWriteRateLimit, async (req, res) => { res.json(await service.book(res.locals.careerActor, id(req), req.body)); });
  router.get("/saves/:id/cam-league/fixtures/:fixtureId", async (req, res) => { res.json(await service.session(res.locals.careerActor, id(req), fixture(req))); });
  router.post("/saves/:id/cam-league/fixtures/:fixtureId/darts", async (req, res) => { res.json(await service.darts(res.locals.careerActor, id(req), fixture(req), req.body)); });
  router.post("/saves/:id/cam-league/fixtures/:fixtureId/simulate", authedWriteRateLimit, async (req, res) => { res.json(await service.simulate(res.locals.careerActor, id(req), fixture(req))); });
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.includes("/cam-league")) { next(error); return; }
    if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else if (error instanceof ZodError) res.status(400).json({ error: "Invalid webcam league request" });
    else { req.log?.error({ err: error }, "Career webcam league request failed"); res.status(500).json({ error: "Webcam league request failed" }); }
  });
  return router;
}
