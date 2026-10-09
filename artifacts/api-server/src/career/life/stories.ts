import type { Fact, EventFact } from "../facts/types.ts";
import { contentId, COPY, response, threadTitle, variant, npcPersonality } from "./content.ts";
import type { Callback, LifeSources, Moment, Persona, Story } from "./types.ts";

const when=(f:{season:number;day:number|null;week:number|null})=>(f.season-1)*364+(f.day ?? (f.week ? (f.week-1)*7+1 : 364));
const order=(a:Story,b:Story)=>when(b)-when(a) || a.id.localeCompare(b.id);
const publicMain=(r:EventFact)=>r.classification!=="QUALIFIER";
const stage=(r:EventFact)=>publicMain(r) && ["TELEVISED","MAJOR","WORLD"].includes(r.presentationTier);
const familyOf=(r:EventFact)=>!publicMain(r) && r.circuit==="Q_SCHOOL" ? "q-school" : r.presentationTier==="WORLD" && publicMain(r) ? "palace" :
  stage(r) ? "major" : ["COUNTY","REGIONAL","NATIONAL_AMATEUR","VAULT","CHALLENGER"].includes(r.circuit) ? "amateur" :
  ["PRO_CIRCUIT","EUROPEAN_SERIES"].includes(r.circuit) ? "professional" : "breakthrough";

export function storyEngine(s:LifeSources):Story[] {
  const out:Story[]=[],results=[...s.facts.results].sort((a,b)=>when(a)-when(b)||a.id.localeCompare(b.id));
  const add=(kind:string,f:Fact,detail:string,family:string,thread:string,significance:Story["significance"]="NEWS",scope:Story["scope"]="HUMAN",opponentId?:string,extraIds:string[]=[])=>{
    const id=contentId(s.saveId,`${kind}:${f.id}`),copy=COPY[family]??COPY.breakthrough;
    const callbacks:Callback[]=[];
    if(opponentId) {
      const o=s.relationships.opponents.find(o=>o.player.id===opponentId);
      const previous=o?.history.filter(m=>when({season:m.season,day:m.day,week:null})<when(f));
      if(previous?.length) {
        const wins=previous.filter(m=>m.won).length;
        callbacks.push({text:`Before this occasion: ${previous.length} played meetings with ${o!.player.name}, ${wins} wins and ${previous.length-wins} defeats.`,sourceIds:previous.map(m=>m.id)});
        const final=[...previous].reverse().find(m=>m.final);
        if(final)callbacks.push({text:`An earlier final together was at ${final.name}.`,sourceIds:[final.id]});
        else {
          const cohort=o!.cohorts.find(c=>c.season<=f.season);
          if(cohort)callbacks.push({text:`Shared ${cohort.kind} history: ${cohort.name}, season ${cohort.season}.`,sourceIds:[`cohort:${cohort.kind}:${cohort.season}:${cohort.session}:${opponentId}`]});
        }
      }
    }
    const result=results.find(r=>r.eventId===f.eventId),event=s.events.find(e=>e.id===f.eventId);
    const earlier=result ? results.filter(r=>r.definitionKey===result.definitionKey && when(r)<when(f)) :
      event ? results.filter(r=>r.definitionKey===event.key && when(r)<when(f)) : [];
    if(earlier.length) {
      const prior=earlier.at(-1)!;
      callbacks.push({text:`Previously at ${prior.name}: ${prior.champion ? "champion" : prior.stageReached.toLowerCase().replaceAll("_"," ")} in season ${prior.season}.`,sourceIds:[prior.id]});
    } else if(event?.venueKey) {
      const place=results.filter(r=>when(r)<when(f)&&s.events.find(e=>e.id===r.eventId)?.venueKey===event.venueKey).at(-1);
      if(place)callbacks.push({text:`Previously at this same venue: ${place.name}, ${place.champion?"champion":place.stageReached.toLowerCase().replaceAll("_"," ")} in season ${place.season}.`,
        sourceIds:[place.id,`event:${event.id}`]});
    }
    const statement=s.decisions.filter(d=>d.kind==="DIALOGUE" && d.data.thread===thread &&
      when({season:d.season,day:null,week:d.week})<when(f)).at(-1);
    if(statement)callbacks.unshift({text:`You previously said: “${response(statement.choice as Persona,String(statement.data.statementFamily??"breakthrough"),statement.id)}”`,
      sourceIds:[`decision:${statement.id}`]});
    out.push({id,kind,scope,significance,title:`${copy.heads[variant(id,copy.heads.length)]}: ${f.label}`,
      body:`${copy.intro[variant(id+"intro",copy.intro.length)]} ${detail}`,season:f.season,week:f.week,day:f.day,date:f.date,
      ...(f.eventId ? {eventId:f.eventId} : {}),...(opponentId ? {opponentId} : {}),thread,sourceIds:[f.id,...extraIds],callbacks:callbacks.slice(0,2)});
  };
  const firsts:[string,(r:EventFact)=>boolean][]=[
    ["first-final",r=>r.stageReached==="FINAL"||r.champion],["first-title",r=>r.champion],
    ["first-amateur-title",r=>publicMain(r) && r.champion && ["REGIONAL","NATIONAL_AMATEUR","VAULT","CHALLENGER"].includes(r.circuit)],
    ["first-pro-final",r=>publicMain(r) && ["PRO_CIRCUIT","EUROPEAN_SERIES"].includes(r.circuit) && (r.stageReached==="FINAL"||r.champion)],
    ["first-pro-title",r=>publicMain(r) && ["PRO_CIRCUIT","EUROPEAN_SERIES"].includes(r.circuit) && r.champion],
    ["first-major-deep-run",r=>stage(r)&&["QUARTER_FINAL","SEMI_FINAL"].includes(r.stageReached)],
    ["first-major-final",r=>stage(r)&&(r.stageReached==="FINAL"||r.champion)],["first-major-title",r=>stage(r)&&r.champion],
    ["first-world-final",r=>publicMain(r)&&r.circuit==="WORLD_CHAMPIONSHIP"&&(r.stageReached==="FINAL"||r.champion)],
    ["first-world-title",r=>publicMain(r)&&r.circuit==="WORLD_CHAMPIONSHIP"&&r.champion],
  ];
  for(const [kind,predicate] of firsts) {
    const r=results.find(predicate);if(!r)continue;
    const opponent=s.relationships.opponents.find(o=>o.history.some(m=>m.eventId===r.eventId && m.final));
    const major=kind==="first-major-title"||kind.startsWith("first-world");
    add(kind,r,`${r.name}: ${r.champion ? "title" : r.stageReached.toLowerCase().replaceAll("_"," ")} recorded.`,familyOf(r),
      r.circuit==="WORLD_CHAMPIONSHIP"&&publicMain(r) ? "palace" : `event:${r.definitionKey}`,major ? "MAJOR" : "MOMENT","HUMAN",opponent?.player.id);
  }
  // Actual played meetings, not mere entries, provide appearance and first-win evidence.
  const meetings=s.relationships.opponents.flatMap(o=>o.history).sort((a,b)=>a.season-b.season||a.day-b.day||a.id.localeCompare(b.id));
  for(const [kind,test] of [
    ["first-professional-appearance",(e:LifeSources["events"][number])=>["PRO_CIRCUIT","EUROPEAN_SERIES"].includes(e.circuit)&&e.classification!=="QUALIFIER"],
    ["first-major-appearance",(e:LifeSources["events"][number])=>["MAJOR","WORLD"].includes(e.tier)&&e.classification!=="QUALIFIER"],
    ["first-palace-appearance",(e:LifeSources["events"][number])=>e.circuit==="WORLD_CHAMPIONSHIP"&&e.classification!=="QUALIFIER"],
    ["first-professional-win",(e:LifeSources["events"][number])=>["PRO_CIRCUIT","EUROPEAN_SERIES"].includes(e.circuit)&&e.classification!=="QUALIFIER"],
  ] as const) {
    const m=meetings.find(m=>{const e=s.events.find(e=>e.id===m.eventId);return e&&test(e)&&(kind!=="first-professional-win"||m.won);});
    if(m)add(kind,{id:m.id,source:"A7.2 played meeting",label:m.name,season:m.season,day:m.day,week:Math.ceil(m.day/7),date:m.date,age:m.humanAge,eventId:m.eventId},
      `${kind.replaceAll("-"," ")} is supported by an actual played match.` ,kind.includes("palace")?"palace":kind.includes("major")?"major":"professional",kind.includes("palace")?"palace":"breakthrough",kind.includes("palace")?"MAJOR":"MOMENT","HUMAN",m.opponentId);
  }
  for(const f of s.facts.timeline.filter(f=>f.id.startsWith("card:")||f.id.startsWith("card-end:"))) {
    const significant=s.facts.records.firstTourCard?.id===f.id||s.facts.records.regainedTourCards.some(c=>c.id===f.id)||/lost/i.test(f.label);
    add("card-status",f,f.label,"card","card",significant?"MAJOR":"NEWS");
  }
  for(const f of s.facts.timeline.filter(f=>f.id.startsWith("sponsor-event:"))) {
    const eventType=f.source.replace("A4 sponsor journey event: ","");
    const important=["SIGNED","SPONSOR_ACCEPTED_REQUEST","OFFER_RECEIVED"].includes(eventType);
    add(`sponsor-${eventType.toLowerCase().replaceAll("_","-")}`,f,f.label,"commercial",
      `commercial:${f.label.split(" — ")[0]}`,important?"MOMENT":"NEWS");
  }
  for(const f of s.facts.timeline.filter(f=>f.id.startsWith("qualification:"))) {
    const milestone=s.recognition.contexts.find(c=>["MAJOR_STAGE","INTERNATIONAL"].includes(c.context)&&c.evidence.some(e=>e.id===f.id));
    add("qualification",f,f.label,"qualification","breakthrough",milestone?"MOMENT":"NEWS");
  }
  for(const r of results.filter(r=>r.circuit==="Q_SCHOOL"))add("q-school-result",r,`${r.name}: ${r.stageReached.toLowerCase().replaceAll("_"," ")}. No unrecorded Card outcome is inferred.`,"q-school","q-school","MOMENT");
  for(const f of s.publicChanges??[])add(f.kind,f,f.kind==="q-school-failure"?"The completed Q-School allocation awarded no Card through this pathway.":f.label,
    f.kind.startsWith("q-school")?"q-school":f.kind==="world-qualification"?"qualification":"card",f.participantKey==="HUMAN"?"q-school":`world:${f.participantKey}`,
    f.participantKey==="HUMAN"?"MOMENT":"NEWS",f.participantKey==="HUMAN"?"HUMAN":"WORLD",f.participantKey==="HUMAN"?undefined:f.participantKey);
  for(const u of s.upsets??[]) {
    const human=u.winnerKey==="HUMAN"||u.loserKey==="HUMAN",opponent=u.winnerKey==="HUMAN"?u.loserKey:u.winnerKey;
    add("published-ranking-upset",u,`${u.winnerName} beat ${u.loserName}; the previous published World ranking placed them #${u.winnerPosition} and #${u.loserPosition} respectively.`,
      human?"rivalry":"world",human?`rival:${opponent}`:`world:${u.winnerKey}`,human?"MOMENT":"NEWS",human?"HUMAN":"WORLD",opponent,[`ranking-snapshot:${u.snapshotId}`]);
  }
  for(const draw of s.draws??[]) {
    if(draw.classification==="QUALIFIER")continue;
    const opponent=s.relationships.opponents.find(o=>o.player.id===draw.opponentId);
    const palace=draw.circuit==="WORLD_CHAMPIONSHIP",firstPalace=palace&&!meetings.some(m=>s.events.find(e=>e.id===m.eventId)?.circuit==="WORLD_CHAMPIONSHIP");
    const firstPro=["PRO_CIRCUIT","EUROPEAN_SERIES"].includes(draw.circuit)&&!meetings.some(m=>["PRO_CIRCUIT","EUROPEAN_SERIES"].includes(s.events.find(e=>e.id===m.eventId)?.circuit??""));
    const firstMajor=["MAJOR","WORLD"].includes(draw.tier)&&!meetings.some(m=>["MAJOR","WORLD"].includes(s.events.find(e=>e.id===m.eventId)?.tier??""));
    if(!(firstPalace||firstPro||firstMajor||opponent?.labels.includes("Career Rival")))continue;
    add(firstPalace?"palace-draw-arrival":firstPro?"pro-draw-arrival":firstMajor?"major-draw-arrival":"rival-drawn",
      {id:`draw:${draw.id}`,source:"A3 actual draw",label:draw.name,season:draw.season,day:draw.day,week:Math.ceil(draw.day/7),date:null,age:null,eventId:draw.eventId},
      `The actual draw includes a match against ${opponent?.player.name??s.relationships.world.players.find(p=>p.id===draw.opponentId)?.name??"a public opponent"}. This is a draw, not a claim of a played appearance.`,
      palace?"palace":"draw",palace?"palace":opponent?`rival:${draw.opponentId}`:"breakthrough",firstPalace?"MAJOR":"MOMENT","HUMAN",draw.opponentId);
  }
  let priorRank:number|null=null,best=Infinity;
  for(const f of s.facts.timeline.filter(f=>f.id.startsWith("ranking:")).sort((a,b)=>when(a)-when(b)||a.id.localeCompare(b.id))) {
    const pos=Number(/#(\d+)/.exec(f.label)?.[1]);if(!pos)continue;
    const threshold=[1,8,32,64,128].find(c=>pos<=c&&best>c);
    if(threshold) add(`rank-top-${threshold}`,f,`Published World ranking #${pos}.`,"ranking","ranking",pos===1?"MAJOR":"MOMENT");
    else if(priorRank!==null && pos-priorRank>=32)add("ranking-fall",f,`Published position changed from #${priorRank} to #${pos}.`,"adversity","ranking");
    else if(priorRank!==null && priorRank-pos>=32)add("ranking-recovery",f,`Published position changed from #${priorRank} to #${pos}.`,"ranking","ranking");
    best=Math.min(best,pos);priorRank=pos;
  }
  // Repeated final defeats / successful defence claims require actual prior lineage evidence.
  for(let i=0;i<results.length;i++) {
    const r=results[i],earlier=results.slice(0,i);
    if(r.stageReached==="FINAL"&&earlier.filter(x=>x.stageReached==="FINAL").length>=2)
      add("repeated-final-defeat",r,"At least three final defeats are now in the Career result record.","adversity",`event:${r.definitionKey}`);
    const defending=[...earlier].reverse().find(x=>x.definitionKey===r.definitionKey&&x.season===r.season-1&&x.champion);
    if(defending)add(r.champion?"title-defence":"defending-champion-eliminated",r,
      r.champion?"The previous season's winner has won this event again.":"The previous season's winner did not retain this event's title.",r.champion?familyOf(r):"adversity",`event:${r.definitionKey}`,stage(r)?"MOMENT":"NEWS","HUMAN",undefined,[defending.id]);
  }
  for(const o of s.relationships.opponents) {
    const history=[...o.history].sort((a,b)=>a.season-b.season||a.day-b.day||a.id.localeCompare(b.id));
    history.forEach((m,i)=>{
      const recent=history.slice(Math.max(0,i-2),i+1),firstFinal=m.final&&!history.slice(0,i).some(p=>p.final),landmark=[3,10,20,50].includes(i+1);
      const revenge=m.won&&history[i-1]?.won===false,streak=recent.length===3&&recent.every(x=>!x.won);
      if(!(firstFinal||landmark||m.major||revenge||streak))return;
      const fact:Fact={id:m.id,source:"A7.2 played meeting",label:`${o.player.name} at ${m.name}`,season:m.season,day:m.day,week:Math.ceil(m.day/7),date:m.date,age:m.humanAge,eventId:m.eventId};
      add(firstFinal?"first-shared-final":streak?"three-meeting-losses":landmark?`meeting-${i+1}`:revenge?"rematch-win":"major-meeting",fact,
        streak?`${o.player.name} won the last three played meetings up to this result.`:`Played meeting ${i+1}: ${m.won?"human win":"opponent win"}.`,
        o.cohorts.length&&landmark?"generation":"rivalry",`rival:${o.player.id}`,firstFinal&&m.major?"MOMENT":"NEWS","RIVAL",o.player.id,recent.map(p=>p.id));
    });
    if(o.player.status==="RETIRED"&&o.meetings>=3&&o.player.retiredSeason)
      add("rival-retirement",{id:`retirement:${o.player.id}:${o.player.retiredSeason}`,source:"A2 public retirement / A7.2",label:o.player.name,
        season:o.player.retiredSeason,week:null,day:null,date:null,age:null},`${o.meetings} played meetings remain in the shared record.`,"retirement",`rival:${o.player.id}`,"MAJOR","RIVAL",o.player.id);
  }
  for(const e of s.events.filter(e=>["DRAW_PENDING","DRAWN","IN_PROGRESS"].includes(e.status))) {
    const previous=results.filter(r=>r.definitionKey===e.key&&r.season<e.season).at(-1);
    if(!previous||!meetings.some(m=>m.eventId===e.id))continue;
    add("event-return",{id:`return:${e.id}`,source:"A3 event lineage / A7.1 result",label:e.name,season:e.season,week:Math.ceil(e.day/7),day:e.day,date:null,age:null,eventId:e.id},
      previous.champion&&previous.season===e.season-1?"Returning after winning this event last season.":"Returning to an event with a recorded previous appearance.",
      e.circuit==="WORLD_CHAMPIONSHIP"?"palace":"return",e.circuit==="WORLD_CHAMPIONSHIP"?"palace":`event:${e.key}`,"MOMENT","HUMAN",undefined,[previous.id]);
  }
  const world=[...s.worldResults].sort((a,b)=>when(a)-when(b)||a.id.localeCompare(b.id));
  for(const r of world) {
    const rival=s.relationships.opponents.find(o=>o.player.id===r.participantKey&&o.meetings>=3);
    const earlier=[...world].reverse().find(p=>p.participantKey===r.participantKey&&p.definitionKey===r.definitionKey&&p.season===r.season-1&&p.champion);
    const young=s.relationships.world.players.find(p=>p.id===r.participantKey);
    const prospect=young&&young.startingAge+(r.season-young.createdSeason)<=23;
    const significant=stage(r)||(prospect&&r.champion)||Boolean(rival&&r.champion)||Boolean(earlier);
    if(!significant)continue;
    add(earlier?(r.champion?"world-title-defence":"world-defending-champion-eliminated"):prospect?"prospect-result":"world-result",r,
      `${r.participantName}: ${r.champion?"champion":r.stageReached.toLowerCase().replaceAll("_"," ")} at ${r.name}.${earlier? r.champion?" The previous season's winner retained this title.":" The previous season's winner did not retain this title.":""}`,
      prospect?"prospect":"world",`world:${r.participantKey}`, "NEWS",rival?"RIVAL":"WORLD",r.participantKey,earlier?[earlier.id]:[]);
  }
  for(const f of s.facts.world.rankingLeaders)add("world-number-one",f,`${f.participantName} leads the published World Ranking.`,"ranking",`world:${f.participantKey}`,"NEWS","WORLD",f.participantKey);
  for(const p of s.relationships.world.players.filter(p=>p.status==="RETIRED"&&p.retiredSeason&&!s.relationships.opponents.some(o=>o.player.id===p.id&&o.meetings>=3)))
    add("world-retirement",{id:`retirement:${p.id}:${p.retiredSeason}`,source:"A2 public retirement",label:p.name,season:p.retiredSeason!,week:null,day:null,date:null,age:null},
      "The public world roster records this player's retirement.","retirement",`world:${p.id}`,"NEWS","WORLD",p.id);
  for(const c of s.commitments.filter(c=>c.status==="COMPLETED"))add("commercial-completed",
    {id:`commitment:${c.id}`,source:"A7.5 accepted commitment / A4 ledger",label:c.title,season:c.season,day:c.day,week:Math.ceil(c.day/7),date:null,age:null},
    `The accepted ${c.family.toLowerCase().replaceAll("_"," ")} commitment was completed. Commercial fees are separate from prize earnings.`,"commercial","commercial");
  return [...new Map(out.map(x=>[x.id,x])).values()].sort(order);
}
export function newsSelection(stories:Story[]):Story[] {
  // Hard caps and per-world-player / per-human-event bounds; never flood trivial results.
  const selected:Story[]=[],counts=new Map<string,number>();
  const priority={HUMAN:0,RIVAL:1,WORLD:2},significance={MAJOR:0,MOMENT:1,NEWS:2};
  const known=new Map<number,number>();
  for(const st of stories)if(st.week!==null)known.set(st.season,Math.max(known.get(st.season)??0,when(st)));
  // Unknown-week public records stay season-scoped, not falsely dated at year end.
  // A bounded human-priority boost keeps this week's player news above NPC noise,
  // without making an old human headline permanently outrank newer world events.
  const newsTime=(st:Story)=>(st.week===null?(known.get(st.season)??(st.season-1)*364+1):when(st))+
    (st.scope==="HUMAN"?7:st.scope==="RIVAL"?3:0);
  for(const story of [...stories].sort((a,b)=>newsTime(b)-newsTime(a)||
    priority[a.scope]-priority[b.scope]||significance[a.significance]-significance[b.significance]||order(a,b))) {
    const key=story.scope==="WORLD"?`world:${story.opponentId??story.thread}`:story.eventId??story.id;
    if((counts.get(key)??0)>=2)continue;
    if(story.scope==="WORLD"&&selected.filter(s=>s.scope==="WORLD").length>=12)continue;
    selected.push(story);counts.set(key,(counts.get(key)??0)+1);if(selected.length===40)break;
  }
  return selected;
}
export function currentMoments(s:LifeSources,stories:Story[]):Moment[] {
  if(!s.active||!s.ready)return [];
  const now=(s.season-1)*52+s.week,answered=new Set(s.decisions.map(d=>d.id));
  const recentDialogue=s.decisions.filter(d=>d.kind==="DIALOGUE").at(-1);
  const cooldown=recentDialogue ? now-((recentDialogue.season-1)*52+recentDialogue.week)<2 : false;
  const candidates=stories.filter(st=>st.scope!=="WORLD"&&st.significance!=="NEWS"&&st.week!==null&&
    now-((st.season-1)*52+st.week)>=0&&now-((st.season-1)*52+st.week)<=3&&!answered.has(st.id)&&
    !s.decisions.some(d=>st.eventId&&d.data.eventId===st.eventId&&now-((d.season-1)*52+d.week)<2)&&
    !s.decisions.some(d=>Array.isArray(d.data.sourceIds)&&st.sourceIds.some(id=>(d.data.sourceIds as string[]).includes(id))));
  const presentationInterest=(st:Story)=>st.opponentId&&["FIERY","SHOWMAN","INTENSE","AMBITIOUS"].includes(npcPersonality(st.opponentId).primary)?1:0;
  const sorted=candidates.sort((a,b)=>(a.significance==="MAJOR"?0:1)-(b.significance==="MAJOR"?0:1)||when(b)-when(a)||
    presentationInterest(b)-presentationInterest(a)||a.id.localeCompare(b.id));
  const chosen=sorted.find(st=>!cooldown||st.kind.startsWith("first-palace")||st.kind.startsWith("first-professional-appearance"));
  if(!chosen)return [];
  // Equivalent scene facts (e.g. World title and major title) cannot trigger sequential duplicate interviews.
  const atmosphere=chosen.kind.endsWith("appearance")||(chosen.kind.endsWith("draw-arrival")&&chosen.kind!=="palace-draw-arrival")||chosen.kind==="rival-drawn"||chosen.kind==="event-return";
  const family=chosen.thread==="palace"?"palace":chosen.thread==="card"?"card":chosen.thread==="q-school"?"q-school":chosen.kind==="qualification"?"qualification":chosen.opponentId?"rivalry":
    chosen.kind.includes("amateur")?"amateur":chosen.kind.includes("major")?"major":chosen.kind.includes("pro-")?"professional":chosen.kind.includes("rank")?"ranking":"breakthrough";
  const personas:Persona[]=["PROFESSIONAL","RESERVED",...(variant(chosen.id,2)===0?["CONFIDENT","FIERY"]:["SHOWMAN","CONFIDENT"]) as Persona[]];
  return [{id:chosen.id,storyId:chosen.id,kind:atmosphere?"ATMOSPHERE":"DIALOGUE",title:chosen.title,
    prompt:atmosphere?"Take a moment to recognise this sporting occasion.":COPY[family].question,
    steps:[chosen.body,...(chosen.opponentId?[`Opponent public presentation: ${npcPersonality(chosen.opponentId).primary.toLowerCase()}.`]:[]),...chosen.callbacks.map(c=>c.text)].slice(0,3),
    choices:atmosphere?[]:personas.map(p=>({id:p,text:response(p,family,chosen.id)})),opponentId:chosen.opponentId,thread:chosen.thread,statementFamily:family}];
}
export function storyThreads(stories:Story[]) {
  const groups=new Map<string,Story[]>();for(const st of stories)groups.set(st.thread,[...(groups.get(st.thread)??[]),st]);
  return [...groups].map(([id,stories])=>({id,title:threadTitle(id),stories:[...stories].reverse()}));
}
