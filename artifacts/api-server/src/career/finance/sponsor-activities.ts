import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { stableUuid } from "../world/random.ts";
import type { SponsorActivitySpecification } from "./sponsors.catalogue.ts";

const REQUIRED_KIND:Record<string,string>={MEDIA_APPEARANCE:"MEDIA_APPEARANCE",COMMUNITY_APPEARANCE:"COMMUNITY_SESSION",PROMOTIONAL_APPEARANCE:"PROMOTIONAL_APPEARANCE",PRODUCT_APPEARANCE:"PRODUCT_APPEARANCE"};
const OPTIONAL_KIND:Record<string,string>={SPONSOR_MEDIA_APPEARANCE:"MEDIA",PROMOTIONAL_EVENT:"PROMOTIONAL_EVENT",COMMUNITY_APPEARANCE:"COMMUNITY",PRODUCT_LAUNCH:"PRODUCT_LAUNCH"};

async function freeWeeks(tx:CareerExecutor,saveId:string,season:number,from:number,to:number){
  const rows=await tx.execute(sql`SELECT series.week FROM generate_series(${from}::integer,${to}::integer) AS series(week)
    WHERE NOT EXISTS (
      SELECT 1 FROM career_event_instances i JOIN career_event_entries e
        ON e.career_save_id=i.career_save_id AND e.event_id=i.id AND e.participant_key='HUMAN'
      WHERE i.career_save_id=${saveId} AND i.season=${season} AND i.start_week<=series.week AND i.end_week>=series.week AND e.status<>'WITHDRAWN'
    ) AND NOT EXISTS (
      SELECT 1 FROM career_sponsor_week_bookings b WHERE b.career_save_id=${saveId} AND b.season=${season} AND b.week=series.week
    ) AND NOT EXISTS (
      SELECT 1 FROM career_life_commitments l WHERE l.career_save_id=${saveId} AND l.season=${season} AND l.status='ACCEPTED'
        AND ((l.day-1)/7+1)=series.week
    ) AND NOT EXISTS (
      SELECT 1 FROM career_trips t WHERE t.career_save_id=${saveId} AND t.season=${season}
        AND t.start_day <= series.week*7 AND t.end_day >= (series.week-1)*7+1
     ) ORDER BY series.week`);
  return rows.rows.map(row=>Number(row.week));
}

function canPlaceAll(tasks:number[][]){
  const owner=new Map<number,number>();
  const ordered=tasks.map((weeks,index)=>({weeks,index})).sort((a,b)=>a.weeks.length-b.weeks.length);
  const place=(index:number,seen:Set<number>):boolean=>{
    for(const week of ordered[index]!.weeks){
      if(seen.has(week))continue;
      seen.add(week);
      const occupied=owner.get(week);
      if(occupied===undefined||place(occupied,seen)){owner.set(week,index);return true;}
    }
    return false;
  };
  return ordered.every((_,index)=>place(index,new Set()));
}

/** Materialize only clauses present in the immutable signed contract snapshot. */
export async function materializeSponsorActivities(
  tx:CareerExecutor,
  input:{saveId:string;contractId:string;sponsorKey:string;worldSeed:string;season:number;week:number;endSeason:number;endWeek:number;specification?:SponsorActivitySpecification},
){
  const spec=input.specification;
  if(!spec)return {commitments:0,opportunities:0};
  let commitments=0,opportunities=0;
  for(let season=input.season;season<=input.endSeason;season++){
    const requiredTasks:{clause:typeof spec.required[number];occurrence:number;from:number;to:number;weeks:number[]}[]=[];
    for(const clause of spec.required)for(let occurrence=1;occurrence<=clause.maxPerSeason;occurrence++){
      const authoredFrom=clause.firstWindowWeek+(occurrence-1)*clause.windowWeeks;
      const authoredTo=Math.min(52,authoredFrom+clause.windowWeeks-1);
      const agreementEnd=season===input.endSeason?input.endWeek:52;
      const from=Math.max(authoredFrom,season===input.season?input.week+1:1);
      const to=Math.min(authoredTo,agreementEnd);
      // A contract signed after an authored window creates no retroactive duty.
      // Never move the deadline to make a late-signed activity appear feasible.
      if(authoredFrom>agreementEnd||from>to)continue;
      requiredTasks.push({clause,occurrence,from,to,weeks:await freeWeeks(tx,input.saveId,season,from,to)});
    }
    const requiredWindows=requiredTasks.map(task=>task.weeks);
    const existing=(await tx.execute(sql`SELECT available_from_week,due_week FROM career_sponsor_commitments
      WHERE career_save_id=${input.saveId} AND season=${season} AND contract_id<>${input.contractId}
        AND status IN ('PLANNED','AVAILABLE')`)).rows;
    for(const row of existing)requiredWindows.push(await freeWeeks(tx,input.saveId,season,Number(row.available_from_week),Number(row.due_week)));
    if(requiredWindows.some(weeks=>weeks.length===0)||!canPlaceAll(requiredWindows))
      throw new Error(`Required sponsor activities have no complete, non-overlapping schedule in season ${season}`);
    for(const {clause,occurrence,from,to} of requiredTasks){
      const id=stableUuid(input.worldSeed,1,"sponsor-commitment",input.contractId,clause.id,season,occurrence);
      const operationKey=`spd:${input.contractId}:${clause.id}:${season}:${occurrence}`;
      const initialStatus=season===input.season&&from<=input.week?"AVAILABLE":"PLANNED";
      await tx.execute(sql`INSERT INTO career_sponsor_commitments
        (career_save_id,id,contract_id,sponsor_key,clause_id,occurrence,commitment_type,required,cadence,season,
         available_from_week,window_weeks,due_week,status,scheduling_requirements,operation_key)
        VALUES (${input.saveId},${id},${input.contractId},${input.sponsorKey},${clause.id},${occurrence},${REQUIRED_KIND[clause.type]},
          true,'PER_SEASON',${season},${from},${clause.windowWeeks},${to},${initialStatus},
          ${JSON.stringify({activitySpecVersion:spec.version,extraCompensationPence:0})}::jsonb,${operationKey})
        ON CONFLICT (career_save_id,contract_id,clause_id,season,occurrence) DO NOTHING`);
      commitments++;
    }
    for(const clause of spec.optional)for(let occurrence=1;occurrence<=clause.maxPerSeason;occurrence++){
      const authoredFrom=clause.firstWindowWeek+(occurrence-1)*clause.windowWeeks;
      const authoredTo=Math.min(52,authoredFrom+clause.windowWeeks-1);
      const agreementEnd=season===input.endSeason?input.endWeek:52;
      const from=Math.max(authoredFrom,season===input.season?input.week+1:1);
      const to=Math.min(authoredTo,agreementEnd);
      if(authoredFrom>agreementEnd)continue;
      if(from>to||!(await freeWeeks(tx,input.saveId,season,from,to)).length)continue;
      const id=stableUuid(input.worldSeed,1,"sponsor-opportunity",input.contractId,clause.id,season,occurrence);
      const operationKey=`spd:opportunity:${input.contractId}:${clause.id}:${season}:${occurrence}`;
      await tx.execute(sql`INSERT INTO career_sponsor_opportunities
        (career_save_id,id,contract_id,sponsor_key,clause_id,occurrence,opportunity_type,season,available_from_week,available_to_week,status,terms,operation_key)
        VALUES (${input.saveId},${id},${input.contractId},${input.sponsorKey},${clause.id},${occurrence},${OPTIONAL_KIND[clause.type]},${season},${from},${to},
          'AVAILABLE',${JSON.stringify({activitySpecVersion:spec.version,compensationPence:0})}::jsonb,${operationKey})
        ON CONFLICT (career_save_id,contract_id,clause_id,season,occurrence) DO NOTHING`);
      opportunities++;
    }
  }
  return {commitments,opportunities};
}

/**
 * Close only unresolved activities after their signed contract is no longer
 * active. Completed rows remain as history; confirmed bookings are released.
 * A replacement can pass explicit IDs before changing contract state, while
 * calendar advancement discovers contracts that have expired or ended.
 */
export async function cancelInactiveSponsorActivities(
  tx:CareerExecutor,
  input:{saveId:string;season:number;week:number;contractIds?:string[]},
){
  const explicitIds=input.contractIds;
  const commitmentSelector=explicitIds
    ? sql`c.contract_id IN (${sql.join(explicitIds.map(id=>sql`${id}`),sql`, `)})`
    : sql`(k.status <> 'ACTIVE' OR k.end_season < ${input.season}
        OR (k.end_season = ${input.season} AND k.end_week < ${input.week}))`;
  const opportunitySelector=explicitIds
    ? sql`o.contract_id IN (${sql.join(explicitIds.map(id=>sql`${id}`),sql`, `)})`
    : sql`(k.status <> 'ACTIVE' OR k.end_season < ${input.season}
        OR (k.end_season = ${input.season} AND k.end_week < ${input.week}))`;
  await tx.execute(sql`
    WITH cancelled AS (
      UPDATE career_sponsor_commitments c SET status='CANCELLED', updated_at=NOW(),
        resolution_evidence=c.resolution_evidence || jsonb_build_object('reason','CONTRACT_INACTIVE')
      FROM career_sponsor_contracts k
      WHERE c.career_save_id=${input.saveId} AND k.career_save_id=c.career_save_id AND k.id=c.contract_id
        AND c.status IN ('PLANNED','AVAILABLE','CONFIRMED') AND ${commitmentSelector}
      RETURNING c.career_save_id,c.id
    )
    DELETE FROM career_sponsor_week_bookings b USING cancelled x
    WHERE b.career_save_id=x.career_save_id AND b.activity_id=x.id AND b.status='CONFIRMED'
  `);
  await tx.execute(sql`
    WITH cancelled AS (
      UPDATE career_sponsor_opportunities o SET status='CANCELLED', updated_at=NOW(),
        terms=o.terms || jsonb_build_object('cancellationReason','CONTRACT_INACTIVE')
      FROM career_sponsor_contracts k
      WHERE o.career_save_id=${input.saveId} AND k.career_save_id=o.career_save_id AND k.id=o.contract_id
        AND o.status IN ('AVAILABLE','ACCEPTED','CONFIRMED') AND ${opportunitySelector}
      RETURNING o.career_save_id,o.id
    )
    DELETE FROM career_sponsor_week_bookings b USING cancelled x
    WHERE b.career_save_id=x.career_save_id AND b.activity_id=x.id AND b.status='CONFIRMED'
  `);
}
