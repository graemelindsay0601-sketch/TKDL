import {sql} from "drizzle-orm";
import {z} from "zod";
import {Router,type Request,type Response,type NextFunction} from "express";
import {authedWriteRateLimit} from "../../middleware/writeRateLimit.ts";
import type {CareerDatabase} from "../database.ts";
import {CareerError} from "../service.ts";
import {careerIdSchema} from "../validation.ts";
import {lockRoot,type CareerActor} from "../world/service.ts";
import {loadInstances,loadMatches,type RootRow} from "../calendar/engine.ts";
import type {CareerCalendarService} from "../calendar/service.ts";
import {isGroupMatch} from "../calendar/groups.ts";
import {loadBulls,resolvedGroups} from "../calendar/group-engine.ts";
import {stageName,finishingPosition} from "../calendar/draw.ts";
import {createCareerRelationshipsService} from "../relationships/service.ts";
import {activeContracts,profileFor} from "../finance/engine.ts";
import {relationship} from "../finance/portfolio.ts";
import {venueContent,TROPHIES} from "../content/world.ts";
import {npcCommercial,PRESENTATION_DEFAULTS} from "../content/service.ts";
import {LOCALITIES} from "../calendar/geography.ts";
import {npcShirt} from "../content/visual.ts";

// Never imported by simulation, ranking, finance or the scorer.
export const presentationSchema=z.object({mode:z.enum(["FULL","BALANCED","QUICK"]),reducedMotion:z.boolean()}).strict();
export type TournamentPresentation=z.infer<typeof presentationSchema>;
export function importance(tier:string,circuit:string,classification?:string) {
  return (circuit==="WORLD_CHAMPIONSHIP"&&classification!=="QUALIFIER")||tier==="WORLD"?5:tier==="MAJOR"?4:tier==="TELEVISED"?3:tier==="FEATURED"?2:1;
}
export function presentationDepth(level:number,mode:TournamentPresentation["mode"],reducedMotion:boolean) {
  return {arrival:level>1&&mode!=="QUICK",drawReveal:level>2&&mode!=="QUICK",
    walkOn:level>2&&mode!=="QUICK",fullCeremony:level>3&&mode==="FULL",
    animate:!reducedMotion&&mode!=="QUICK",skippable:true as const,sportingEffects:false as const};
}
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
const finalStatus=(s:string)=>["COMPLETED","BYE","WALKOVER","VOID"].includes(s);

export function createCareerTournamentService(database:CareerDatabase,calendar:CareerCalendarService) {
  const relationships=createCareerRelationshipsService(database);
  async function read(actor:CareerActor,saveId:string,eventId:string) {
    careerIdSchema.parse(eventId);
    const data=await database.transaction(async tx=>{
      const root=await lockRoot(tx,actor,saveId,false) as RootRow&{career_name:string};
      const event=(await loadInstances(tx,root.id,sql`id=${eventId}`))[0];
      if(!event)throw new CareerError(404,"Tournament was not found in this Career");
      const matches=await loadMatches(tx,root.id,eventId);
      if(event.status==="IN_PROGRESS"&&!matches.length)throw new CareerError(409,"Official draw is missing; nothing has been regenerated");
      const size=(event.snapshot as unknown as {draw?:{size:number}}).draw?.size;
      const expected=event.snapshot.format.structure==="GROUP_KNOCKOUT"?31:size?size-1:null;
      if(event.status==="IN_PROGRESS"&&expected!==null&&matches.length!==expected)
        throw new CareerError(409,"Official draw is incomplete; it has not been regenerated");
      const entries=(await tx.execute(sql`SELECT e.participant_key,e.source,e.status,e.draw_seed,
        p.first_name,p.surname,p.nickname,p.nationality,p.tier,
        EXISTS(SELECT 1 FROM career_tour_cards c WHERE c.career_save_id=e.career_save_id AND c.participant_key=e.participant_key
          AND c.status='ACTIVE' AND c.start_season<=${Number(root.current_season)} AND c.end_season>=${Number(root.current_season)}) AS tour_card
        FROM career_event_entries e LEFT JOIN career_world_players p ON p.career_save_id=e.career_save_id AND p.id=e.npc_id
        WHERE e.career_save_id=${saveId} AND e.event_id=${eventId} ORDER BY e.draw_seed NULLS LAST,e.participant_key`)).rows;
      const withdrawn=new Set(entries.filter(e=>e.status==="WITHDRAWN").map(e=>String(e.participant_key)));
      const drawKeys=new Set(matches.flatMap(m=>[m.a_key,m.b_key]).filter((k):k is string=>!!k));
      const fieldEntries=matches.length?entries.filter(e=>drawKeys.has(String(e.participant_key))):entries.filter(e=>e.status!=="WITHDRAWN");
      const groups=event.snapshot.format.structure==="GROUP_KNOCKOUT"&&matches.length
        ?resolvedGroups(matches,await loadBulls(tx,saveId,eventId),withdrawn):[];
      const next=matches.filter(m=>[m.a_key,m.b_key].includes("HUMAN")&&!finalStatus(m.status))
        .sort((a,b)=>Number(!isGroupMatch(a))-Number(!isGroupMatch(b))||a.round-b.round||a.slot-b.slot)[0]??null;
      const humanMatches=matches.filter(m=>[m.a_key,m.b_key].includes("HUMAN"));
      const knockout=matches.filter(m=>!isGroupMatch(m)),rounds=knockout.length?Math.max(...knockout.map(m=>m.round)):0;
      const loss=humanMatches.find(m=>!isGroupMatch(m)&&finalStatus(m.status)&&m.winner_key!=="HUMAN"&&m.status!=="BYE");
      const humanGroup=groups.find(g=>g.buckets.some(b=>b.some(p=>p.key==="HUMAN")));
      const groupOut=!!humanGroup&&humanGroup.finished&&!humanGroup.pending&&!humanGroup.qualifiers.includes("HUMAN");
      const results=(await tx.execute(sql`SELECT participant_key,finishing_position,stage_reached,is_champion,matches_played,wins,losses,legs_for,legs_against
        FROM career_event_results WHERE career_save_id=${saveId} AND event_id=${eventId} ORDER BY finishing_position,participant_key`)).rows;
      const result=results.find(r=>r.participant_key==="HUMAN")??null;
      const entry=entries.find(e=>e.participant_key==="HUMAN");
      const session=next?(await tx.execute(sql`SELECT id,status,revision FROM career_match_sessions WHERE career_save_id=${saveId} AND match_id=${next.id}`)).rows[0]??null:null;
      const latest=humanMatches.filter(m=>m.status==="COMPLETED"||m.status==="WALKOVER")
        .sort((a,b)=>Number(isGroupMatch(a))-Number(isGroupMatch(b))||b.round-a.round||b.slot-a.slot)[0]??null;
      const bull=groups.find(g=>g.pending?.pair.includes("HUMAN"))?.pending??null;
      const phase=withdrawn.has("HUMAN")?"WITHDRAWN":event.status==="CANCELLED"?"CANCELLED":result?.is_champion?"CHAMPION":
        event.status==="COMPLETED"?"COMPLETE":loss||groupOut?"ELIMINATED":bull?"GROUP_BULL":
        session?.status==="IN_PLAY"?"LIVE_MATCH":session?.status==="BULL_UP"?"BULL_UP":next?.status==="AWAITING_HUMAN"?"MATCH_READY":
        event.status==="IN_PROGRESS"?"BETWEEN_SESSIONS":event.status==="DRAWN"?"DRAW_READY":entry?"ARRIVAL":"EVENT_PREVIEW";
      const stored=object(root.settings_snapshot?.tournamentPresentation);
      const presentation:TournamentPresentation={mode:stored.mode==="FULL"||stored.mode==="QUICK"?stored.mode:"BALANCED",reducedMotion:stored.reducedMotion===true};
      const level=importance(event.presentation_tier,event.circuit,event.classification);
      const appearances=(await tx.execute(sql`SELECT i.id,i.name,i.season,i.start_day,r.finishing_position,r.is_champion
        FROM career_event_instances i LEFT JOIN career_event_results r ON r.career_save_id=i.career_save_id
          AND r.event_id=i.id AND r.participant_key='HUMAN'
        WHERE i.career_save_id=${saveId} AND i.definition_key=${event.definition_key}
          AND (i.season<${event.season} OR (i.season=${event.season} AND i.start_day<${event.start_day}))
          AND EXISTS(SELECT 1 FROM career_tournament_matches m WHERE m.career_save_id=i.career_save_id AND m.event_id=i.id
            AND (m.a_key='HUMAN' OR m.b_key='HUMAN')) ORDER BY i.season DESC,i.start_day DESC`)).rows;
      const recentChampions=(await tx.execute(sql`SELECT i.id,i.name,i.season,i.champion_participant_key,
        CASE WHEN i.champion_participant_key='HUMAN' THEN COALESCE(p.display_name,s.career_name)
          ELSE concat_ws(' ',n.first_name,n.surname) END AS champion_name
        FROM career_event_instances i JOIN career_saves s ON s.id=i.career_save_id
        LEFT JOIN career_profiles p ON p.career_save_id=i.career_save_id
        LEFT JOIN career_world_players n ON n.career_save_id=i.career_save_id AND n.id=i.champion_npc_id
        WHERE i.career_save_id=${saveId} AND i.definition_key=${event.definition_key} AND i.status='COMPLETED'
          AND (i.season<${event.season} OR (i.season=${event.season} AND i.start_day<${event.start_day}))
        ORDER BY i.season DESC,i.start_day DESC LIMIT 5`)).rows;
      const priorPositions=appearances.map(p=>Number(p.finishing_position)).filter(p=>p>0);
      const history={source:"A3 confirmed draws and permanent results; no pre-save history",previousAppearances:appearances,
        bestFinish:priorPositions.length?Math.min(...priorPositions):null,recentChampions,
        palace:level===5?{firstAppearance:humanMatches.length>0&&appearances.length===0,
          appearanceNumber:humanMatches.length>0?appearances.length+1:null,
          formerWorldChampion:appearances.some(p=>p.is_champion===true)}:null};
      const prior=(await tx.execute(sql`SELECT i.champion_participant_key,i.id FROM career_event_instances i
        WHERE i.career_save_id=${saveId} AND i.definition_key=${event.definition_key} AND i.status='COMPLETED'
        AND (i.season<${event.season} OR (i.season=${event.season} AND i.start_day<${event.start_day}))
        ORDER BY i.season DESC,i.start_day DESC LIMIT 1`)).rows[0];
      const worldChampion=(await tx.execute(sql`SELECT champion_participant_key,id FROM career_event_instances WHERE career_save_id=${saveId}
         AND circuit='WORLD_CHAMPIONSHIP' AND classification<>'QUALIFIER' AND status='COMPLETED'
         AND (season<${event.season} OR (season=${event.season} AND start_day<=${event.start_day}))
        ORDER BY season DESC,start_day DESC LIMIT 1`)).rows[0];
      const champions=(await tx.execute(sql`SELECT r.participant_key,COUNT(*)::int AS titles,
        COUNT(*) FILTER(WHERE i.circuit IN ('MAJOR','WORLD_CHAMPIONSHIP'))::int AS major_titles
        FROM career_event_results r JOIN career_event_instances i ON i.career_save_id=r.career_save_id AND i.id=r.event_id
         WHERE r.career_save_id=${saveId} AND r.is_champion AND i.classification<>'QUALIFIER' AND i.circuit<>'Q_SCHOOL'
         GROUP BY r.participant_key`)).rows;
      const ranks=(await tx.execute(sql`SELECT r.participant_key,r.position FROM career_ranking_snapshot_rows r
        WHERE r.career_save_id=${saveId} AND r.snapshot_id=(SELECT id FROM career_ranking_snapshots WHERE career_save_id=${saveId}
          AND list_key='pro-world' ORDER BY sequence DESC LIMIT 1)`)).rows;
      const personal=object(root.settings_snapshot?.presentationIdentity);
      const profile=(await tx.execute(sql`SELECT display_name,home_locality FROM career_profiles WHERE career_save_id=${saveId}`)).rows[0];
      const country=LOCALITIES.find(l=>l.key===profile?.home_locality)?.country??"";
      const contracts=await activeContracts(tx,saveId);
      const field=fieldEntries.map(e=>{
        const key=String(e.participant_key),human=key==="HUMAN";
        const achievement=champions.find(c=>c.participant_key===key);
        const ranking=ranks.find(r=>r.participant_key===key)?.position;
        const badges:{label:string;source:string}[]=[];
        if(!event.snapshot.qSchool&&prior?.champion_participant_key===key)badges.push({label:"Defending champion",source:String(prior.id)});
        if(worldChampion?.champion_participant_key===key)badges.push({label:"Reigning World Champion",source:String(worldChampion.id)});
        if(ranking===1)badges.push({label:"World #1",source:"A5 latest published pro-world snapshot"});
        if(Number(achievement?.major_titles)>0)badges.push({label:`${achievement!.major_titles} major/world titles`,source:"A3 actual champion results"});
        const stature={titles:Number(achievement?.titles??0),majorTitles:Number(achievement?.major_titles??0),worldRanking:ranking?Number(ranking):null};
        return {key,name:human?String(profile?.display_name??root.career_name):`${e.first_name} ${e.surname}`,nickname:human?personal.nickname??null:e.nickname??null,
          nationality:human?country:String(e.nationality??""),ranking:stature.worldRanking,
          titles:stature.titles,badges:badges.slice(0,2),source:String(e.source),status:String(e.status),seed:e.draw_seed?Number(e.draw_seed):null,
          sponsors:human?contracts.map(c=>({brandName:c.terms.displayName,slot:relationship(c.terms).slot})):
            npcCommercial(root.world_seed,key,{...stature,careerStarted:true,tourCard:e.tour_card===true,
              professionalStatus:e.tour_card?"PROFESSIONAL":"AMATEUR",qualifications:[],bestFinishByCircuit:{}}).portfolio.map(c=>({brandName:c.brandName,slot:c.slot})),
          shirt:human?{...PRESENTATION_DEFAULTS,...personal}:npcShirt(key),
        };
      });
      const routes=(await tx.execute(sql`SELECT recipient_key,entitlement_type,source_kind,source_event_id,source_position,source_detail,target_key
        FROM career_qualification_entitlements WHERE career_save_id=${saveId} AND consumed_by_event_id=${eventId}
        ORDER BY recipient_key,created_at,id`)).rows;
      const ledger=(await tx.execute(sql`SELECT category,amount_pence FROM career_finance_entries WHERE career_save_id=${saveId} AND event_id=${eventId}`)).rows;
      const prize=(await tx.execute(sql`SELECT cash_award_pence,ranking_eligible_pence,finishing_position FROM career_prize_awards
        WHERE career_save_id=${saveId} AND event_id=${eventId} AND participant_key='HUMAN'`)).rows[0]??null;
      const prizeTable=(await tx.execute(sql`SELECT bands FROM career_event_prize_tables WHERE career_save_id=${saveId} AND event_id=${eventId}`)).rows[0];
      const bands=(prizeTable?.bands??profileFor(event).prize.bands) as {upToPosition:number;amountPence:number}[];
      const position=result?Number(result.finishing_position):loss?finishingPosition(loss.round,rounds):groupOut?9:
        next&&!isGroupMatch(next)?finishingPosition(next.round,rounds):null;
      const securedPence=position?bands.find(b=>position<=b.upToPosition)?.amountPence??0:0;
      const meta=event.snapshot.content??null;
      return {saveId,event:{id:eventId,name:event.name,definitionKey:event.definition_key,season:event.season,week:Number(root.current_week),
          startDay:event.start_day,endDay:event.end_day,status:event.status,statusReason:event.status_reason,circuit:event.circuit,
          classification:event.classification,format:event.snapshot.format,executable:event.executable,fieldLocked:!!event.field_locked_at,drawLocked:!!event.drawn_at,
          venue:venueContent(event.venue_key),venueFallback:{city:event.city,country:event.country},content:meta,level,
          trophy:TROPHIES.find(t=>t.id===meta?.trophyId)??null,qualificationOutputs:event.snapshot.qualificationOutputs,qSchool:event.snapshot.qSchool??null},
        presentation,depth:presentationDepth(level,presentation.mode,presentation.reducedMotion),phase,field,routes,matches,groups,history,
        nextMatchId:next?.status==="AWAITING_HUMAN"?next.id:null,session,latestMatch:latest,humanResult:result,results,
        groupBull:bull?{...bull,row:bull.row}:null,championKey:event.champion_participant_key,position,
        money:{securedPence,paid:!!prize,prize,ledger:ledger.map(r=>({category:String(r.category),amountPence:Number(r.amount_pence)}))},
        achievements:{groupWinner:!!humanGroup&&!humanGroup.pending&&humanGroup.finished&&humanGroup.qualifiers[0]==="HUMAN",
          tournamentChampion:!event.snapshot.qSchool&&result?.is_champion===true},readOnly:root.status!=="ACTIVE",
        authority:{draw:"A3",results:"A3/A6.5",finance:"A4",qualification:"A5",relationships:"A7.2",presentationOnly:true}};
    });
    // Reuse A7.2, not a new rivalry classifier. This read has no sporting side effects.
    const relationshipsView=await relationships.read(actor,saveId);
    return {...data,opponents:relationshipsView.opponents.filter(p=>data.field.some(f=>f.key===p.player.id))
      .map(p=>({key:p.player.id,labels:p.labels,evidence:p.evidence,meetings:p.meetings,humanWins:p.humanWins,npcWins:p.npcWins,
        firstMeeting:p.firstMeeting,latestMeeting:p.latestMeeting}))};
  }
  return {
    read,
    async active(actor:CareerActor,saveId:string) {
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId,false) as RootRow;
         const stored=root.settings_snapshot?.dismissedTournaments;
         const dismissed=[String(root.settings_snapshot?.dismissedTournament??""),...(Array.isArray(stored)?stored.map(String):[])];
         const rows=(await tx.execute(sql`SELECT i.id,i.name,i.presentation_tier,i.circuit,i.classification,i.status FROM career_event_instances i JOIN career_event_entries e
          ON e.career_save_id=i.career_save_id AND e.event_id=i.id AND e.participant_key='HUMAN'
           WHERE i.career_save_id=${saveId} AND i.id::text NOT IN (${sql.join(dismissed.map(k=>sql`${k}`),sql`, `)})
             AND ((i.status='IN_PROGRESS' AND i.drawn_at IS NOT NULL) OR
               (i.status IN ('COMPLETED','CANCELLED') AND i.season=${Number(root.current_season)} AND i.end_week>=${Math.max(1,Number(root.current_week)-1)}))
          ORDER BY i.season DESC,i.start_day DESC LIMIT 4`)).rows;
         return {tournaments:rows.map(r=>({eventId:String(r.id),name:String(r.name),terminal:r.status!=="IN_PROGRESS",
           level:importance(String(r.presentation_tier),String(r.circuit),String(r.classification))}))};
      });
    },
    async presentation(actor:CareerActor,saveId:string,body:unknown) {
      const input=presentationSchema.parse(body);
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId) as RootRow;
        await tx.execute(sql`UPDATE career_saves SET settings_snapshot=${JSON.stringify({...root.settings_snapshot,tournamentPresentation:input})}::jsonb WHERE id=${saveId}`);
        return input;
      });
    },
    async dismiss(actor:CareerActor,saveId:string,eventId:string) {
      careerIdSchema.parse(eventId);
      const view=await read(actor,saveId,eventId);
      if(!["ELIMINATED","WITHDRAWN","CHAMPION","COMPLETE","CANCELLED"].includes(view.phase))
        throw new CareerError(409,"Leaving the page pauses the tournament; it does not end participation");
      return database.transaction(async tx=>{
        const root=await lockRoot(tx,actor,saveId) as RootRow;
         const stored=root.settings_snapshot?.dismissedTournaments;
         const dismissed=[...new Set([...(Array.isArray(stored)?stored.map(String):[]),eventId])].slice(-128);
         await tx.execute(sql`UPDATE career_saves SET settings_snapshot=${JSON.stringify({...root.settings_snapshot,dismissedTournament:eventId,dismissedTournaments:dismissed})}::jsonb WHERE id=${saveId}`);
        return {dismissed:true};
      });
    },
  };
}
export type TournamentView=Awaited<ReturnType<ReturnType<typeof createCareerTournamentService>["read"]>>;

export function createCareerTournamentRouter(service:ReturnType<typeof createCareerTournamentService>,calendar:CareerCalendarService,isAvailable:(admin:boolean)=>Promise<boolean>) {
  const router=Router();
  router.use("/saves/:id/tournaments",async(req,res,next)=>{
    res.set("Cache-Control","no-store");
    const s=req.session as {playerId?:number;isAdmin?:boolean}|undefined;
    if(!Number.isSafeInteger(s?.playerId)||(s?.playerId??0)<=0){res.status(401).json({error:"Authentication required"});return;}
    if(!await isAvailable(s?.isAdmin===true)){res.status(404).json({error:"Career not available"});return;}
    res.locals.careerActor={playerId:s!.playerId!,isAdmin:s?.isAdmin===true};next();
  });
  const save=(r:Request)=>String(r.params.id),event=(r:Request)=>String(r.params.eventId);
  router.get("/saves/:id/tournaments",async(req,res)=>res.json(await service.active(res.locals.careerActor,save(req))));
  router.post("/saves/:id/tournaments/presentation",authedWriteRateLimit,async(req,res)=>res.json(await service.presentation(res.locals.careerActor,save(req),req.body)));
  router.get("/saves/:id/tournaments/:eventId",async(req,res)=>res.json(await service.read(res.locals.careerActor,save(req),event(req))));
  router.post("/saves/:id/tournaments/:eventId/group-bull",authedWriteRateLimit,async(req,res)=>res.json(await calendar.groupBull(res.locals.careerActor,save(req),event(req),req.body)));
  router.post("/saves/:id/tournaments/:eventId/concede",authedWriteRateLimit,async(req,res)=>res.json(await calendar.concedeMatch(res.locals.careerActor,save(req),event(req),req.body)));
  router.post("/saves/:id/tournaments/:eventId/withdraw",authedWriteRateLimit,async(req,res)=>{
    z.object({confirmation:z.literal("WITHDRAW_TOURNAMENT")}).strict().parse(req.body);
    res.json(await calendar.withdraw(res.locals.careerActor,save(req),{eventId:event(req)}));
  });
  router.post("/saves/:id/tournaments/:eventId/dismiss",authedWriteRateLimit,async(req,res)=>res.json(await service.dismiss(res.locals.careerActor,save(req),event(req))));
  router.use((error:unknown,req:Request,res:Response,_next:NextFunction)=>{
    if(error instanceof z.ZodError)res.status(400).json({error:"Invalid tournament request",issues:error.issues});
    else if(error instanceof CareerError)res.status(error.status).json({error:error.message});
    else {req.log.error({err:error},"Career tournament request failed");res.status(500).json({error:"Tournament state could not be read; no replacement results were created"});}
  });
  return router;
}
