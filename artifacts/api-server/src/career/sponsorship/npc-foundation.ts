import {sql} from "drizzle-orm";
import {z} from "zod";
import type {CareerExecutor} from "../database.ts";
import {BRANDS,SPONSOR_CATEGORIES} from "../content/brands.ts";
import {representativeById} from "../content/sponsor-representatives.ts";
import {stableUuid} from "../world/random.ts";

export const NPC_SPONSOR_CONTENT_VERSION=1;

export const npcSponsorSnapshotSchema=z.object({
  contentVersion:z.literal(NPC_SPONSOR_CONTENT_VERSION),
  sponsorId:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName:z.string().min(2).max(80),
  shortName:z.string().min(2).max(40),
  category:z.enum(SPONSOR_CATEGORIES),
  commercialTier:z.enum(["LOCAL","REGIONAL","PROFESSIONAL","ELITE"]),
  themeKey:z.string().regex(/^brand:[a-z0-9-]+$/),
  presentation:z.object({logoAssetKey:z.string().min(1).max(100),displayTreatment:z.enum(["WORDMARK","MONOGRAM","CREST"]),
    accentToken:z.string().regex(/^sponsor-[a-z0-9-]+-accent$/),tagline:z.string().max(80).nullable()}).strict(),
  representative:z.object({id:z.string().regex(/^rep-[a-z0-9-]+$/),sponsorId:z.string().regex(/^[a-z0-9-]+$/),
    displayName:z.string().min(2).max(80),role:z.string().min(2).max(100)}).strict(),
}).strict();
export type SponsorSnapshot=z.infer<typeof npcSponsorSnapshotSchema>;
export const parseNpcSponsorSnapshot=(value:unknown)=>npcSponsorSnapshotSchema.parse(value);

function hashBucket(value:string,modulus:number):number{
  return Number.parseInt(value.replaceAll("-","").slice(0,8),16)%modulus;
}

/** Pure, repeatable content selection; no current time, global RNG, or save-account identity. */
export function initialNpcSponsorRelationships(seed:string,generationVersion:number,npcIds:readonly string[]){
  const candidates=BRANDS.filter(brand=>brand.active&&brand.representativeId&&brand.category!=="LOCAL_PARTNER")
    .sort((a,b)=>a.id.localeCompare(b.id));
  return npcIds.flatMap(npcId=>{
    const presence=stableUuid(seed,generationVersion,"npc-sponsor-presence",npcId);
    if(hashBucket(presence,100)>=18)return [];
    const choice=stableUuid(seed,generationVersion,"npc-sponsor-choice",npcId);
    const brand=candidates[hashBucket(choice,candidates.length)];
    if(!brand)return [];
    const representative=representativeById(brand.representativeId!);
    if(!representative)throw new Error(`Missing representative content for ${brand.id}`);
    const sponsorSnapshot:SponsorSnapshot=npcSponsorSnapshotSchema.parse({
      contentVersion:NPC_SPONSOR_CONTENT_VERSION,sponsorId:brand.id,displayName:brand.name,shortName:brand.shortName,
      category:brand.category,commercialTier:brand.commercialTier,themeKey:brand.themeKey,
      presentation:brand.presentation,representative,
    });
    return [{
      id:stableUuid(seed,generationVersion,"npc-sponsor-relationship",npcId,brand.id),
      npcId,sponsorKey:brand.id,category:brand.category,representativeId:representative.id,
      status:"ACTIVE" as const,startSeason:1,startWeek:1,endSeason:null,endWeek:null,sponsorSnapshot,
    }];
  });
}

/**
 * Called only while a new Career world is being created, in the same transaction
 * as its NPC population. The marker makes empty and populated results equally final.
 */
export async function persistInitialNpcSponsorRelationships(
  tx:CareerExecutor,
  input:{saveId:string;seed:string;generationVersion:number;npcIds:readonly string[]},
):Promise<{created:boolean;relationshipCount:number}>{
  const existing=(await tx.execute(sql`SELECT content_version,generation_version FROM career_sponsor_world_state
    WHERE career_save_id=${input.saveId} FOR UPDATE`)).rows[0];
  if(existing){
    if(Number(existing.content_version)!==NPC_SPONSOR_CONTENT_VERSION||Number(existing.generation_version)!==input.generationVersion)
      throw new Error("Career NPC sponsor content requires a versioned migration");
    return {created:false,relationshipCount:Number((await tx.execute(sql`SELECT relationship_count FROM career_sponsor_world_state
      WHERE career_save_id=${input.saveId}`)).rows[0].relationship_count)};
  }

  const relationships=initialNpcSponsorRelationships(input.seed,input.generationVersion,input.npcIds);
  if(relationships.length){
    const insertRows=relationships.map(row=>({id:row.id,npc_id:row.npcId,sponsor_key:row.sponsorKey,category:row.category,
      representative_id:row.representativeId,status:row.status,start_season:row.startSeason,start_week:row.startWeek,
      end_season:row.endSeason,end_week:row.endWeek,sponsor_snapshot:row.sponsorSnapshot}));
    await tx.execute(sql`INSERT INTO career_npc_sponsor_relationships
      (career_save_id,id,npc_id,sponsor_key,category,representative_id,status,start_season,start_week,end_season,end_week,sponsor_snapshot)
      SELECT ${input.saveId}::uuid,r.id::uuid,r.npc_id::uuid,r.sponsor_key,r.category,r.representative_id,r.status,
        r.start_season,r.start_week,r.end_season,r.end_week,r.sponsor_snapshot
      FROM jsonb_to_recordset(${JSON.stringify(insertRows)}::jsonb) AS r(
        id text,npc_id text,sponsor_key text,category text,representative_id text,status text,start_season integer,start_week integer,
        end_season integer,end_week integer,sponsor_snapshot jsonb
      ) ON CONFLICT(career_save_id,id) DO NOTHING`);
  }
  await tx.execute(sql`INSERT INTO career_sponsor_world_state(career_save_id,content_version,generation_version,npc_count,relationship_count)
    VALUES(${input.saveId},${NPC_SPONSOR_CONTENT_VERSION},${input.generationVersion},${input.npcIds.length},${relationships.length})`);
  return {created:true,relationshipCount:relationships.length};
}
