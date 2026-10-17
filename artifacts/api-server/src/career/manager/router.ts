import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import type { createCareerManagerService } from "./service.ts";

/** Your manager: who will sign you, sign one, or leave. */
export function createCareerManagerRouter(service: ReturnType<typeof createCareerManagerService>) {
  const router = Router();
  const paths = ["/saves/:id/manager", "/saves/:id/manager/sign", "/saves/:id/manager/leave"];
  router.use(paths, (req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    res.locals.careerActor = { playerId: s!.playerId!, isAdmin: s?.isAdmin === true };
    next();
  });
  const id = (req: Request) => careerIdSchema.parse(String(req.params.id));
  router.get("/saves/:id/manager", async (req, res) => { res.json(await service.read(res.locals.careerActor, id(req))); });
  router.post("/saves/:id/manager/sign", authedWriteRateLimit, async (req, res) => { res.json(await service.sign(res.locals.careerActor, id(req), req.body)); });
  router.post("/saves/:id/manager/leave", authedWriteRateLimit, async (req, res) => { res.json(await service.leave(res.locals.careerActor, id(req))); });
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.includes("/manager")) { next(error); return; }
    if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else if (error instanceof ZodError) res.status(400).json({ error: "Invalid manager request" });
    else { req.log?.error({ err: error }, "Career manager request failed"); res.status(500).json({ error: "Manager request failed" }); }
  });
  return router;
}
