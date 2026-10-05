import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { createCareerFactsService } from "../facts/service.ts";
import { createCareerRelationshipsService } from "../relationships/service.ts";
import { createCareerRecognitionService } from "../recognition/service.ts";
import { careerDate } from "../identity/age.ts";
import { contentId, npcPersonality } from "./content.ts";
import { storyEngine, newsSelection, currentMoments, storyThreads } from "./stories.ts";
import { publicProfile, relationshipTones } from "./profile.ts";
import { opportunities } from "./opportunities.ts";
import { LEVELS } from "../recognition/types.ts";
import type { Commitment, Decision, LifeSources, LifeView, NpcLifeView } from "./types.ts";

type Row=Record<string,unknown>;
const adapter=(tx:CareerExecutor):CareerDatabase=>({execute:q=>tx.execute(q),transaction:w=>w(tx)});
const choiceSchema=z.object({choice:z.string().min(1).max(40)}).strict();
const merchandiseSchema=z.object({choice:z.enum(["REPLICA_SHIRT","SIGNED_ITEMS","SPONSOR_LINKED","STOP"])}).strict();
const decisionsFrom=(rows:Row[]):Decision[]=>rows.map(r=>({id:String(r.id),kind:r.kind as Decision["kind"],choice:String(r.choice),
  season:Number(r.season),week:Number(r.week),data:r.data as Record<string,unknown>}));
const commitmentsFrom=(rows:Row[]):Commitment[]=>rows.map(r=>({id:String(r.id),family:String(r.family),title:String(r.title),
  season:Number(r.season),day:Number(r.day),feePence:Number(r.fee_pence),status:r.status as Commitment["status"],contractId:r.contract_id?String(r.contract_id):null}));

export function createCareerLifeService(database:CareerDatabase) {
  async function sources(tx:CareerExecutor,actor:CareerActor,saveId:string,root:Row):Promise<LifeSources> {
    const db=adapter(tx),facts=await createCareerFactsService(db).read(actor,saveId);
    const relationships=await createCareerRelationshipsService(db).read(actor,saveId);
    const recognition=await createCareerRecognitionService(db).read(actor,saveId);
    const events=(await tx.execute(sql`SELECT id,definition_key,name,circuit,classification,presentation_tier,season,start_day,end_day,status,venue_key
      FROM career_event_instances WHERE career_save_id=${saveId} ORDER BY season,start_day,id`)).rows;
    // Bounded public world evidence only; NEVER select NPC ability/config/potential.
    const world=(await tx.execute(sql`SELECT r.event_id,r.participant_key,r.finishing_position,r.stage_reached,r.is_champion,r.wins,r.losses,
      i.definition_key,i.name,i.circuit,i.classification,i.presentation_tier,i.country,i.season,i.end_day,concat(n.first_name,' ',n.surname) AS participant_name
      FROM career_event_results r JOIN career_event_instances i ON i.career_save_id=r.career_save_id AND i.id=r.event_id
      JOIN career_world_players n ON n.career_save_id=r.career_save_id AND n.id::text=r.participant_key
      WHERE r.career_save_id=${saveId} AND i.status='COMPLETED' AND (r.is_champion=true OR r.stage_reached='FINAL'
        OR EXISTS (SELECT 1 FROM career_event_results previous JOIN career_event_instances prior ON prior.career_save_id=previous.career_save_id AND prior.id=previous.event_id
          WHERE previous.career_save_id=r.career_save_id AND previous.participant_key=r.participant_key AND previous.is_champion=true
          AND prior.definition_key=i.definition_key AND prior.season=i.season-1))
      AND i.classification<>'QUALIFIER' ORDER BY i.season DESC,i.end_day DESC,r.participant_key LIMIT 1200`)).rows;
    const contract=(await tx.execute(sql`SELECT id,sponsor_key FROM career_sponsor_contracts WHERE career_save_id=${saveId} AND status='ACTIVE' LIMIT 1`)).rows[0];
    const decisions=decisionsFrom((await tx.execute(sql`SELECT * FROM career_life_decisions WHERE career_save_id=${saveId} ORDER BY season,week,created_at,id`)).rows);
    const commitments=commitmentsFrom((await tx.execute(sql`SELECT * FROM career_life_commitments WHERE career_save_id=${saveId} ORDER BY season,day,id`)).rows);
    const cardChanges=(await tx.execute(sql`SELECT c.id,c.participant_key,c.source,c.awarded_season,c.awarded_week,c.status,c.ended_season,c.ended_week,concat(n.first_name,' ',n.surname) AS name
      FROM career_tour_cards c JOIN career_world_players n ON n.career_save_id=c.career_save_id AND n.id::text=c.participant_key
      WHERE c.career_save_id=${saveId} AND (c.source NOT LIKE 'INITIAL%' OR c.status='LOST')
      ORDER BY c.awarded_season DESC,c.awarded_week DESC LIMIT 150`)).rows;
    const qualifications=(await tx.execute(sql`SELECT DISTINCT q.id,q.recipient_key,q.awarded_season,i.end_day,i.season AS source_season,
      concat(n.first_name,' ',n.surname) AS name,t.name AS target_name
      FROM career_qualification_entitlements q JOIN career_world_players n ON n.career_save_id=q.career_save_id AND n.id=q.npc_id
      LEFT JOIN career_event_instances i ON i.career_save_id=q.career_save_id AND i.id=q.source_event_id
      JOIN career_event_instances t ON t.career_save_id=q.career_save_id AND t.definition_key=q.target_key AND t.season=q.target_season
      WHERE q.career_save_id=${saveId} AND t.classification<>'QUALIFIER' AND t.presentation_tier IN ('TELEVISED','MAJOR','WORLD')
      ORDER BY q.awarded_season DESC,q.id LIMIT 150`)).rows;
    // Both ranks must be published BEFORE the match's week; no hidden ratings,
    // current/future ranking hindsight or guesses about unranked players.
    const upsets=(await tx.execute(sql`WITH recent AS (
      SELECT m.*,CASE WHEN m.winner_key=m.a_key THEN m.b_key ELSE m.a_key END AS loser_key,i.season,i.name
      FROM career_tournament_matches m JOIN career_event_instances i ON i.career_save_id=m.career_save_id AND i.id=m.event_id
      WHERE m.career_save_id=${saveId} AND m.status='COMPLETED' AND i.classification<>'QUALIFIER'
      ORDER BY i.season DESC,m.scheduled_day DESC,m.id LIMIT 600)
      SELECT m.id,m.event_id,m.season,m.scheduled_day,m.name,m.winner_key,m.loser_key,p.id AS snapshot_id,w.position AS winner_position,l.position AS loser_position,
        CASE WHEN m.winner_key='HUMAN' THEN 'You' ELSE concat(wn.first_name,' ',wn.surname) END AS winner_name,
        CASE WHEN m.loser_key='HUMAN' THEN 'You' ELSE concat(ln.first_name,' ',ln.surname) END AS loser_name
      FROM recent m JOIN LATERAL (SELECT id FROM career_ranking_snapshots p WHERE p.career_save_id=${saveId} AND p.list_key='pro-world'
        AND (p.season<m.season OR (p.season=m.season AND p.week<CEIL(m.scheduled_day/7.0)))
        ORDER BY p.season DESC,p.week DESC LIMIT 1) p ON true
      JOIN career_ranking_snapshot_rows w ON w.career_save_id=${saveId} AND w.snapshot_id=p.id AND w.participant_key=m.winner_key
      JOIN career_ranking_snapshot_rows l ON l.career_save_id=${saveId} AND l.snapshot_id=p.id AND l.participant_key=m.loser_key
      LEFT JOIN career_world_players wn ON wn.career_save_id=${saveId} AND wn.id::text=m.winner_key
      LEFT JOIN career_world_players ln ON ln.career_save_id=${saveId} AND ln.id::text=m.loser_key
      WHERE l.position<=8 AND w.position>=32 ORDER BY m.season DESC,m.scheduled_day DESC,m.id LIMIT 40`)).rows;
    const failures=(await tx.execute(sql`SELECT DISTINCT a.season,a.pathway,a.allocated_week FROM career_qschool_allocations a
      JOIN career_qschool_results q ON q.career_save_id=a.career_save_id AND q.season=a.season AND q.pathway=a.pathway
      WHERE a.career_save_id=${saveId} AND q.participant_key='HUMAN' AND q.stage='FINAL'
      AND a.completed_days=a.final_days AND a.final_days>0
      AND NOT EXISTS (SELECT 1 FROM career_qschool_card_awards w WHERE w.career_save_id=a.career_save_id
        AND w.season=a.season AND w.pathway=a.pathway AND w.participant_key='HUMAN') ORDER BY a.season`)).rows;
    const draws=(await tx.execute(sql`SELECT m.id,m.event_id,CASE WHEN m.a_key='HUMAN' THEN m.b_key ELSE m.a_key END opponent_id,
      i.season,m.scheduled_day,i.name,i.circuit,i.classification,i.presentation_tier
      FROM career_tournament_matches m JOIN career_event_instances i ON i.career_save_id=m.career_save_id AND i.id=m.event_id
      WHERE m.career_save_id=${saveId} AND m.status<>'COMPLETED' AND (m.a_key='HUMAN' OR m.b_key='HUMAN')
      AND m.a_key IS NOT NULL AND m.b_key IS NOT NULL AND i.status IN ('DRAW_PENDING','DRAWN','IN_PROGRESS')
      AND i.season=${Number(root.current_season)} ORDER BY m.scheduled_day,m.round,m.slot`)).rows;
    const publicChanges:NonNullable<LifeSources["publicChanges"]>=[
      ...failures.map(r=>({id:`qschool-failure:${r.season}:${r.pathway}`,source:"A5 completed Q-School allocation",label:`Q-School ${r.pathway}`,
        kind:"q-school-failure",participantKey:"HUMAN",participantName:"You",season:Number(r.season),week:Number(r.allocated_week),day:null,date:null,age:null})),
      ...qualifications.map(r=>({id:`world-qualification:${r.id}`,source:"A3/A5 public qualification entitlement",label:`${r.name}: qualified for ${r.target_name}`,
        kind:"world-qualification",participantKey:String(r.recipient_key),participantName:String(r.name),season:Number(r.awarded_season),
        week:r.source_season===r.awarded_season&&r.end_day?Math.ceil(Number(r.end_day)/7):null,
        day:r.source_season===r.awarded_season&&r.end_day?Number(r.end_day):null,date:null,age:null})),
      ...cardChanges.flatMap(r=>[
        ...(!String(r.source).startsWith("INITIAL")?[{id:`world-card:${r.id}`,source:"A5 public Tour Card award",label:`${r.name}: Tour Card awarded`,kind:"world-card-award",participantKey:String(r.participant_key),
          participantName:String(r.name),season:Number(r.awarded_season),week:Number(r.awarded_week),day:null,date:null,age:null}]:[]),
        ...(r.status==="LOST"&&r.ended_season ? [{id:`world-card-loss:${r.id}`,source:"A5 public Tour Card loss",label:`${r.name}: Tour Card lost`,kind:"world-card-loss",
          participantKey:String(r.participant_key),participantName:String(r.name),season:Number(r.ended_season),week:r.ended_week?Number(r.ended_week):null,day:null,date:null,age:null}] : []),
      ])];
    return {saveId,season:Number(root.current_season),week:Number(root.current_week),active:root.status==="ACTIVE",ready:Boolean(root.identity_dob)&&events.length>0,
      facts,relationships,recognition,decisions,commitments,publicChanges,
      draws:draws.map(r=>({id:String(r.id),eventId:String(r.event_id),opponentId:String(r.opponent_id),season:Number(r.season),day:Number(r.scheduled_day),
        name:String(r.name),circuit:String(r.circuit),tier:String(r.presentation_tier),classification:String(r.classification)})),
      upsets:upsets.map(r=>({id:`upset:${r.id}`,eventId:String(r.event_id),source:"A3 played match / A5 prior published ranking",label:String(r.name),
        season:Number(r.season),week:Math.ceil(Number(r.scheduled_day)/7),day:Number(r.scheduled_day),date:null,age:null,
        winnerKey:String(r.winner_key),winnerName:String(r.winner_name),loserKey:String(r.loser_key),loserName:String(r.loser_name),
        winnerPosition:Number(r.winner_position),loserPosition:Number(r.loser_position),snapshotId:String(r.snapshot_id)})),
      sponsor:contract?{id:String(contract.id),name:String(contract.sponsor_key)}:null,
      events:events.map(r=>({id:String(r.id),key:String(r.definition_key),name:String(r.name),circuit:String(r.circuit),tier:String(r.presentation_tier),venueKey:String(r.venue_key),
        classification:String(r.classification),season:Number(r.season),day:Number(r.start_day),endDay:Number(r.end_day),status:String(r.status)})),
      worldResults:world.map(r=>({id:`result:${r.event_id}:${r.participant_key}`,source:"A3 public world result",label:`${r.participant_name} at ${r.name}`,
        season:Number(r.season),day:Number(r.end_day),week:Math.ceil(Number(r.end_day)/7),
        date:root.identity_start?careerDate(String(root.identity_start),Number(r.season),Number(r.end_day)):null,age:null,
        eventId:String(r.event_id),name:String(r.name),definitionKey:String(r.definition_key),circuit:String(r.circuit),classification:String(r.classification),
        presentationTier:String(r.presentation_tier),country:String(r.country),participantKey:String(r.participant_key),participantName:String(r.participant_name),
        position:Number(r.finishing_position),stageReached:String(r.stage_reached),champion:r.is_champion===true,wins:Number(r.wins),losses:Number(r.losses)}))};
  }
  async function view(tx:CareerExecutor,actor:CareerActor,saveId:string,root:Row):Promise<LifeView> {
    const s=await sources(tx,actor,saveId,root),stories=storyEngine(s),profile=publicProfile(s);
    const entries=(await tx.execute(sql`SELECT category,COALESCE(SUM(amount_pence),0)::bigint total FROM career_finance_entries
      WHERE career_save_id=${saveId} AND category IN ('COMMERCIAL_APPEARANCE','MERCHANDISE_ROYALTY') GROUP BY category`)).rows;
    const merch=(await tx.execute(sql`SELECT category,active,royalty_pence FROM career_life_merchandise WHERE career_save_id=${saveId}`)).rows[0];
    const offers=opportunities(s);
    const products=(await tx.execute(sql`SELECT p.*,c.status AS contract_status FROM career_signature_products p
      JOIN career_sponsor_contracts c ON c.career_save_id=p.career_save_id AND c.id=p.contract_id WHERE p.career_save_id=${saveId}
      ORDER BY p.launch_season,p.id`)).rows;
    const booked=(await tx.execute(sql`SELECT day,event_id FROM career_participant_bookings WHERE career_save_id=${saveId}
      AND participant_key='HUMAN' AND season=${s.season}`)).rows;
    for(const o of offers) {
      o.conflicts.push(...booked.filter(b=>Number(b.day)===o.day).map(b=>s.events.find(e=>e.id===b.event_id)?.name??"Entered tournament"));
      o.canAccept=o.conflicts.length===0;
    }
    return {careerSaveId:saveId,retired:!s.active,profile,news:newsSelection(stories),threads:storyThreads(stories),moments:currentMoments(s,stories),
      opportunities:offers,history:s.decisions,commitments:s.commitments,relationshipTones:relationshipTones(s),
      merchandise:{demand:profile.commercial.demand,incomePence:Number(entries.find(e=>e.category==="MERCHANDISE_ROYALTY")?.total??0),
        royaltyPence:merch?Number(merch.royalty_pence):null,offerRoyaltyPence:2500*Math.max(...s.recognition.contexts.map(c=>LEVELS.indexOf(c.level))),
        agreement:merch?`${String(merch.category).toLowerCase().replaceAll("_"," ")} · ${merch.active?"active":"stopped"}`:null,
        canOptIn:s.active&&s.ready&&!merch&&s.recognition.contexts.some(c=>LEVELS.indexOf(c.level)>=2),canStop:s.active&&merch?.active===true},
      commercialIncomePence:entries.reduce((sum,r)=>sum+Number(r.total),0),
      signatureProducts:products.map(p=>({id:String(p.id),name:String(p.product_name),manufacturer:String(p.manufacturer),
        launchSeason:Number(p.launch_season),state:s.active&&p.contract_status==="ACTIVE"?"ACTIVE":"LEGACY"})),
      notes:["Sporting recognition, persona, public response and commercial demand are distinct.",
        "Optional work never changes scoring, ability, form, RNG, draws, rankings, qualification or Tour Cards.",
        "Declining media or charity brings no sporting penalty or morality judgement. Accepted dates are real commitments.",
        "History is factual; no past dialogue choices are invented. World stories use the latest 1,200 significant public results."]};
  }
  async function existing(tx:CareerExecutor,saveId:string,id:string,kind:string,choice:string) {
    const row=(await tx.execute(sql`SELECT * FROM career_life_decisions WHERE career_save_id=${saveId} AND id=${id}`)).rows[0];
    if(!row)return false;
    if(row.kind!==kind||row.choice!==choice)throw new CareerError(409,"This Career decision was already resolved differently");
    return true;
  }
  async function remember(tx:CareerExecutor,saveId:string,id:string,kind:string,choice:string,root:Row,data:Record<string,unknown>) {
    await tx.execute(sql`INSERT INTO career_life_decisions (career_save_id,id,kind,choice,season,week,data)
      VALUES (${saveId},${id},${kind},${choice},${Number(root.current_season)},${Number(root.current_week)},${JSON.stringify({...data,contentVersion:1})}::jsonb)`);
  }
  return {
    read:(actor:CareerActor,saveId:string)=>database.transaction(async tx=>view(tx,actor,saveId,await lockRoot(tx,actor,saveId,false) as unknown as Row)),
    async npc(actor:CareerActor,saveId:string,npcId:string):Promise<NpcLifeView> {
      careerIdSchema.parse(npcId);
      return database.transaction(async tx=>{
        await lockRoot(tx,actor,saveId,false);
        const r=await createCareerRecognitionService(adapter(tx)).npc(actor,saveId,npcId);
        const strength=Math.max(...r.contexts.map(c=>LEVELS.indexOf(c.level)));
        return {careerSaveId:saveId,id:npcId,name:r.subject.name,retired:r.subject.retired,personality:npcPersonality(npcId),
          standing:r.standing.label,publicDraw:["Limited","Growing","Growing","Strong","Major draw"][strength],
          notes:"Deterministic public presentation only. No NPC bank account, hidden ability, form or sporting modifier."};
      });
    },
    async moment(actor:CareerActor,saveId:string,id:string,body:unknown) {
      careerIdSchema.parse(id);const {choice}=choiceSchema.parse(body);
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId,false) as unknown as Row;
        const stored=(await tx.execute(sql`SELECT kind FROM career_life_decisions WHERE career_save_id=${saveId} AND id=${id}`)).rows[0];
        if(stored&&!["DIALOGUE","ATMOSPHERE"].includes(String(stored.kind)))throw new CareerError(404,"Career Moment not found");
        if(stored&&await existing(tx,saveId,id,String(stored.kind),choice))return {resolved:true,replayed:true};
        if(root.status!=="ACTIVE")throw new CareerError(409,"Career is retired");
        const v=await view(tx,actor,saveId,root),moment=v.moments.find(m=>m.id===id);
        if(!moment)throw new CareerError(409,"Moment is unavailable or no longer current");
        if(moment.kind==="ATMOSPHERE" ? choice!=="ACKNOWLEDGE" : !moment.choices.some(c=>c.id===choice))
          throw new z.ZodError([{code:"custom",path:["choice"],message:"Invalid moment choice"}]);
        const st=v.threads.flatMap(t=>t.stories).find(s=>s.id===moment.storyId)!;
        await remember(tx,saveId,id,moment.kind,choice,root,{storyKind:st.kind,thread:moment.thread,sourceIds:st.sourceIds,
          ...(moment.opponentId?{opponentId:moment.opponentId}:{}),...(st.eventId?{eventId:st.eventId}:{}),
          statementCode:choice,statementFamily:moment.statementFamily});
        return {resolved:true,replayed:false};
      });
    },
    async opportunity(actor:CareerActor,saveId:string,id:string,body:unknown) {
      careerIdSchema.parse(id);const {choice}=z.object({choice:z.enum(["ACCEPT","DECLINE"])}).strict().parse(body);
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId,false) as unknown as Row;
        if(await existing(tx,saveId,id,"OPPORTUNITY",choice))return {resolved:true,replayed:true};
        if(root.status!=="ACTIVE")throw new CareerError(409,"Career is retired");
        const o=(await view(tx,actor,saveId,root)).opportunities.find(o=>o.id===id);
        if(!o)throw new CareerError(409,"Opportunity is unavailable or expired");
        if(choice==="ACCEPT") {
          if(!o.canAccept)throw new CareerError(409,`Calendar conflict: ${o.conflicts.join(", ")}`);
          await tx.execute(sql`INSERT INTO career_life_commitments (career_save_id,id,family,title,season,day,fee_pence,contract_id,status)
            VALUES (${saveId},${id},${o.family},${o.title},${o.season},${o.day},${o.feePence},${o.contractId},'ACCEPTED')`);
        }
        await remember(tx,saveId,id,"OPPORTUNITY",choice,root,{family:o.family,season:o.season,day:o.day,thread:"commercial",feePence:o.feePence});
        return {resolved:true,replayed:false};
      });
    },
    async merchandise(actor:CareerActor,saveId:string,body:unknown) {
      const {choice}=merchandiseSchema.parse(body);
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId,false) as unknown as Row;
        const id=contentId(saveId,`merchandise:${choice==="STOP"?"stop":"agreement"}`);
        if(await existing(tx,saveId,id,"MERCHANDISE",choice))return {resolved:true,replayed:true};
        if(root.status!=="ACTIVE")throw new CareerError(409,"Career is retired");
        const v=await view(tx,actor,saveId,root);
        if(choice==="STOP") {
          if(!v.merchandise.canStop)throw new CareerError(409,"No active merchandise agreement");
          await tx.execute(sql`UPDATE career_life_merchandise SET active=false WHERE career_save_id=${saveId}`);
        } else {
          if(!v.merchandise.canOptIn)throw new CareerError(409,"Merchandise is not currently available");
          const s=await sources(tx,actor,saveId,root);
          if(choice==="SPONSOR_LINKED"&&!s.sponsor)throw new CareerError(409,"No active sponsor for linked merchandise");
          const stature=Math.max(...s.recognition.contexts.map(c=>LEVELS.indexOf(c.level)));
          await tx.execute(sql`INSERT INTO career_life_merchandise (career_save_id,category,royalty_pence,signed_season,signed_week,contract_id)
            VALUES (${saveId},${choice},${2500*stature},${s.season},${s.week},${choice==="SPONSOR_LINKED"?s.sponsor!.id:null})`);
        }
        await remember(tx,saveId,id,"MERCHANDISE",choice,root,{thread:"commercial",category:choice});
        return {resolved:true,replayed:false};
      });
    },
  };
}
