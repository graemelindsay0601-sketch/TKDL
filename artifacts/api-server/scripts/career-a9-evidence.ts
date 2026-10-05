/**
 * Compact reproducible A9 evidence. Scoring uses real shared GameScorer dart
 * planning + legal match state, not adapter averages. Economic finishing positions
 * are explicit fixtures, NOT predicted human results. No writes to a live save.
 */
import {mkdirSync,writeFileSync} from "node:fs";
import path from "node:path";
import {generateInitialWorld,generateJuniorCohort,generateWomenCohort} from "../src/career/world/generation.ts";
import {developNpc,evolveOffSeason} from "../src/career/world/development.ts";
import {createPerformance} from "../src/career/world/performance.ts";
import {toCareerBotConfig} from "../src/career/world/bot-adapter.ts";
import {scopedRandom} from "../src/career/world/random.ts";
import {describe} from "../src/career/world/harness.ts";
import {meanAbility,type Npc,type MatchContext} from "../src/career/world/types.ts";
import {CAREER_DIFFICULTIES,type CareerDifficulty} from "../src/career/config.ts";
import {CONTEXTS,TIERS} from "../src/career/world/config.ts";
import {createMatch,throwDart,planBotX01Visit} from "../src/shared/darts-rules/index.ts";
import {generateSeason} from "../src/career/calendar/generation.ts";
import {VENUES,LOCALITIES} from "../src/career/calendar/geography.ts";
import {profileFor,portfolioCoverage,type ContractRow} from "../src/career/finance/engine.ts";
import {groupTrips,travelBand,type Home,type EventPlace} from "../src/career/finance/travel.ts";
import {sponsorCatalogue} from "../src/career/finance/sponsors.catalogue.ts";
import {prizeForPosition} from "../src/career/finance/config.ts";
const seed="a12e".repeat(16),out=path.resolve(process.argv[2]??"/tmp/tkdl-a9-evidence");
mkdirSync(out,{recursive:true});
let world=generateInitialWorld(seed,1);
world.push(...generateJuniorCohort(seed,1,1,40,world,"initial"));
world.push(...generateWomenCohort(seed,1,1,80,world));
function live(players:[Npc,Npc],difficulty:CareerDifficulty,context:MatchContext,key:string) {
  const configs=players.map(p=>toCareerBotConfig(createPerformance(p,context,difficulty,scopedRandom(seed,1,"a9-performance",key,p.id))));
  const rng=scopedRandom(seed,1,"a9-live-darts",key);
  let s=createMatch({startingScore:501,inRule:"STRAIGHT",outRule:"DOUBLE",unit:"LEGS",bestOfLegs:5},0);
  while(!s.complete&&s.dartsThrown<4000){
    const p=s.turn,leg=s.legNo;
    for(const dart of planBotX01Visit(s.scores[p],configs[p],{doubleOut:true,rng})){
      s=throwDart(s,dart).state;
      if(s.complete||s.turn!==p||s.legNo!==leg)break;
    }
  }
  if(!s.complete)throw new Error("Unfinished real-rules fixture");
  return {winner:s.winner,stats:[0,1].map(p=>{
    const visits=s.visits.filter(v=>v.thrower===p),darts=visits.reduce((n,v)=>n+v.darts.length,0);
    const attempts=visits.filter(v=>v.startScore<=170),checkouts=visits.filter(v=>v.checkout).length;
    return {average:3*visits.reduce((n,v)=>n+v.points,0)/darts,checkouts,finishingVisits:attempts.length,
      finishingVisitPct:100*checkouts/Math.max(1,attempts.length),darts};
  })};
}
const scoring=[];
for(const difficulty of CAREER_DIFFICULTIES)for(const tier of TIERS)for(const category of CONTEXTS){
  const pool=world.filter(p=>p.tier===tier),averages:number[]=[],finishing:number[]=[];
  for(let i=0;i<20;i++){
    const r=scopedRandom(seed,1,"a9-sample",tier,category,i),a=Math.floor(r()*pool.length),b=(a+1+Math.floor(r()*(pool.length-1)))%pool.length;
    const result=live([pool[a],pool[b]],difficulty,{category,roundImportance:category==="major"?1:0.5,elimination:true},`${tier}:${category}:${i}`);
    for(const s of result.stats){averages.push(s.average);finishing.push(s.finishingVisitPct);}
  }
  scoring.push({tier,difficulty,context:category,matches:20,playerSamples:averages.length,average:describe(averages),finishingVisitPct:describe(finishing)});
}
const pools=Object.fromEntries(TIERS.map(t=>[t,world.filter(p=>p.tier===t)])) as Record<typeof TIERS[number],Npc[]>;
const upset=[];
for(const difficulty of CAREER_DIFFICULTIES)for(const [label,strong,weak,category] of [
  ["Amateur v grassroots",pools.AMATEUR,pools.GRASSROOTS,"local"],
  ["Pro v amateur",pools.PROFESSIONAL,pools.AMATEUR,"floor"],
  ["Elite v pro",pools.ELITE,pools.PROFESSIONAL,"major"],
  ["Elite v grassroots",pools.ELITE,pools.GRASSROOTS,"stage"],
  ["Q-School: top amateur v lower pro",[...pools.AMATEUR].sort((a,b)=>meanAbility(b.ability)-meanAbility(a.ability)).slice(0,12),
    [...pools.PROFESSIONAL].sort((a,b)=>meanAbility(a.ability)-meanAbility(b.ability)).slice(0,12),"qualifier"],
  ["New Tour Card calibre v established pro",[...pools.PROFESSIONAL].sort((a,b)=>meanAbility(b.ability)-meanAbility(a.ability)).slice(0,20),
    [...pools.AMATEUR].sort((a,b)=>meanAbility(b.ability)-meanAbility(a.ability)).slice(0,12),"floor"],
] as [string,Npc[],Npc[],MatchContext["category"]][]) {
  let wins=0;
  for(let i=0;i<80;i++){const r=scopedRandom(seed,1,"a9-pair",label,i);
    const result=live([strong[Math.floor(r()*strong.length)],weak[Math.floor(r()*weak.length)]],difficulty,{category,roundImportance:0.8,elimination:true},`${label}:${i}`);
    if(result.winner===1)wins++;}
  upset.push({label,difficulty,context:category,matches:80,secondPlayerWinPct:wins/80*100});
}
const years=[];
for(let season=1;season<=15;season++){
  const active=world.filter(p=>p.status==="ACTIVE");
  years.push({season,active:active.length,elite:active.filter(p=>p.tier==="ELITE").length,
    pro:active.filter(p=>p.tier==="PROFESSIONAL").length,ability:describe(active.map(p=>meanAbility(p.ability))),
    under23:active.filter(p=>p.age<23).length});
  for(let week=1;week<=52;week++)world=world.map(p=>developNpc(p,seed,1,`a9-year:${season}:week:${week}`,1/52,0.5));
  const e=evolveOffSeason(world,seed,1,season,0,0.5);world=e.players;
  world.push(...generateJuniorCohort(seed,1,season+1,18,world,`intake:${season+1}`));
  world.push(...generateWomenCohort(seed,1,season+1,20,world));
  Object.assign(years.at(-1)!,{retired:e.retired.length,intake:e.entrants.length+38});
}
const calendar=generateSeason(seed,5,1),annual=generateSeason(seed,5,2);
const home:Home={locality:"ayrshire",country:"GBR",zone:"UK_IRELAND",travelVersion:2};
type E=typeof calendar[number];
const place=(e:E):EventPlace=>({id:e.id,city:e.city,country:e.country,zone:e.zone,venue_key:e.venueKey,locality_key:e.localityKey,
  start_day:e.startDay,end_day:e.endDay,circuit:e.circuit,series_key:e.seriesKey});
const profile=(e:E)=>profileFor({definition_key:e.definitionKey,classification:e.classification,snapshot:e.snapshot});
const contract=(key:string,version=3):ContractRow=>{const t=sponsorCatalogue(version).find(d=>d.key===key)!.terms;return {
  id:key,offer_id:key,sponsor_key:key,tier:t.tier,terms:structuredClone(t),start_season:1,start_week:1,end_season:3,end_week:52,status:"ACTIVE"};};
function costs(events:E[],brands:string[],version=3,positions:number[]=[],start=25000,signing=true){
  const contracts=brands.map(b=>contract(b,version)),portfolio={contracts,usage:new Map(contracts.map(c=>[c.id,new Map<number,number>()]))};
  let gross=0,covered=0,prizes=0,cash=signing?contracts.reduce((n,c)=>n+c.terms.signingBonusPence,0):0;
  const charged=new Set<string>(),counts=new Map<string,number>();
  const cover=(type:"ENTRY_FEE"|"TRAVEL"|"ACCOMMODATION",circuit:string,pence:number)=>{
    gross+=pence;covered+=portfolioCoverage(portfolio,new Map(),type,circuit,pence).covered;};
  for(const [i,e] of events.entries()){
    const f=profile(e),unit=f.fee.basis==="PER_SERIES"?`${e.season}:${e.seriesKey}`:e.id;
    if(!charged.has(unit)){cover("ENTRY_FEE",e.circuit,f.fee.entryFeePence);charged.add(unit);}
    const pos=positions[i]??9999;prizes+=prizeForPosition(f.prize,pos);
    for(const c of contracts){
      const pay=c.terms.eventPayment,count=counts.get(c.id)??0;
      if(pay&&(!pay.circuits||pay.circuits.includes(e.circuit))&&count<pay.maxEventsPerSeason){cash+=pay.amountPence;counts.set(c.id,count+1);}
      // A4 pays every applicable authored bonus (each key is idempotent).
      cash+=c.terms.performanceBonuses.filter(b=>pos<=b.maxPosition&&(!b.circuits||b.circuits.includes(e.circuit))&&b.classifications.includes(e.classification)).reduce((n,b)=>n+b.amountPence,0);
    }
  }
  const trips=groupTrips(home,events.map(place));
  for(const t of trips){cover("TRAVEL",t.events[0].circuit,t.travelPence);cover("ACCOMMODATION",t.events[0].circuit,t.accommodationPence);}
  const expense=gross-covered;
  return {events:events.length,trips:trips.length,grossPence:gross,coveredPence:covered,expensesPence:expense,
    prizePence:prizes,sponsorCashPence:cash,startPence:start,endPence:start+prizes+cash-expense};
}
const choose=(requests:[string,number][],pool=calendar)=>{const picked:E[]=[],busy=new Set<number>();
  for(const [circuit,count] of requests){const candidates=pool.filter(e=>e.circuit===circuit&&e.executable)
    .sort((a,b)=>(travelBand(home,place(a))==="LOCAL"?0:1)-(travelBand(home,place(b))==="LOCAL"?0:1)||a.startDay-b.startDay);
    for(const e of candidates){if(picked.filter(x=>x.circuit===circuit).length>=count)break;
      if(Array.from({length:e.endDay-e.startDay+1},(_,i)=>e.startDay+i).some(d=>busy.has(d)))continue;
      picked.push(e);for(let d=e.startDay;d<=e.endDay;d++)busy.add(d);
    }}
  return picked.sort((a,b)=>a.startDay-b.startDay);};
const scenarios=[];
for(const [name,requests,brands,start,finishes] of [
  ["Average grassroots amateur",[["GRASSROOTS",20]],[],25000,[1,2,2,4,4]],
  ["Strong amateur",[["GRASSROOTS",8],["COUNTY",4],["REGIONAL",6],["NATIONAL_AMATEUR",3]],["ochre-darts"],25000,[1,2,4,4]],
  ["Elite lifelong amateur",[["REGIONAL",6],["NATIONAL_AMATEUR",4],["VAULT",6],["CHALLENGER",4]],["redpoint-darts"],25000,[1,2,4,8]],
  ["New Tour Card holder",[["PRO_CIRCUIT",12]],["ironflight"],150000,[64,128,128,64]],
  ["Struggling professional",[["PRO_CIRCUIT",8]],["ironflight"],125000,[128,128,64,128]],
  ["Established professional",[["PRO_CIRCUIT",28],["EUROPEAN_SERIES",6]],["northline-darts"],1000000,[16,32,64,8]],
  ["Top 32",[["PRO_CIRCUIT",28],["EUROPEAN_SERIES",10]],["northline-darts"],1500000,[4,8,16,32]],
  ["Major champion",[["PRO_CIRCUIT",12],["MAJOR",3]],["vantage-darts"],2000000,[1,4,8,16]],
  ["World champion / #1",[["PRO_CIRCUIT",12],["WORLD_CHAMPIONSHIP",1]],["vantage-darts"],5000000,[1]],
] as [string,[string,number][],string[],number,number[]][]){
  const events=choose(requests),positions=events.map((_,i)=>name==="Average grassroots amateur"?(finishes[i]??9999):finishes[i%finishes.length]);
  scenarios.push({name,scope:"Non-overlapping authored schedule; eligibility and finishes assumed, not predicted; signing once; no debt is simulated",
    finishes:positions,eventKeys:events.map(e=>e.instanceKey),beforeSponsorV2:costs(events,brands,2,positions,start),
    ...costs(events,brands,3,positions,start)});
}
const qs=annual.filter(e=>e.circuit==="Q_SCHOOL"&&e.instanceKey.includes("uk")&&!e.instanceKey.includes("europe"));
// Canonical pathway fallback: choose one venue/pathway, include all series days.
const school=qs.length?qs:annual.filter(e=>e.circuit==="Q_SCHOOL"&&e.venueKey===annual.find(e=>e.circuit==="Q_SCHOOL")!.venueKey);
const first=school.filter(e=>e.seriesKey?.startsWith("q-school-first")).sort((a,b)=>a.startDay-b.startDay);
scenarios.push({name:"Q-School aspirant",scope:"Full First + Final; First day win/Final failure explicitly assumed. No prize/refund. Aggregate illustration, not live qualification or ledger.",
  beforeSponsorV2:costs(school,["redpoint-darts"],2,school.map(e=>e.id===first[0].id?1:128),125000,false),
  ...costs(school,["redpoint-darts"],3,school.map(e=>e.id===first[0].id?1:128),125000,false)});
scenarios.push({name:"Failed Q-School",scope:"First Stage only, all early losses assumed; no sporting-failure prize/refund; no Final entry. Sponsor already held, no fresh signing bonus.",
  beforeSponsorV2:costs(first,["redpoint-darts"],2,first.map(()=>128),50000,false),
  ...costs(first,["redpoint-darts"],3,first.map(()=>128),50000,false)});
const stages=[...new Set(school.map(e=>e.seriesKey))].map(key=>({key,...costs(school.filter(e=>e.seriesKey===key),["redpoint-darts"],3,[],0,false)}));
const qSchoolAffordability=[50000,90000,125000].map(start=>{
  let bank=start;
  const attempts=stages.map(s=>{const canAfford=bank>=s.expensesPence;const before=bank;
    if(canAfford)bank+=s.sponsorCashPence-s.expensesPence;
    return {stage:s.key,upfrontPlayerCostPence:s.expensesPence,beforePence:before,canAfford,afterPence:bank};});
  return {startPence:start,attempts,endPence:bank,scope:"Stage-level arithmetic using real grouped costs; sponsor receipts only after play. Not live ledger or qualification."};
});
const representative=[];
const base=calendar.find(e=>e.circuit==="PRO_CIRCUIT")!;
for(const venueKey of ["midlands-oche","harbour-rooms-dublin","spree-halle-berlin","burns-hall"]){
  const v=VENUES.find(v=>v.key===venueKey)!;
  const pair=[0,1].map(i=>({...base,id:`pair:${i}`,venueKey,city:v.city,country:v.country,
    zone:v.country==="GBR"||v.country==="IRL"?"UK_IRELAND":"EUROPE",localityKey:null,startDay:50+i,endDay:50+i}));
  for(const version of [2,3])representative.push({venueKey,version,band:travelBand(home,place(pair[0])),...costs(pair,["ironflight"],version,[],0,false)});
  const compatible=sponsorCatalogue(3).filter(d=>["SECONDARY_COMMERCIAL","APPAREL_PARTNER"].includes(d.terms.relationshipSlot??"")&&d.terms.tier==="PROFESSIONAL");
  const logistics=compatible.find(d=>d.terms.coverage.some(r=>r.costTypes.includes("TRAVEL")));
  const apparel=compatible.find(d=>d.terms.relationshipSlot==="APPAREL_PARTNER");
  if(logistics&&apparel)representative.push({venueKey,version:3,portfolio:["ironflight",logistics.key,apparel.key],
    ...costs(pair,["ironflight",logistics.key,apparel.key],3,[],0,false)});
}
const audit=VENUES.map(v=>({key:v.key,city:v.city,region:v.region,country:v.country,
  fromAyrshire:travelBand(home,{venue_key:v.key,locality_key:null,country:v.country,zone:v.country==="GBR"||v.country==="IRL"?"UK_IRELAND":
    ["AUS","CAN","USA","JPN","SGP","ZAF"].includes(v.country)?"LONG_HAUL":"EUROPE"})}));
const report={seed,scope:"Focused A9 evidence; not A10 certification",scoring,upset,
  world:{scope:"15 seasons of real development/retirement/intake functions, 52 periods/year; no match-form feedback, rankings or calendar simulation",years},
   economy:{scope:"Real profiles/prizes/grouping/coverage; explicitly assumed finishes and eligibility; no probability model; no live accounts",scenarios,representative,qSchoolAffordability},
  catalogue:{canonicalVenues:VENUES.length,localities:LOCALITIES.length,season1Events:calendar.length,season2Events:annual.length,
    season1Executable:calendar.filter(e=>e.executable).length,proTourEvents:calendar.filter(e=>e.circuit==="PRO_CIRCUIT").length,audit}};
writeFileSync(path.join(out,"evidence.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({out,scoringMatches:scoring.reduce((n,s)=>n+s.matches,0),upsetMatches:upset.reduce((n,s)=>n+s.matches,0),
  world:years.map(y=>({season:y.season,active:y.active,elite:y.elite,pro:y.pro})),representative,scenarios},null,2));
