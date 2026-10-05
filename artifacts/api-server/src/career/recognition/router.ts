import { Router, type Request, type Response, type NextFunction } from "express";
import type {} from "express-session";
import { ZodError } from "zod";
import { CareerError } from "../service.ts";
import type { createCareerRecognitionService } from "./service.ts";

export function createCareerRecognitionRouter(service: ReturnType<typeof createCareerRecognitionService>) {
  const router=Router();
  const auth=(req:Request,res:Response,next:NextFunction)=>{
    res.set("Cache-Control","no-store");
    const session=req.session as {playerId?:number;isAdmin?:boolean}|undefined;
    if (!Number.isSafeInteger(session?.playerId) || (session?.playerId??0)<=0) {res.status(401).json({error:"Authentication required"});return;}
    res.locals.careerActor={playerId:session!.playerId!,isAdmin:session?.isAdmin===true};next();
  };
  router.get("/saves/:id/recognition",auth,async(req,res)=>res.json(await service.read(res.locals.careerActor,String(req.params.id))));
  router.get("/saves/:id/recognition/npcs/:npcId",auth,async(req,res)=>res.json(await service.npc(res.locals.careerActor,String(req.params.id),String(req.params.npcId))));
  // Deliberately no mutation endpoint: the browser cannot submit recognition.
  router.use((error:unknown,_req:Request,res:Response,next:NextFunction)=>{
    if (error instanceof CareerError) res.status(error.status).json({error:error.message});
    else if (error instanceof ZodError) res.status(400).json({error:"Invalid Career recognition request"});
    else next(error);
  });
  return router;
}
