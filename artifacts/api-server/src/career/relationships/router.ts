import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import type { createCareerRelationshipsService } from "./service.ts";

export function createCareerRelationshipsRouter(service: ReturnType<typeof createCareerRelationshipsService>) {
  const router = Router();
  router.get("/saves/:id/relationships", async (req,res) => {
    res.set("Cache-Control","no-store");
    const session = req.session as { playerId?:number; isAdmin?:boolean };
    if (!Number.isSafeInteger(session?.playerId) || (session?.playerId ?? 0)<=0) { res.status(401).json({error:"Authentication required"}); return; }
    res.json(await service.read({playerId:session.playerId!,isAdmin:session.isAdmin===true},String(req.params.id)));
  });
  router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof CareerError) res.status(error.status).json({error:error.message});
    else if (error instanceof ZodError) res.status(400).json({error:"Invalid Career request"});
    else next(error);
  });
  return router;
}
