import { Router, type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import type { CareerSportingService } from "./service.ts";

type PlayerSession = { playerId?: number; isAdmin?: boolean };
const num = (value: unknown) => typeof value === "string" && value.trim() !== "" ? Number(value) : undefined;
const str = (value: unknown) => typeof value === "string" && value !== "" ? value : undefined;
const defined = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/**
 * A5 read-only sporting API for the future A6 UI. Sporting state changes only as
 * a consequence of A3 results (inside A3's transactions); nothing here mutates.
 */
export function createCareerSportingRouter(service: CareerSportingService, isAvailable: (isAdmin: boolean) => Promise<boolean>) {
  const router = Router();
  router.use(["/saves/:id/initialize", "/saves/:id/sporting", "/saves/:id/rankings", "/saves/:id/tour-card", "/saves/:id/q-school", "/saves/:id/qualification", "/saves/:id/milestones"], async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const session = req.session as PlayerSession | undefined;
    if (!Number.isSafeInteger(session?.playerId) || (session?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    if (!await isAvailable(session?.isAdmin === true)) { res.status(404).json({ error: "Career not available" }); return; }
    res.locals.careerActor = { playerId: session!.playerId!, isAdmin: session?.isAdmin === true };
    next();
  });
  const id = (req: Request) => String(req.params.id);
  // A6: one idempotent initialize for the whole composed Career (A2 world, A3 calendar, A4 finance, A5 sporting state).
  router.post("/saves/:id/initialize", authedWriteRateLimit, async (req, res) => { res.json(await service.initialize(res.locals.careerActor, id(req))); });
  router.get("/saves/:id/sporting", async (req, res) => { res.json(await service.summary(res.locals.careerActor, id(req))); });
  router.get("/saves/:id/rankings", async (req, res) => { res.json(await service.rankingLists(res.locals.careerActor, id(req))); });
  router.get("/saves/:id/rankings/:list", async (req, res) => {
    res.json(await service.rankingTable(res.locals.careerActor, id(req), String(req.params.list), defined({ view: str(req.query.view)?.toUpperCase(), limit: num(req.query.limit),
      offset: num(req.query.offset), participant: str(req.query.participant), radius: num(req.query.radius) })));
  });
  router.get("/saves/:id/rankings/:list/history", async (req, res) => {
    res.json(await service.rankingHistory(res.locals.careerActor, id(req), String(req.params.list), defined({ participant: str(req.query.participant), limit: num(req.query.limit) })));
  });
  router.get("/saves/:id/rankings/:list/explain", async (req, res) => {
    res.json(await service.rankingExplain(res.locals.careerActor, id(req), String(req.params.list), str(req.query.participant)));
  });
  router.get("/saves/:id/tour-card", async (req, res) => { res.json(await service.tourCard(res.locals.careerActor, id(req), str(req.query.participant))); });
  router.get("/saves/:id/q-school", async (req, res) => {
    res.json(await service.qSchool(res.locals.careerActor, id(req), defined({ season: num(req.query.season), participant: str(req.query.participant) }) as { season?: number; participant?: string }));
  });
  router.get("/saves/:id/qualification", async (req, res) => {
    res.json(await service.qualification(res.locals.careerActor, id(req), defined({ eventId: str(req.query.eventId), fromWeek: num(req.query.fromWeek), weeks: num(req.query.weeks) })));
  });
  router.get("/saves/:id/milestones", async (req, res) => {
    res.json(await service.milestones(res.locals.careerActor, id(req), defined({ participant: str(req.query.participant), limit: num(req.query.limit),
      beforeSeason: num(req.query.beforeSeason), beforeWeek: num(req.query.beforeWeek) })));
  });
  router.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) res.status(400).json({ error: "Invalid Career request", issues: error.issues });
    else if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else { req.log.error({ err: error }, "Career sporting request failed"); res.status(500).json({ error: "Career request failed" }); }
  });
  return router;
}
