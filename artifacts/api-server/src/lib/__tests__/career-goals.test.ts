import { test } from "node:test";
import assert from "node:assert/strict";
import { completionFact, goalSchema, focusSchema, goalProgress, evidenceFor, recommend, targetKey } from "../../career/goals/model.ts";
import type { GoalRow, GoalSources, Opportunity } from "../../career/goals/types.ts";
import type { Fact } from "../../career/facts/types.ts";

const sources=()=>({facts:{results:[],timeline:[],performance:{maximums:null},records:{firstTourCard:null,bestWorldRanking:null}},
  relationships:{opponents:[],world:{players:[]}},currentWeek:1,currentRank:null,holdsCard:false,earningsPence:0,earningsEvidence:[]} as unknown as GoalSources);
const fact=(id:string,season=1,day=7):Fact=>({id,source:"A3 event result",label:id,season,day,week:Math.ceil(day/7),date:"2026-01-07",age:20,eventId:id});
const row=(definition:GoalRow["definition"],baseline_evidence:string[]=[]):GoalRow=>({id:"goal",career_save_id:"save",request_key:"req",definition,target_key:targetKey(definition),
  baseline_evidence,status:"ACTIVE",created_season:1,created_week:1,completed_evidence:null});
const event=(id:string,extra:Partial<Opportunity>={}):Opportunity=>({id,name:id,season:1,startDay:7,circuit:"COUNTY",classification:"RANKING",tier:"LOCAL",status:"REGISTRATION_OPEN",
  canEnter:true,eligible:true,denials:[],relationship:"NONE",majorRoute:false,firstPrizePence:5000,estimatedCostPence:500,registration:{opensWeek:1,closesWeek:1},...extra});

test("strict focus/goal definitions reject invented types, completion fields and malformed targets",()=>{
  assert.equal(focusSchema.parse({focus:"OPEN_SCHEDULE"}).focus,"OPEN_SCHEDULE");
  for (const d of [{type:"XP"},{type:"WIN_TITLE",completed:true},{type:"EARNINGS",target:-1},{type:"REACH_WORLD_RANK",target:1.5},{type:"WIN_EVENT",eventId:"bad"}])
    assert.throws(()=>goalSchema.parse(d));
  assert.throws(()=>focusSchema.parse({focus:"OPEN_SCHEDULE",bonus:100}));
  assert.deepEqual(goalSchema.parse({type:"REACH_WORLD_RANK",target:64}),{type:"REACH_WORLD_RANK",target:64});
});
test("completion keeps a thin supporting reference and uses immutable identity for age at the actual known date",()=>{
  const evidence={...fact("event"),age:19,wins:4,losses:0};
  const record=completionFact(evidence,"2006-01-03");
  assert.equal(record.age,20,"birthday passed between event start and result date");
  assert.equal(record.date,"2026-01-07");assert.equal(record.id,evidence.id);
  assert.ok(!("wins" in record) && !("losses" in record));
  const unknown=completionFact({...evidence,date:null,age:null},"2006-01-03");
  assert.equal(unknown.date,null);assert.equal(unknown.age,null);
});
test("titles/finals use A7.1 event evidence, exclude pre-selection achievements and preserve exact source metadata",()=>{
  const s=sources(),old={...fact("old"),champion:true},next={...fact("next",2,10),champion:true};
  s.facts.results=[old,next] as never;
  const goal=row({type:"WIN_TITLE"},["old"]);
  const p=goalProgress(goal,s);
  assert.equal(p.progress.current,1);assert.deepEqual(p.evidence,next);
  assert.equal(goal.status,"ACTIVE","pure derivation cannot write completion or rewards");
  assert.equal(goalProgress(row({type:"WIN_TITLE"},["old","next"]),s).evidence,null);
  assert.deepEqual(evidenceFor({type:"REACH_FINAL"},s),[old,next]);
});
test("ranking and Tour Card milestones use existing published facts; current ranking may later fall",()=>{
  const s=sources(),rank={...fact("rank",2,8),position:32};
  s.currentRank=81;s.facts.records.bestWorldRanking=rank;
  assert.equal(goalProgress(row({type:"REACH_WORLD_RANK",target:64}),s).progress.current,81);
  assert.deepEqual(goalProgress(row({type:"REACH_WORLD_RANK",target:64}),s).evidence,rank);
  s.facts.records.firstTourCard=fact("card",2);
  assert.equal(goalProgress(row({type:"EARN_TOUR_CARD"}),s).evidence?.id,"card");
});
test("Career earnings uses A4 prize earnings, not balance or sponsors, with the crossing ledger evidence",()=>{
  const s=sources();
  s.earningsPence=120000;
  s.earningsEvidence=[{id:"one",amountPence:70000,fact:fact("ledger:one")},{id:"two",amountPence:50000,fact:fact("ledger:two",2)}];
  const p=goalProgress(row({type:"EARNINGS",target:100000},["ledger:one"]),s);
  assert.equal(p.progress.current,120000);assert.equal(p.evidence?.id,"ledger:two");
});
test("opponent goals use new played H2H; old wins, retirement and later relationship evolution do not fabricate success",()=>{
  const s=sources();
  const history=[{id:"old",won:true,season:1,day:1},{id:"loss",won:false,season:1,day:2},{id:"win",won:true,season:1,day:3},{id:"win2",won:true,season:1,day:4}]
    .map(m=>({...m,eventId:"event",date:null,humanAge:20}));
  s.relationships.opponents=[{player:{id:"npc",status:"ACTIVE"},history,labels:[]}] as never;
  const p=goalProgress(row({type:"IMPROVE_H2H",opponentId:"npc"},["match:old"]),s);
  assert.equal(p.progress.current,1);assert.equal(p.evidence?.id,"match:win2");
  assert.equal(goalProgress(row({type:"BEAT_RELATIONSHIP",opponentId:"npc",relationship:"Nemesis"},["match:old"]),s).evidence?.id,"match:win");
  s.relationships.opponents[0].player.status="RETIRED";
  assert.match(goalProgress(row({type:"BEAT_OPPONENT",opponentId:"npc"},history.map(m=>`match:${m.id}`)),s).progress.note!,/retired/);
  assert.equal(goalProgress(row({type:"BEAT_OPPONENT",opponentId:"npc"},history.map(m=>`match:${m.id}`)),s).evidence,null);
});
test("major/world/amateur titles follow existing event classification, not generic qualifier finals",()=>{
  const s=sources();
  s.facts.results=[{...fact("qual"),champion:true,circuit:"GRASSROOTS",presentationTier:"FEATURED"},
    {...fact("county"),champion:true,circuit:"COUNTY",presentationTier:"LOCAL"},
    {...fact("major"),champion:true,circuit:"MAJOR",presentationTier:"MAJOR"},
    {...fact("world"),champion:true,circuit:"WORLD_CHAMPIONSHIP",presentationTier:"WORLD"}] as never;
  assert.deepEqual(evidenceFor({type:"WIN_MAJOR"},s).map(f=>f.id),["major"]);
  assert.deepEqual(evidenceFor({type:"WIN_WORLD"},s).map(f=>f.id),["world"]);
  assert.deepEqual(evidenceFor({type:"WIN_AMATEUR_TITLE"},s).map(f=>f.id),["qual","county"]);
});
test("recommendations are deterministic, preserve blocked-state denials and leave the normal calendar untouched",()=>{
  const events=[event("county"),event("q",{circuit:"Q_SCHOOL",canEnter:false,eligible:false,denials:["BELOW_MINIMUM_AGE"]}),
    event("cancelled",{status:"CANCELLED"}),event("route",{majorRoute:true}),event("local-qualifier",{classification:"QUALIFIER"})];
  const before=structuredClone(events);
  assert.deepEqual(recommend("MAJOR_QUALIFICATION",events).map(e=>e.id),["route"]);
  assert.deepEqual(recommend("AMATEUR_CIRCUIT",events).map(e=>e.id),["county","local-qualifier","route"]);
  assert.deepEqual(recommend("OPEN_SCHEDULE",events).map(e=>e.id),["county","q","route","local-qualifier"]);
  assert.deepEqual(recommend("PROFESSIONAL_PATHWAY",events),recommend("PROFESSIONAL_PATHWAY",events));
  assert.deepEqual(recommend("PROFESSIONAL_PATHWAY",events).find(e=>e.id==="q")?.denials,["BELOW_MINIMUM_AGE"]);
  assert.deepEqual(events,before);
});
test("prize focus ranks factual prizes/costs, not probabilities, profit or monetary rewards",()=>{
  const list=recommend("PRIZE_MONEY",[event("cheap",{firstPrizePence:1000}),event("high",{firstPrizePence:100000,estimatedCostPence:50000})]);
  assert.equal(list[0].id,"high");assert.match(list[0].reason,/not guaranteed/);
  assert.equal(list[0].estimatedCostPence,50000);
});
test("missing dart evidence stays unavailable, and verified aggregates do not invent exact crossing dates",()=>{
  const s=sources(),g=row({type:"MAXIMUMS",target:10});
  assert.equal(goalProgress(g,s).progress.current,null);assert.equal(goalProgress(g,s).evidence,null);
  s.facts.performance.maximums=10;
  assert.match(goalProgress(g,s).progress.note!,/exact crossing/);
  assert.equal(goalProgress(g,s).evidence,null);
});
