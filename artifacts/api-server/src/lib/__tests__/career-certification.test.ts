import {test} from "node:test";
import assert from "node:assert/strict";
import {catalogueFor} from "../../career/calendar/catalogue.ts";
import {generateSeason} from "../../career/calendar/generation.ts";
import {assessCapability,a2MatchFormat,liveMatchFormat,bestOfForRound} from "../../career/calendar/formats.ts";
import {SEASON_GROUPINGS,groupingForWeek} from "../../career/calendar/config.ts";
import {SEASON_RHYTHM} from "../../career/content/world.ts";
import {generateInitialWorld} from "../../career/world/generation.ts";
import {simulateNpcMatch} from "../../career/world/simulation.ts";
import {createMatch,throwDart,planBotX01Visit,seededRandom} from "../../shared/darts-rules/index.ts";
import {BOOTSTRAP_STATUS} from "../../career/calendar/providers.ts";
const seed="a12e".repeat(16),world=generateInitialWorld(seed,1);
test("one six-phase rhythm authority, all endpoints and invalid weeks",()=>{
  assert.equal(SEASON_RHYTHM,SEASON_GROUPINGS);
  assert.equal(SEASON_GROUPINGS.length,6);
  for(const g of SEASON_GROUPINGS)for(const week of [g.fromWeek,g.toWeek])assert.equal(groupingForWeek(week),g);
  for(const w of [0,53,NaN,Infinity,1.5])assert.throws(()=>groupingForWeek(w));
});
test("every current definition classified with safe format/adapter agreement",()=>{
  const definitions=catalogueFor(5);assert.equal(definitions.length,92);
  for(const d of definitions){
    const c=assessCapability(d.format,true);
    if(!c.executable){assert.ok(c.reasons.length);continue;}
    assert.equal(d.format.sideSize,1);assert.equal(d.format.outRule,"DOUBLE");
    if(d.format.structure==="GROUP_KNOCKOUT")assert.equal(d.fieldSize,16);
    for(const stage of d.format.stages)for(const length of stage.bestOfByRound){
      const live=liveMatchFormat(d.format,length),npc=a2MatchFormat(d.format,length,0);
      assert.equal(live.startingScore,npc.startingScore??501);
      assert.equal(live.inRule,npc.inRule??"STRAIGHT");
      assert.equal(live.unit,npc.unit??"LEGS");
    }
  }
});
test("v18 keeps grassroots and amateur routes playable and removes novelty-game fixtures",()=>{
  const definitions=catalogueFor(18);
  assert.ok(definitions.some(d=>d.key==="friday-night-501"));
  assert.ok(definitions.some(d=>d.key==="county-501-open"));
  assert.ok(definitions.some(d=>d.key==="national-amateur-gbr"));
  assert.ok(definitions.some(d=>d.key==="sudden-death-night" && d.circuit==="GRASSROOTS"));
  assert.ok(definitions.some(d=>d.key==="regional-champions-league" && assessCapability(d.format,true).executable));
  assert.ok(!definitions.some(d=>["cricket-classic","national-cricket","halve-it-night","killer-night","football-darts","golf-night","count-up-challenge",
    "shanghai-showdown","bobs-27-challenge","scram-shootout","baseball-darts-classic","fives-festival","snooker-darts-cup",
    "noughts-and-crosses-trophy","treble-out-trophy"].includes(d.key)));
  const unplayable=definitions.filter(d=>!assessCapability(d.format,true).executable);
  assert.deepEqual(unplayable.map(d=>d.key),[]);
});
test("v19 covers the major PDC and WDF routes with playable 501 events",()=>{
  const definitions=catalogueFor(19);
  const keys=new Set(definitions.map(d=>d.key));
  for(const key of ["thursday-night-darts","open-championship","long-format-matchplay","double-crown",
    "european-championship","grand-slam-of-champions","pro-circuit-finals","world-darts-championship",
    "pro-circuit-championship","european-dart-series","world-dart-series","challenger-event",
    "development-tour","women-tour","wdf-world-championship","wdf-world-masters","wdf-world-cup",
    "wdf-europe-cup","wdf-asia-pacific-cup","wdf-gold-open","wdf-silver-open","wdf-bronze-open",
    "wdf-nevada-open","wdf-low-countries-open","wdf-caledonian-open","wdf-manx-open","wdf-ulster-open",
    "wdf-baltic-open","wdf-britannia-open","wdf-danube-masters","wdf-emerald-open","wdf-bohemian-open",
    "wdf-mediterranean-masters","wdf-southern-cross-open","pdc-womens-matchplay","pdc-youth-world-championship"]) {
    assert.ok(keys.has(key),`missing circuit event ${key}`);
  }
  assert.equal(definitions.find(d=>d.key==="thursday-night-darts")?.name,"Premier Darts League");
  assert.ok(!definitions.some(d=>d.circuit==="VAULT"),"fictional Vault circuit must not be in the real-world calendar");
  assert.ok(!keys.has("pro-super-series"),"the discontinued pandemic-era series is not a regular circuit");
  assert.deepEqual(definitions.filter(d=>!assessCapability(d.format,true).executable).map(d=>d.key),[]);
});
test("v20 keeps event names distinct from official PDC/WDF branding",()=>{
  const definitions=catalogueFor(20);
  const names=new Map(definitions.map(d=>[d.key,d.name]));
  assert.equal(names.get("pdc-youth-world-championship"),"Pro Youth World Championship");
  assert.equal(names.get("wdf-world-championship"),"Lakeside World Championship");
  assert.equal(names.get("wdf-gold-open"),"Gold-Ranked International Open");
  assert.equal(names.get("women-world-championship"),"Women's World Championship");
  assert.deepEqual(definitions.filter(d=>!assessCapability(d.format,true).executable).map(d=>d.key),[]);
});
test("v31 keeps WDF team cups competitive but outside singles ranking lists",()=>{
  const previous=catalogueFor(30),current=catalogueFor(31);
  const teamCups=["wdf-world-cup","wdf-europe-cup","wdf-asia-pacific-cup"];
  for(const key of teamCups){
    const old=previous.find(d=>d.key===key)!;
    const next=current.find(d=>d.key===key)!;
    assert.equal(old.classification,"RANKING","published event editions are immutable");
    assert.equal(next.classification,"TEAM");
    assert.equal(next.rankingCategory,null);
    assert.equal(next.format.sideSize,2,"team format remains playable");
    assert.equal(assessCapability(next.format,true).executable,true);
  }
  for(const key of ["wdf-world-championship","wdf-world-masters","wdf-gold-open","wdf-silver-open"]){
    const event=current.find(d=>d.key===key)!;
    assert.equal(event.classification,"RANKING",`${key} remains a singles ranking event`);
    assert.ok(event.rankingCategory);
  }
  assert.deepEqual(current.filter(d=>!assessCapability(d.format,true).executable).map(d=>d.key),[]);
});
test("v21 restores Vault as an optional tour without same-day clashes with headline circuits",()=>{
  const rows=generateSeason(seed,21,1);
  const vault=rows.filter(e=>e.circuit==="VAULT");
  assert.equal(vault.length,23);
  const highCircuits=new Set(["MAJOR","WORLD_CHAMPIONSHIP","WORLD_SERIES","EUROPEAN_SERIES","PRO_CIRCUIT","INVITATIONAL","Q_SCHOOL","CHALLENGER"]);
  const headlines=rows.filter(e=>highCircuits.has(e.circuit)&&e.definitionKey!=="thursday-night-darts");
  const clashes=vault.flatMap(v=>headlines.filter(h=>v.startDay<=h.endDay&&h.startDay<=v.endDay)
    .map(h=>`${v.name} clashes with ${h.name}`));
  assert.deepEqual(clashes,[]);
  const premierLeagueNights=Array.from({length:16},(_,i)=>(6+i-1)*7+4);
  assert.deepEqual(vault.filter(v=>premierLeagueNights.some(day=>v.startDay<=day&&day<=v.endDay)),[]);
  assert.deepEqual(vault.filter(e=>e.definitionKey==="vault-tour").map(e=>Math.floor((e.startDay-1)/7)+1).filter((w,i,a)=>a.indexOf(w)===i),
    [7,13,19,25,33,37,45]);
  const keyEvents=rows.filter(e=>["world-dart-series","world-dart-series-finals","european-dart-series","world-cup-of-darts",
    "long-format-matchplay","double-crown","european-championship","grand-slam-of-champions","pro-circuit-finals",
    "world-darts-championship","pdc-womens-matchplay","pdc-youth-world-championship","open-championship","champions-masters",
    "wdf-world-championship","wdf-world-masters","wdf-world-cup","wdf-europe-cup","wdf-asia-pacific-cup"].includes(e.definitionKey));
  const collisions=keyEvents.flatMap((a,i)=>keyEvents.slice(i+1).filter(b=>a.startDay<=b.endDay&&b.startDay<=a.endDay)
    .map(b=>`${a.definitionKey}:${a.startDay}-${a.endDay} / ${b.definitionKey}:${b.startDay}-${b.endDay}`));
  assert.deepEqual(collisions,[]);
});
for(const key of ["world-darts-championship","double-crown","county-301-sprint","county-701-open"]){
  test(`${key}: real shared scorer and real NPC darts complete with matching authored rules`,()=>{
    const d=catalogueFor(5).find(d=>d.key===key)!;
    assert.equal(assessCapability(d.format,true).executable,true);
    const bestOf=bestOfForRound(d.format,1,Math.ceil(Math.log2(d.fieldSize)));
    const npc=simulateNpcMatch({players:[world[0],world[1]],context:{category:d.format.matchContext,roundImportance:0.5,elimination:true},
      format:a2MatchFormat(d.format,bestOf,0),seed,generationVersion:1,matchKey:key,difficulty:"STANDARD"});
    assert.ok(npc.legs.length>0);assert.ok(npc.legs.every(l=>l.points[l.winner]===d.format.startingScore));
    const rng=seededRandom(key);let s=createMatch(liveMatchFormat(d.format,bestOf),0);
    while(!s.complete&&s.dartsThrown<10000){
      const turn=s.turn,leg=s.legNo;
      for(const dart of planBotX01Visit(s.scores[turn],{avg:75,sd:8,checkoutPct:0.45,hitAcc:0.75},
        {doubleOut:true,opened:s.opened[turn],rng})){
        s=throwDart(s,dart).state;if(s.complete||s.turn!==turn||s.legNo!==leg)break;
      }
    }
    assert.ok(s.complete);assert.ok(s.visits.filter(v=>v.checkout).length>0);
    if(d.format.scoringUnit==="SETS"){
      assert.equal(Math.max(...s.sets),(bestOf+1)/2);
      assert.equal(Math.max(...npc.stats.map(p=>p.setsWon!)),(bestOf+1)/2);
    }
  });
}
test("bootstrap provider reads cache/home only and cannot publish rankings",()=>{
  assert.equal(BOOTSTRAP_STATUS.id,"BOOTSTRAP_UNRANKED_STATUS");
  assert.deepEqual(BOOTSTRAP_STATUS.rankings("HUMAN"),{});
  assert.equal(BOOTSTRAP_STATUS.human({has_tour_card:false,settings_snapshot:{}}).tourCard,false);
});
