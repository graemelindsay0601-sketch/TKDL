import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recognitionModel } from "../../career/recognition/model.ts";
import { recognitionResult } from "../../career/recognition/types.ts";
import { contentId, npcPersonality, COPY } from "../../career/life/content.ts";
import { storyEngine, storyThreads, currentMoments, newsSelection } from "../../career/life/stories.ts";
import { publicProfile, relationshipTones } from "../../career/life/profile.ts";
import { opportunities, OPPORTUNITY_FAMILIES } from "../../career/life/opportunities.ts";
import type { LifeSources, Decision } from "../../career/life/types.ts";
import type { EventFact, CareerFacts } from "../../career/facts/types.ts";

const result=(id:string,circuit="GRASSROOTS",tier="LOCAL",season=1,day=7):EventFact=>({
  id:`result:${id}:HUMAN`,eventId:id,source:"A3 event result",label:id,name:id,definitionKey:"repeat-event",season,day,week:Math.ceil(day/7),date:null,age:20,
  circuit,classification:"RANKING",presentationTier:tier,country:"GBR",participantKey:"HUMAN",participantName:"You",
  position:1,stageReached:"CHAMPION",champion:true,wins:5,losses:0});
const facts=():CareerFacts=>({statistics:{matchesPlayed:0,wins:0,losses:0,winPercentage:null,eventsEntered:0,titles:0,runnersUp:0,semiFinals:0,quarterFinals:0,bestFinish:null,currentWinningStreak:null,longestWinningStreak:null,currentSeason:1,seasonsPlayed:1},
  careerSaveId:"save-one",performance:{recordedMatches:0,unavailableMatches:0,darts:null,threeDartAverage:null,highestCheckout:null,checkoutsCompleted:null,checkoutAttempts:null,checkoutPercentage:null,maximums:null,visits140Plus:null,visits100Plus:null,highestVisit:null,bestMatchAverage:null,most180sMatch:null},
  records:{firstMatch:null,firstWin:null,firstFinal:null,firstTitle:null,latestTitle:null,bestWorldRanking:null,highestTierTitles:[],firstTourCard:null,regainedTourCards:[]},results:[],timeline:[],world:{champions:[],rankingLeaders:[]}});
function source(results:EventFact[]=[]):LifeSources {
  const f=facts();f.results=results;f.statistics.matchesPlayed=results.length*5;
  return {saveId:"save-one",season:1,week:1,active:true,ready:true,facts:f,
    relationships:{careerSaveId:"save-one",opponents:[],world:{players:[],active:0,retired:0,newEntrants:0,youngPlayers:0,youngAgeMaximum:23}},
    recognition:{careerSaveId:"save-one",subject:{kind:"HUMAN",id:"HUMAN",name:"You",retired:false},relationships:[],
      ...recognitionModel({results:results.map(r=>recognitionResult(r)),appearances:[],cards:[],rankings:[],qualifications:[]})},
    events:[],worldResults:[],decisions:[],commitments:[],sponsor:null};
}
const decision=(id:string,choice:string,week=1):Decision=>({id,kind:"DIALOGUE",choice,season:1,week,data:{thread:"palace",statementFamily:"palace",contentVersion:1}});
const worldPlayer=(id="npc-one")=>({id,name:"Public Opponent",nationality:"GBR",homeRegion:"midlands",age:21,startingAge:20,createdSeason:1,retiredSeason:null,status:"ACTIVE" as const,worldRanking:null});
function rival(s:LifeSources) {
  const p=worldPlayer();s.relationships.world.players=[p];s.relationships.opponents=[{player:p,labels:["Career Rival"],evidence:[],meetings:3,humanWins:0,npcWins:3,winPercentage:0,
    eventCount:3,seasonCount:1,finals:1,majorMeetings:0,qualificationMeetings:0,firstMeeting:null,latestMeeting:null,cohorts:[],
    history:[7,14,21].map((day,i)=>({id:`meeting-${i}`,opponentId:p.id,eventId:`event-${i}`,name:`Played event ${i}`,season:1,day,date:null,round:1,stage:"FINAL",won:false,final:true,major:false,qualification:false,legsHuman:0,legsNpc:5,setsHuman:null,setsNpc:null,humanAge:20}))}];
}
test("fresh / existing-save context never invents dialogue, moments, persona or opportunities",()=>{
  const s=source();assert.deepEqual(storyEngine(s),[]);assert.deepEqual(currentMoments(s,[]),[]);assert.deepEqual(opportunities(s),[]);
  assert.equal(publicProfile(s).persona.primary,null);assert.equal(publicProfile(s).awareness,"Not yet known");
});
test("deterministic stories are order-independent, source-traceable and leave sporting authorities unchanged",()=>{
  const a=result("one"),b=result("two","NATIONAL_AMATEUR","FEATURED",1,14),s=source([a,b]),before=structuredClone(s),stories=storyEngine(s);
  assert.deepEqual(storyEngine(s),stories);assert.deepEqual(s,before);
  assert.deepEqual(storyEngine({...s,facts:{...s.facts,results:[b,a]}}),stories);
  for(const st of stories)assert.ok(st.sourceIds.some(id=>[a.id,b.id].includes(id)));
  assert.equal(new Set(stories.map(st=>st.id)).size,stories.length);
});
test("amateur success is its own story family, without pro/Card requirements or invented major appearances",()=>{
  const s=source([result("amateur","NATIONAL_AMATEUR","FEATURED")]);assert.ok(storyEngine(s).some(st=>st.kind==="first-amateur-title"));
  const q=result("world-qualifier","WORLD_CHAMPIONSHIP","WORLD");q.classification="QUALIFIER";
  assert.ok(!storyEngine(source([q])).some(st=>st.kind.startsWith("first-world")||st.kind.startsWith("first-major")));
});
test("human news beats same-week world headlines; significant public NPC world stories are included",()=>{
  const s=source([result("human","NATIONAL_AMATEUR","FEATURED")]);
  s.worldResults=Array.from({length:80},(_,i)=>({...result(`world-${i}`,"MAJOR","MAJOR"),participantKey:`npc-${i}`,participantName:`Public ${i}`}));
  const news=newsSelection(storyEngine(s));assert.equal(news[0].scope,"HUMAN");assert.ok(news.some(st=>st.scope==="WORLD"));
  assert.ok(news.length<=40);assert.ok(news.filter(st=>st.scope==="WORLD").length<=12);
});
test("trivial anonymous grassroots NPC results do not flood world news",()=>{
  const s=source();s.worldResults=Array.from({length:200},(_,i)=>({...result(`trivial-${i}`),participantKey:`npc-${i}`,participantName:"Opponent"}));
  assert.deepEqual(newsSelection(storyEngine(s)),[]);
});
test("callbacks use real previous meetings/finals, capped at two; no fabricated hatred",()=>{
  const s=source();rival(s);const stories=storyEngine(s),last=stories.find(st=>st.kind==="three-meeting-losses")!;
  assert.match(last.body,/last three played meetings/);assert.ok(last.callbacks.length<=2);
  assert.ok(last.callbacks.some(c=>c.sourceIds.includes("meeting-0")));assert.doesNotMatch(JSON.stringify(stories),/despises|hates|injur|scandal/i);
});
test("thread chapters derive persistently from actual meeting IDs, not scripted objectives",()=>{
  const s=source();rival(s);const st=storyThreads(storyEngine(s)).find(t=>t.id==="rival:npc-one")!;
  assert.ok(st.stories.length>=2);assert.deepEqual(storyThreads(storyEngine(s)),storyThreads(storyEngine(s)));
  const changed={...s,saveId:"save-two"};assert.notEqual(storyEngine(changed)[0].id,storyEngine(s)[0].id);
});
test("actual previous event lineage supports title-defence and event/place callbacks only",()=>{
  const first=result("old","MAJOR","MAJOR",1,7),next=result("return","MAJOR","MAJOR",2,7),s=source([first,next]);
  const defence=storyEngine(s).find(st=>st.kind==="title-defence")!;assert.ok(defence.sourceIds.includes(first.id));
  assert.ok(defence.callbacks.some(c=>c.sourceIds.includes(first.id)));
  next.definitionKey="unrelated";assert.ok(!storyEngine(s).some(st=>st.kind==="title-defence"));
});
test("place memory across different events requires an exact owned authored venue key",()=>{
  const first=result("old","NATIONAL_AMATEUR","FEATURED",1,7),next=result("new","MAJOR","MAJOR",2,7);next.definitionKey="other-event";
  const s=source([first,next]);s.events=[first,next].map(r=>({id:r.eventId,key:r.definitionKey,name:r.name,circuit:r.circuit,tier:r.presentationTier,
    classification:r.classification,season:r.season,day:r.day!,endDay:r.day!,status:"COMPLETED",venueKey:"same-owned-venue"}));
  assert.ok(storyEngine(s).some(st=>st.eventId===next.eventId&&st.callbacks.some(c=>c.text.includes("same venue")&&c.sourceIds.includes(first.id))));
  s.events[1].venueKey="different";assert.ok(!storyEngine(s).some(st=>st.callbacks.some(c=>c.text.includes("same venue"))));
});
test("a real earlier Palace statement can be quoted by a later factual achievement",()=>{
  const s=source([result("palace","WORLD_CHAMPIONSHIP","WORLD",1,28)]);s.week=4;s.decisions=[decision("real-choice","CONFIDENT",1)];
  const st=storyEngine(s).find(st=>st.kind==="first-world-title")!;
  assert.ok(st.callbacks.some(c=>c.sourceIds.includes("decision:real-choice")&&c.text.includes("previously said")));
  s.decisions=[];assert.ok(!storyEngine(s).some(st=>st.callbacks.some(c=>c.sourceIds.includes("decision:real-choice"))));
});
test("persona emerges only from actual choices, evolves after long history and is not selected by sporting results",()=>{
  const s=source([result("won","WORLD_CHAMPIONSHIP","WORLD")]);assert.equal(publicProfile(s).persona.primary,null);
  s.decisions=[...Array.from({length:50},(_,i)=>decision(`old-${i}`,"PROFESSIONAL")),...Array.from({length:8},(_,i)=>decision(`new-${i}`,"FIERY"))];
  assert.equal(publicProfile(s).persona.primary,"FIERY");
  const before=publicProfile(s).persona;s.facts.results=[];assert.deepEqual(publicProfile(s).persona,before);
});
test("divisive/high-interest and reserved/major-star combinations remain distinct",()=>{
  const s=source([result("world","WORLD_CHAMPIONSHIP","WORLD")]);s.decisions=Array.from({length:6},(_,i)=>decision(String(i),"FIERY"));
  const loud=publicProfile(s);assert.equal(loud.reception,"Divisive");assert.equal(loud.draw,"Major draw");
  s.decisions=Array.from({length:6},(_,i)=>decision(String(i),"RESERVED"));const quiet=publicProfile(s);
  assert.equal(quiet.awareness,"Major darts star");assert.equal(quiet.reception,"Positive");assert.equal(quiet.persona.primary,"RESERVED");
});
test("sporting stature drives commercial demand; focus/goals/persona cannot fake recognition or highest sporting demand",()=>{
  const s=source(),before=structuredClone(s.recognition);s.decisions=Array.from({length:12},(_,i)=>decision(String(i),"SHOWMAN"));
  assert.equal(publicProfile(s).commercial.demand,"Not yet established");assert.deepEqual(s.recognition,before);
  const decorated={...s,focus:"MAJOR_QUALIFICATION",goals:[{status:"COMPLETED"}]};
  assert.deepEqual(publicProfile(decorated),publicProfile(s));
});
test("respectful sporting rivalry remains possible; tone follows interactions without changing A7.2 labels",()=>{
  const s=source();rival(s);s.decisions=[decision("a","PROFESSIONAL"),decision("b","RESERVED")];
  s.decisions.forEach(d=>d.data.opponentId="npc-one");
  assert.equal(relationshipTones(s)[0].tone,"RESPECTFUL");const labels=structuredClone(s.relationships);
  s.decisions.push({...decision("c","FIERY"),data:{opponentId:"npc-one"}},{...decision("d","FIERY"),data:{opponentId:"npc-one"}});
  assert.equal(relationshipTones(s)[0].tone,"HEATED");assert.deepEqual(s.relationships,labels);
});
test("all twelve off-board families exist, eligibility is factual, dates/fees cannot be arbitrarily supplied",()=>{
  assert.equal(OPPORTUNITY_FAMILIES.length,12);
  const s=source([result("local")]);const offers=opportunities(s);assert.ok(offers.length>0&&offers.length<=4);
  assert.deepEqual(opportunities(s),offers);assert.ok(offers.every(o=>o.day===22&&o.feePence>=0));
  assert.ok(!offers.some(o=>o.family==="INTERNATIONAL"||o.family==="SPONSOR_APPEARANCE"));
});
test("accepted dates conflict honestly; declined opportunities stay declined and charity has no morality reward",()=>{
  const s=source([result("local")]),offers=opportunities(s),o=offers[0];
  s.commitments=[{id:o.id,family:o.family,title:o.title,season:o.season,day:o.day,feePence:o.feePence,status:"ACCEPTED",contractId:null}];
  assert.ok(opportunities(s).every(o=>!o.canAccept&&o.conflicts.length>0));
  const charity=OPPORTUNITY_FAMILIES.find(f=>f.key==="CHARITY")!;assert.equal(charity.fee,0);
  s.decisions=[{id:o.id,kind:"OPPORTUNITY",choice:"DECLINE",season:1,week:1,data:{}}];assert.ok(!opportunities(s).some(p=>p.id===o.id));
});
test("major scene rarity, recent-time eligibility, cooldown and source deduplication prevent repeated popups",()=>{
  const s=source([result("world","WORLD_CHAMPIONSHIP","WORLD")]),st=storyEngine(s),m=currentMoments(s,st);
  assert.equal(m.length,1);assert.equal(m[0].choices.length,4);
  s.decisions=[{...decision(m[0].id,"RESERVED"),data:{sourceIds:st.find(t=>t.id===m[0].id)!.sourceIds}}];
  assert.deepEqual(currentMoments(s,st),[]);
  s.decisions=[];s.week=10;assert.deepEqual(currentMoments(s,st),[],"no fabricated historical interviews");
});
test("actual Palace draw supports a compact pre-debut dialogue, not an invented played appearance",()=>{
  const s=source();s.draws=[{id:"draw",eventId:"palace",opponentId:"npc-one",season:1,day:7,name:"Palace",circuit:"WORLD_CHAMPIONSHIP",tier:"WORLD",classification:"RANKING"}];
  const st=storyEngine(s);assert.ok(st.some(st=>st.kind==="palace-draw-arrival"));assert.ok(!st.some(st=>st.kind==="first-palace-appearance"));
  assert.ok(st.every(st=>!st.body.includes("Another played meeting")));
  assert.equal(currentMoments(s,st)[0].kind,"DIALOGUE");
});
test("Q-School failure requires completed A5 allocation evidence, not merely absence of a Card",()=>{
  const s=source();assert.ok(!storyEngine(s).some(st=>st.kind==="q-school-failure"));
  s.publicChanges=[{id:"allocation",kind:"q-school-failure",source:"A5 allocation",participantKey:"HUMAN",participantName:"You",label:"Q-School",season:1,week:2,day:null,date:null,age:null}];
  assert.ok(storyEngine(s).some(st=>st.kind==="q-school-failure"&&st.sourceIds.includes("allocation")));
});
test("a meaningful upset is sourced to an actual played match and prior public ranking, never inferred from ability",()=>{
  const s=source();assert.ok(!storyEngine(s).some(st=>st.kind==="published-ranking-upset"));
  s.upsets=[{id:"upset:played",source:"A3 / A5 prior publication",label:"Major match",season:1,day:14,week:2,date:null,age:null,eventId:"event",
    winnerKey:"HUMAN",winnerName:"You",loserKey:"npc-one",loserName:"Public Opponent",winnerPosition:64,loserPosition:4,snapshotId:"prior-snapshot"}];
  const st=storyEngine(s).find(st=>st.kind==="published-ranking-upset")!;
  assert.equal(st.scope,"HUMAN");assert.ok(st.sourceIds.includes("ranking-snapshot:prior-snapshot"));assert.match(st.body,/#64 and #4/);
});
test("public NPC Card/qualification evidence and title-defence history produce world news independently of the human",()=>{
  const s=source();s.publicChanges=[
    {id:"card",source:"A5 award",kind:"world-card-award",label:"Public Opponent: Card awarded",participantKey:"npc-one",participantName:"Public Opponent",season:1,week:3,day:null,date:null,age:null},
    {id:"qualification",source:"A3 entitlement",kind:"world-qualification",label:"Public Opponent: qualified for The Palace",participantKey:"npc-one",participantName:"Public Opponent",season:1,week:4,day:null,date:null,age:null}];
  s.worldResults=[{...result("past","MAJOR","MAJOR",1,7),participantKey:"npc-one",participantName:"Public Opponent"},
    {...result("current","MAJOR","MAJOR",2,7),champion:false,stageReached:"LAST_16",participantKey:"npc-one",participantName:"Public Opponent"}];
  const st=storyEngine(s);assert.ok(st.some(st=>st.kind==="world-card-award"&&st.scope==="WORLD"));
  assert.ok(st.some(st=>st.kind==="world-qualification"&&st.scope==="WORLD"));
  assert.ok(st.some(st=>st.kind==="world-defending-champion-eliminated"&&st.sourceIds.includes("result:past:HUMAN")));
});
test("NPC personality is bounded, stable across future reads and derived independently of hidden sporting attributes",()=>{
  assert.deepEqual(npcPersonality("npc-one"),npcPersonality("npc-one"));
  assert.ok(new Set(Array.from({length:50},(_,i)=>npcPersonality(String(i)).primary)).size>=7);
  assert.match(contentId("save","semantic"),/^[a-f0-9-]{36}$/);assert.ok(Object.keys(COPY).length>=15);
});
test("retired Careers preserve stories/profile/threads without new moments or opportunities; age never changes ability",()=>{
  const s=source([result("title")]),before=storyEngine(s);s.active=false;
  assert.deepEqual(storyEngine(s),before);assert.deepEqual(currentMoments(s,before),[]);assert.deepEqual(opportunities(s),[]);
  const p=publicProfile(s);s.facts.results.forEach(r=>r.age=85);assert.deepEqual(publicProfile(s),p);
});
test("static boundary: only A4 posts money; no parallel wallet, simulation hooks, persona creation or browser arbitrary values",async()=>{
  const files=await Promise.all(["stories","profile","service","commitments","router"].map(n=>readFile(new URL(`../../career/life/${n}.ts`,import.meta.url),"utf8")));
  assert.doesNotMatch(files.join("\n"),/simulateNpcMatch|planBotX01Visit|throwDart\(|seededRandom|Math\.random|UPDATE career_world_players|UPDATE career_ranking/);
  assert.doesNotMatch(files[2],/UPDATE career_saves SET balance|INSERT INTO career_finance_entries/);
  assert.match(files[3],/await post\(tx,root/);assert.match(files[2],/choice.*strict\(\)/);
  const validation=await readFile(new URL("../../career/validation.ts",import.meta.url),"utf8");assert.doesNotMatch(validation,/persona|publicProfile/);
});
