import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import type { createCareerLifeService } from "./service.ts";

export function createCareerLifeRouter(service:ReturnType<typeof createCareerLifeService>) {
  const router=Router();
  const auth=(req:Request,res:Response,next:NextFunction)=>{
    res.set("Cache-Control","no-store");const session=req.session as {playerId?:number;isAdmin?:boolean}|undefined;
    if(!Number.isSafeInteger(session?.playerId)||(session?.playerId??0)<=0){res.status(401).json({error:"Authentication required"});return;}
    res.locals.careerActor={playerId:session!.playerId!,isAdmin:session?.isAdmin===true};next();
  };
  router.get("/saves/:id/life",auth,async(req,res)=>res.json(await service.read(res.locals.careerActor,String(req.params.id))));
  router.get("/saves/:id/life/npcs/:npcId",auth,async(req,res)=>res.json(await service.npc(res.locals.careerActor,String(req.params.id),String(req.params.npcId))));
  router.post("/saves/:id/life/moments/:momentId",auth,async(req,res)=>res.json(await service.moment(res.locals.careerActor,String(req.params.id),String(req.params.momentId),req.body)));
  router.post("/saves/:id/life/opportunities/:opportunityId",auth,async(req,res)=>res.json(await service.opportunity(res.locals.careerActor,String(req.params.id),String(req.params.opportunityId),req.body)));
  router.post("/saves/:id/life/merchandise",auth,async(req,res)=>res.json(await service.merchandise(res.locals.careerActor,String(req.params.id),req.body)));
  router.use((error:unknown,req:Request,res:Response,_next:NextFunction)=>{
    if(error instanceof CareerError)res.status(error.status).json({error:error.message});
    else if(error instanceof ZodError)res.status(400).json({error:"Invalid Career Life choice"});
    else {req.log?.error({err:error},"Career Life request failed");res.status(500).json({error:"Career Life request failed"});}
  });
  return router;
}
