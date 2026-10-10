import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { BRANDS } from "../content/brands.ts";
import { stableUuid } from "../world/random.ts";
import { npcSponsorSnapshotForBrand } from "./npc-foundation.ts";

type MarketRoot = { id: string; world_seed: string; world_generation_version: number };
type SponsorMarketEvent = {
  id: string; eventType: string; npcId: string; npcName: string; sponsorKey: string; sponsorName: string;
  sourceEventId: string|null; season: number; week: number; title: string; summary: string; relationshipId: string;
};

const asPeriod = (season: number, week: number) => (season - 1) * 52 + week;
const periodParts = (period: number) => ({ season: Math.floor((period - 1) / 52) + 1, week: ((period - 1) % 52) + 1 });

async function persistMarketEvent(
  tx: CareerExecutor, root: MarketRoot,
  input: { relationshipId: string; npcId: string; npcName: string; sponsorKey: string; sponsorName: string;
    eventType: "SIGNED" | "RENEWED" | "ENDED"; season: number; week: number; operationKey: string;
    title: string; summary: string; sourceEventId?: string|null; },
) {
  await tx.execute(sql`INSERT INTO career_npc_sponsor_market_events
    (career_save_id,id,relationship_id,npc_id,sponsor_key,source_event_id,event_type,season,week,operation_key,details)
    VALUES(${root.id},${stableUuid(root.world_seed,root.world_generation_version,"npc-sponsor-story",input.operationKey)},
      ${input.relationshipId},${input.npcId},${input.sponsorKey},${input.sourceEventId??null},${input.eventType},${input.season},${input.week},
      ${input.operationKey},${JSON.stringify({npcName:input.npcName,sponsorName:input.sponsorName,title:input.title,summary:input.summary})}::jsonb)
    ON CONFLICT(career_save_id,operation_key) DO NOTHING`);
}

/**
 * Runs in the committed sporting-week transaction. Only recorded event finishes
 * qualify an NPC for a new or renewed agreement; no player ledger is touched.
 */
export async function advanceNpcSponsorMarketWeek(
  tx: CareerExecutor, root: MarketRoot, season: number, week: number,
): Promise<void> {
  const claimed = await tx.execute(sql`INSERT INTO career_npc_sponsor_market_periods(career_save_id,season,week)
    VALUES(${root.id},${season},${week}) ON CONFLICT DO NOTHING RETURNING week`);
  if (!claimed.rows.length) return;

  const results = await tx.execute(sql`SELECT DISTINCT ON (r.npc_id) r.npc_id,r.finishing_position::integer AS best_finish,
      r.event_id,i.definition_key,p.first_name,p.surname
    FROM career_event_results r
    JOIN career_event_instances i ON i.career_save_id=r.career_save_id AND i.id=r.event_id
    JOIN career_world_players p ON p.career_save_id=r.career_save_id AND p.id=r.npc_id
    WHERE r.career_save_id=${root.id} AND r.participant_kind='NPC' AND r.npc_id IS NOT NULL
      AND r.season=${season} AND i.start_week=${week} AND r.finishing_position<=3 AND p.status='ACTIVE'
    ORDER BY r.npc_id,r.finishing_position,r.event_id`);
  const achievements = new Map(results.rows.map(row => [String(row.npc_id), {
    finish: Number(row.best_finish), name: `${String(row.first_name)} ${String(row.surname)}`,
    eventId:String(row.event_id),eventName:String(row.definition_key),
  }]));
  const currentPeriod = asPeriod(season, week);
  const expired = await tx.execute(sql`SELECT r.id,r.npc_id,r.sponsor_key,r.category,r.sponsor_snapshot,
      p.first_name,p.surname
    FROM career_npc_sponsor_relationships r
    JOIN career_npc_sponsor_market_terms t ON t.career_save_id=r.career_save_id AND t.relationship_id=r.id
    JOIN career_world_players p ON p.career_save_id=r.career_save_id AND p.id=r.npc_id
    WHERE r.career_save_id=${root.id} AND r.status='ACTIVE'
      AND ((t.contract_end_season-1)*52+t.contract_end_week)<=${currentPeriod}
    ORDER BY r.npc_id,r.id FOR UPDATE OF r`);
  for (const row of expired.rows) {
    const npcId=String(row.npc_id), relationshipId=String(row.id), sponsorKey=String(row.sponsor_key);
    const npcName=`${String(row.first_name)} ${String(row.surname)}`;
    const sponsorName=String((row.sponsor_snapshot as Record<string,unknown>).displayName ?? sponsorKey);
    const achievement=achievements.get(npcId);
    await tx.execute(sql`UPDATE career_npc_sponsor_relationships SET status='ENDED',end_season=${season},end_week=${week}
      WHERE career_save_id=${root.id} AND id=${relationshipId} AND status='ACTIVE'`);
    if (!achievement) {
      await persistMarketEvent(tx,root,{relationshipId,npcId,npcName,sponsorKey,sponsorName,eventType:"ENDED",season,week,
        operationKey:`end:${relationshipId}`,title:`${npcName} parts ways with ${sponsorName}`,
        summary:`The agreement concluded after its recorded term expired.`});
      continue;
    }
    const newId=stableUuid(root.world_seed,root.world_generation_version,"npc-sponsor-renewal",relationshipId,season,week);
    await tx.execute(sql`INSERT INTO career_npc_sponsor_relationships
      (career_save_id,id,npc_id,sponsor_key,category,representative_id,status,start_season,start_week,end_season,end_week,sponsor_snapshot)
      SELECT ${root.id},${newId},npc_id,sponsor_key,category,representative_id,'ACTIVE',${season},${week},NULL,NULL,sponsor_snapshot
      FROM career_npc_sponsor_relationships WHERE career_save_id=${root.id} AND id=${relationshipId}
      ON CONFLICT(career_save_id,id) DO NOTHING`);
    const renewalEnd=periodParts(asPeriod(season,week)+52);
    await tx.execute(sql`INSERT INTO career_npc_sponsor_market_terms
      (career_save_id,relationship_id,contract_end_season,contract_end_week)
      VALUES(${root.id},${newId},${renewalEnd.season},${renewalEnd.week})
      ON CONFLICT(career_save_id,relationship_id) DO NOTHING`);
    await persistMarketEvent(tx,root,{relationshipId:newId,npcId,npcName,sponsorKey,sponsorName,eventType:"RENEWED",season,week,
      operationKey:`renew:${relationshipId}:${season}:${week}`,title:`${npcName} renews with ${sponsorName}`,
      sourceEventId:achievement.eventId,summary:`A recorded top-three finish at ${achievement.eventName} secured another term.`});
  }

  const categories = new Map<number,string>([[1,"EQUIPMENT_PARTNER"],[2,"APPAREL_PARTNER"],[3,"SECONDARY_PARTNER"]]);
  const brands=BRANDS.filter(brand=>brand.active&&brand.representativeId&&brand.category!=="LOCAL_PARTNER")
    .sort((a,b)=>a.id.localeCompare(b.id));
  for (const [npcId,achievement] of achievements) {
    const category=categories.get(achievement.finish);
    if(!category)continue;
    const activeSponsors=new Set((await tx.execute(sql`SELECT sponsor_key FROM career_npc_sponsor_relationships
      WHERE career_save_id=${root.id} AND npc_id=${npcId} AND status='ACTIVE'`)).rows.map(row=>String(row.sponsor_key)));
    const candidates=brands.filter(brand=>brand.category===category&&!activeSponsors.has(brand.id));
    if(!candidates.length)continue;
    const choice=stableUuid(root.world_seed,root.world_generation_version,"npc-sponsor-choice",npcId,season,week,category);
    const brand=candidates[Number.parseInt(choice.replaceAll("-","").slice(0,8),16)%candidates.length]!;
    const snapshot=npcSponsorSnapshotForBrand(brand);
    const id=stableUuid(root.world_seed,root.world_generation_version,"npc-sponsor-agreement",npcId,brand.id,season,week);
    await tx.execute(sql`INSERT INTO career_npc_sponsor_relationships
      (career_save_id,id,npc_id,sponsor_key,category,representative_id,status,start_season,start_week,end_season,end_week,sponsor_snapshot)
      VALUES(${root.id},${id},${npcId},${brand.id},${category},${brand.representativeId},'ACTIVE',${season},${week},
        NULL,NULL,${JSON.stringify(snapshot)}::jsonb)
      ON CONFLICT(career_save_id,id) DO NOTHING`);
    const contractEnd=periodParts(currentPeriod+52);
    await tx.execute(sql`INSERT INTO career_npc_sponsor_market_terms
      (career_save_id,relationship_id,contract_end_season,contract_end_week)
      VALUES(${root.id},${id},${contractEnd.season},${contractEnd.week})
      ON CONFLICT(career_save_id,relationship_id) DO NOTHING`);
    await persistMarketEvent(tx,root,{relationshipId:id,npcId,npcName:achievement.name,sponsorKey:brand.id,sponsorName:brand.name,
      eventType:"SIGNED",season,week,operationKey:`sign:${npcId}:${brand.id}:${season}:${week}`,
      title:`${achievement.name} signs with ${brand.name}`,
      sourceEventId:achievement.eventId,
      summary:`A recorded ${achievement.finish===1?"tournament win":"top-three finish"} at ${achievement.eventName} attracted the ${brand.category.replaceAll("_"," ").toLowerCase()} partner.`});
  }
}

export async function getNpcSponsorMarket(tx: CareerExecutor, saveId: string) {
  const save=(await tx.execute(sql`SELECT s.current_season,s.current_week,s.world_seed,s.world_generation_version
    FROM career_saves s WHERE s.id=${saveId}`)).rows[0];
  if(!save)return null;
  // Idempotent additive recovery for pre-SP-F saves: only real persisted NPC
  // relationships are represented; human sponsor contracts are never queried.
  const legacyRows=await tx.execute(sql`SELECT r.id,r.npc_id,r.sponsor_key,r.start_season,r.start_week,
      r.sponsor_snapshot,concat_ws(' ',p.first_name,p.surname) AS npc_name
    FROM career_npc_sponsor_relationships r JOIN career_world_players p
      ON p.career_save_id=r.career_save_id AND p.id=r.npc_id
    WHERE r.career_save_id=${saveId}`);
  const root={id:saveId,world_seed:String(save.world_seed),world_generation_version:Number(save.world_generation_version)};
  for(const row of legacyRows.rows){
    const snapshot=row.sponsor_snapshot as Record<string,unknown>,npcName=String(row.npc_name),sponsorKey=String(row.sponsor_key);
    const sponsorName=String(snapshot.displayName??sponsorKey),relationshipId=String(row.id);
    await persistMarketEvent(tx,root,{relationshipId,npcId:String(row.npc_id),npcName,sponsorKey,sponsorName,
      eventType:"SIGNED",season:Number(row.start_season),week:Number(row.start_week),
      operationKey:`relationship-start:${relationshipId}`,title:`${npcName} signs with ${sponsorName}`,
      summary:"A persisted NPC sponsorship relationship was recorded in this Career world."});
  }
  const relationshipRows=await tx.execute(sql`SELECT r.id,r.npc_id,concat_ws(' ',p.first_name,p.surname) AS npc_name,
      r.sponsor_key,r.category,r.status,r.start_season,r.start_week,r.end_season,r.end_week,r.sponsor_snapshot
    FROM career_npc_sponsor_relationships r JOIN career_world_players p
      ON p.career_save_id=r.career_save_id AND p.id=r.npc_id
    WHERE r.career_save_id=${saveId} ORDER BY (r.status='ACTIVE') DESC,r.sponsor_key,p.surname,p.first_name,r.start_season DESC LIMIT 300`);
  const eventRows=await tx.execute(sql`SELECT e.id,e.event_type,e.npc_id,concat_ws(' ',p.first_name,p.surname) AS npc_name,
      e.sponsor_key,e.source_event_id,e.season,e.week,e.relationship_id,e.details
    FROM career_npc_sponsor_market_events e JOIN career_world_players p
      ON p.career_save_id=e.career_save_id AND p.id=e.npc_id
    WHERE e.career_save_id=${saveId} ORDER BY e.season DESC,e.week DESC,e.id DESC LIMIT 100`);
  const relationships=relationshipRows.rows.map(row=>{
    const snapshot=row.sponsor_snapshot as Record<string,unknown>;
    return {id:String(row.id),npcId:String(row.npc_id),npcName:String(row.npc_name),sponsorKey:String(row.sponsor_key),
      sponsorName:String(snapshot.displayName??row.sponsor_key),category:String(row.category),tier:String(snapshot.commercialTier??"REGIONAL"),
      status:String(row.status),startSeason:Number(row.start_season),startWeek:Number(row.start_week),
      endSeason:row.end_season==null?null:Number(row.end_season),endWeek:row.end_week==null?null:Number(row.end_week)};
  });
  const events:SponsorMarketEvent[]=eventRows.rows.map(row=>{
    const details=row.details as Record<string,unknown>;
    return {id:String(row.id),eventType:String(row.event_type),npcId:String(row.npc_id),npcName:String(row.npc_name),
      sponsorKey:String(row.sponsor_key),sponsorName:String(details.sponsorName??row.sponsor_key),
      sourceEventId:row.source_event_id?String(row.source_event_id):null,
      season:Number(row.season),week:Number(row.week),title:String(details.title??"Sponsor update"),
      summary:String(details.summary??""),relationshipId:String(row.relationship_id)};
  });
  const brandRosters=BRANDS.filter(brand=>brand.active).map(brand=>({
    sponsorKey:brand.id,sponsorName:brand.name,category:brand.category,tier:brand.commercialTier,
    players:relationships.filter(row=>row.status==="ACTIVE"&&row.sponsorKey===brand.id)
      .map(row=>({npcId:row.npcId,npcName:row.npcName,category:row.category,tier:row.tier})),
  }));
  const npcCommercialProfiles=[...new Set(relationships.map(row=>row.npcId))].map(npcId=>{
    const playerRelationships=relationships.filter(row=>row.npcId===npcId);
    const first=playerRelationships[0]!;
    return {npcId,npcName:first.npcName,sponsors:playerRelationships,
      history:events.filter(event=>event.npcId===npcId)};
  });
  return {period:{season:Number(save.current_season),week:Number(save.current_week)},relationships,events,brandRosters,npcCommercialProfiles};
}
