import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { relationshipModel, RELATIONSHIP_RULES } from "../../career/relationships/model.ts";
import type { Cohort, Meeting, WorldIdentity } from "../../career/relationships/types.ts";

const player: WorldIdentity = {id:"npc",name:"Fictional Opponent",nationality:"GBR",homeRegion:"Ayrshire",age:21,startingAge:20,createdSeason:1,retiredSeason:null,status:"ACTIVE",worldRanking:42};
const meeting = (i: number, won=true, over: Partial<Meeting> = {}): Meeting => ({
  id:`match-${i}`,opponentId:"npc",eventId:`event-${i}`,name:`Event ${i}`,season:i<3 ? 1 : 2,day:i+1,date:null,round:1,stage:"MAIN",won,
  final:false,major:false,qualification:false,legsHuman:won?3:1,legsNpc:won?1:3,setsHuman:null,setsNpc:null,humanAge:21,...over,
});
const run = (ms: Meeting[], cs: Cohort[]=[], p=player) => relationshipModel("save-a",[p],ms,cs,2);
test("one meeting cannot establish a special performance relationship; IDs are idempotent and scores remain factual",()=>{
  const m=meeting(0,false);
  const o=run([m,m]).opponents[0];
  assert.equal(o.meetings,1); assert.equal(o.humanWins,0); assert.equal(o.npcWins,1); assert.equal(o.winPercentage,0);
  assert.deepEqual(o.labels,[]); assert.equal(o.firstMeeting?.legsHuman,1);
  assert.equal(run([]).opponents.length,0);
});
test("familiar requires repeated meetings spread across events; competitive recurring history creates career and generation rivals",()=>{
  assert.ok(run([0,1,2].map(i=>meeting(i))).opponents[0].labels.includes("Familiar Opponent"));
  assert.deepEqual(run([0,1,2].map(i=>meeting(i,true,{eventId:"one-event"}))).opponents[0].labels,[]);
  const o=run([0,1,2,3,4,5].map(i=>meeting(i,i%2===0))).opponents[0];
  assert.ok(o.labels.includes("Career Rival")); assert.ok(o.labels.includes("Generation Rival"));
  assert.equal(o.firstMeeting?.season,1); assert.equal(o.latestMeeting?.season,2); assert.equal(o.eventCount,6); assert.equal(o.seasonCount,2);
  assert.equal(o.winPercentage,50);
  assert.ok(!run([0,1,2,3,4,5].map(i=>meeting(i,i%2===0,{humanAge:50}))).opponents[0].labels.includes("Generation Rival"));
  assert.ok(!run([0,1,2,3,4,5].map(i=>meeting(i,i%2===0,{humanAge:null}))).opponents[0].labels.includes("Generation Rival"));
  assert.ok(!run([0,1,2,3,4,5].map(i=>meeting(i,true))).opponents[0].labels.includes("Career Rival"));
});
test("single-season rivalry requires meaningful meetings; exact equality is not required",()=>{
  const ms=[0,1,2,3,4,5].map(i=>meeting(i,i<4,{season:1}));
  assert.ok(!run(ms).opponents[0].labels.includes("Career Rival"));
  ms[0].final=true;ms[1].qualification=true;
  assert.ok(run(ms).opponents[0].labels.includes("Career Rival"));
  assert.equal(run(ms).opponents[0].finals,1);
});
test("sufficiently strong repeated losing/winning history creates dominance labels; labels evolve",()=>{
  const lost=[0,1,2,3,4].map(i=>meeting(i,i===0));
  assert.ok(run(lost).opponents[0].labels.includes("Nemesis"));
  assert.ok(run(lost.map(m=>({...m,won:!m.won}))).opponents[0].labels.includes("Favourite Opponent"));
  const evolved=run([...lost,...[5,6,7,8,9].map(i=>meeting(i,true))]).opponents[0];
  assert.ok(!evolved.labels.includes("Nemesis"));assert.ok(evolved.labels.includes("Career Rival"));
});
test("cohorts remain independent of age, current status and performance; retired identities remain readable",()=>{
  const cohorts: Cohort[]=[{opponentId:"npc",kind:"Q-School Class",season:1,session:"uk-first",name:"UK first"},
    {opponentId:"npc",kind:"Junior Contemporary",season:1,session:"junior-1",name:"Junior event"}];
  const p={...player,age:60,status:"RETIRED" as const,retiredSeason:8};
  const o=run([], [...cohorts,...cohorts],p).opponents[0];
  assert.equal(o.meetings,0);assert.equal(o.winPercentage,null);assert.equal(o.cohorts.length,2);
  assert.deepEqual(o.labels,["Q-School Class","Junior Contemporary"]);
  assert.deepEqual(run([meeting(0,false)],cohorts,p).opponents[0].cohorts,o.cohorts);
  assert.equal(run([meeting(0)],[],p).opponents[0].player.name,player.name);
});
test("model is read-only, thresholds are central, generation labels are context and writers have no relationship dependencies",()=>{
  const ps=[structuredClone(player)], ms=[meeting(0)], cs: Cohort[]=[];
  const before=JSON.stringify({ps,ms,cs});
  const model=relationshipModel("save-a",ps,ms,cs,2);
  assert.equal(JSON.stringify({ps,ms,cs}),before);
  assert.equal(model.world.youngAgeMaximum,RELATIONSHIP_RULES.youngAgeMaximum);
  assert.equal(model.world.youngPlayers,1);assert.equal(model.world.newEntrants,0);
  for (const file of ["world/simulation.ts","world/development.ts","calendar/engine.ts","sporting/service.ts","finance/service.ts"]) {
    assert.doesNotMatch(readFileSync(new URL(`../../career/${file}`,import.meta.url),"utf8"),/relationships\//);
  }
});
