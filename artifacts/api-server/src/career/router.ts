import { Router, type Request, type Response, type NextFunction } from "express";
import { z, ZodError } from "zod";
import { CareerError, type CareerService } from "./service.ts";
import { emptyCareerBodySchema } from "./validation.ts";
import { authedWriteRateLimit } from "../middleware/writeRateLimit.ts";

type PlayerSession = { playerId?: number; isAdmin?: boolean };

/** Mounted after TKDL's session middleware and legacy-session repair. */
export function createCareerRouter(service: CareerService) {
  const router = Router();
  router.use(async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const session = req.session as PlayerSession | undefined;
    if (!Number.isSafeInteger(session?.playerId) || (session?.playerId ?? 0) <= 0) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!await service.isAvailable(session?.isAdmin === true)) {
      res.status(404).json({ error: "Career not available" });
      return;
    }
    res.locals.careerPlayerId = session!.playerId;
    next();
  });
  router.get("/saves", async (_req, res) => {
    res.json(await service.list(res.locals.careerPlayerId));
  });
  router.post("/saves", authedWriteRateLimit, async (req, res) => {
    res.status(201).json(await service.create(res.locals.careerPlayerId, req.body));
  });
  router.get("/saves/:id", async (req, res) => {
    res.json(await service.read(res.locals.careerPlayerId, String(req.params.id)));
  });
  router.post("/saves/:id/restart", authedWriteRateLimit, async (req, res) => {
    emptyCareerBodySchema.parse(req.body ?? {});
    res.json(await service.restart(res.locals.careerPlayerId, String(req.params.id)));
  });
  router.post("/saves/:id/retire", authedWriteRateLimit, async (req, res) => {
    z.object({confirmation:z.literal("RETIRE CAREER")}).strict().parse(req.body);
    res.json(await service.retire(res.locals.careerPlayerId, String(req.params.id)));
  });
  router.delete("/saves/:id", authedWriteRateLimit, async (req, res) => {
    emptyCareerBodySchema.parse(req.body ?? {});
    await service.delete(res.locals.careerPlayerId, String(req.params.id));
    res.status(204).end();
  });
  router.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({ error: "Invalid Career request", issues: error.issues });
    } else if (error instanceof CareerError) {
      res.status(error.status).json({ error: error.message });
    } else {
      req.log.error({ err: error }, "Career request failed");
      res.status(500).json({ error: "Career request failed" });
    }
  });
  return router;
}
