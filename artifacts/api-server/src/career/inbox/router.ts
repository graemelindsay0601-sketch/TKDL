import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import type { createCareerInboxService } from "./service.ts";

/** The Career inbox: what's new for you, and marking it seen, dismissed or muted. */
export function createCareerInboxRouter(service: ReturnType<typeof createCareerInboxService>) {
  const router = Router();
  router.use("/saves/:id/inbox", (req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    res.locals.careerActor = { playerId: s!.playerId!, isAdmin: s?.isAdmin === true };
    next();
  });
  const id = (req: Request) => careerIdSchema.parse(String(req.params.id));
  router.get("/saves/:id/inbox", async (req, res) => { res.json(await service.read(res.locals.careerActor, id(req))); });
  router.post("/saves/:id/inbox", authedWriteRateLimit, async (req, res) => { res.json(await service.update(res.locals.careerActor, id(req), req.body)); });
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.includes("/inbox")) { next(error); return; }
    if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else if (error instanceof ZodError) res.status(400).json({ error: "Invalid inbox request" });
    else { req.log?.error({ err: error }, "Career inbox request failed"); res.status(500).json({ error: "Inbox request failed" }); }
  });
  return router;
}
