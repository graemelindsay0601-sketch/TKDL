import { Router, type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import type { CareerLiveMatchService } from "./service.ts";

type PlayerSession = { playerId?: number; isAdmin?: boolean };

/**
 * A6.5 live match API. There is still no endpoint that accepts a winner or a
 * score: the client sends its bull-up dart and its dart log; the server derives
 * everything else (see live/service.ts).
 */
export function createCareerLiveRouter(service: CareerLiveMatchService, isAvailable: (isAdmin: boolean) => Promise<boolean>) {
  const router = Router();
  router.use("/saves/:id/matches", async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const session = req.session as PlayerSession | undefined;
    if (!Number.isSafeInteger(session?.playerId) || (session?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    if (!await isAvailable(session?.isAdmin === true)) { res.status(404).json({ error: "Career not available" }); return; }
    res.locals.careerActor = { playerId: session!.playerId!, isAdmin: session?.isAdmin === true };
    next();
  });
  const ids = (req: Request) => [String(req.params.id), String(req.params.matchId)] as const;
  router.post("/saves/:id/matches/:matchId/session", authedWriteRateLimit, async (req, res) => {
    res.json(await service.open(res.locals.careerActor, ...ids(req)));
  });
  router.get("/saves/:id/matches/:matchId/session", async (req, res) => {
    res.json(await service.read(res.locals.careerActor, ...ids(req)));
  });
  router.post("/saves/:id/matches/:matchId/session/bull", authedWriteRateLimit, async (req, res) => {
    res.json(await service.bull(res.locals.careerActor, ...ids(req), req.body));
  });
  // Checkpoints are sent once per visit, so they are not behind the general write limiter.
  router.put("/saves/:id/matches/:matchId/session/darts", async (req, res) => {
    res.json(await service.darts(res.locals.careerActor, ...ids(req), req.body));
  });
  router.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) res.status(400).json({ error: "Invalid Career request", issues: error.issues });
    else if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else { req.log.error({ err: error }, "Career live match request failed"); res.status(500).json({ error: "Career request failed" }); }
  });
  return router;
}
