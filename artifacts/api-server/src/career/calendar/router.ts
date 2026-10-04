import { Router, type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import type { CareerCalendarService } from "./service.ts";

type PlayerSession = { playerId?: number; isAdmin?: boolean };
const num = (value: unknown) => typeof value === "string" && value.trim() !== "" ? Number(value) : undefined;
const str = (value: unknown) => typeof value === "string" && value !== "" ? value : undefined;

/**
 * A3 calendar/tournament API for the future A6 UI. Read endpoints plus the
 * player's own actions (initialize, enter, withdraw, advance). There is
 * deliberately no endpoint for reporting human match results: that boundary is
 * reserved for the server-side GameScorer integration.
 */
export function createCareerCalendarRouter(service: CareerCalendarService, isAvailable: (isAdmin: boolean) => Promise<boolean>) {
  const router = Router();
  // Scoped to A3 paths so A1 save routes are not double-gated.
  router.use(["/saves/:id/calendar", "/saves/:id/events", "/saves/:id/history", "/saves/:id/entitlements"], async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const session = req.session as PlayerSession | undefined;
    if (!Number.isSafeInteger(session?.playerId) || (session?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    if (!await isAvailable(session?.isAdmin === true)) { res.status(404).json({ error: "Career not available" }); return; }
    res.locals.careerActor = { playerId: session!.playerId!, isAdmin: session?.isAdmin === true };
    next();
  });
  const id = (req: Request) => String(req.params.id);
  router.post("/saves/:id/calendar/initialize", authedWriteRateLimit, async (req, res) => {
    res.json(await service.initialize(res.locals.careerActor, id(req)));
  });
  router.get("/saves/:id/calendar", async (req, res) => {
    const q = req.query;
    res.json(await service.calendar(res.locals.careerActor, id(req), Object.fromEntries(Object.entries({
      season: num(q.season), fromWeek: num(q.fromWeek), toWeek: num(q.toWeek), scope: str(q.scope), circuit: str(q.circuit), classification: str(q.classification), family: str(q.family),
    }).filter(([, v]) => v !== undefined))));
  });
  router.post("/saves/:id/calendar/advance", authedWriteRateLimit, async (req, res) => {
    res.json(await service.advance(res.locals.careerActor, id(req), req.body));
  });
  router.get("/saves/:id/events/:eventId", async (req, res) => {
    res.json(await service.event(res.locals.careerActor, id(req), String(req.params.eventId)));
  });
  router.post("/saves/:id/events/:eventId/entry", authedWriteRateLimit, async (req, res) => {
    res.json(await service.enter(res.locals.careerActor, id(req), { eventId: String(req.params.eventId) }));
  });
  router.delete("/saves/:id/events/:eventId/entry", authedWriteRateLimit, async (req, res) => {
    res.json(await service.withdraw(res.locals.careerActor, id(req), { eventId: String(req.params.eventId) }));
  });
  router.get("/saves/:id/history", async (req, res) => {
    res.json(await service.history(res.locals.careerActor, id(req), { participantKey: str(req.query.participant), definitionKey: str(req.query.definition), season: num(req.query.season) }));
  });
  router.get("/saves/:id/entitlements", async (req, res) => {
    res.json(await service.entitlements(res.locals.careerActor, id(req)));
  });
  router.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) res.status(400).json({ error: "Invalid Career request", issues: error.issues });
    else if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else { req.log.error({ err: error }, "Career calendar request failed"); res.status(500).json({ error: "Career request failed" }); }
  });
  return router;
}
