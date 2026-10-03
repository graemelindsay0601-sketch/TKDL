import { Router, type Request, type Response, type NextFunction } from "express";
import { z, ZodError } from "zod";
import { CareerError } from "../service.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import type { CareerEventService } from "./service.ts";
import type { CareerActor } from "../world/service.ts";
export function createCareerEventRouter(service: CareerEventService) {
  const router = Router();
  const actor = (req: Request): CareerActor => {
    const session = (req.session ?? {}) as { playerId?: number; isAdmin?: boolean };
    return { playerId: session.playerId!, isAdmin: session.isAdmin === true };
  };
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!Number.isSafeInteger(actor(req).playerId) || actor(req).playerId < 1) { res.status(401).json({ error: "Authentication required" }); return; }
    next();
  });
  const empty = (body: unknown) => z.object({}).strict().parse(body ?? {});
  router.post("/saves/:id/calendar/initialize", authedWriteRateLimit, async (req, res) => { empty(req.body); res.json(await service.initialize(actor(req), String(req.params.id))); });
  router.get("/saves/:id/calendar", async (req, res) => { res.json(await service.calendar(actor(req), String(req.params.id), req.query)); });
  router.get("/saves/:id/events/:eventId", async (req, res) => { res.json(await service.detail(actor(req), String(req.params.id), String(req.params.eventId))); });
  router.post("/saves/:id/events/:eventId/enter", authedWriteRateLimit, async (req, res) => { empty(req.body); res.json(await service.enter(actor(req), String(req.params.id), String(req.params.eventId))); });
  router.post("/saves/:id/events/:eventId/withdraw", authedWriteRateLimit, async (req, res) => { empty(req.body); res.json(await service.withdraw(actor(req), String(req.params.id), String(req.params.eventId))); });
  router.post("/saves/:id/calendar/advance", authedWriteRateLimit, async (req, res) => { res.json(await service.advance(actor(req), String(req.params.id), req.body)); });
  router.post("/saves/:id/calendar/close-season", authedWriteRateLimit, async (req, res) => {
    const body = z.object({ season: z.number().int().positive() }).strict().parse(req.body);
    res.json(await service.closeSeason(actor(req), String(req.params.id), body.season));
  });
  // No public NPC simulation, arbitrary result, provider, seed or identity authority endpoints.
  router.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) res.status(400).json({ error: "Invalid Career event request", issues: error.issues });
    else if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else { req.log?.error({ err: error }, "Career event request failed"); res.status(500).json({ error: "Career event request failed" }); }
  });
  return router;
}
