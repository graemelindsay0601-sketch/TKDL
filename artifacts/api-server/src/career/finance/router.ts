import { Router, type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import type { CareerFinanceService } from "./service.ts";

type PlayerSession = { playerId?: number; isAdmin?: boolean };
const num = (value: unknown) => typeof value === "string" && value.trim() !== "" ? Number(value) : undefined;
const str = (value: unknown) => typeof value === "string" && value !== "" ? value : undefined;

/**
 * A4 finance/sponsor API for the future A6 UI. Event entry/withdrawal stay on the
 * A3 routes (now finance-aware); there is no separate "pay" endpoint. Internal
 * operations (reversals, milestone triggers) are deliberately not exposed.
 */
export function createCareerFinanceRouter(service: CareerFinanceService, isAvailable: (isAdmin: boolean) => Promise<boolean>) {
  const router = Router();
  router.use(["/saves/:id/finance", "/saves/:id/sponsors", "/saves/:id/events/:eventId/finance"], async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const session = req.session as PlayerSession | undefined;
    if (!Number.isSafeInteger(session?.playerId) || (session?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    if (!await isAvailable(session?.isAdmin === true)) { res.status(404).json({ error: "Career not available" }); return; }
    res.locals.careerActor = { playerId: session!.playerId!, isAdmin: session?.isAdmin === true };
    next();
  });
  const id = (req: Request) => String(req.params.id);
  router.get("/saves/:id/finance", async (req, res) => { res.json(await service.summary(res.locals.careerActor, id(req))); });
  router.get("/saves/:id/finance/ledger", async (req, res) => {
    res.json(await service.ledger(res.locals.careerActor, id(req), Object.fromEntries(Object.entries({
      limit: num(req.query.limit), beforeCreatedAt: str(req.query.beforeCreatedAt), beforeId: str(req.query.beforeId) }).filter(([, v]) => v !== undefined))));
  });
  router.get("/saves/:id/events/:eventId/finance", async (req, res) => { res.json(await service.eventFinance(res.locals.careerActor, id(req), String(req.params.eventId))); });
  router.get("/saves/:id/sponsors", async (req, res) => { res.json(await service.sponsors(res.locals.careerActor, id(req))); });
  router.post("/saves/:id/sponsors/offers/:offerId/accept", authedWriteRateLimit, async (req, res) => {
    res.json(await service.acceptOffer(res.locals.careerActor, id(req), { ...(req.body??{}),offerId: String(req.params.offerId) }));
  });
  router.post("/saves/:id/sponsors/offers/:offerId/negotiate", authedWriteRateLimit, async (req, res) => {
    res.json(await service.negotiateOffer(res.locals.careerActor, id(req), String(req.params.offerId), req.body ?? {}));
  });
  router.post("/saves/:id/sponsors/offers/:offerId/decline", authedWriteRateLimit, async (req, res) => {
    res.json(await service.declineOffer(res.locals.careerActor, id(req), { offerId: String(req.params.offerId) }));
  });
  router.put("/saves/:id/sponsors/activities/:activityId", authedWriteRateLimit, async (req,res)=>{
    res.json(await service.updateSponsorActivity(res.locals.careerActor,id(req),String(req.params.activityId),req.body??{}));
  });
  router.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) res.status(400).json({ error: "Invalid Career request", issues: error.issues });
    else if (error instanceof CareerError) res.status(error.status).json({ error: error.message, ...("code" in error ? { code: (error as { code: string }).code } : {}) });
    else { req.log.error({ err: error }, "Career finance request failed"); res.status(500).json({ error: "Career request failed" }); }
  });
  return router;
}
