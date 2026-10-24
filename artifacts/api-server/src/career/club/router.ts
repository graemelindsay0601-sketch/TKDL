import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import type { createCareerClubService } from "./service.ts";
import type { createCareerTeamNightsService } from "./team-service.ts";
import type { createCareerCountyLiveService } from "./county-live-service.ts";
import type { createCareerCountyTrialService } from "./county-trial-service.ts";

/** Your home club (read-only). */
export function createCareerClubRouter(service: ReturnType<typeof createCareerClubService>, teams?: ReturnType<typeof createCareerTeamNightsService>,
  live?: ReturnType<typeof createCareerCountyLiveService>, trials?: ReturnType<typeof createCareerCountyTrialService>) {
  const router = Router();
  router.get("/saves/:id/club", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    res.json(await service.read({ playerId: s!.playerId!, isAdmin: s?.isAdmin === true }, careerIdSchema.parse(String(req.params.id))));
  });
  router.get("/saves/:id/club/team-nights", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    if (!teams) { res.status(404).json({ error: "Not found" }); return; }
    res.json(await teams.read({ playerId: s!.playerId!, isAdmin: s?.isAdmin === true }, careerIdSchema.parse(String(req.params.id))));
  });
  router.post("/saves/:id/club/team-nights/join", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    if (!teams) { res.status(404).json({ error: "Not found" }); return; }
    res.json(await teams.join({ playerId: s!.playerId!, isAdmin: s?.isAdmin === true }, careerIdSchema.parse(String(req.params.id))));
  });
  router.get("/saves/:id/club/team-matches/:matchId", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    if (!teams) { res.status(404).json({ error: "Not found" }); return; }
    res.json(await teams.liveMatch({ playerId: s!.playerId!, isAdmin: s?.isAdmin === true }, careerIdSchema.parse(String(req.params.id)), careerIdSchema.parse(String(req.params.matchId))));
  });
  router.post("/saves/:id/club/team-matches/:matchId/darts", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    if (!teams) { res.status(404).json({ error: "Not found" }); return; }
    res.json(await teams.darts({ playerId: s!.playerId!, isAdmin: s?.isAdmin === true }, careerIdSchema.parse(String(req.params.id)), careerIdSchema.parse(String(req.params.matchId)), req.body));
  });
  router.put("/saves/:id/club/county-category", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    res.json(await service.setCountyCategory({ playerId: s!.playerId!, isAdmin: s?.isAdmin === true }, careerIdSchema.parse(String(req.params.id)), req.body));
  });
  router.get("/saves/:id/club/county-matches/:matchId", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    if (!live) { res.status(404).json({ error: "Not found" }); return; }
    res.json(await live.read({ playerId: s!.playerId!, isAdmin: s?.isAdmin === true }, careerIdSchema.parse(String(req.params.id)), careerIdSchema.parse(String(req.params.matchId))));
  });
  router.post("/saves/:id/club/county-matches/:matchId/darts", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    if (!live) { res.status(404).json({ error: "Not found" }); return; }
    res.json(await live.darts({ playerId: s!.playerId!, isAdmin: s?.isAdmin === true }, careerIdSchema.parse(String(req.params.id)), careerIdSchema.parse(String(req.params.matchId)), req.body));
  });
  router.get("/saves/:id/club/county-trial", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    if (!trials) { res.status(404).json({ error: "Not found" }); return; }
    res.json(await trials.read({ playerId: s!.playerId!, isAdmin: s?.isAdmin === true }, careerIdSchema.parse(String(req.params.id))));
  });
  router.post("/saves/:id/club/county-trial/start", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    if (!trials) { res.status(404).json({ error: "Not found" }); return; }
    res.json(await trials.start({ playerId: s!.playerId!, isAdmin: s?.isAdmin === true }, careerIdSchema.parse(String(req.params.id))));
  });
  router.get("/saves/:id/club/county-trials/:matchId", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    if (!trials) { res.status(404).json({ error: "Not found" }); return; }
    res.json(await trials.session({ playerId: s!.playerId!, isAdmin: s?.isAdmin === true }, careerIdSchema.parse(String(req.params.id)), careerIdSchema.parse(String(req.params.matchId))));
  });
  router.post("/saves/:id/club/county-trials/:matchId/darts", async (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    if (!trials) { res.status(404).json({ error: "Not found" }); return; }
    res.json(await trials.darts({ playerId: s!.playerId!, isAdmin: s?.isAdmin === true }, careerIdSchema.parse(String(req.params.id)), careerIdSchema.parse(String(req.params.matchId)), req.body));
  });
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.includes("/club")) { next(error); return; }
    if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else if (error instanceof ZodError) res.status(400).json({ error: "Invalid Career club request" });
    else { req.log?.error({ err: error }, "Career club request failed"); res.status(500).json({ error: "Career club request failed" }); }
  });
  return router;
}
