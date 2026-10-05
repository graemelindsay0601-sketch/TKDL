import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { careerIdSchema } from "../validation.ts";
import { eventHistory, loadEvidence, npcHistory, projectLegacy, readReviews } from "./persistence.ts";
import type { LegacyView } from "./types.ts";
import { createCareerRelationshipsService } from "../relationships/service.ts";
const rootSchema=z.object({id:z.string().uuid(),current_season:z.number().int().positive(),current_week:z.number().int().min(1).max(52),
  status:z.enum(["ACTIVE","RETIRED"]),player_id:z.number().int().positive(),career_name:z.string().nullable()});
const ownedRoot=async(tx:CareerExecutor,actor:CareerActor,id:string,active=false)=>rootSchema.parse(await lockRoot(tx,actor,id,active));
export function createCareerLegacyService(database:CareerDatabase) {
  return {
    read:(actor:CareerActor,id:string)=>database.transaction(async tx=>{
      const root=await ownedRoot(tx,actor,id);
      const saved=(await tx.execute(sql`SELECT snapshot FROM career_legacy_retirements WHERE career_save_id=${id}`)).rows[0];
      return saved?saved.snapshot as LegacyView:projectLegacy(tx,root);
    }),
    season:(actor:CareerActor,id:string,season:number)=>database.transaction(async tx=>{
      z.number().int().positive().parse(season);
      const root=await ownedRoot(tx,actor,id),e=await loadEvidence(tx,root);
      const r=(await readReviews(tx,e)).find(r=>r.season===season);
      if(!r)throw new CareerError(404,"Completed season review not found");return r;
    }),
    event:(actor:CareerActor,id:string,key:string)=>database.transaction(async tx=>{
      z.string().min(1).max(150).regex(/^[a-zA-Z0-9:_-]+$/).parse(key);
      const root=await ownedRoot(tx,actor,id),e=await loadEvidence(tx,root);
      if(!e.results.some(r=>r.key===key))throw new CareerError(404,"Recorded event history not found");
      return eventHistory(e,key);
    }),
    npc:(actor:CareerActor,id:string,npcId:string)=>database.transaction(async tx=>{
      careerIdSchema.parse(npcId);const root=await ownedRoot(tx,actor,id),e=await loadEvidence(tx,root);
      if(!e.players.some(p=>p.id===npcId))throw new CareerError(404,"Public NPC not found");
      const v=await projectLegacy(tx,root);
      const relationships=await createCareerRelationshipsService({execute:q=>tx.execute(q),transaction:w=>w(tx)}).read(actor,id);
      return {...npcHistory(e,npcId,await readReviews(tx,e),v.hallOfFame),
        meetings:relationships.opponents.find(o=>o.player.id===npcId)?.history.map(m=>({season:m.season,name:m.name,won:m.won}))??[]};
    }),
    begin:(actor:CareerActor,id:string,season:number,body:unknown)=>database.transaction(async tx=>{
      z.number().int().positive().parse(season);z.object({confirmation:z.literal("BEGIN SEASON")}).strict().parse(body);
      const root=await ownedRoot(tx,actor,id,true);
      const pending=(await tx.execute(sql`SELECT season FROM career_legacy_reviews WHERE career_save_id=${id} AND acknowledged=false ORDER BY season LIMIT 1`)).rows[0];
      const row=(await tx.execute(sql`SELECT acknowledged FROM career_legacy_reviews WHERE career_save_id=${id} AND season=${season}`)).rows[0];
      if(row?.acknowledged===true)return {acknowledged:true,season,now:{season:Number(root.current_season),week:Number(root.current_week)}};
      if(!row||season>=Number(root.current_season)||(pending&&Number(pending.season)!==season))throw new CareerError(409,"Season review is not ready to acknowledge");
      await tx.execute(sql`UPDATE career_legacy_reviews SET acknowledged=true WHERE career_save_id=${id} AND season=${season}`);
      return {acknowledged:true,season,now:{season:Number(root.current_season),week:Number(root.current_week)}};
    }),
  };
}
