import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import type { createCareerLocalNightsService } from "./service.ts";

/** Local nights: pub league, club knockout, practice, friendlies, exhibitions and coaching. */
export function createCareerLocalNightsRouter(service: ReturnType<typeof createCareerLocalNightsService>) {
  const router = Router();
  router.use("/saves/:id/local", (req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    res.locals.careerActor = { playerId: s!.playerId!, isAdmin: s?.isAdmin === true };
    next();
  });
  const id = (req: Request) => careerIdSchema.parse(String(req.params.id)), night = (req: Request) => careerIdSchema.parse(String(req.params.nightId));
  router.get("/saves/:id/local", async (req, res) => { res.json(await service.read(res.locals.careerActor, id(req))); });
  router.post("/saves/:id/local/book", authedWriteRateLimit, async (req, res) => { res.json(await service.book(res.locals.careerActor, id(req), req.body)); });
  router.post("/saves/:id/local/pub-league", authedWriteRateLimit, async (req, res) => { res.json(await service.joinPubLeague(res.locals.careerActor, id(req))); });
  router.get("/saves/:id/local/nights/:nightId", async (req, res) => { res.json(await service.session(res.locals.careerActor, id(req), night(req))); });
  router.post("/saves/:id/local/nights/:nightId/darts", async (req, res) => { res.json(await service.darts(res.locals.careerActor, id(req), night(req), req.body)); });
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.includes("/local")) { next(error); return; }
    if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else if (error instanceof ZodError) res.status(400).json({ error: "Invalid local night request" });
    else { req.log?.error({ err: error }, "Career local night request failed"); res.status(500).json({ error: "Local night request failed" }); }
  });
  return router;
}
