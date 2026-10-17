import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import type { createCareerStreamingService } from "./service.ts";

/** Streaming: your channel, going live, the stream's darts (chat replies) and ending a stream. */
export function createCareerStreamingRouter(service: ReturnType<typeof createCareerStreamingService>) {
  const router = Router();
  router.use("/saves/:id/streaming", (req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    res.locals.careerActor = { playerId: s!.playerId!, isAdmin: s?.isAdmin === true };
    next();
  });
  const id = (req: Request) => careerIdSchema.parse(String(req.params.id));
  const stream = (req: Request) => careerIdSchema.parse(String(req.params.streamId));
  router.get("/saves/:id/streaming", async (req, res) => { res.json(await service.read(res.locals.careerActor, id(req))); });
  router.post("/saves/:id/streaming/live", authedWriteRateLimit, async (req, res) => { res.json(await service.goLive(res.locals.careerActor, id(req), req.body)); });
  router.get("/saves/:id/streaming/streams/:streamId", async (req, res) => { res.json(await service.session(res.locals.careerActor, id(req), stream(req))); });
  router.post("/saves/:id/streaming/streams/:streamId/darts", async (req, res) => { res.json(await service.darts(res.locals.careerActor, id(req), stream(req), req.body)); });
  router.post("/saves/:id/streaming/streams/:streamId/end", authedWriteRateLimit, async (req, res) => { res.json(await service.end(res.locals.careerActor, id(req), stream(req))); });
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.includes("/streaming")) { next(error); return; }
    if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else if (error instanceof ZodError) res.status(400).json({ error: "Invalid streaming request" });
    else { req.log?.error({ err: error }, "Career streaming request failed"); res.status(500).json({ error: "Streaming request failed" }); }
  });
  return router;
}
