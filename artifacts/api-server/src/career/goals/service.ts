import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { createCareerFactsService } from "../facts/service.ts";
import { createCareerRelationshipsService } from "../relationships/service.ts";
import { createCareerSportingService } from "../sporting/service.ts";
import { summary } from "../finance/ledger.ts";
import { catalogueFor } from "../calendar/catalogue.ts";
import { FOCUSES, type Focus, type GoalDefinition, type GoalRow, type GoalSources, type GoalsView, type Opportunity } from "./types.ts";
import { ACTIVE_GOAL_LIMIT, completionFact, createGoalSchema, evidenceFor, focusSchema, goalLabel, goalProgress, recommend, targetKey } from "./model.ts";
import type { Fact } from "../facts/types.ts";

/** Existing read authorities share ONE outer transaction/root lock, not nested transactions. */
const inTransaction = (tx: CareerExecutor): CareerDatabase => ({ execute:q=>tx.execute(q),transaction:work=>work(tx) });
type Root = Awaited<ReturnType<typeof lockRoot>>;
const numeric = (v: unknown) => v===null || v===undefined ? null : Number(v);
export function createCareerGoalsService(database: CareerDatabase) {
  async function sources(tx: CareerExecutor, actor: CareerActor, saveId: string, root: Root) {
    const db=inTransaction(tx);
    const facts=await createCareerFactsService(db).read(actor,saveId);
    const relationships=await createCareerRelationshipsService(db).read(actor,saveId);
    const targetNames=(await tx.execute(sql`SELECT DISTINCT i.id,i.name FROM career_event_instances i JOIN career_personal_goals g
      ON g.career_save_id=i.career_save_id AND g.definition->>'type'='WIN_EVENT' AND g.definition->>'eventId'=i.id::text WHERE i.career_save_id=${saveId}`)).rows;
    const finance=await summary(tx,saveId);
    const rr=root as unknown as Record<string,unknown>;
    const earningsRows=(await tx.execute(sql`SELECT e.id,e.amount_pence,e.season,e.week,e.event_id FROM career_finance_entries e
      LEFT JOIN career_event_instances i ON i.career_save_id=e.career_save_id AND i.id=e.event_id
      WHERE e.career_save_id=${saveId} AND e.headline='EARNINGS'
      ORDER BY COALESCE(e.season,0),COALESCE(e.week,0),COALESCE(i.end_day,0),e.created_at,e.id`)).rows;
    const earningsEvidence=earningsRows.map(r=>{
      const event=facts.results.find(e=>e.eventId===r.event_id);
      const fact: Fact={id:`ledger:${r.id}`,source:"A4 immutable prize earnings ledger",label:"Career prize earnings milestone",
        season:Number(r.season??root.current_season),week:numeric(r.week),day:event?.day??null,date:event?.date??null,age:event?.age??null,
        ...(r.event_id?{eventId:String(r.event_id)}:{})};
      return {id:String(r.id),amountPence:Number(r.amount_pence),fact};
    });
    const s: GoalSources={facts,relationships,eventNames:Object.fromEntries(targetNames.map(r=>[String(r.id),String(r.name)])),earningsPence:finance.careerEarningsPence,earningsEvidence,
      currentWeek:Number(rr.current_week),currentRank:numeric(rr.professional_ranking),holdsCard:rr.has_tour_card===true};
    let events: Opportunity[]=[];
    const initialized=(await tx.execute(sql`SELECT 1 FROM career_seasons WHERE career_save_id=${saveId} AND season=${root.current_season} LIMIT 1`)).rows.length>0;
    if (initialized && rr.status==="ACTIVE" && rr.identity_dob && rr.identity_start) {
      const cal=await createCareerSportingService(db).calendar.calendar(actor,saveId,{scope:"WORLD",fromWeek:Number(rr.current_week),toWeek:Math.min(52,Number(rr.current_week)+8)});
      const majors=new Set(catalogueFor(Number(rr.event_database_version)).filter(d=>["MAJOR","WORLD"].includes(d.presentation.tier)).map(d=>d.key));
      events=cal.events.filter(e=>e.dates.endDay>=(Number(rr.current_week)-1)*7+1).map(e=>{
        const f=e.finance as {topPrizePence?:number;estimatedPlayerCostPence?:number}|null;
        return {id:e.id,name:e.name,season:e.season,startDay:e.dates.startDay,circuit:e.circuit,classification:e.classification,tier:e.presentation.tier,status:e.status,
          canEnter:e.human?.canEnter??false,eligible:e.human?.eligible??false,denials:e.human?.denials??[],relationship:e.human?.relationship??"NONE",
          majorRoute:e.qualificationOutputs.some(o=>majors.has(o.targetKey)),
          firstPrizePence:numeric(f?.topPrizePence),estimatedCostPence:numeric(f?.estimatedPlayerCostPence),registration:e.registration};
      });
    }
    return {s,events};
  }
  async function rows(tx: CareerExecutor, saveId: string) {
    return (await tx.execute(sql`SELECT * FROM career_personal_goals WHERE career_save_id=${saveId} ORDER BY created_at,id`)).rows as unknown as GoalRow[];
  }
  async function reconcile(tx: CareerExecutor, saveId: string, root: Root, goals: GoalRow[], s: GoalSources) {
    for (const row of goals.filter(r=>r.status==="ACTIVE")) {
      const result=goalProgress(row,s);
      let evidence=result.evidence;
      if (row.definition.type==="MAXIMUMS" && result.progress.current!==null && result.progress.current>=row.definition.target) {
        evidence={id:`aggregate:maximums:${row.id}`,source:"A7.1 verified dart aggregate (confirmation season, exact crossing date unavailable)",
          label:`Recorded ${row.definition.target} maximums`,season:Number(root.current_season),day:null,week:null,date:null,age:null};
      }
      if (!evidence) continue;
      // Persist only the supporting Fact/reference, never a copied EventFact's counters.
      const identity=root as unknown as Record<string,unknown>;
      const completion=completionFact(evidence,identity.identity_dob ? String(identity.identity_dob) : undefined);
      await tx.execute(sql`UPDATE career_personal_goals SET status='COMPLETED',completed_evidence=${JSON.stringify(completion)}::jsonb
        WHERE career_save_id=${saveId} AND id=${row.id} AND status='ACTIVE'`);
      row.status="COMPLETED";row.completed_evidence=completion;
    }
  }
  function validate(d: GoalDefinition, s: GoalSources, events: Opportunity[]) {
    if ("opponentId" in d) {
      const p=s.relationships.world.players.find(p=>p.id===d.opponentId);
      if (!p || p.status!=="ACTIVE") throw new CareerError(409,"Choose an active opponent belonging to this Career");
      const o=s.relationships.opponents.find(o=>o.player.id===d.opponentId);
      if (d.type==="IMPROVE_H2H" && !o?.meetings) throw new CareerError(409,"H2H improvement requires an existing played opponent");
      if (d.type==="BEAT_RELATIONSHIP" && !o?.labels.includes(d.relationship)) throw new CareerError(409,"That sporting relationship is not currently evidenced");
    }
    if (d.type==="WIN_EVENT" && !events.some(e=>e.id===d.eventId && e.eligible &&
      ["SCHEDULED","REGISTRATION_OPEN","REGISTRATION_CLOSED","DRAW_PENDING","DRAWN","IN_PROGRESS"].includes(e.status) &&
      (["ENTERED","CONFIRMED","PLAYING"].includes(e.relationship) ||
       (["SCHEDULED","REGISTRATION_OPEN"].includes(e.status) && s.currentWeek<=e.registration.closesWeek)))) {
      throw new CareerError(409,"Choose an eligible upcoming or entered event in this Career");
    }
    if (d.type==="EARN_TOUR_CARD" && (s.holdsCard || s.facts.records.firstTourCard)) throw new CareerError(409,"First Tour Card already achieved");
    if (d.type==="REACH_WORLD_RANK" && (s.facts.records.bestWorldRanking?.position??Infinity)<=d.target) throw new CareerError(409,"That Career ranking milestone is already achieved");
    if (d.type==="EARNINGS" && s.earningsPence>=d.target) throw new CareerError(409,"Choose a prize-earnings milestone above existing earnings");
    if (d.type==="MAXIMUMS" && (s.facts.performance.maximums??0)>=d.target) throw new CareerError(409,"Choose a maximums milestone above the verified total");
  }
  function options(s: GoalSources, events: Opportunity[], retired: boolean) {
    if (retired) return [];
    const defs: GoalDefinition[]=[{type:"WIN_TITLE"},{type:"REACH_FINAL"},{type:"WIN_AMATEUR_TITLE"},{type:"WIN_MAJOR"},{type:"WIN_WORLD"}];
    if (!s.holdsCard && !s.facts.records.firstTourCard) defs.push({type:"EARN_TOUR_CARD"});
    for (const target of [128,64,32,16,1]) if ((s.facts.records.bestWorldRanking?.position??Infinity)>target) defs.push({type:"REACH_WORLD_RANK",target});
    for (const target of [100000,1000000,10000000]) if (s.earningsPence<target) defs.push({type:"EARNINGS",target});
    for (const target of [1,10,100]) if ((s.facts.performance.maximums??0)<target) defs.push({type:"MAXIMUMS",target});
    for (const o of s.relationships.opponents.filter(o=>o.player.status==="ACTIVE" && o.meetings>0)) {
      defs.push({type:"BEAT_OPPONENT",opponentId:o.player.id},{type:"IMPROVE_H2H",opponentId:o.player.id});
      for (const relationship of ["Career Rival","Nemesis"] as const) if (o.labels.includes(relationship)) defs.push({type:"BEAT_RELATIONSHIP",opponentId:o.player.id,relationship});
    }
    for (const e of events) {
      const def: GoalDefinition={type:"WIN_EVENT",eventId:e.id};
      try {validate(def,s,events);defs.push(def);} catch(e) {if (!(e instanceof CareerError)) throw e;}
    }
    return defs.map(definition=>({definition,label:goalLabel(definition,s,events)}));
  }
  function view(saveId: string, root: Root, goals: GoalRow[], s: GoalSources, events: Opportunity[]): GoalsView {
    const rr=root as unknown as Record<string,unknown>,focus=(rr.career_focus??"OPEN_SCHEDULE") as Focus,retired=rr.status==="RETIRED";
    return {careerSaveId:saveId,focus,focusOptions:Object.entries(FOCUSES).map(([value,detail])=>({value:value as Focus,...detail})),activeLimit:ACTIVE_GOAL_LIMIT,retired,
      goals:goals.map(r=>{
        const progress=goalProgress(r,s).progress;
        if (retired && r.status==="ACTIVE") progress.note="Career retired; no further sporting progress. This selection remains in the record.";
        return {id:r.id,definition:r.definition,label:goalLabel(r.definition,s,events),status:r.status,created:{season:r.created_season,week:r.created_week},
          progress,completion:r.completed_evidence};
      }),
      options:options(s,events,retired),opportunities:recommend(focus,events),context:{currentRank:s.currentRank,holdsCard:s.holdsCard,earningsPence:s.earningsPence}};
  }
  return {
    async read(actor: CareerActor, saveId: string) {
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId,false), {s,events}=await sources(tx,actor,saveId,root),goals=await rows(tx,saveId);
        await reconcile(tx,saveId,root,goals,s);
        return view(saveId,root,goals,s,events);
      });
    },
    async focus(actor: CareerActor, saveId: string, body: unknown) {
      const input=focusSchema.parse(body);
      return database.transaction(async tx=>{
        await lockRoot(tx,actor,saveId);
        await tx.execute(sql`UPDATE career_saves SET career_focus=${input.focus} WHERE id=${saveId}`);
        return {focus:input.focus};
      });
    },
    async create(actor: CareerActor, saveId: string, body: unknown) {
      const input=createGoalSchema.parse(body),definition=input.definition as GoalDefinition,key=targetKey(definition);
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId),goals=await rows(tx,saveId);
        const prior=goals.find(r=>r.request_key===input.requestKey);
        if (prior) {if (prior.target_key!==key) throw new CareerError(409,"Request key already used for another goal");return {id:prior.id,created:false};}
        const {s,events}=await sources(tx,actor,saveId,root);
        await reconcile(tx,saveId,root,goals,s);
        const existing=goals.find(r=>r.status==="ACTIVE" && r.target_key===key);
        if (existing) return {id:existing.id,created:false};
        validate(definition,s,events);
        if (goals.filter(r=>r.status==="ACTIVE").length>=ACTIVE_GOAL_LIMIT) throw new CareerError(409,`At most ${ACTIVE_GOAL_LIMIT} active goals; abandon one without penalty`);
        const id=randomUUID(),baseline=evidenceFor(definition,s).map(f=>f.id);
        const rr=root as unknown as Record<string,unknown>;
        await tx.execute(sql`INSERT INTO career_personal_goals(id,career_save_id,request_key,definition,target_key,baseline_evidence,created_season,created_week)
          VALUES(${id},${saveId},${input.requestKey},${JSON.stringify(definition)}::jsonb,${key},ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(baseline)}::jsonb)),
            ${root.current_season},${Number(rr.current_week)})`);
        return {id,created:true};
      });
    },
    async abandon(actor: CareerActor, saveId: string, goalId: string) {
      careerIdSchema.parse(goalId);
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId),goals=await rows(tx,saveId),row=goals.find(r=>r.id===goalId);
        if (!row) throw new CareerError(404,"Personal goal not found");
        const {s}=await sources(tx,actor,saveId,root);
        await reconcile(tx,saveId,root,goals,s);
        if (row.status==="ACTIVE") {await tx.execute(sql`UPDATE career_personal_goals SET status='ABANDONED',abandoned_at=NOW() WHERE career_save_id=${saveId} AND id=${goalId} AND status='ACTIVE'`);row.status="ABANDONED";}
        return {id:goalId,status:row.status};
      });
    },
  };
}
