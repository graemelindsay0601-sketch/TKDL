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
  router.put("/saves/:id/streaming/pathway", authedWriteRateLimit, async (req, res) => {
    res.json(await service.setPathway(res.locals.careerActor, id(req), req.body));
  });
  router.post("/saves/:id/streaming/schedule", authedWriteRateLimit, async (req, res) => {
    res.json(await service.schedulePathway(res.locals.careerActor, id(req)));
  });
  router.post("/saves/:id/streaming/studio-upgrade", authedWriteRateLimit, async (req, res) => {
    res.json(await service.buyStudioUpgrade(res.locals.careerActor, id(req)));
  });
  router.post("/saves/:id/streaming/creator-series", authedWriteRateLimit, async (req, res) => {
    res.json(await service.chooseCreatorSeries(res.locals.careerActor, id(req), req.body));
  });
  router.get("/saves/:id/streaming", async (req, res) => {
    const week = req.query.week === undefined ? undefined : Number(req.query.week);
    res.json(await service.read(res.locals.careerActor, id(req), week));
  });
  router.post("/saves/:id/streaming/schedule-night", authedWriteRateLimit, async (req, res) => {
    res.json(await service.scheduleNight(res.locals.careerActor, id(req), req.body));
  });
  router.post("/saves/:id/streaming/live", authedWriteRateLimit, async (req, res) => { res.json(await service.goLive(res.locals.careerActor, id(req), req.body)); });
  router.get("/saves/:id/streaming/streams/:streamId", async (req, res) => { res.json(await service.session(res.locals.careerActor, id(req), stream(req))); });
  router.post("/saves/:id/streaming/streams/:streamId/darts", async (req, res) => { res.json(await service.darts(res.locals.careerActor, id(req), stream(req), req.body)); });
  router.post("/saves/:id/streaming/streams/:streamId/end", authedWriteRateLimit, async (req, res) => { res.json(await service.end(res.locals.careerActor, id(req), stream(req))); });
  router.post("/saves/:id/streaming/deals/:dealId", authedWriteRateLimit, async (req, res) => {
    res.json(await service.answerDeal(res.locals.careerActor, id(req), careerIdSchema.parse(String(req.params.dealId)), req.body)); });
  router.post("/saves/:id/streaming/campaigns/:campaignId",authedWriteRateLimit,async(req,res)=>{
    res.json(await service.answerCampaign(res.locals.careerActor,id(req),careerIdSchema.parse(String(req.params.campaignId)),req.body));});
  router.post("/saves/:id/streaming/sub-goal", authedWriteRateLimit, async (req, res) => { res.json(await service.setSubGoal(res.locals.careerActor, id(req), req.body)); });
  router.get("/saves/:id/streaming/match/:matchId", async (req, res) => {
    res.json(await service.matchStream(res.locals.careerActor, id(req), careerIdSchema.parse(String(req.params.matchId)), false)); });
  router.post("/saves/:id/streaming/match/:matchId", async (req, res) => {
    res.json(await service.matchStream(res.locals.careerActor, id(req), careerIdSchema.parse(String(req.params.matchId)), true)); });
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.includes("/streaming")) { next(error); return; }
    if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else if (error instanceof ZodError) res.status(400).json({ error: "Invalid streaming request" });
    else { req.log?.error({ err: error }, "Career streaming request failed"); res.status(500).json({ error: "Streaming request failed" }); }
  });
  return router;
}
