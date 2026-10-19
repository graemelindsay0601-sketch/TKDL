import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import type { createCareerMoneyService } from "./service.ts";

/** Money matches at your club: this week's members and challenge, haggle over a stake, play, or turn a challenge down. */
export function createCareerMoneyRouter(service: ReturnType<typeof createCareerMoneyService>) {
  const router = Router();
  const paths = ["/saves/:id/money-matches", "/saves/:id/money-matches/offer", "/saves/:id/money-matches/play", "/saves/:id/money-matches/decline",
    "/saves/:id/money-matches/:matchId", "/saves/:id/money-matches/:matchId/darts"];
  router.use(paths, (req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    res.locals.careerActor = { playerId: s!.playerId!, isAdmin: s?.isAdmin === true };
    next();
  });
  const id = (req: Request) => careerIdSchema.parse(String(req.params.id));
  router.get("/saves/:id/money-matches", async (req, res) => { res.json(await service.read(res.locals.careerActor, id(req))); });
  router.get("/saves/:id/money-matches/:matchId", async (req, res) => {
    res.json(await service.session(res.locals.careerActor, id(req), careerIdSchema.parse(String(req.params.matchId))));
  });
  router.post("/saves/:id/money-matches/:matchId/darts", authedWriteRateLimit, async (req, res) => {
    res.json(await service.darts(res.locals.careerActor, id(req), careerIdSchema.parse(String(req.params.matchId)), req.body));
  });
  router.post("/saves/:id/money-matches/offer", authedWriteRateLimit, async (req, res) => { res.json(await service.offer(res.locals.careerActor, id(req), req.body)); });
  router.post("/saves/:id/money-matches/play", authedWriteRateLimit, async (req, res) => { res.json(await service.play(res.locals.careerActor, id(req), req.body)); });
  router.post("/saves/:id/money-matches/decline", authedWriteRateLimit, async (req, res) => { res.json(await service.decline(res.locals.careerActor, id(req))); });
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.includes("/money-matches")) { next(error); return; }
    if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else if (error instanceof ZodError) res.status(400).json({ error: "Invalid money match request" });
    else { req.log?.error({ err: error }, "Career money match request failed"); res.status(500).json({ error: "Money match request failed" }); }
  });
  return router;
}
