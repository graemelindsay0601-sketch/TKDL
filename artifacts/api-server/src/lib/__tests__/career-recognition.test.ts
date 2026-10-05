import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recognitionModel } from "../../career/recognition/model.ts";
import { recognitionResult, type RecognitionContext, type RecognitionEvent, type RecognitionSources } from "../../career/recognition/types.ts";
import type { Fact } from "../../career/facts/types.ts";

const fact=(id:string,day=7,season=1):Fact=>({id,source:"A3 public sporting evidence",label:`Factual ${id}`,season,day,week:Math.ceil(day/7),date:`2026-01-${String(day).padStart(2,"0")}`,age:20,eventId:id});
const event=(id:string,circuit="GRASSROOTS",tier="LOCAL",day=7):RecognitionEvent=>({fact:fact(id,day),circuit,tier,classification:"NON_RANKING",international:false});
const empty=():RecognitionSources=>({results:[],appearances:[],qualifications:[],cards:[],rankings:[]});
function titles(count:number,circuit:string,tier="LOCAL"):RecognitionSources {
  const s=empty();
  for(let i=0;i<count;i++) {const e=event(`title-${i}`,circuit,tier,i+1);s.results.push({...e,champion:true,stageReached:"CHAMPION"});s.appearances.push({...e,fact:{...e.fact,id:`appearance-${i}`,label:`Played in event ${i}`}});}
  return s;
}
const context=(s:RecognitionSources,c:RecognitionContext)=>recognitionModel(s).contexts.find(v=>v.context===c)!;
test("fresh Career: five independently unknown contexts, a grounded standing and no fabricated evidence/milestones",()=>{
  const v=recognitionModel(empty());assert.equal(v.contexts.length,5);assert.ok(v.contexts.every(c=>c.level==="UNKNOWN" && c.evidence.length===0));
  assert.match(v.standing.label,/Building/);assert.deepEqual(v.milestones,[]);assert.deepEqual(v.strongest,[]);
});
test("local titles primarily affect local recognition, not professional/major/international",()=>{
  const s=titles(5,"GRASSROOTS");assert.equal(context(s,"LOCAL").level,"HIGHLY_REGARDED");
  for(const c of ["AMATEUR","PROFESSIONAL","MAJOR_STAGE","INTERNATIONAL"] as const) assert.equal(context(s,c).level,"UNKNOWN");
});
test("amateur-only sustained success can become elite without a Tour Card or professional result",()=>{
  const s=titles(4,"NATIONAL_AMATEUR");
  assert.equal(context(s,"AMATEUR").level,"ELITE");assert.equal(context(s,"PROFESSIONAL").level,"UNKNOWN");
  assert.equal(recognitionModel(s).standing.label,"Elite amateur");
});
test("county and regional results develop amateur recognition, independently of turning professional",()=>{
  const s=titles(4,"COUNTY");assert.equal(context(s,"LOCAL").level,"HIGHLY_REGARDED");assert.equal(context(s,"AMATEUR").level,"ESTABLISHED");
  assert.equal(context(titles(4,"REGIONAL"),"AMATEUR").level,"HIGHLY_REGARDED");
});
test("a Tour Card alone gives limited known professional recognition, never elite; repeated retentions do not inflate it",()=>{
  const s=empty();s.cards=[fact("card-1")];assert.equal(context(s,"PROFESSIONAL").level,"KNOWN");
  for(let i=2;i<30;i++)s.cards.push(fact(`card-${i}`));assert.equal(context(s,"PROFESSIONAL").level,"KNOWN");
});
test("sustained professional success develops professional recognition",()=>{
  const s=titles(4,"PRO_CIRCUIT","STANDARD");assert.equal(context(s,"PROFESSIONAL").level,"ELITE");
  assert.equal(context(s,"INTERNATIONAL").level,"UNKNOWN");assert.match(recognitionModel(s).standing.label,/Elite professional/);
});
test("bounded participation cannot turn repeated first-round losses into established recognition",()=>{
  const s=empty();for(let i=0;i<100;i++)s.appearances.push(event(`appearance-${i}`,"PRO_CIRCUIT","STANDARD"));
  assert.equal(context(s,"PROFESSIONAL").level,"KNOWN");
});
test("major qualification is factual target recognition, not proof of a major appearance",()=>{
  const s=empty();s.qualifications=[{...event("qualified","MAJOR","MAJOR"),targetKey:"authored-major"}];
  assert.equal(context(s,"MAJOR_STAGE").level,"KNOWN");assert.equal(s.appearances.length,0);
  assert.ok(context(s,"MAJOR_STAGE").evidence.some(f=>f.id==="qualified"));
  const qualifier={...event("minor-qualifier","WORLD_CHAMPIONSHIP","FEATURED"),classification:"QUALIFIER"};
  s.results=[{...qualifier,champion:true,stageReached:"CHAMPION"}];s.qualifications=[];
  assert.equal(context(s,"MAJOR_STAGE").level,"UNKNOWN");assert.equal(context(s,"INTERNATIONAL").level,"UNKNOWN");
});
test("an actual stage appearance earns limited recognition; a major title matters strongly but is not instant elite",()=>{
  const s=empty();s.appearances=[event("stage-1","MAJOR","MAJOR"),event("stage-2","MAJOR","MAJOR"),event("stage-3","MAJOR","MAJOR")];
  assert.equal(context(s,"MAJOR_STAGE").level,"KNOWN");
  s.results=[{...event("major-title","MAJOR","MAJOR"),champion:true,stageReached:"CHAMPION"}];
  assert.equal(context(s,"MAJOR_STAGE").level,"ESTABLISHED");
});
test("international public series results develop international recognition; a minor local title does not",()=>{
  assert.equal(context(titles(3,"WORLD_SERIES","TELEVISED"),"INTERNATIONAL").level,"HIGHLY_REGARDED");
  assert.equal(context(titles(1,"GRASSROOTS"),"INTERNATIONAL").level,"UNKNOWN");
});
test("old World success and established amateur achievements survive poor recent results",()=>{
  const s=titles(1,"WORLD_CHAMPIONSHIP","WORLD"),prior=recognitionModel(s).contexts.map(c=>c.level);
  s.results[0].fact.season=1;s.results.push({...event("poor-recent","WORLD_CHAMPIONSHIP","WORLD"),fact:fact("poor-recent",7,8),champion:false,stageReached:"LAST_128"});
  assert.deepEqual(recognitionModel(s).contexts.map(c=>c.level),prior);
  assert.equal(context(s,"MAJOR_STAGE").level,"HIGHLY_REGARDED");assert.equal(context(s,"INTERNATIONAL").level,"HIGHLY_REGARDED");
});
test("published ranking recognition uses historical best, not a volatile recent rank",()=>{
  const s=empty();s.rankings=[{...fact("ranking-best"),position:8}];
  assert.equal(context(s,"PROFESSIONAL").level,"ESTABLISHED");
  s.rankings.push({...fact("ranking-poor",8),position:140});
  assert.equal(context(s,"PROFESSIONAL").level,"ESTABLISHED");
});
test("age changes evidence presentation only, never contextual standing",()=>{
  const s=titles(4,"NATIONAL_AMATEUR"),before=recognitionModel(s);
  for(const r of [...s.results,...s.appearances]) r.fact.age=80;
  const after=recognitionModel(s);assert.deepEqual(after.contexts.map(c=>c.level),before.contexts.map(c=>c.level));assert.deepEqual(after.standing,before.standing);
});
test("focus and active/completed goals are not recognition inputs; only the underlying sporting fact matters",()=>{
  const s=empty();const decorated={...s,focus:"MAJOR_QUALIFICATION",goals:[{status:"ACTIVE"},{status:"COMPLETED",type:"WIN_WORLD"}]};
  assert.deepEqual(recognitionModel(decorated),recognitionModel(s));
  s.results=titles(1,"WORLD_CHAMPIONSHIP","WORLD").results;
  assert.notDeepEqual(recognitionModel(s).contexts.map(c=>c.level),recognitionModel(empty()).contexts.map(c=>c.level));
});
test("derivation is deterministic, order-independent, duplicate-safe, idempotent and does not mutate authorities",()=>{
  const s=titles(4,"REGIONAL"),before=structuredClone(s),v=recognitionModel(s);
  assert.deepEqual(recognitionModel(s),v);assert.deepEqual(s,before);
  assert.deepEqual(recognitionModel({...s,results:[...s.results].reverse(),appearances:[...s.appearances].reverse()}),v);
  assert.deepEqual(recognitionModel({...s,results:[...s.results,...s.results],appearances:[...s.appearances,...s.appearances]}),v);
});
test("factual representative evidence is bounded, traceable and exposes neither scores nor hidden data",()=>{
  const s=titles(20,"REGIONAL"),view=recognitionModel(s),ids=new Set([...s.results,...s.appearances].map(e=>e.fact.id));
  for(const c of view.contexts){assert.ok(c.evidence.length<=4);for(const e of c.evidence)assert.ok(ids.has(e.id));}
  assert.doesNotMatch(JSON.stringify(view),/score|thresholds|currentAbility|potential|reputationPoints|weight/);
});
test("threshold history groups same-day facts, emits only the attained meaningful level and remains stable",()=>{
  const s=titles(4,"NATIONAL_AMATEUR");for(const e of [...s.results,...s.appearances])e.fact=fact(e.fact.id,7);
  const m=recognitionModel(s).milestones.filter(m=>m.context==="AMATEUR");
  assert.equal(m.length,1);assert.equal(m[0].level,"ELITE");assert.equal(m[0].precision,"DAY");assert.equal(m[0].date,"2026-01-07");
  assert.equal(m[0].supportingFactIds.length,8);assert.deepEqual(recognitionModel(s).milestones,recognitionModel(s).milestones);
});
test("ranking/Card weekly evidence never fabricates exact threshold dates or ages",()=>{
  const s=empty();s.cards=[{...fact("card"),day:null,date:null,age:null,week:3}];
  s.rankings=[{...fact("rank",20),position:32,week:3}];
  const m=recognitionModel(s).milestones.find(m=>m.context==="PROFESSIONAL")!;
  assert.equal(m.precision,"WEEK");assert.equal(m.week,3);assert.equal(m.day,null);assert.equal(m.date,null);assert.equal(m.age,null);
});
test("season-only qualification supports existing-save standing without inventing a past crossing date",()=>{
  const s=empty();s.qualifications=[{...event("q","MAJOR","MAJOR"),targetKey:"major",fact:{...fact("q"),day:null,week:null,date:null,age:null}}];
  assert.equal(context(s,"MAJOR_STAGE").level,"KNOWN");assert.equal(recognitionModel(s).milestones.length,0);
});
test("the A7.1 adapter preserves public source identity and strips unrelated/hidden fields",()=>{
  const r=recognitionResult({id:"r",eventId:"e",source:"A3",label:"Result",season:1,day:7,week:1,date:null,age:20,name:"Public event",
    definitionKey:"e",circuit:"COUNTY",classification:"NON_RANKING",presentationTier:"LOCAL",country:"GBR",
    participantKey:"HUMAN",participantName:"You",position:1,stageReached:"CHAMPION",champion:true,wins:5,losses:0});
  assert.equal(r.fact.label,"Public event — title");assert.equal(r.fact.id,"r");assert.ok(!("wins" in r));
});
test("recognition code has no mutation/scoring/economy/ranking/qualification/Card/RNG/difficulty write path",async()=>{
  const model=await readFile(new URL("../../career/recognition/model.ts",import.meta.url),"utf8");
  const service=await readFile(new URL("../../career/recognition/service.ts",import.meta.url),"utf8");
  const router=await readFile(new URL("../../career/recognition/router.ts",import.meta.url),"utf8");
  assert.doesNotMatch(service,/\b(?:INSERT INTO|UPDATE|DELETE FROM)\b/);
  assert.doesNotMatch(model,/simulateNpcMatch|throwDart|replay\(|seededRandom|Math\.random|Date\.now/);
  assert.doesNotMatch(router,/router\.(?:post|put|patch|delete)\(/);
});
