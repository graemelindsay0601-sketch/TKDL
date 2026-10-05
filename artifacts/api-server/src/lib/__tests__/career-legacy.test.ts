import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aggregate, descriptors, eraLabel, hall, legacy, recordEvents, records, review, seasonAwards, zero } from "../../career/legacy/model.ts";
import { eventHistory, npcHistory } from "../../career/legacy/persistence.ts";
import type { Evidence, Player, Result, Totals } from "../../career/legacy/types.ts";
const player=(id:string,extra:Partial<Player>={}):Player=>({id,name:id,startingAge:20,createdSeason:1,retiredSeason:null,...extra});
const total=(id:string,season=1,extra:Partial<Totals>={}):Totals=>({...zero(id,season),appearances:1,wins:3,...extra});
const result=(extra:Partial<Result>={}):Result=>({id:"result:event:HUMAN",key:"palace",name:"Palace",season:1,day:350,participant:"HUMAN",
  position:1,champion:true,final:true,circuit:"WORLD_CHAMPIONSHIP",tier:"WORLD",classification:"MAIN",...extra});
const evidence=(extra:Partial<Evidence>={}):Evidence=>({saveId:"save-a",currentSeason:2,currentWeek:1,retired:false,
  players:[player("HUMAN"),player("npc")],totals:[],results:[],rankings:[],cards:[],money:[],sponsors:[],qualifications:[],decisions:[],
  commitments:[],merchandise:null,...extra});
test("season scope, deterministic identity/story, actual money and published endpoints",()=>{
  const e=evidence({totals:[total("HUMAN",1,{titles:1,worlds:1,majorTitles:1}),total("HUMAN",2,{titles:8})],results:[result()],
    money:[{season:1,prizePence:500,commercialPence:100},{season:2,prizePence:9000,commercialPence:0}],
    rankings:[{id:"start",season:0,week:52,participant:"HUMAN",position:64},{id:"end",season:1,week:50,participant:"HUMAN",position:8}]});
  const r=review(e,1,"CAPTURED");
  assert.deepEqual(review(e,1,"CAPTURED"),r);assert.equal(r.identity,"World Champion");
  assert.equal(r.human.titles,1);assert.equal(r.prizePence,500);assert.equal(r.commercialPence,100);assert.equal(r.rankingMovement,56);
  assert.equal(r.finalRank?.week,50);assert.equal(r.worldResult?.id,"result:event:HUMAN");
});
test("amateur-only achievement is valid and pro status is not its identity",()=>{
  const e=evidence({totals:[total("HUMAN",1,{amateurTitles:3,nationalTitles:2,titles:3})]});
  assert.equal(review(e,1).identity,"An Outstanding Amateur Season");
  assert.ok(!review(e,1).story.join(" ").includes("failed to turn"));
  assert.equal(eraLabel(review(e,1)),"Amateur Achievement Years");
});
test("restrained, difficult and unsupported seasons are honest",()=>{
  assert.equal(review(evidence(),1).identity,"A Quiet Season");
  const r=review(evidence({totals:[total("HUMAN",1,{wins:0,losses:3})]}),1);
  assert.equal(r.identity,"A Difficult Campaign");assert.equal(r.startingRank,null);assert.equal(r.worldResult,null);
  assert.deepEqual(r.awards,[]);assert.deepEqual(r.recordEvents,[]);
});
test("awards are deterministic and explained; NPCs and amateurs can win",()=>{
  const e=evidence({totals:[total("HUMAN",1,{titles:3,amateurTitles:3,nationalTitles:3}),total("npc",1,{titles:1,proTitles:1})]});
  const a=seasonAwards(e,1);assert.deepEqual(a,seasonAwards({...e,totals:[...e.totals].reverse()},1));
  assert.equal(a.find(x=>x.kind==="Player of the Season")?.participant,"HUMAN");
  assert.equal(a.find(x=>x.kind==="Amateur Player of the Season")?.participant,"HUMAN");
  assert.ok(a.every(x=>x.reason&&x.sources.length));
  const npc=seasonAwards(evidence({totals:[total("npc",1,{worlds:1,majorTitles:1,titles:1})],results:[result({participant:"npc"})]}),1);
  assert.equal(npc.find(a=>a.kind==="Player of the Season")?.participant,"npc");
});
test("young award uses public start-of-season age and requires sporting participation",()=>{
  const e=evidence({players:[player("HUMAN",{startingAge:24}),player("npc",{startingAge:23})],
    totals:[total("HUMAN",1,{worlds:1}),total("npc")]});
  assert.equal(seasonAwards(e,1).find(a=>a.kind==="Young Player of the Season")?.participant,"npc");
  assert.equal(seasonAwards({...e,players:e.players.map(p=>({...p,startingAge:null}))},1).some(a=>a.kind==="Young Player of the Season"),false);
});
test("breakthrough is not a random young-player award; published change is required",()=>{
  assert.equal(seasonAwards(evidence({totals:[total("npc")]}),1).some(a=>a.kind==="Breakthrough Player"),false);
  const e=evidence({totals:[total("npc",1),total("npc",2)],rankings:[
    {id:"old",participant:"npc",season:1,week:52,position:80},{id:"new",participant:"npc",season:2,week:52,position:16}]});
  assert.deepEqual(seasonAwards(e,2).find(a=>a.kind==="Breakthrough Player")?.sources,["old","new"]);
});
test("persona, commercial activity and presentation never decide sporting awards",()=>{
  const e=evidence({totals:[total("npc",1,{titles:2})]});
  const changed={...e,decisions:[{id:"choice",season:1,kind:"DIALOGUE",thread:"palace"}],commitments:[{id:"paid",season:1,title:"TV",status:"COMPLETED"}]};
  assert.deepEqual(seasonAwards(e,1),seasonAwards(changed,1));
});
test("world snapshot uses recorded major/World champions, #1, Card changes and retirements",()=>{
  const e=evidence({players:[player("HUMAN"),player("npc",{retiredSeason:1})],results:[result({participant:"npc"})],
    rankings:[{id:"r",participant:"npc",season:1,week:52,position:1}],
    cards:[{id:"c",participant:"npc",source:"Q_SCHOOL_DIRECT",awardedSeason:1,awardedWeek:4,startSeason:1,endSeason:2,status:"ACTIVE",endedSeason:null,endedWeek:null}]});
  const r=review(e,1,"CAPTURED");assert.equal(r.world.numberOne?.id,"npc");assert.equal(r.world.champions[0].participant,"npc");
  assert.equal(r.world.retirements[0].id,"npc");assert.equal(r.world.cardChanges[0].id,"c");
  assert.deepEqual(review(e,9).world.champions,[]);
});
test("later Card loss does not rewrite reconstructed prior award status",()=>{
  const e=evidence({cards:[{id:"c",participant:"npc",source:"Q_SCHOOL_DIRECT",awardedSeason:1,awardedWeek:4,startSeason:1,endSeason:3,status:"LOST",endedSeason:3,endedWeek:52}]});
  assert.equal(review(e,1).world.cardChanges[0].status,"ACTIVE");assert.equal(review(e,1).world.cardChanges[0].endedSeason,null);
});
test("event legends use exact lineage and do not fabricate defending champions",()=>{
  const e=evidence({currentSeason:3,results:[result(),result({id:"b",season:2,participant:"npc"}),result({id:"c",key:"elsewhere",season:2})]});
  const h=eventHistory(e,"palace");assert.equal(h.champions.length,2);assert.equal(h.defendingChampion?.participant,"npc");
  assert.equal(h.human.length,1);assert.equal(h.mostFinals.length,2);
  assert.equal(eventHistory({...e,currentSeason:5},"palace").defendingChampion,null);
});
test("record crossings are strict, ties are not breaks and first observations are baselines",()=>{
  const e=evidence({totals:[total("HUMAN",1,{titles:2}),total("npc",2,{titles:2})]});
  assert.deepEqual(recordEvents(e,1),[]);assert.equal(recordEvents(e,2).some(r=>r.metric==="titles"),false);
  const broken={...e,totals:[...e.totals,total("HUMAN",2,{titles:1})]};
  assert.equal(recordEvents(broken,2).find(r=>r.metric==="titles")?.previousValue,2);
  assert.equal(recordEvents(broken,2).find(r=>r.metric==="titles")?.value,3);
});
test("records never compare invented NPC scoring or NPC cash against human authorities",()=>{
  const r=records(evidence({totals:[total("npc",1,{titles:3})],money:[{season:1,prizePence:100,commercialPence:90}]}));
  assert.doesNotMatch(JSON.stringify(r),/180|checkout|potential|ability|legacyScore/);
  assert.equal(r.find(r=>r.metric==="human-season-prize")?.holders[0].id,"HUMAN");
});
test("Hall of Fame requires retirement and exceptional achievement via multiple routes",()=>{
  const years=Array.from({length:5},(_,i)=>total("HUMAN",i+1,{titles:4,amateurTitles:4,nationalTitles:1}));
  const e=evidence({currentSeason:6,players:[player("HUMAN",{retiredSeason:6})],totals:years});
  assert.equal(hall(e)[0].route,"Amateur Great");assert.deepEqual(hall(e),hall(e));
  assert.deepEqual(hall({...e,players:[player("HUMAN")]}),[]);
  assert.equal(hall(evidence({players:[player("npc",{retiredSeason:2})],totals:[total("npc",1,{worlds:2,majorTitles:2})]}))[0].route,"Professional Great");
});
test("longevity alone and one ordinary win never qualify",()=>{
  const e=evidence({currentSeason:20,players:[player("npc",{retiredSeason:20})],
    totals:Array.from({length:19},(_,i)=>total("npc",i+1))});
  assert.deepEqual(hall(e),[]);assert.deepEqual(hall({...e,totals:[total("npc",1,{titles:1})]}),[]);
});
test("eras merge only consecutive factual seasons; no forced professional ladder",()=>{
  const e=evidence({currentSeason:5,totals:[total("HUMAN",1,{amateurTitles:1}),total("HUMAN",2,{amateurTitles:1}),total("HUMAN",4,{amateurTitles:1})]});
  const v=legacy(e,[review(e,1),review(e,2),review(e,4)],[],null);
  assert.deepEqual(v.eras,[{from:1,to:2,label:"Amateur Achievement Years"},{from:4,to:4,label:"Amateur Achievement Years"}]);
  assert.equal(v.overview.amateurTitles,3);assert.equal(v.completedSeasons.length,3);
});
test("descriptors and factual comparisons have no universal numeric Legacy Score",()=>{
  const t=total("HUMAN",1,{titles:30,amateurTitles:30,nationalTitles:7});
  assert.ok(descriptors(t,null,[]).includes("Amateur Great"));
  const v=legacy(evidence({totals:[t]}),[],[],null);
  assert.match(v.comparisons.join(" " ),/30/);assert.doesNotMatch(JSON.stringify(v),/legacyScore|GOAT|XP:/);
});
test("retired NPC history remains derived from the same owned universe",()=>{
  const e=evidence({players:[player("npc",{retiredSeason:1})],totals:[total("npc",1,{titles:1})],results:[result({participant:"npc"})]});
  const h=npcHistory(e,"npc",[],[]);
  assert.equal(h.totals?.titles,1);assert.equal(h.player.retiredSeason,1);assert.equal(h.titles.length,1);
});
test("source boundary: no sporting/finance authority writes, hidden reads or RNG in legacy",()=>{
  const dir=new URL("../../career/legacy/",import.meta.url);
  const all=["model.ts","persistence.ts","service.ts"].map(p=>readFileSync(new URL(p,dir),"utf8")).join("\n");
  assert.doesNotMatch(all,/Math\.random|randomUUID|current_ability|potential|development_config|UPDATE career_(?:world_players|ranking|tour_cards|event_results|finance_entries)/);
  assert.doesNotMatch(all,/\bpost\(/);
  assert.match(all,/ON CONFLICT DO NOTHING/);
});
