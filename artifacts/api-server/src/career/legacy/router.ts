import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import { authedWriteRateLimit } from "../../middleware/writeRateLimit.ts";
import type { createCareerLegacyService } from "./service.ts";
export function createCareerLegacyRouter(service:ReturnType<typeof createCareerLegacyService>) {
  const router=Router();
  const auth=(req:Request,res:Response,next:NextFunction)=>{
    res.set("Cache-Control","no-store");
    const s=req.session as {playerId?:number;isAdmin?:boolean}|undefined;
    if(!Number.isSafeInteger(s?.playerId)||(s?.playerId??0)<=0){res.status(401).json({error:"Authentication required"});return;}
    res.locals.careerActor={playerId:s!.playerId!,isAdmin:s?.isAdmin===true};next();
  };
  router.get("/saves/:id/legacy",auth,async(req,res)=>res.json(await service.read(res.locals.careerActor,String(req.params.id))));
  router.get("/saves/:id/legacy/seasons/:season",auth,async(req,res)=>res.json(await service.season(res.locals.careerActor,String(req.params.id),Number(req.params.season))));
  router.get("/saves/:id/legacy/events/:key",auth,async(req,res)=>res.json(await service.event(res.locals.careerActor,String(req.params.id),String(req.params.key))));
  router.get("/saves/:id/legacy/npcs/:npcId",auth,async(req,res)=>res.json(await service.npc(res.locals.careerActor,String(req.params.id),String(req.params.npcId))));
  router.post("/saves/:id/legacy/seasons/:season/begin",auth,authedWriteRateLimit,async(req,res)=>res.json(await service.begin(res.locals.careerActor,String(req.params.id),Number(req.params.season),req.body)));
  router.use((error:unknown,req:Request,res:Response,_next:NextFunction)=>{
    if(error instanceof CareerError)res.status(error.status).json({error:error.message});
    else if(error instanceof ZodError)res.status(400).json({error:"Invalid Career history request"});
    else{req.log?.error({err:error},"Career history request failed");res.status(500).json({error:"Career history request failed"});}
  });return router;
}
