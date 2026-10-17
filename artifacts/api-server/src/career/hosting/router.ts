import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { z, ZodError } from "zod";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import { hostingPreview, type createCareerHostingService } from "./service.ts";

/** Run your own tournament: what you've hosted, a preview of a booking, and booking one. */
export function createCareerHostingRouter(service: ReturnType<typeof createCareerHostingService>) {
  const router = Router();
  router.use(["/saves/:id/hosting", "/saves/:id/hosting/preview"], (req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "no-store");
    const s = req.session as { playerId?: number; isAdmin?: boolean } | undefined;
    if (!Number.isSafeInteger(s?.playerId) || (s?.playerId ?? 0) <= 0) { res.status(401).json({ error: "Authentication required" }); return; }
    res.locals.careerActor = { playerId: s!.playerId!, isAdmin: s?.isAdmin === true };
    next();
  });
  const id = (req: Request) => careerIdSchema.parse(String(req.params.id));
  router.get("/saves/:id/hosting", async (req, res) => { res.json(await service.read(res.locals.careerActor, id(req))); });
  router.get("/saves/:id/hosting/preview", async (req, res) => {
    const q = z.object({ feePence: z.coerce.number().int().min(0).max(5000), topUpPence: z.coerce.number().int().min(0).max(200000), fieldSize: z.coerce.number().int(), fans: z.coerce.number().int().min(0).default(0) }).parse(req.query);
    if (q.fieldSize !== 16 && q.fieldSize !== 32) throw new CareerError(400, "Choose a field of 16 or 32");
    res.json(hostingPreview(q, q.fans));
  });
  router.post("/saves/:id/hosting", authedWriteRateLimit, async (req, res) => { res.json(await service.create(res.locals.careerActor, id(req), req.body)); });
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.includes("/hosting")) { next(error); return; }
    if (error instanceof CareerError) res.status(error.status).json({ error: error.message });
    else if (error instanceof ZodError) res.status(400).json({ error: "Invalid tournament booking" });
    else { req.log?.error({ err: error }, "Career hosting request failed"); res.status(500).json({ error: "Tournament booking failed" }); }
  });
  return router;
}
