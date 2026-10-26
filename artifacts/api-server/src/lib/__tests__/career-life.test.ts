import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recognitionModel } from "../../career/recognition/model.ts";
import { recognitionResult } from "../../career/recognition/types.ts";
import { contentId, npcPersonality, COPY } from "../../career/life/content.ts";
import { storyEngine, storyThreads, currentMoments, newsSelection } from "../../career/life/stories.ts";
import { publicProfile, relationshipTones } from "../../career/life/profile.ts";
import { opportunities, OPPORTUNITY_FAMILIES, clubInvitationProgress } from "../../career/life/opportunities.ts";
import type { LifeSources, Decision } from "../../career/life/types.ts";
import type { EventFact, CareerFacts, Fact } from "../../career/facts/types.ts";

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
test("SP-B3 A4 sponsor events enter Career stories once with a stable source link",()=>{
  const s=source();
  const offer:Fact={id:"sponsor-event:OFFER_RECEIVED:offer-event-one",source:"A4 sponsor journey event: OFFER_RECEIVED",
    label:"Vantage Darts — A formal offer is ready.",season:1,day:8,week:2,date:null,age:20,eventId:"offer-one"};
  s.facts.timeline=[offer,structuredClone(offer)];
  const stories=storyEngine(s),sponsorStories=stories.filter(st=>st.kind==="sponsor-offer-received");
  assert.equal(sponsorStories.length,1);
  assert.equal(sponsorStories[0].scope,"HUMAN");
  assert.ok(sponsorStories[0].sourceIds.includes(offer.id));
  assert.deepEqual(newsSelection(stories).filter(st=>st.kind==="sponsor-offer-received").map(st=>st.id),[sponsorStories[0].id]);
  assert.deepEqual(storyEngine(s),stories);
});
test("trivial anonymous grassroots NPC results do not flood world news",()=>{
  const s=source();s.worldResults=Array.from({length:200},(_,i)=>({...result(`trivial-${i}`),participantKey:`npc-${i}`,participantName:"Opponent"}));
  assert.deepEqual(newsSelection(storyEngine(s)),[]);
});
test("callbacks use real previous meetings/finals, capped at two; no fabricated hatred",()=>{
  const s=source();rival(s);const stories=storyEngine(s),last=stories.find(st=>st.kind==="three-meeting-losses")!;
  assert.match(last.body,/won the last three matches/);assert.ok(last.callbacks.length<=2);
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
  assert.ok(storyEngine(s).some(st=>st.eventId===next.eventId&&st.callbacks.some(c=>c.text.includes("this venue")&&c.sourceIds.includes(first.id))));
  s.events[1].venueKey="different";assert.ok(!storyEngine(s).some(st=>st.callbacks.some(c=>c.text.includes("this venue"))));
});
test("a real earlier Palace statement can be quoted by a later factual achievement",()=>{
  const s=source([result("palace","WORLD_CHAMPIONSHIP","WORLD",1,28)]);s.week=4;s.decisions=[decision("real-choice","CONFIDENT",1)];
  const st=storyEngine(s).find(st=>st.kind==="first-world-title")!;
  assert.ok(st.callbacks.some(c=>c.sourceIds.includes("decision:real-choice")&&c.text.includes("You said at the time")));
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
test("real club appearances open a one-way local-to-regional opportunity path",()=>{
  const s=source();
  assert.deepEqual(clubInvitationProgress(s),{nextInvitation:"LOCAL_SPOTLIGHT",status:"IN_PROGRESS",appearances:0,wins:0,targetAppearances:3,targetWins:null});
  s.localTeamRecord={appearances:2,wins:2};
  assert.equal(clubInvitationProgress(s).targetAppearances,3);
  assert.ok(!opportunities(s).some(o=>o.family==="LOCAL_SPOTLIGHT"));
  s.localTeamRecord={appearances:3,wins:2};
  assert.equal(clubInvitationProgress(s).status,"READY");
  const local=opportunities(s).find(o=>o.family==="LOCAL_SPOTLIGHT")!;
  assert.ok(local);
  assert.match(local.compatibility,/3 genuine club appearances/);
  assert.match(local.description,/off-board commitment, not a tournament result/);
  assert.equal(opportunities(s).some(o=>o.family==="REGIONAL_SHOWCASE"),false);

  s.commitments=[{id:local.id,family:local.family,title:local.title,season:1,day:local.day,feePence:local.feePence,status:"COMPLETED",contractId:null}];
  s.localTeamRecord={appearances:5,wins:2};
  assert.deepEqual(clubInvitationProgress(s),{nextInvitation:"REGIONAL_SHOWCASE",status:"IN_PROGRESS",appearances:5,wins:2,targetAppearances:5,targetWins:3});
  assert.equal(opportunities(s).some(o=>o.family==="REGIONAL_SHOWCASE"),false,"two wins do not meet the regional invitation threshold");
  s.localTeamRecord={appearances:5,wins:3};
  s.events=[{id:"regional-open-1",key:"regional-open",name:"North Regional Open",circuit:"REGIONAL",tier:"REGIONAL",
    classification:"RANKING",season:1,day:35,endDay:35,status:"REGISTRATION_OPEN"}];
  const regional=opportunities(s).find(o=>o.family==="REGIONAL_SHOWCASE")!;
  assert.equal(clubInvitationProgress(s).status,"READY");
  assert.ok(regional);
  assert.match(regional.compatibility,/5 genuine appearances · 3 wins · completed local spotlight/);
  assert.equal(regional.feePence,0,"the tournament invitation is not an appearance payment");
  assert.equal(regional.eventId,"regional-open-1");
  assert.equal(regional.day,35,"the invitation uses the scheduled Regional Open date");
  assert.equal(regional.canAccept,true,"the completed local spotlight no longer occupies the regional date");
  assert.deepEqual(regional.conflicts,[]);
  s.decisions=[{id:regional.id,kind:"OPPORTUNITY",choice:"ACCEPT",season:1,week:1,data:{family:"REGIONAL_SHOWCASE",eventId:"regional-open-1"}}];
  assert.equal(clubInvitationProgress(s).status,"BOOKED");
  assert.equal(clubInvitationProgress(s).eventId,"regional-open-1");
  s.events[0].status="COMPLETED";
  assert.equal(clubInvitationProgress(s).status,"COMPLETE");
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

test("v6 close-season tips: elite tips by name, a tour-level round-up, and the tip coming good only on public evidence",()=>{
  const s=source();s.season=3;
  s.relationships.world.players=[{...worldPlayer("npc-rising"),name:"Ryan Kerr",homeRegion:"Ayrshire",startingAge:21,createdSeason:1},
    ...["a","b","c","d","e"].map(x=>({...worldPlayer(`npc-${x}`),name:`Club ${x.toUpperCase()}`,homeRegion:"Fife"}))];
  s.tips=[{npcId:"npc-rising",name:"Ryan Kerr",band:"ELITE",season:2,order:1},
    ...["a","b","c","d","e"].map((x,i)=>({npcId:`npc-${x}`,name:`Club ${x.toUpperCase()}`,band:"TOUR" as const,season:2,order:i+2}))];
  let stories=storyEngine(s);
  const tip=stories.find(st=>st.kind==="tipped-for-the-top")!;
  assert.match(tip.body,/ Ryan Kerr \(22, Ayrshire\) goes into season 2 tipped/);
  assert.deepEqual([tip.scope,tip.thread,tip.opponentId,tip.season,tip.week],["WORLD","world:npc-rising","npc-rising",2,1]);
  assert.ok(!/\d{2,}\s*(ability|potential|rating)|potential/i.test(tip.body),"never reveals ratings");
  const roundUp=stories.filter(st=>st.kind==="names-to-watch");
  assert.equal(roundUp.length,1,"one round-up a season");
  assert.equal(roundUp[0].body.match(/Club [A-E]/g)!.length,4,"at most four names");
  assert.ok(!stories.some(st=>st.kind==="tip-arrival"),"no arrival without a public result");
  // A title before the tip proves nothing; a later public title does.
  s.worldResults=[{...result("before","PRO_CIRCUIT","STANDARD",1,70),participantKey:"npc-rising",participantName:"Ryan Kerr"},
    {...result("pro-tour-12","PRO_CIRCUIT","STANDARD",3,140),name:"Pro Tour 12",participantKey:"npc-rising",participantName:"Ryan Kerr"}];
  s.publicChanges=[{id:"world-card:x",source:"A5",label:"Club A: Tour Card awarded",kind:"world-card-award",participantKey:"npc-a",participantName:"Club A",season:2,week:3,day:null,date:null,age:null}];
  stories=storyEngine(s);
  const arrivals=stories.filter(st=>st.kind==="tip-arrival");
  assert.deepEqual(arrivals.map(a=>a.body.replace(/^.*?\. (?=[A-Z][a-z]+ [A-Z])/,"")).sort(),["Club A, tipped in the close season before season 2, has earned a Tour Card.",
    "Ryan Kerr, tipped in the close season before season 2, has won Pro Tour 12."]);
  assert.ok(arrivals.every(a=>a.sourceIds.some(id=>id.startsWith("tip:2:"))),"linked to the tip");
  assert.deepEqual(storyEngine(s),stories,"deterministic");
});

test("nine-darters from the records book: yours is a major career moment, anyone else's is world news",()=>{
  const s=source();s.season=2;s.relationships.world.players=[{...worldPlayer("npc-nine"),name:"Nina Perfect"}];
  s.nineDarters=[{matchId:"m-you",eventId:"e1",eventName:"The Match Trophy",participantKey:"HUMAN",name:"You",season:2,day:150,count:1,source:"LIVE"},
    {matchId:"m-npc",eventId:"e2",eventName:"Pro Tour 7",participantKey:"npc-nine",name:"Nina Perfect",season:2,day:40,count:2,source:"SIMULATED"}];
  const stories=storyEngine(s),you=stories.find(st=>st.kind==="your-nine-darter")!,world=stories.find(st=>st.kind==="nine-darter")!;
  assert.deepEqual([you.scope,you.significance,you.week],["HUMAN","MAJOR",22]);
  assert.match(you.body,/You threw a nine-dart leg at The Match Trophy with your own darts\./);
  assert.deepEqual([world.scope,world.opponentId],["WORLD","npc-nine"]);
  assert.match(world.body,/Nina Perfect threw a nine-dart leg at Pro Tour 7 \(2 in the match\)\./);
});

test("a savings goal reached is a story: what you saved for, how much, and when",()=>{
  const s=source();s.season=2;
  s.savingsGoals=[{id:"g1",kind:"EVENT",label:"UK Open",targetPence:23800,eventId:"e-open",season:2,week:14},
    {id:"g2",kind:"AMOUNT",label:"New darts",targetPence:15000,eventId:null,season:2,week:20}];
  const goals=storyEngine(s).filter(st=>st.kind==="goal-reached");
  assert.equal(goals.length,2);
  assert.match(goals.find(g=>g.body.includes("UK Open"))!.body,/You saved the £238 it takes to play UK Open \(entry, travel and stay\), in week 14 of season 2\./);
  assert.match(goals.find(g=>g.body.includes("New darts"))!.body,/You reached your savings goal: £150 for New darts, in week 20 of season 2\./);
});

test("county and national selection: picked, dropped, Inter-County titles and World Cup call-ups make the news",()=>{
  const s=source();s.season=3;
  s.club={club:{localityKey:"ayrshire",name:"Kilbirnie Darts Club",city:"Kilbirnie",region:"Ayrshire",country:"GBR"},season:3,captain:{key:"HUMAN",name:"You",you:true},
    history:[{season:1,division:2,position:1,points:40,champions:true,promoted:true,relegated:false},{season:2,division:1,position:8,points:3,champions:false,promoted:false,relegated:true}],
      county:{name:"Ayrshire County",category:"MEN",aTeam:[],squads:{MEN:{A:[],B:[]},WOMEN:{A:[],B:[]}},rankingProgress:null,trial:{status:"NOT_EARNED",season:3,sourceSeason:2,appearances:0,wins:0,category:null,matchId:null,opponentName:null},fixtures:[],
      teamStandings:["MEN-A","MEN-B","WOMEN-A","WOMEN-B"].map(k=>({category:k.startsWith("MEN")?"MEN" as const:"WOMEN" as const,team:k.endsWith("A")?"A" as const:"B" as const,rows:[]})),
      youSelected:true,youSelectedLastSeason:false,standings:[],lastSeasonChampion:{name:"Ayrshire",you:true}},
    nation:{code:"SCO",name:"Scotland",candidates:[],yourPlace:1,selected:true,worldCups:[{season:2,players:["You","Blair Paterson"],you:true},{season:3,players:["Blair Paterson","Kieran Ross"],you:false}]}};
  const kinds=storyEngine(s).map(st=>st.kind);
  for(const k of ["club-champions","club-relegated","club-captain","county-selected","county-champions","nation-selected","nation-dropped"])assert.ok(kinds.includes(k),k);
  assert.ok(!kinds.includes("county-dropped"));
  const called=storyEngine(s).find(st=>st.kind==="nation-selected")!;
  assert.match(called.body,/represent Scotland at the World Cup of Darts in season 2, alongside Blair Paterson\./);
});
