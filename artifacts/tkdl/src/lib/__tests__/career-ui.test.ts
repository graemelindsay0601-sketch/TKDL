/**
 * A6 Career screen tests. Pages are loaded through Vite's SSR module loader (real
 * aliases, real components) and rendered to static markup with a React Query cache
 * pre-seeded from TEST-ONLY fixtures shaped like the real A1–A5 DTOs. Assertions are
 * about meaning (which facts/actions appear), never pixels.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {mkdirSync,writeFileSync,readFileSync,existsSync,readdirSync} from "node:fs";
import { createElement as h, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { legacy as projectLegacy, review as projectReview, zero } from "../../../../api-server/src/career/legacy/model.ts";
import type { Evidence } from "../../../../api-server/src/career/legacy/types.ts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer, type ViteDevServer } from "vite";
import { event, eventDetail, finance, human, overview, pathway, rankingMeta, row, save, SAVE_ID, sporting } from "./career-fixtures.ts";
import { FOCUSES, type GoalsView } from "../../../../api-server/src/career/goals/types.ts";
import { recognitionModel } from "../../../../api-server/src/career/recognition/model.ts";
import type { RecognitionView } from "../../../../api-server/src/career/recognition/types.ts";
import type { LifeView, Story } from "../../../../api-server/src/career/life/types.ts";
import {ORGANISATIONS,CIRCUIT_CONTENT,COUNTRY_CONTENT,REGIONS,CITIES,VENUE_CONTENT,VENUE_FAMILIES,TROPHIES,GUIDE,ALMANAC,SEASON_RHYTHM,PRESTIGE_CLASSES,venueContent} from "../../../../api-server/src/career/content/world.ts";
import {BRANDS} from "../../../../api-server/src/career/content/brands.ts";
import {identity} from "../../../../api-server/src/career/content/events.ts";
import {assessCapability} from "../../../../api-server/src/career/calendar/formats.ts";
import {catalogueFor} from "../../../../api-server/src/career/calendar/catalogue.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");
let vite: ViteDevServer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let M: Record<string, any> = {};
before(async () => {
  vite = await createServer({ root: ROOT, configFile: path.join(ROOT, "vite.config.ts"), logLevel: "error", appType: "custom",
    plugins:process.env.A9_BROWSER_DIR?[{name:"a9-test-only-auth",enforce:"pre",transform(_code,id){
      if(id.endsWith("/src/context/auth.tsx"))return `export function useAuth(){return {user:{id:1,playerId:1,username:"fixture",playerName:"Fixture Player",isAdmin:false,coins:250,avatar:null},loading:false,login:async()=>({ok:true}),logout:async()=>{},refresh:async()=>{}}} export function useCurrentPlayer(){return {playerId:1,playerName:"Fixture Player"}} export function AuthProvider({children}){return children}`;
    }}]:[],
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false } });
  const load = (p: string) => vite.ssrLoadModule(p);
   const [saves, home, rankings, qschool, finances, eventPage, history, shell, api, wouter, fetchMod, relationships, goals, recognition, life] = await Promise.all([
    load("/src/features/career/pages/saves.tsx"), load("/src/features/career/pages/home.tsx"), load("/src/features/career/pages/rankings.tsx"),
    load("/src/features/career/pages/q-school.tsx"), load("/src/features/career/pages/finances.tsx"), load("/src/features/career/pages/event.tsx"),
     load("/src/features/career/pages/history.tsx"), load("/src/features/career/shell.tsx"), load("/src/features/career/api.ts"), load("wouter"), load("/src/lib/api-fetch.ts"), load("/src/features/career/pages/relationships.tsx"), load("/src/features/career/pages/goals.tsx"), load("/src/features/career/pages/recognition.tsx"),load("/src/features/career/pages/life.tsx")]);
   M = { ...saves, ...home, ...rankings, ...qschool, ...finances, ...eventPage, ...history, ...shell, ...api, ...relationships, ...goals, ...recognition,...life,...(await load("/src/features/career/pages/legacy.tsx")),...(await load("/src/features/career/pages/world.tsx")),...(await load("/src/features/career/pages/tournament.tsx")),...(await load("/src/features/career/pages/my-career.tsx")),...(await load("/src/features/career/pages/world-hub.tsx")),...(await load("/src/features/career/identity.tsx")), Router: wouter.Router, ApiRequestError: fetchMod.ApiRequestError };
  Object.assign(M,await load("/src/features/career/components.tsx"),await load("/src/features/career/guidance.tsx"),await load("/src/features/career/pages/map.tsx"));
  if(process.env.A9_BROWSER_DIR){
    Object.assign(M,await load("/src/components/layout.tsx"),await load("/src/features/career/pages/calendar.tsx"));
    M.ordinary={};
    for(const [name,page] of [["hub","dashboard"],["standings","leaderboard"],["practice","practice"],["account","account"],["classic","tour"],["login","login"]]){
      M.ordinary[name]=(await load(`/src/pages/${page}.tsx`)).default;
    }
    M.TooltipProvider=(await load("/src/components/ui/tooltip.tsx")).TooltipProvider;
  }
});
after(async () => { await vite?.close(); });

const key = (...rest: unknown[]) => ["career", SAVE_ID, ...rest];
function render(el: ReactElement, seed: [unknown[], unknown][], at = `/career/${SAVE_ID}`, errors: [unknown[], unknown][] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, refetchOnMount: false, staleTime: Infinity } } });
  for (const [k, v] of seed) client.setQueryData(k, v);
  for (const [k, e] of errors) client.getQueryCache().build(client, { queryKey: k }).setState({ status: "error", error: e as Error, fetchStatus: "idle" });
  try{return renderToStaticMarkup(h(QueryClientProvider, { client }, h(M.Router, { ssrPath: at.split("?")[0],ssrSearch:at.includes("?")?at.slice(at.indexOf("?")):"" }, el)));}
  finally{client.clear();}
}
/** Optional browser evidence uses only seeded TEST fixtures and actual components. */
function browserScene(name:string,html:string) {
  if(process.env.A9_BROWSER_DIR){
    const out=process.env.A9_BROWSER_DIR;mkdirSync(out,{recursive:true});
    const assets=process.env.A83_CSS_DIR??"/tmp/tkdl-a9-styles/assets";
    const css=readdirSync(assets).filter(f=>f.endsWith(".css")).map(f=>readFileSync(path.join(assets,f),"utf8")).join("\n")+
      readFileSync(path.join(ROOT,"src/features/career/career.css"),"utf8");
    const markup=render(h(M.TooltipProvider,null,name==="login"?h("div",{style:{height:"100%"},dangerouslySetInnerHTML:{__html:html}}):
      h(M.Layout,null,h("div",{dangerouslySetInnerHTML:{__html:html}}))),[],name==="login"?"/login":["hub","standings","practice","account","classic"].includes(name)?name==="hub"?"/":name==="standings"?"/leaderboard":`/${name}`:`/career/${SAVE_ID}/${name}`);
    writeFileSync(path.join(out,`${name}.html`),`<!doctype html><html class="dark"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>A9 fixture: ${name}</title><style>${css}</style><body><div id="root">${markup}</div></body></html>`);
  }
  if(!process.env.A83_BROWSER_DIR)return;
  const out=process.env.A83_BROWSER_DIR;mkdirSync(out,{recursive:true});
  const assets=process.env.A83_CSS_DIR??path.join(ROOT,"dist/public/assets");
  const files=existsSync(assets)?readdirSync(assets).filter(f=>f.endsWith(".css")):[];
  const css=(files.length?files.map(f=>readFileSync(path.join(assets,f),"utf8")).join("\n"):"")+readFileSync(path.join(ROOT,"src/features/career/career.css"),"utf8");
  writeFileSync(path.join(out,`${name}.html`),`<!doctype html><html class="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A8.3 test fixture: ${name}</title><style>${css}</style><body style="background:#080c14;color:#e7edf5;margin:0"><div style="max-width:1180px;margin:auto;padding:16px">${html}</div></body></html>`);
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
const ctx = (s = save(), ov = overview()) => ({ save: s, overview: ov, retired: s.status === "RETIRED" });
// A8.2 presentation fixtures only; authoritative group/live/settlement tests live in the API suite.
function tournamentFixture(champion=false) {
  const entrant=(key:string,name:string)=>({key,name,nickname:null,nationality:"Scotland",ranking:null,titles:0,badges:[],
    source:"HUMAN_ENTRY",status:"LOCKED",seed:null,sponsors:[],shirt:{primaryColour:"#20334A",secondaryColour:"#FFFFFF",accentColour:"#C8A050"}});
  return {saveId:SAVE_ID,event:{id:"event",name:champion?"The Palace World Championship":"Community Open",level:champion?5:1,
    season:1,startDay:1,endDay:1,venue:null,venueFallback:{city:"London",country:"England"},drawLocked:true,fieldLocked:true,
    format:{inRule:"STRAIGHT",scoringUnit:champion?"SETS":"LEGS",legsPerSet:5},executable:true,
    trophy:champion?{name:"The Sovereign Trophy"}:null,qualificationOutputs:[],qSchool:null},
    phase:champion?"CHAMPION":"MATCH_READY",presentation:{mode:"QUICK",reducedMotion:true},
    depth:{arrival:false,drawReveal:false,walkOn:false,fullCeremony:false,animate:false,skippable:true,sportingEffects:false},
    field:[entrant("HUMAN","Fixture Player"),entrant("npc","Fixture Opponent")],routes:[],groups:[],opponents:[],
    matches:champion?[]:[{id:"match",stage_key:"main",round:1,slot:1,best_of:3,scheduled_day:1,a_key:"HUMAN",b_key:"npc",status:"AWAITING_HUMAN"}],
    nextMatchId:champion?null:"match",session:null,latestMatch:null,humanResult:champion?{wins:7,losses:0,matches_played:7}:null,
    results:[],groupBull:null,championKey:champion?"HUMAN":null,position:champion?1:null,
    money:{paid:champion,securedPence:0,prize:champion?{cash_award_pence:200000,ranking_eligible_pence:200000}:null,ledger:[]},
    achievements:{groupWinner:false,tournamentChampion:champion},readOnly:false};
}
test("A8.2 floor hub is quick, factual and offers explicit concession/withdrawal rather than browser-loss penalties",()=>{
  const t=text(render(h(M.TournamentPage,{ctx:ctx(),eventId:"event"}),[[key("tournament","event"),tournamentFixture()]]));
  assert.match(t,/Floor tournament/);assert.match(t,/Official draw locked/);assert.match(t,/Fixture Player vs Fixture Opponent/);
  assert.match(t,/Prepare match/);assert.match(t,/Concede this match/);assert.match(t,/Withdraw from tournament/);
  assert.match(t,/no sporting effects/);assert.doesNotMatch(t,/World Champion|Tournament Champion|Event arrival/);
});
test("A8.2 real Palace champion summary uses tall Sovereign silver trophy, settled A4 prize and recorded A3 statistics",()=>{
  const html=render(h(M.TournamentPage,{ctx:ctx(),eventId:"event"}),[[key("tournament","event"),tournamentFixture(true)]]);
  const t=text(html);
  assert.match(t,/World Champion · Sovereign Trophy/);assert.match(t,/7 wins · 0 losses · 7 played matches/);
  assert.match(t,/Prize settled: £2,000/);assert.match(t,/Ranking-eligible money: £2,000/);
  assert.match(html,/tall silver sculpture/);assert.doesNotMatch(html,/lucide-crown/);
});
test("A8.2 Home resume opens the saved tournament and explicitly preserves participation",()=>{
  const html=render(h(M.TournamentResume,{saveId:SAVE_ID}),[[key("tournaments"),{tournaments:[{eventId:"event",name:"Saved Vault Nights",level:3}]}]]);
  assert.match(text(html),/Resume Saved Vault Nights/);assert.match(text(html),/Leaving a screen never withdraws you/);
  assert.match(html,new RegExp(`/career/${SAVE_ID}/tournaments/event`));
});
const lifeFixture=():LifeView=>({careerSaveId:SAVE_ID,retired:false,profile:{
  persona:{label:"Reserved",primary:"RESERVED",secondary:null,description:"Actual choices; no sporting modifier."},
  awareness:"Major darts star",reception:"Positive",draw:"Strong",
  commercial:{demand:"Strong sporting demand",activity:"Choosing quiet off-board life",description:"Optional work; not a prize reward."}},
  news:[],threads:[],moments:[],opportunities:[],history:[],commitments:[],relationshipTones:[],
  merchandise:{demand:"Strong sporting demand",incomePence:0,agreement:null,royaltyPence:null,offerRoyaltyPence:7500,canOptIn:true,canStop:false},
  commercialIncomePence:0,notes:["Persona and sporting recognition remain separate."]});
test("A7.5 profile preserves reserved sporting fame and separates awareness/reception/draw/commercial activity",()=>{
  const d=lifeFixture(),html=render(h(M.LifePage,{ctx:ctx()}),[[key("life"),d]]),t=text(html);
  for(const label of ["Reserved","Major darts star","Positive","Strong","Choosing quiet off-board life","Narrative relationship tone"])assert.ok(t.includes(label),label);
  assert.doesNotMatch(t,/Follower count|Spend reputation|Upgrade ability/);
  assert.match(html,/News &amp; Story Threads/);
});
test("A7.5 actual moment choices render four contextual answers, never sliders or editable numerical rewards",()=>{
  const d=lifeFixture();d.moments=[{id:"moment",storyId:"moment",title:"The Palace",kind:"DIALOGUE",prompt:"What would you say?",steps:["Actual world draw"],thread:"palace",statementFamily:"palace",
    choices:[{id:"PROFESSIONAL",text:"Take it match by match."},{id:"RESERVED",text:"Let the darts do the talking."},{id:"CONFIDENT",text:"I can compete here."},{id:"FIERY",text:"I am here to make this difficult."}]}];
  const html=render(h(M.LifePage,{ctx:ctx()}),[[key("life"),d]]),t=text(html);
  for(const c of d.moments[0].choices)assert.ok(t.includes(c.text));
  assert.doesNotMatch(html,/<input|type="range"/);assert.match(t,/Actual world draw/);
});
test("A7.5 opportunities preview the agreed fee/day, honest conflicts, optional decline and royalty terms",()=>{
  const d=lifeFixture();d.opportunities=[{id:"opp",family:"EXHIBITION",title:"Darts exhibition",description:"One agreed full-day commitment",season:1,day:22,feePence:7500,contractId:null,compatibility:"Reserved presentation welcomed",conflicts:["County Final"],canAccept:false}];
  const html=render(h(M.LifePage,{ctx:ctx(),initialTab:"Opportunities"}),[[key("life"),d]]),t=text(html);
  assert.match(t,/day 22.*£75/);assert.match(t,/Calendar conflict: County Final/);assert.match(t,/Decline/);
  assert.match(html,/disabled=""[^>]*>Accept commitment/);assert.match(t,/Royalty terms: £75/);
  assert.match(t,/never prize earnings or a separate wallet|no past royalties are invented/);
});
test("A7.5 retired history stays readable without new decision/acceptance/merchandise actions",()=>{
  const d=lifeFixture();d.retired=true;d.merchandise.canOptIn=false;d.merchandise.canStop=false;
  d.history=[{id:"old",kind:"DIALOGUE",choice:"RESERVED",season:1,week:4,data:{}}];
  const t=text(render(h(M.LifePage,{ctx:ctx(save({status:"RETIRED"})),initialTab:"History"}),[[key("life"),d]]));
  assert.match(t,/Retired Career/);assert.match(t,/S1 W4.*reserved/);assert.doesNotMatch(t,/Accept commitment|Stop future merchandise royalties/);
});
test("A7.5 public world news and thread callbacks retain factual sources and real earlier statement links",()=>{
  const d=lifeFixture(),story:Story={id:"story",kind:"world-title",scope:"WORLD",significance:"NEWS",title:"Public opponent wins",body:"A recorded major result.",season:2,week:5,day:29,date:null,eventId:"event",
    thread:"world:npc",sourceIds:["result:event:npc"],callbacks:[{text:"You previously said: let the darts do the talking.",sourceIds:["decision:actual"]}]};
  d.news=[story];d.threads=[{id:story.thread,title:"A public darts Career",stories:[story]}];
  for(const initialTab of ["News","Story Threads"]) {
    const t=text(render(h(M.StoriesPage,{ctx:ctx(),initialTab}),[[key("life"),d]]));
    assert.match(t,/Public opponent wins/);assert.match(t,/You previously said/);assert.match(t,/decision:actual/);assert.match(t,/result:event:npc/);
  }
});
test("A7.5 public NPC identity exposes only presentation and sporting standing, with separate recognition link",()=>{
  const data={careerSaveId:SAVE_ID,id:"npc",name:"Public Opponent",retired:false,personality:{primary:"FIERY",secondary:"INTENSE"},standing:"Professional contender",publicDraw:"Strong",notes:"No hidden sporting attributes."};
  const html=render(h(M.NpcLifePage,{ctx:ctx(),npcId:"npc"}),[[key("life","npc","npc"),data]]);
  assert.match(text(html),/Public Opponent.*Professional contender.*fiery \/ intense/);assert.match(html,/recognition\/npcs\/npc/);
  assert.doesNotMatch(html,/currentAbility|potential|bankAccount|followerCount/);
});
const homeSeed = (s: ReturnType<typeof save>, events: ReturnType<typeof event>[], sp = sporting("UNRANKED_AMATEUR"), fin = finance()): [unknown[], unknown][] => [
  [key("sporting"), sp], [key("finance"), fin], [key("history", { participant: "HUMAN" }), []],
  [key("tournaments"),{tournaments:[]}],[key("legacy"),projectLegacy(legacyEvidence(),[],[],null)],
  [key("calendar", { scope: "WORLD", fromWeek: Math.max(1,s.currentWeek-2), toWeek: Math.min(52, s.currentWeek + 8) }), { overview: overview({ week: s.currentWeek }), season: 1, scope: "WORLD", events }],
];

const goalsFixture=():GoalsView=>({careerSaveId:SAVE_ID,focus:"OPEN_SCHEDULE",focusOptions:Object.entries(FOCUSES).map(([value,d])=>({value:value as GoalsView["focus"],...d})),
  activeLimit:5,retired:false,goals:[],options:[{definition:{type:"WIN_TITLE"},label:"Win a Career title"}],
  context:{currentRank:null,holdsCard:false,earningsPence:0},opportunities:[]});
const recognitionFixture=(elite=false):RecognitionView=>({careerSaveId:SAVE_ID,subject:{kind:"HUMAN",id:"HUMAN",name:"Your Career",retired:false},relationships:[],
  ...recognitionModel({appearances:[],qualifications:[],cards:[],rankings:[],results:elite ? Array.from({length:4},(_,i)=>({
    fact:{id:`title-${i}`,source:"A3 event result",label:`National amateur title ${i+1}`,season:1,day:7,week:1,date:"2026-01-07",age:20,eventId:`event-${i}`},
    circuit:"NATIONAL_AMATEUR",classification:"RANKING",tier:"STANDARD",international:false,champion:true,stageReached:"CHAMPION"})) : []})});
test("A7.4 Recognition: elite amateur standing, independent contexts, factual evidence/history and no meters/scores",()=>{
  const data=recognitionFixture(true),html=render(h(M.RecognitionPage,{ctx:ctx()}),[[key("recognition"),data]]),t=text(html);
  for(const s of ["Elite amateur","Local","Amateur","Professional","Major / Stage","International","Why you're recognised","National amateur title","2026-01-07","Age 20","A3 event result","Recent recognition milestones"])assert.ok(t.includes(s),s);
  assert.match(t,/turning professional is optional/);assert.match(t,/Focus and personal goals do not grant recognition/);
  assert.ok(html.includes(`/career/${SAVE_ID}/events/event-0`));
  assert.doesNotMatch(html,/<progress|role="progressbar"|\d+\/100/);
  assert.doesNotMatch(t,/reputation points|XP|potential|current ability|level up|fame currency/i);
});
test("A7.4 empty and retired Recognition remain meaningful, readable and without mutation controls",()=>{
  const data=recognitionFixture(),empty=text(render(h(M.RecognitionPage,{ctx:ctx()}),[[key("recognition"),data]]));
  assert.match(empty,/Building a sporting record/);assert.match(empty,/No qualifying sporting evidence/);assert.match(empty,/No dated recognition milestones/);
  data.subject.retired=true;
  const retired=text(render(h(M.RecognitionPage,{ctx:ctx(save({status:"RETIRED"}))}),[[key("recognition"),data]]));
  assert.match(retired,/Retired Career/);assert.match(retired,/creates no further progression/);assert.doesNotMatch(retired,/Enter event|Select goal|Spend|Upgrade/);
});
test("A7.4 Hub summary limits badges to strongest contexts and history renders only sourced milestone dates",()=>{
  const data=recognitionFixture(true),summary=render(h(M.RecognitionSummary,{saveId:SAVE_ID}),[[key("recognition"),data]]);
  assert.match(text(summary),/Career standing.*Elite amateur/);assert.ok(summary.includes(`/career/${SAVE_ID}/recognition`));
  assert.doesNotMatch(text(summary),/Professional ·|Major \/ Stage ·|International ·/);
  const history=text(render(h(M.RecognitionTimeline,{saveId:SAVE_ID}),[[key("recognition"),data]]));
  assert.match(history,/Recognition threshold history/);assert.match(history,/Amateur recognition — Elite/);assert.match(history,/2026-01-07/);
  const home=text(render(h(M.MyCareerPage,{ctx:ctx()}),[...homeSeed(save(),[]),[key("recognition"),data]]));
  assert.match(home,/Career standing.*Elite amateur/);
});
test("A7.4 on-demand NPC Recognition and relationship links expose public sporting evidence only",()=>{
  const data=recognitionFixture(true);data.subject={kind:"NPC",id:"public-npc",name:"Public Opponent",retired:true};
  const html=render(h(M.RecognitionPage,{ctx:ctx(),npcId:"public-npc"}),[[key("recognition","npc","public-npc"),data]]);
  assert.match(text(html),/Public opponent recognition/);assert.match(text(html),/Public Opponent/);assert.match(text(html),/Retired player/);
  assert.ok(html.includes(`/career/${SAVE_ID}/relationships`));assert.doesNotMatch(text(html),/potential|ability|development score/i);
});
test("A7.4 loading/error and week-precision milestones never imply an exact sporting date",()=>{
  assert.match(text(render(h(M.RecognitionPage,{ctx:ctx()}),[])),/Reading sporting recognition/);
  assert.match(text(render(h(M.RecognitionPage,{ctx:ctx()}),[],undefined,[[key("recognition"),new Error("Recognition unavailable")]])),/Recognition unavailable/);
  const data=recognitionFixture(true);
  data.milestones[0]={...data.milestones[0],precision:"WEEK",week:3,day:null,date:null,age:null};
  const t=text(render(h(M.RecognitionTimeline,{saveId:SAVE_ID}),[[key("recognition"),data]]));
  assert.match(t,/S1 · W3/);assert.doesNotMatch(t,/2026-01-07|Age 20/);
});
test("A7.3 optional focus/goals render guidance, an unrestricted calendar link, contextual choices and empty state",()=>{
  const data=goalsFixture();
  const html=render(h(M.GoalsPage,{ctx:ctx()}),[[key("goals"),data]]);
  const t=text(html);
  assert.match(t,/Optional sporting ambitions, not quests/);assert.match(t,/Every eligible pathway remains available/);
  for (const f of Object.values(FOCUSES)) assert.ok(t.includes(f.label));
  assert.match(t,/No active goals/);assert.match(t,/No matching upcoming opportunity/);assert.match(t,/Select goal/);
  assert.ok(html.includes(`/career/${SAVE_ID}/calendar`));assert.match(t,/no penalty/i);
});
test("A7.3 recommendations retain exact costs, eligibility blockers and event links; completions show evidence/date/age",()=>{
  const data=goalsFixture();data.focus="PRIZE_MONEY";data.context.currentRank=81;
  data.opportunities=[{id:"event-1",name:"Regional Open",season:1,startDay:7,circuit:"REGIONAL",classification:"RANKING",tier:"LOCAL",status:"REGISTRATION_OPEN",
    eligible:true,canEnter:false,denials:["INSUFFICIENT_FUNDS"],relationship:"NONE",majorRoute:false,firstPrizePence:1000000,estimatedCostPence:10000,
    registration:{opensWeek:1,closesWeek:1},reason:"Published first prize and estimated costs; winning and profit are not guaranteed"}];
  data.goals=[{id:"goal-1",definition:{type:"WIN_TITLE"},label:"Win a Career title",status:"COMPLETED",created:{season:1,week:1},
    progress:{current:1,target:1,unit:"achievement",note:null},completion:{id:"result:one",source:"A3 event result",label:"Regional Open",season:1,day:7,week:1,date:"2026-01-07",age:20,eventId:"event-1"}}];
  const html=render(h(M.GoalsPage,{ctx:ctx()}),[[key("goals"),data]]),t=text(html);
  assert.match(t,/INSUFFICIENT_FUNDS/);assert.match(t,/not guaranteed/);assert.match(t,/10,000/);assert.match(t,/£100 estimated Career cost/);
  assert.match(t,/World ranking: #81/);assert.match(t,/2026-01-07/);assert.match(t,/Age 20/);assert.match(t,/A3 event result/);
  assert.ok(html.includes(`/career/${SAVE_ID}/events/event-1`));
  assert.doesNotMatch(t,/XP awarded|skill points|loot|level up/i);
});
test("A7.3 retired Careers retain readable goals/focus but no new-goal or abandon actions; Home has a compact summary",()=>{
  const data=goalsFixture();data.retired=true;
  data.goals=[{id:"pending",definition:{type:"WIN_TITLE"},label:"Win a Career title",status:"ACTIVE",created:{season:1,week:1},
    progress:{current:0,target:1,unit:"achievement",note:"Career retired; no further sporting progress."},completion:null}];
  const html=render(h(M.GoalsPage,{ctx:ctx(save({status:"RETIRED"}))}),[[key("goals"),data]]),t=text(html);
  assert.match(t,/Retired Career/);assert.match(t,/no further sporting progress/);
  assert.doesNotMatch(t,/Select goal|Abandon without penalty/);assert.match(html,/<select[^>]*disabled/);
  const summary=text(render(h(M.GoalsSummary,{saveId:SAVE_ID}),[[key("goals"),data]]));
  assert.match(summary,/Open Schedule/);assert.match(summary,/1 active goals/);assert.match(summary,/Win a Career title/);assert.match(summary,/Manage/);
});

test("A7.2 relationships render factual retired identity, H2H, cohorts, meetings, world context and no gameplay effects",()=>{
  const player={id:"fictional",name:"Fictional Opponent",nationality:"GBR",homeRegion:"Ayrshire",age:65,startingAge:20,createdSeason:1,retiredSeason:8,status:"RETIRED",worldRanking:null};
  const meeting={id:"m1",opponentId:player.id,eventId:"event-one",name:"Fictional Final",season:2,day:7,date:"2027-01-06",round:4,stage:"MAIN",won:true,final:true,major:true,qualification:false,legsHuman:6,legsNpc:3,setsHuman:null,setsNpc:null,humanAge:21};
  const opponent={player,labels:["Career Rival","Q-School Class"],evidence:["Repeated competitive meetings."],meetings:6,humanWins:4,npcWins:2,winPercentage:66.67,eventCount:6,seasonCount:2,finals:1,majorMeetings:1,qualificationMeetings:0,firstMeeting:meeting,latestMeeting:meeting,history:[meeting],cohorts:[{opponentId:player.id,kind:"Q-School Class",season:1,session:"q-school-first-uk",name:"UK first session"}]};
  const data={careerSaveId:SAVE_ID,opponents:[opponent],world:{players:[player],active:0,retired:1,newEntrants:0,youngPlayers:0,youngAgeMaximum:23}};
  const html=render(h(M.RelationshipsPage,{ctx:ctx(save({status:"RETIRED"}))}),[[key("relationships"),data]]);
  const t=text(html);
  for (const s of ["Fictional Opponent","H2H 4–2","66.67% wins","Career Rival","Q-School Class","Retired (season 8)","No current World Ranking","Legs 6–3","Fictional Final","never change scoring","Career generations"]) assert.ok(t.includes(s),s);
  assert.ok(html.includes(`/career/${SAVE_ID}/events/event-one`));
  assert.ok(!/Rivalry Score|Potential|Current ability/.test(t));
  const empty=text(render(h(M.RelationshipsPage,{ctx:ctx()}),[[key("relationships"),{...data,opponents:[],world:{...data.world,players:[]}}]]));
  assert.ok(empty.includes("No opponent history here yet"));
});

// ---------------------------------------------------------------- saves
test("save selection: three slots, empty slot, archive and lifecycle actions", () => {
  const list = { slots: [{ slotNumber: 1, career: save({ careerName: "Progressed", professionalRanking: 42, hasTourCard: true, sponsor: "Ochre Darts Co." }) },
    { slotNumber: 2, career: save({ id: "22222222-2222-4222-8222-222222222222", slotNumber: 2, careerName: "Fresh" }) }, { slotNumber: 3, career: null }],
    archived: [save({ id: "33333333-3333-4333-8333-333333333333", careerName: "Old Career", status: "RETIRED", retiredAt: "2026-10-04", slotNumber: 3 })] };
  const t = text(render(h(M.SavesPage), [[["career", "saves"], list]], "/career"));
  for (const s of ["Slot 1", "Slot 2", "Slot 3", "Empty slot", "New Career", "Progressed", "42nd", "Ochre Darts Co.", "Unranked", "Self-funded", "Old Career", "View record", "Retired archive"]) assert.ok(t.includes(s), s);
  assert.equal((t.match(/Continue/g) ?? []).length, 2, "Continue on each active slot only");
  for (const s of ["Restart", "Retire", "Delete"]) assert.ok(t.includes(s), s);
  assert.ok(t.includes("Classic Tour / Trophy Hunt"), "Career is presented as separate from Classic Tour");
});

test("save selection: feature-gated 404 shows an honest unavailable state", () => {
  const t = text(render(h(M.SavesPage), [], "/career", [[["career", "saves"], new M.ApiRequestError("Career not available", 404, "/api/career/saves")]]));
  assert.ok(t.includes("Career is not available yet"), t.slice(0, 600));
});

// ---------------------------------------------------------------- home
test("Career Home, new amateur: unranked, no Tour Card, self-funded, affordable Enter", () => {
  const s = save();
  const t = text(render(h(M.HomePage, { ctx: ctx(s) }), homeSeed(s, [event({ name: "Newcastle Friday Night 501" })])));
  for (const x of ["Next Up","Newcastle Friday Night 501", "Enter · £65", "Unranked", "No Tour Card", "Self-funded", "£250", "No entered commitments", "No results yet"]) assert.ok(t.includes(x), x);
});

test("Career Home: unaffordable next event says Cannot afford and offers no Enter", () => {
  const s = save();
  const e = event({ name: "Vault Qualifier", human: human({ canEnter: false, denials: ["INSUFFICIENT_FUNDS"] }), finance: { affordable: false, estimatedPlayerCostPence: 69000 } });
  const html = render(h(M.HomePage, { ctx: ctx(s) }), homeSeed(s, [e]));
  assert.ok(text(html).includes("Cannot afford"));
  assert.ok(!/>\s*Enter/.test(html), "no Enter button");
});

test("Career Home, ranked professional with sponsor and a pending match: real figures and the live Play match action (A6.5)", () => {
  const s = save({ currentWeek: 12, professionalRanking: 42, hasTourCard: true });
  const live = event({ name: "Pro Circuit Championship 9", status: "IN_PROGRESS", dates: { startWeek: 12, startDay: 79 }, human: human({ relationship: "PLAYING", canEnter: false }) });
  const seed = homeSeed(s, [live], sporting("RANKED_PRO"), finance({ balancePence: 1469000, sponsor: { contractId: "c", sponsorKey: "ochre", displayName: "Ochre Darts Co.", tier: "REGIONAL", endSeason: 1, endWeek: 52 } }));
  const calendarIndex=seed.findIndex(([k])=>k[2]==="calendar");
  seed[calendarIndex] = [seed[calendarIndex][0], { overview: overview({ week: 12, pendingHumanMatches: [{ matchId: "m1", eventId: live.id }] }), season: 1, scope: "WORLD", events: [live] }];
  seed.push([key("event", live.id), eventDetail(live, { human: { nextMatch: { id: "m1", stage: "main", round: 1, roundName: "LAST_128", slot: 31, bestOf: 11, scheduledDay: 79,
    a: { key: "HUMAN", name: "You" }, b: { key: "npc", name: "Arno Auenberg" }, status: "AWAITING_HUMAN", winnerKey: null, legs: null, firstThrow: null, firstThrowMethod: "BULL_UP", resultSource: null, summary: null }, result: null } })]);
  const html = render(h(M.HomePage, { ctx: ctx(s, overview({ week: 12, pendingHumanMatches: [{ matchId: "m1", eventId: live.id }] })) }), seed);
  const t = text(html);
  for (const x of ["42nd", "£14,690", "Active", "Ochre Darts Co.", "Your match is waiting", "Play match"]) assert.ok(t.includes(x), x);
  // A8.2 adds preparation before the same A6.5 session; never a client-reported result.
  assert.match(html, new RegExp(`href="/career/${SAVE_ID}/tournaments/${live.id}/matches/m1"`), "Play match opens preparation for the same live Career session");
  assert.ok(!t.includes("not connected yet"), "no stale A6 boundary copy");
});

test("retired Career Home is read-only: no next-event hero, no Enter, no Continue", () => {
  const s = save({ status: "RETIRED", retiredAt: "2026-10-04T05:39:45Z" });
  const html = render(h(M.HomePage, { ctx: ctx(s) }), homeSeed(s, [event()]));
  const t = text(html);
  assert.ok(t.includes("Career record")||t.includes("Career record".replace("record","Record")));assert.ok(t.includes("Retired"));
  assert.ok(!/>\s*Enter/.test(html));
  assert.ok(!t.includes("Open for entry"));
});

test("retired Career shell shows the read-only notice and no advance control", () => {
  const s = save({ status: "RETIRED", retiredAt: "2026-10-04" });
  const t = text(render(h(M.CareerShell, { saveId: SAVE_ID, children: () => h("p", null, "child") }),
    [[key("save"), s], [key("calendar", { scope: "WORLD", fromWeek: 1, toWeek: 1 }), { overview: overview(), season: 1, scope: "WORLD", events: [] }]]));
  assert.ok(t.includes("This Career is retired"));
  assert.ok(!t.includes("Continue"));
  assert.ok(t.includes("child"));
});

// ---------------------------------------------------------------- rankings
test("Rankings default to Around Me, highlight the human and draw A5 cut lines", () => {
  const meta = rankingMeta();
  const rows = [30, 31, 32, 33, 42].map(p => p === 42 ? row(42, { participantKey: "HUMAN", kind: "HUMAN", name: null, nationality: null, movement: -3 }) : row(p, { movement: 2 }));
  const html = render(h(M.RankingsPage, { ctx: ctx() }), [[key("ranking-lists"), [meta]],
    [key("ranking", "pro-world", { view: "AROUND", participant: "HUMAN", radius: 6 }), { list: "pro-world", name: "World Ranking", view: "AROUND", published: meta.published, participant: { key: "HUMAN", position: 42 }, rows }],
    [key("ranking-history", "pro-world", "HUMAN", 12), { list: "pro-world", participantKey: "HUMAN", careerHigh: { position: 20, publicationIndex: 6 }, seasonHighs: [], snapshots: [] }]]);
  const t = text(html);
  assert.match(html, /aria-pressed="true"[^>]*>Around me/);
  assert.match(html, /data-me="true"/);
  assert.ok(t.includes("Top 32 cut"), "cut line after position 32");
  for (const x of ["42nd", "Top 32", "£3,000 behind", "Player 30"]) assert.ok(t.includes(x), x);
  assert.ok(!/ability|potential/i.test(t), "no hidden NPC attributes");
});

test("Rankings for an unranked player default to the top of the table", () => {
  const meta = rankingMeta({ human: { ranked: false, standing: null, careerHighPosition: null, seasonHighPosition: null, cutLines: [] } });
  const t = text(render(h(M.RankingsPage, { ctx: ctx() }), [[key("ranking-lists"), [meta]],
    [key("ranking", "pro-world", { view: "TOP", limit: 32 }), { list: "pro-world", name: "World Ranking", published: meta.published, participant: null, rows: [row(1), row(2)] }]]));
  assert.ok(t.includes("Unranked"));
  assert.ok(!t.includes("Around me"));
});

// ---------------------------------------------------------------- Q-School
test("Q-School shows pathways, standing vs card line and an unmistakable Tour Card result", () => {
  const uk = pathway({ finalStage: { days: 4, completed: 4, dayWinners: [{ day: 1, status: "COMPLETED", winner: "HUMAN" }] },
    participant: { firstStage: [{ day: 1, position: 1 }], finalStageEntry: { route: "EVENT_RESULT", detail: null }, wonDay: [1], orderOfMerit: { position: 10, contenderPosition: 0, points: 9, insideCardLine: true } },
    standings: [{ participantKey: "npc", position: 1, points: 16, bestDayFinish: 1, scoringDays: 4, name: "Callan Thistledown", dayWinner: true },
      { participantKey: "HUMAN", position: 10, points: 9, bestDayFinish: 1, scoringDays: 2, name: "You", dayWinner: true }],
    allocation: { allocatedWeek: 3, directCards: 4, unusedDirectCards: 0, orderOfMeritCards: 10, awards: [{ participantKey: "HUMAN", name: "You", route: "DIRECT", day: 1, orderOfMeritPosition: null, points: 9, cardId: "c" }] } });
  const eu = pathway({ pathway: "EUROPE", cardLine: { orderOfMeritCards: 6, valueAtLinePoints: 9 } });
  const t = text(render(h(M.QSchoolPage, { ctx: ctx() }), [[key("q-school", 1), { season: 1, participantKey: "HUMAN", tieBreaks: ["POINTS_DESC"], pathways: [uk, eu] }],
    [key("calendar", { scope: "WORLD", season: 1, circuit: "Q_SCHOOL" }), { overview: overview(), season: 1, scope: "WORLD", events: [] }]]));
  for (const x of ["UK & Ireland · yours", "Europe", "Tour Card won — Final Stage Day 1 winner", "Not a contender — card already won", "Callan Thistledown", "Day winner — card", "Order of Merit"]) assert.ok(t.includes(x), x);
});

test("Q-School before any participation: Not entered, outside-the-pathway facts only", () => {
  const t = text(render(h(M.QSchoolPage, { ctx: ctx() }), [[key("q-school", 1), { season: 1, participantKey: "HUMAN", tieBreaks: [], pathways: [pathway(), pathway({ pathway: "EUROPE" })] }],
    [key("calendar", { scope: "WORLD", season: 1, circuit: "Q_SCHOOL" }), { overview: overview(), season: 1, scope: "WORLD", events: [] }]]));
  assert.ok(t.includes("Not entered"));
  assert.ok(t.includes("No Final Stage results yet"));
  assert.ok(!t.includes("Tour Card result"));
});

// ---------------------------------------------------------------- finance
test("Finances: four separate headline figures, sponsor terms and no money-buying actions", () => {
  const terms = { sponsorKey: "ochre", displayName: "Ochre Darts Co.", tier: "REGIONAL", duration: { kind: "REMAINDER_OF_SEASON" }, signingBonusPence: 50000, eventPayment: null,
    coverage: [{ costTypes: ["ENTRY_FEE"], percent: 100, perEventCapPence: 5000, seasonCapPence: null, circuits: null }], performanceBonuses: [], renewalRequirement: null, retentionRequirement: null, presentation: { colour: "#c08a3e" } };
  const html = render(h(M.FinancesPage, { ctx: ctx() }), [
    [key("finance"), finance({ balancePence: 1469000, careerEarningsPence: 1200000, sponsorEarningsPence: 95000, careerExpensesPence: 351000 })],
    [key("sponsors"), { active: { id: "c", sponsorKey: "ochre", tier: "REGIONAL", terms, status: "ACTIVE", endReason: null, start: { season: 1, week: 2 }, end: { season: 1, week: 52 }, totals: { paidPence: 95000, coveredPence: 35000 } },
      offers: [{ id: "o1", sponsorKey: "iron", tier: "PROFESSIONAL", kind: "NEW", terms: { ...terms, displayName: "Ironflight" }, status: "OFFERED", statusReason: null, offered: { season: 1, week: 5 }, expires: { season: 1, week: 9 } }],
      history: { contracts: [], offers: [] } }],
    [key("calendar", { scope: "MY_SCHEDULE", season: 1 }), { overview: overview(), season: 1, scope: "MY_SCHEDULE", events: [] }],
    [key("ledger", 25, null), { entries: [{ id: "l1", category: "PRIZE", headline: "INCOME", amountPence: 150000, direction: "CREDIT", season: 1, week: 10, eventId: null, grossAmountPence: null, sponsorCoveredPence: 0, reason: "Prize money — Pro Circuit Championship 8", createdAt: "x" }], next: null }]]);
  const t = text(html);
  for (const x of ["Balance", "£14,690", "Career Earnings", "£12,000", "Sponsor Earnings", "£950", "Career Expenses", "£3,510", "Ochre Darts Co.", "Signing bonus £500", "Ironflight", "Accept", "Decline", "+£1,500"]) assert.ok(t.includes(x), x);
  assert.ok(!/coins?|buy|loan|debt|bet/i.test(t.replace(/Accept|Decline/g, "")), "no coin conversion, purchase, loan, debt or betting");
});

test("Finances: no sponsor and no offers are explicit empty states", () => {
  const t = text(render(h(M.FinancesPage, { ctx: ctx() }), [[key("finance"), finance()], [key("sponsors"), { active: null, offers: [], history: { contracts: [], offers: [] } }],
    [key("calendar", { scope: "MY_SCHEDULE", season: 1 }), { overview: overview(), season: 1, scope: "MY_SCHEDULE", events: [] }], [key("ledger", 25, null), { entries: [], next: null }]]));
  for (const x of ["Self-funded", "No offers right now", "No upcoming commitments", "No transactions on this page"]) assert.ok(t.includes(x), x);
});

// ---------------------------------------------------------------- event
test("unsupported pairs event is explicitly benched, with no Enter and no fabricated draw", () => {
  const wc = event({ name: "Pub Doubles", status: "CANCELLED", capability: { executable: false, code: "UNSUPPORTED_FORMAT", reasons: ["PAIRS"] },
    format: { sideSize: 2, scoringUnit: "LEGS", stages: [{ key: "main", kind: "KNOCKOUT", bestOfByRound: [3, 5] }] }, human: human({ canEnter: false, denials: ["UNSUPPORTED_FORMAT"] }) });
  const html = render(h(M.EventView, { ctx: ctx(), detail: eventDetail(wc) }), []);
  const t = text(html);
  for (const x of ["Intentionally benched", "no entry, field, draw or invented result"]) assert.ok(t.includes(x), x);
  assert.ok(!/>\s*Enter/.test(html));
  assert.ok(!t.includes(">Draw<") && !/aria-pressed="false"[^>]*>Draw</.test(html), "no Draw tab without a persisted draw");
});

test("entered event offers Withdraw; completed event shows the persisted result", () => {
  const entered = event({ human: human({ relationship: "ENTERED", canEnter: false, entryStatus: "ENTERED", denials: ["ALREADY_ENTERED"] }) });
  assert.ok(text(render(h(M.EventView, { ctx: ctx(), detail: eventDetail(entered) }), [])).includes("Withdraw"));
  const done = event({ status: "COMPLETED", human: human({ relationship: "COMPLETED", canEnter: false, result: { finishingPosition: 2, stageReached: "FINAL", champion: false } }) });
  const t = text(render(h(M.EventView, { ctx: ctx(), detail: eventDetail(done, { results: [
    { participantKey: "npc", name: "Callan Thistledown", position: 1, stageReached: "CHAMPION", champion: true, wins: 5, losses: 0, legsFor: 25, legsAgainst: 9 },
    { participantKey: "HUMAN", name: "You", position: 2, stageReached: "FINAL", champion: false, wins: 4, losses: 1, legsFor: 20, legsAgainst: 15 }] }) }), []));
  for (const x of ["Callan Thistledown", "Runner-up", "4W 1L"]) assert.ok(t.includes(x), x);
  assert.ok(!t.includes("Withdraw"));
});

// ---------------------------------------------------------------- history
test("Trophy room is Career-only and states its separation from the Classic Tour trophies", () => {
  const won = [{ eventId: "e1", season: 1, name: "Kilbirnie Friday Night 501", definitionKey: "k", circuit: "GRASSROOTS", classification: "RANKING", presentationTier: "LOCAL", week: 3,
    country: "GBR", participantKey: "HUMAN", position: 1, stageReached: "CHAMPION", champion: true, wins: 5, losses: 0 }];
  const t = text(render(h(M.HistoryPage, { ctx: ctx(), initialTab: "TROPHIES" }), [[key("facts"), { results: won }]]));
  assert.ok(t.includes("Kilbirnie Friday Night 501"));
  assert.ok(t.includes("Separate from the Classic Tour's 305 Trophy Hunt trophies"));
  const empty = text(render(h(M.HistoryPage, { ctx: ctx(), initialTab: "TROPHIES" }), [[key("facts"), { results: [] }]]));
  assert.ok(empty.includes("The cabinet is empty"));
});

// ---------------------------------------------------------------- mutations (real endpoints, mocked transport)
test("every Career mutation hits the real A1–A5 endpoint with the right method and body", async () => {
  const calls: { url: string; method: string; body: unknown }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined });
    if (init.method === "DELETE" && /\/saves\/[^/]+$/.test(url)) return new Response(null, { status: 204 });
    const payload = /\/saves$|restart$/.test(url) ? { id: "new-save" } : { ok: true, entered: true, withdrawn: true, denials: [] };
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const r = M.careerRequests;
    await r.enter("s", "e"); await r.withdraw("s", "e"); await r.acceptOffer("s", "o"); await r.declineOffer("s", "o");
    await r.advance("s", { season: 1, week: 12, target: { kind: "NEXT_MEANINGFUL" } }, "ui-fixed-key");
    assert.equal((await r.create({ slot: 3, careerName: "New" })).id, "new-save");
    assert.equal((await r.restart("s")).id, "new-save", "restart adopts the NEW save id");
    await r.retire("s"); assert.equal(await r.remove("s"), null);
    assert.deepEqual(calls.map(c => `${c.method} ${c.url}`), [
      "POST /api/career/saves/s/events/e/entry", "DELETE /api/career/saves/s/events/e/entry",
      "POST /api/career/saves/s/sponsors/offers/o/accept", "POST /api/career/saves/s/sponsors/offers/o/decline",
      "POST /api/career/saves/s/calendar/advance",
      "POST /api/career/saves", "POST /api/career/saves/new-save/initialize",
      "POST /api/career/saves/s/restart", "POST /api/career/saves/new-save/initialize",
      "POST /api/career/saves/s/retire", "DELETE /api/career/saves/s"]);
    assert.deepEqual(calls[4].body, { operationKey: "ui-fixed-key", expectedSeason: 1, expectedWeek: 12, target: { kind: "NEXT_MEANINGFUL" } });
    assert.deepEqual(calls[5].body, { slot: 3, careerName: "New" });
    assert.deepEqual(calls[9].body,{confirmation:"RETIRE CAREER"});
    assert.ok(!Object.keys(r).some(k => /result|score|record/i.test(k)), "no client path to report a human match result");
  } finally { globalThis.fetch = original; }
});

test("Career delete rejects on HTTP errors and network failures instead of reporting success", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: "Career save not found" }), { status: 404 })) as typeof fetch;
    await assert.rejects(M.careerRequests.remove("s"), (e: { status?: number; message?: string }) => e.status === 404 && e.message === "Career save not found");
    globalThis.fetch = (async () => { throw new TypeError("network down"); }) as typeof fetch;
    await assert.rejects(M.careerRequests.remove("s"), /network down/);
  } finally { globalThis.fetch = original; }
});
const legacyEvidence=():Evidence=>({saveId:SAVE_ID,currentSeason:2,currentWeek:1,retired:false,
  players:[{id:"HUMAN",name:"Your Career",startingAge:30,createdSeason:1,retiredSeason:null}],
  totals:[{...zero("HUMAN",1),appearances:3,titles:3,amateurTitles:3,nationalTitles:2,wins:10}],
  results:[],rankings:[],cards:[],money:[{season:1,prizePence:10000,commercialPence:5000}],
  sponsors:[],qualifications:[],decisions:[],commitments:[],merchandise:null});
test("A7.6 Legacy is grouped, amateur-valid and explainable without a score or new sidebar",()=>{
  const e=legacyEvidence(),r=projectReview(e,1,"CAPTURED"),d=projectLegacy(e,[r],[],null);
  const t=text(render(h(M.LegacyPage,{ctx:ctx()}),[[key("legacy"),d]]));
  for(const label of ["History & Legacy","Career Record","Seasons","Honours","World History","Event Legends","Records","Hall of Fame","Retirement","Open Circuit Champion","3 amateur titles"])assert.ok(t.includes(label),label);
  assert.doesNotMatch(t,/Legacy Score|Spend legacy|Earn XP|Upgrade ability/);
});
test("A7.6 completed review renders money, awards, source limits and missing evidence honestly",()=>{
  const r=projectReview(legacyEvidence(),1,"CAPTURED");
  const t=text(render(h(M.SeasonReviewPanel,{review:r,saveId:SAVE_ID}),[]));
  for(const label of ["Season 1 Complete","Outstanding Amateur Season","£100","£50","Amateur Player of the Season","Starting World rank: not recorded","Career Changes"])assert.ok(t.includes(label),label);
});
test("A7.6 season-end transition starts at review and cannot offer Begin before the deliberate sequence",()=>{
  const r=projectReview(legacyEvidence(),1,"CAPTURED");
  const t=text(render(h(M.Transition,{saveId:SAVE_ID,season:1}),[[key("legacy-season",1),r]]));
  assert.match(t,/Step 1 of 4/);assert.match(t,/Next section/);assert.doesNotMatch(t,/Begin Season 2/);
  assert.match(t,/Awards & Champions/);assert.match(t,/New Season/);
});
test("A7.6 retirement summary is archived, readable and has no progression control",()=>{
  const e={...legacyEvidence(),retired:true};e.players[0].retiredSeason=2;
  const d=projectLegacy(e,[projectReview(e,1,"CAPTURED")],[],null);
  const t=text(render(h(M.LegacyPage,{ctx:ctx(save({status:"RETIRED"})),initialTab:"Retirement"}),[[key("legacy"),d]]));
  assert.match(t,/Final Career Summary/);assert.match(t,/Read-only archive/);assert.doesNotMatch(t,/Confirm permanent retirement|Begin Season|Retire Career This/);
});
test("A7.6 old seasons label reconstruction and do not manufacture awards",()=>{
  const r=projectReview(legacyEvidence(),1),t=text(render(h(M.SeasonReviewPanel,{review:r,saveId:SAVE_ID}),[]));
  assert.match(t,/reconstructed/);assert.match(t,/Older reconstructed seasons do not invent award winners/);
});
const worldFixture=()=>({version:1,eventDatabaseVersion:3,playerDatabaseVersion:2,organisations:ORGANISATIONS,circuits:CIRCUIT_CONTENT,
  countries:COUNTRY_CONTENT,regions:REGIONS,cities:CITIES,venues:VENUE_CONTENT,venueFamilies:VENUE_FAMILIES,trophies:TROPHIES,brands:BRANDS,
  seasonRhythm:SEASON_RHYTHM,prestigeClasses:PRESTIGE_CLASSES,guide:GUIDE,almanac:ALMANAC,eventFamilies:catalogueFor(3).map(d=>({id:d.key,name:d.name,circuit:d.circuit,formatKind:d.format.structure,supported:assessCapability(d.format,d.eventDatabaseVersion).supported,...identity(d),...d.content}))});
test("A8.1 world directory shows real authored identities and paths without invented champions",()=>{
  const t=text(render(h(M.WorldPage,{ctx:ctx()}),[[key("world-content"),worldFixture()]]));
  assert.match(t,/World Darts Union/);assert.match(t,/Vault Darts/);assert.match(t,/Sovereign Trophy/);assert.match(t,/Factual trophy cabinet/);
  assert.doesNotMatch(t,/Historical World Champion:|ability bonus/);
});
test("A8.1 guide preserves optional amateur, women's and youth pathways, not XP gates",()=>{
  const t=text(render(h(M.WorldPage,{ctx:ctx(),guide:true}),[[key("world-content"),worldFixture()]]));
  assert.match(t,/Turning professional is an opportunity/);assert.match(t,/Declared women's-category eligibility/);
  assert.match(t,/Foundation events are under 18/);assert.match(t,/never XP/);
});
test("Premium ordinary reads cache briefly; deferred summaries stay disabled and live freshness is unchanged",()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  function Probe() {
    M.useCareerLife(SAVE_ID,false);M.useFinance(SAVE_ID,false);M.useSporting(SAVE_ID,false);
    M.useCareerSave(SAVE_ID);M.useWorldMap(SAVE_ID);
    M.useActiveTournament(SAVE_ID,false);M.useTournament(SAVE_ID,"fixture-event");M.useLiveSession(SAVE_ID,"fixture-match");
    return h("p",null,"TEST query policy");
  }
  try {
    renderToStaticMarkup(h(QueryClientProvider,{client},h(Probe)));
    for(const part of ["life","finance","sporting"]) {
      const options=client.getQueryCache().find({queryKey:key(part),exact:true})!.options as {enabled?:boolean;staleTime?:number};
      assert.equal(options.enabled,false,`${part} is deferred`);
      assert.equal(options.staleTime,30_000);
    }
    for(const part of ["save","world-map"])assert.equal((client.getQueryCache().find({queryKey:key(part),exact:true})!.options as {staleTime?:number}).staleTime,30_000);
    assert.equal((client.getQueryCache().find({queryKey:key("tournament","fixture-event"),exact:true})!.options as {staleTime?:number}).staleTime,0);
    const live=client.getQueryCache().getAll().find(q=>q.queryKey.includes("fixture-match"));
    assert.equal((live!.options as {staleTime?:number}).staleTime,2_000);
  } finally {client.clear();}
});

test("Premium cache still invalidates the whole save and save list after a mocked mutation",async()=>{
  const client=new QueryClient(),original=globalThis.fetch;
  const own=[key("save"),key("world-map"),key("finance"),key("sporting"),key("life")];
  const other=["career","other-test-save","world-map"];
  for(const k of [...own,["career","saves"],other])client.setQueryData(k,{test:true});
  let action:any;
  function Probe(){action=M.useEnterEvent(SAVE_ID);return h("p",null,"TEST mutation");}
  globalThis.fetch=async(input,options)=>{
    assert.ok(String(input).includes(`/saves/${SAVE_ID}/events/fixture-event/`));
    assert.equal(options?.method,"POST");
    return new Response(JSON.stringify({test:true}),{status:200,headers:{"Content-Type":"application/json"}});
  };
  try {
    renderToStaticMarkup(h(QueryClientProvider,{client},h(Probe)));
    await action.mutateAsync("fixture-event");
    for(const k of [...own,["career","saves"]])assert.equal(client.getQueryState(k)?.isInvalidated,true);
    assert.equal(client.getQueryState(other)?.isInvalidated,false);
  } finally {globalThis.fetch=original;client.clear();}
});

test("A8.3 map defaults to personal opportunities; inaccessible Palace remains available through All Events",()=>{
  const d=identity(catalogueFor(3).find(d=>d.key==="world-darts-championship")!);
  const e={id:"palace",name:"The Palace World Championship",status:"SCHEDULED",definitionId:"world-darts-championship",dates:{startWeek:50},venue:venueContent("the-palace-london"),fieldDescriptor:"World Championship Field",
    content:d,opportunity:{state:"NOT_QUALIFIED",reasons:["REQUIRES_RANKING"],canEnter:false}};
  const t=text(render(h(M.WorldMapPage,{ctx:ctx()}),[[key("world-map"),{events:[e]}]]));
  assert.match(t,/Career Map/);assert.match(t,/All events — including inaccessible/);assert.match(t,/City-level approximations/);
  assert.match(t,/No matching activity/);
  assert.doesNotMatch(t,/Enter this event|Buy access/);
});
test("A8.1 retired identity/products render read-only, with contract-controlled placement",()=>{
  const p={identity:{nickname:"The Quiet One",shirtTemplate:"CLASSIC",primaryColour:"#334455",secondaryColour:"#FFFFFF",accentColour:"#C8A050",competitionCategory:"WOMEN"},
    canEdit:false,editWindow:"Season opening week",placements:[{contractId:"equipment",brandName:"Ironflight",position:"UPPER_CHEST",slot:"EQUIPMENT_PARTNER"}],
    products:[{id:"signature",name:"Actual Signature Darts",launchSeason:3,state:"LEGACY"}],productCandidates:[]};
  const html=render(h(M.PresentationPage,{ctx:ctx(save({status:"RETIRED"}))}),[[key("presentation"),p]]),t=text(html);
  assert.match(t,/Contract-controlled shirt placement/);assert.match(t,/Actual Signature Darts/);assert.match(t,/LEGACY/);assert.doesNotMatch(t,/Launch Signature/);
  assert.match(html,/<button[^>]*disabled=""[^>]*>Save presentation/);
});
test("A8.1 empty trophy cabinet invents nothing; repeated genuine wins stay distinct",()=>{
  const empty=text(render(h(M.TrophyPage,{ctx:ctx()}),[[key("trophy-cabinet",0),{total:0,titles:[],nextOffset:null}]]));
  assert.match(empty,/No titles invented/);
  const award={canonicalEventId:"double-crown",name:"The Double Crown",classification:"RANKING",trophy:{name:"Double Crown Trophy"}};
  const full=text(render(h(M.TrophyPage,{ctx:ctx()}),[[key("trophy-cabinet",0),{total:2,nextOffset:null,titles:[{...award,eventId:"a",season:2},{...award,eventId:"b",season:3}]}]]));
  assert.equal((full.match(/Double Crown Trophy/g)??[]).length,2);assert.match(full,/Season 2/);assert.match(full,/Season 3/);
});

const a83MapFixture=()=>{
  const d=worldFixture().eventFamilies.find(e=>e.id==="world-darts-championship")!;
  return {home:{city:"Ayr",region:"Scotland"},events:[{id:"palace",name:"The Palace World Championship",definitionId:d.id,status:"SCHEDULED",
    dates:{startWeek:50},venue:venueContent("the-palace-london"),content:d,fieldDescriptor:"World Championship Field",
    opportunity:{state:"NOT_QUALIFIED",canEnter:false,reasons:["REQUIRES_RANKING"]},qualification:{routes:{type:"RANKING",met:false,list:"pro-world",maxPosition:32,position:null}},
    financialCommitment:{entryFeePence:0,estimatedTravelPence:10000,estimatedAccommodationPence:15000,estimatedPlayerCostPence:17500,sponsorCoverage:{entryFeePence:0,travelPence:2500,accommodationPence:5000}}}]};
};
test("A8.3 navigation has five compact destinations and only the current section's tabs",()=>{
  for(const [route,section] of [["/map","Map"],["/calendar","Calendar"],["/world/players","Darts World"],["/my-career/achievements","My Career"]]) {
    const html=render(h(M.CareerNav,{saveId:SAVE_ID}),[],`/career/${SAVE_ID}${route}`),t=text(html);
    for(const label of ["Home","Map","Calendar","Darts World","My Career"])assert.ok(t.includes(label));
    assert.match(html,/aria-current="page"/);assert.match(t,new RegExp(section));
    if(route==="/map"||route==="/calendar")assert.doesNotMatch(t,/Overview Performance Achievements Career Life History/);
    if(route==="/world/players")assert.match(t,/Rankings Players Events &amp; Circuits Venues History|Rankings Players Events & Circuits Venues History/);
  }
});
test("A8.3 Home prioritises an actual active tournament, then the mandatory season review",()=>{
  const active={tournaments:[{eventId:"active",name:"Fixture Open",terminal:false,phase:"MATCH_READY"}]};
  const seed=[...homeSeed(save(),[event({id:"opportunity"})]),[key("tournaments"),active]] as [unknown[],unknown][];
  const html=render(h(M.HomePage,{ctx:ctx()}),seed);
  assert.match(text(html),/Next Up Tournament in progress Fixture Open Return to Tournament/);
  assert.match(html,/tournaments\/active/);
  const reviewing=render(h(M.HomePage,{ctx:ctx()}),[...seed,[key("legacy"),{pendingReview:1}]]);
  assert.match(text(reviewing),/Continue Season Review/);assert.doesNotMatch(text(reviewing),/Return to Tournament/);
  browserScene("home",render(h("div",{className:"career-root"},h(M.CareerNav,{saveId:SAVE_ID}),h(M.HomePage,{ctx:ctx()})),seed));
});
test("A8.3 All Events map deep link exposes the inaccessible Palace and authoritative cost split",()=>{
  const seed:[[unknown[],unknown]]=[[key("world-map"),a83MapFixture()]];
  const html=render(h(M.CareerMapPage,{ctx:ctx()}),seed,`/career/${SAVE_ID}/map?filter=ALL&event=palace`);
  for(const fact of ["The Palace World Championship","Not Qualified","Ranking position required","Top 32","Commitment (estimated)","£250","Sponsor coverage","£75","Your cost (estimated)","£175"])assert.ok(text(html).includes(fact),fact);
  assert.match(html,/aria-label="Actual sporting routes"/);
  assert.match(html,/events\/palace/);assert.doesNotMatch(text(html),/Enter ·/);
  assert.match(html,/role="group" tabindex="0"/);assert.match(html,/Accessible location list/);
  browserScene("map",render(h("div",{className:"career-root"},h(M.CareerNav,{saveId:SAVE_ID}),h(M.CareerMapPage,{ctx:ctx()})),seed,`/career/${SAVE_ID}/map?filter=ALL&event=palace`));
});
test("A8.3 World landing is a hub rather than an encyclopaedia dump",()=>{
  const html=render(h(M.WorldHub,{ctx:ctx()}),[[key("world-content"),worldFixture()],[key("world-map"),a83MapFixture()],
    [key("ranking","pro-world",{view:"TOP",limit:5}),{rows:[{...row(),name:"Fixture Published Leader"}]}]]);
  for(const label of ["Darts World","Published World #1","Fixture Published Leader","Upcoming Championships","Players","Venues"])assert.ok(text(html).includes(label),label);
  assert.doesNotMatch(text(html),/World Darts Union.*Organisation Directory/);
  browserScene("world",render(h("div",{className:"career-root"},h(M.CareerNav,{saveId:SAVE_ID}),h(M.WorldHub,{ctx:ctx()})),[[key("world-content"),worldFixture()],[key("world-map"),a83MapFixture()]],`/career/${SAVE_ID}/world`));
});
test("A8.3 championship detail has central Palace identity and no fictional champion",()=>{
  const html=render(h(M.WorldHub,{ctx:ctx(),section:"events",detail:"world-darts-championship"}),[[key("world-content"),worldFixture()],[key("world-map"),a83MapFixture()],[key("event-legacy","world-darts-championship"),{champions:[]}]]);
  assert.match(html,/identity-palace/);assert.match(text(html),/Sovereign Trophy/);assert.match(text(html),/No pre-save history is invented/);
  assert.match(html,/events\/palace/);
  browserScene("palace",`<div class="career-root">${html}</div>`);
});
test("A8.3 shirts have genuinely different silhouettes/patterns, authored marks and no portraits",()=>{
  const sponsor={slot:"EQUIPMENT_PARTNER",brandName:"Ironflight"};
  const classic=render(h(M.CareerPlayerCard,{name:"Fixture Player",nickname:"Quiet",identity:{shirtTemplate:"CLASSIC",primaryColour:"#225577",secondaryColour:"#111111",accentColour:"#ddeeff"},sponsors:[sponsor],scale:"profile"}),[]);
  const chevron=render(h(M.CareerShirt,{name:"Fixture Player",identity:{shirtTemplate:"CHEVRON"},scale:"compact"}),[]);
  assert.match(classic,/role="img"/);assert.match(classic,/Fixture Player/);assert.match(classic,/>Ironflight<\/text>/);assert.match(chevron,/M15 43 60 70 105 43/);
  assert.notEqual(classic,chevron);assert.doesNotMatch(classic,/<img|portrait|avatar|human portrait/i);
  browserScene("identity",`<div class="career-root career-surface">${classic}${chevron}</div>`);
});
test("A8.3 retired player directory uses public cards and still links to historical careers",()=>{
  const player={id:"retired",name:"Fixture Retired Player",nickname:null,country:"GBR",status:"RETIRED",ranking:null,shirt:{shirtTemplate:"SPLIT"},commercial:{portfolio:[]}};
  const html=render(h(M.WorldPlayerDirectory,{ctx:ctx()}),[[key("world-players",0,"","ALL",null),{players:[player],total:1,nextOffset:null}]]);
  assert.match(text(html),/Fixture Retired Player/);assert.match(html,/world\/players\/retired/);assert.match(html,/Retired<\/option>/);
  assert.doesNotMatch(html,/potential|currentAbility|bankAccount/);
});
test("A8.3 guidance preference is explanatory and read-only on retirement",()=>{
  const html=render(h(M.GuidanceSettings,{saveId:SAVE_ID}),[[key("guidance"),{mode:"FULL",dismissed:["home"],canEdit:false}]]);
  assert.match(text(html),/Guidance/);assert.match(text(html),/FULL STANDARD MINIMAL/);assert.match(html,/disabled=""/);
  assert.doesNotMatch(text(html),/Difficulty:|Upgrade ability|Buy/);
});
test("A8.3 long histories render twenty records at a time without discarding totals or old seasons",()=>{
  const html=render(h(M.BoundedList,{rows:Array.from({length:1000},(_,i)=>i),children:(i:number)=>h("p",{key:i},`Recorded season ${i+1}`)}),[]);
  assert.equal((text(html).match(/Recorded season/g)??[]).length,20);
  assert.match(text(html),/1000 records/);assert.match(text(html),/Next records/);assert.doesNotMatch(text(html),/Recorded season 21/);
});
test("A8.3 Q-School session evidence is not portrayed as a championship trophy",()=>{
  const html=render(h(M.TrophyPage,{ctx:ctx()}),[[key("trophy-cabinet",0),{total:1,nextOffset:null,titles:[{eventId:"session",canonicalEventId:"q-school",circuit:"Q_SCHOOL",name:"Q-School day",classification:"QUALIFIER",season:1,trophy:{name:"Session Cup",designKey:"handled-silver"}}]}]]);
  assert.match(text(html),/Session win — not a tournament title or automatic Tour Card/);assert.doesNotMatch(html,/aria-label="Session Cup"/);
});
test("A9 establishment copy is new-save-only; Career Calendar fixture remains bounded",()=>{
  const seed:[unknown[],unknown][]=[[key("calendar",{scope:"WORLD",fromWeek:1,toWeek:9}),{overview:overview(),events:[event()]}],
    [key("finance"),finance()],[key("sporting"),sporting()],[key("tournaments"),{tournaments:[]}],[key("legacy"),{pendingReview:null}]];
  const html=render(h(M.HomePage,{ctx:ctx(save({eventDatabaseVersion:5}))}),seed);
  assert.match(text(html),/Establishment season/);assert.match(text(html),/Turning professional is optional/);
  assert.doesNotMatch(text(render(h(M.HomePage,{ctx:ctx(save({eventDatabaseVersion:4}))}),seed)),/Establishment season/);
  if(process.env.A9_BROWSER_DIR){
    const q={scope:"WORLD",season:1,fromWeek:1,toWeek:9,circuit:undefined};
    const markup=render(h("div",{className:"career-root"},h(M.CareerNav,{saveId:SAVE_ID}),h(M.CalendarPage,{ctx:ctx()})),
      [[key("calendar",q),{overview:overview(),events:Array.from({length:14},(_,i)=>event({id:`calendar-${i}`,name:`Local fixture event ${i+1}`}))}]]);
    assert.match(text(markup),/Calendar/);browserScene("calendar",markup);
  }
});
test("A9 browser fixtures include actual ordinary TKDL pages and long standings",()=>{
  if(!process.env.A9_BROWSER_DIR)return;
  const standings=Array.from({length:35},(_,i)=>({position:i+1,positionChange:0,playerId:i+1,playerName:`Fixture Player ${i+1}`,wins:8,losses:4,
    gamesPlayed:12,points:200-i,elo:1100-i,tier:"CLUB",winRate:66.7,currentStreak:1,status:"ACTIVE"}));
  const seed:[unknown[],unknown][]=[[["/api/leaderboard"],standings],[["app-settings"],{coins_enabled:false,live_scorer_enabled:false}]];
  const prior=Object.getOwnPropertyDescriptor(globalThis,"window");
  Object.defineProperty(globalThis,"window",{configurable:true,value:{location:{search:""},innerWidth:390,
    matchMedia:()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}})}});
  try{for(const [name,Component] of Object.entries(M.ordinary)){
    const html=render(h(M.TooltipProvider,null,h(Component as never)),seed,name==="hub"?"/":name==="standings"?"/leaderboard":`/${name}`);
    assert.ok(text(html).length>50,`${name}: actual screen content`);browserScene(name,html);
  }}finally{if(prior)Object.defineProperty(globalThis,"window",prior);else Reflect.deleteProperty(globalThis,"window");}
});
