import { sql } from "drizzle-orm";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { createCareerFactsService } from "../facts/service.ts";
import { createCareerRelationshipsService } from "../relationships/service.ts";
import { catalogueFor } from "../calendar/catalogue.ts";
import { ageOn, careerDate } from "../identity/age.ts";
import type { Fact } from "../facts/types.ts";
import { recognitionModel } from "./model.ts";
import { recognitionResult, type RecognitionEvent, type RecognitionSources, type RecognitionView } from "./types.ts";

type Row = Record<string, unknown>;
const str = (r: Row, key: string) => String(r[key] ?? "");
const inTransaction = (tx: CareerExecutor): CareerDatabase => ({execute:q=>tx.execute(q),transaction:work=>work(tx)});

export function createCareerRecognitionService(database: CareerDatabase) {
  async function read(actor: CareerActor, saveId: string, npcId?: string): Promise<RecognitionView> {
    if (npcId) careerIdSchema.parse(npcId);
    return database.transaction(async tx=>{
      const root=await lockRoot(tx,actor,saveId,false), rr=root as unknown as Row;
      const db=inTransaction(tx), relationships=await createCareerRelationshipsService(db).read(actor,saveId);
      const npc=npcId ? relationships.world.players.find(p=>p.id===npcId) : null;
      if (npcId && !npc) throw new CareerError(404,"Career opponent not found");
      const participant=npcId ?? "HUMAN", start=str(rr,"identity_start"), dob=npcId ? "" : str(rr,"identity_dob");
      const fact=(id:string,source:string,label:string,season:number,day:number|null,week:number|null=null,eventId?:string):Fact=>{
        const date=start && day!==null ? careerDate(start,season,day) : null;
        return {id,source,label,season,day,week:week ?? (day!==null ? Math.ceil(day/7) : null),date,
          age:date && dob ? ageOn(dob,date) : null,...(eventId ? {eventId} : {})};
      };
      const catalogue=new Map(catalogueFor(Number(rr.event_database_version)).map(d=>[d.key,d]));
      // Metadata only from owned A3 instances. No NPC attributes or recreated statistics.
      const metadata=(await tx.execute(sql`SELECT id,name,definition_key,circuit,classification,presentation_tier,season,end_day
        FROM career_event_instances WHERE career_save_id=${saveId}`)).rows;
      const events=new Map(metadata.map(r=>[str(r,"id"),r]));
      const eventMeta=(r:Row):Omit<RecognitionEvent,"fact">=>({
        circuit:str(r,"circuit"),classification:str(r,"classification"),tier:str(r,"presentation_tier"),
        international:catalogue.get(str(r,"definition_key"))?.geography.kind==="INTERNATIONAL",
      });
      const sources:RecognitionSources={results:[],appearances:[],qualifications:[],cards:[],rankings:[]};
      if (!npcId) {
        const facts=await createCareerFactsService(db).read(actor,saveId);
        sources.results=facts.results.map(r=>{
          const result=recognitionResult(r,catalogue.get(r.definitionKey)?.geography.kind==="INTERNATIONAL");
          // A7.1 stores result age at event start. Recognition evidence refers to completion.
          result.fact.age=result.fact.date && dob ? ageOn(dob,result.fact.date) : null;
          return result;
        });
        const meetings=relationships.opponents.flatMap(o=>o.history).sort((a,b)=>a.season-b.season || a.day-b.day || a.id.localeCompare(b.id));
        const seen=new Set<string>();
        for (const m of meetings) {
          const e=events.get(m.eventId);
          if (!e || seen.has(m.eventId)) continue;
          seen.add(m.eventId);
          sources.appearances.push({...eventMeta(e),fact:fact(`appearance:${m.eventId}`,"A3 played match / A7.2 attendance",`Played in ${m.name}`,m.season,m.day,null,m.eventId)});
        }
      } else {
        // On demand for ONE owned NPC; all public results, not just human meetings
        // or champion-only A7.1 world summaries. No weekly NPC reputation persistence.
        const results=(await tx.execute(sql`SELECT r.* FROM career_event_results r JOIN career_event_instances i
          ON i.career_save_id=r.career_save_id AND i.id=r.event_id
          WHERE r.career_save_id=${saveId} AND r.participant_key=${participant} AND i.status='COMPLETED'`)).rows;
        for (const r of results) {
          const e=events.get(str(r,"event_id")); if (!e) continue;
          sources.results.push({...eventMeta(e),champion:r.is_champion===true,stageReached:str(r,"stage_reached"),
            fact:fact(`result:${str(r,"event_id")}:${participant}`,"A3 public NPC event result",
              `${str(e,"name")} — ${r.is_champion===true ? "title" : str(r,"stage_reached").toLowerCase().replaceAll("_"," ")}`,
              Number(e.season),Number(e.end_day),null,str(r,"event_id"))});
        }
        const played=(await tx.execute(sql`SELECT DISTINCT ON (m.event_id) m.event_id,m.scheduled_day,i.season,i.name
          FROM career_tournament_matches m JOIN career_event_instances i ON i.career_save_id=m.career_save_id AND i.id=m.event_id
          WHERE m.career_save_id=${saveId} AND m.status='COMPLETED' AND (m.a_key=${participant} OR m.b_key=${participant})
            AND m.a_key IS NOT NULL AND m.b_key IS NOT NULL AND m.a_key<>m.b_key AND m.winner_key IN (m.a_key,m.b_key)
            AND COALESCE(m.result_source,'') NOT IN ('BYE','WALKOVER')
          ORDER BY m.event_id,m.scheduled_day,m.round,m.slot,m.id`)).rows;
        for (const r of played) {
          const e=events.get(str(r,"event_id")); if (!e) continue;
          sources.appearances.push({...eventMeta(e),fact:fact(`appearance:${str(r,"event_id")}`,"A3 public played NPC match",
            `Played in ${str(r,"name")}`,Number(r.season),Number(r.scheduled_day),null,str(r,"event_id"))});
        }
      }
      const cards=(await tx.execute(sql`SELECT id,source,awarded_season,awarded_week FROM career_tour_cards
        WHERE career_save_id=${saveId} AND participant_key=${participant} ORDER BY awarded_season,awarded_week,id`)).rows;
      sources.cards=cards.map(r=>fact(`card:${str(r,"id")}`,"A5 Tour Card award",`Tour Card awarded — ${str(r,"source").toLowerCase().replaceAll("_"," ")}`,
        Number(r.awarded_season),null,Number(r.awarded_week)));
      const ranks=(await tx.execute(sql`SELECT r.snapshot_id,r.position,r.season,s.week FROM career_ranking_snapshot_rows r
        JOIN career_ranking_snapshots s ON s.career_save_id=r.career_save_id AND s.id=r.snapshot_id
        WHERE r.career_save_id=${saveId} AND r.participant_key=${participant} AND r.list_key='pro-world' ORDER BY r.publication_index`)).rows;
      sources.rankings=ranks.map(r=>({...fact(`ranking:${str(r,"snapshot_id")}:${participant}`,"A5 published World Ranking",
        `Published World ranking #${Number(r.position)}`,Number(r.season),null,Number(r.week)),position:Number(r.position)}));
      const qualifications=(await tx.execute(sql`SELECT q.id,q.target_key,q.entitlement_type,q.awarded_season,q.source_event_id,i.season AS source_season,i.end_day
        FROM career_qualification_entitlements q LEFT JOIN career_event_instances i ON i.career_save_id=q.career_save_id AND i.id=q.source_event_id
        WHERE q.career_save_id=${saveId} AND q.recipient_key=${participant}`)).rows;
      for (const q of qualifications) {
        const target=catalogue.get(str(q,"target_key"));
        if (!target || !["EVENT_ENTRY","STAGE_ENTRY"].includes(str(q,"entitlement_type"))) continue;
        sources.qualifications.push({targetKey:target.key,circuit:target.circuit,classification:target.classification,tier:target.presentation.tier,
          international:target.geography.kind==="INTERNATIONAL",
          fact:fact(`qualification:${str(q,"id")}`,"A3/A5 qualification entitlement",`Qualified: ${target.key}`,
            Number(q.awarded_season),q.end_day!==null && q.end_day!==undefined && q.source_season===q.awarded_season ? Number(q.end_day) : null,
            null,str(q,"source_event_id") || undefined)});
      }
      const related=npcId ? [] : relationships.opponents.filter(o=>o.labels.some(l=>l==="Career Rival" || l==="Nemesis"))
        .sort((a,b)=>b.meetings-a.meetings || a.player.id.localeCompare(b.player.id)).slice(0,3)
        .map(o=>({opponentId:o.player.id,name:o.player.name,labels:o.labels,
          description:`${o.meetings} played meetings across ${o.eventCount} events and ${o.seasonCount} seasons.`}));
      return {careerSaveId:saveId,subject:{kind:npcId ? "NPC" : "HUMAN",id:participant,
        name:npc?.name ?? (str(rr,"career_name") || "Your Career"),retired:npc ? npc.status==="RETIRED" : rr.status==="RETIRED"},
        ...recognitionModel(sources),relationships:related};
    });
  }
  return {read:(actor:CareerActor,saveId:string)=>read(actor,saveId),npc:(actor:CareerActor,saveId:string,npcId:string)=>read(actor,saveId,npcId)};
}
