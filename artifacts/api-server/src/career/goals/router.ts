import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import type { createCareerGoalsService } from "./service.ts";

export function createCareerGoalsRouter(service: ReturnType<typeof createCareerGoalsService>) {
  const router=Router();
  const auth=(req:Request,res:Response,next:NextFunction)=>{
    res.set("Cache-Control","no-store");
    const session=req.session as {playerId?:number;isAdmin?:boolean}|undefined;
    if (!Number.isSafeInteger(session?.playerId) || (session?.playerId??0)<=0) {res.status(401).json({error:"Authentication required"});return;}
    res.locals.careerActor={playerId:session!.playerId!,isAdmin:session?.isAdmin===true};next();
  };
  router.get("/saves/:id/goals",auth,async(req,res)=>res.json(await service.read(res.locals.careerActor,String(req.params.id))));
  router.post("/saves/:id/focus",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.focus(res.locals.careerActor,String(req.params.id),req.body)));
  router.post("/saves/:id/goals",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.create(res.locals.careerActor,String(req.params.id),req.body)));
  router.post("/saves/:id/goals/:goalId/abandon",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.abandon(res.locals.careerActor,String(req.params.id),String(req.params.goalId))));
  router.use((error:unknown,_req:Request,res:Response,next:NextFunction)=>{
    if (error instanceof CareerError) res.status(error.status).json({error:error.message});
    else if (error instanceof ZodError) res.status(400).json({error:"Invalid Career Focus/Goal request"});
    else next(error);
  });
  return router;
}
