import {test} from "node:test";
import assert from "node:assert/strict";
import {catalogueFor} from "../../career/calendar/catalogue.ts";
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
