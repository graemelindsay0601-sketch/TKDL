import { test } from "node:test";
import assert from "node:assert/strict";
import { sportingStatistics, performanceStatistics } from "../../career/facts/model.ts";
import type { EventFact, MatchEvidence, DartEvidence } from "../../career/facts/types.ts";
import type { Dart } from "../../shared/darts-rules/x01.ts";
const match = (id:string,season:number,day:number,won:boolean):MatchEvidence=>({id,eventId:`e${season}-${day}`,name:'Event',season,day,round:1,slot:0,won});
const event = (id:string,position:number,stageReached:string):EventFact=>({id,eventId:id,source:'A3',label:'Result',season:1,day:2,week:1,date:null,age:18,name:'Event',definitionKey:id,circuit:'AMATEUR',classification:'NON_RANKING',presentationTier:'LOCAL',country:'GB',participantKey:'HUMAN',participantName:'You',position,stageReached,champion:position===1,wins:0,losses:0});
const d = (segment:number,multiplier:1|2|3=1):Dart=>({segment,multiplier,value:segment*multiplier});

test('sporting totals deduplicate IDs, order across seasons, count stages, and update records from new facts',()=>{
  const rows=[match('c',2,1,false),match('a',1,363,true),match('b',1,364,true),match('d',2,2,true)];
  const events=[event('a',1,'CHAMPION'),event('b',2,'FINAL'),event('c',3,'SEMI_FINAL'),event('d',5,'QUARTER_FINAL')];
  const s=sportingStatistics([...rows,rows[0]],[...events,events[0]],2);
  assert.equal(s.matchesPlayed,4); assert.equal(s.wins,3); assert.equal(s.losses,1); assert.equal(s.winPercentage,75);
  assert.equal(s.currentWinningStreak,1); assert.equal(s.longestWinningStreak,2); assert.equal(s.eventsEntered,4);
  assert.equal(s.titles,1); assert.equal(s.runnersUp,1); assert.equal(s.semiFinals,1); assert.equal(s.quarterFinals,1); assert.equal(s.seasonsPlayed,2);
  assert.equal(s.bestFinish?.eventId,'a');
  assert.equal(sportingStatistics([...rows,match('e',2,3,true),match('f',2,4,true)],events,2).longestWinningStreak,3);
  assert.equal(sportingStatistics([{...rows[0],day:1,eventId:'x'},{...rows[1],season:2,day:1,eventId:'y'}],[],2).longestWinningStreak,null);
});
test('empty and missing evidence distinguish unmeasured figures from measured zero',()=>{
  const s=sportingStatistics([],[],1); assert.equal(s.matchesPlayed,0); assert.equal(s.winPercentage,null); assert.equal(s.seasonsPlayed,0); assert.equal(s.bestFinish,null);
  const p=performanceStatistics([],4); assert.equal(p.threeDartAverage,null); assert.equal(p.maximums,null); assert.equal(p.unavailableMatches,4); assert.equal(p.bestMatchAverage,null);
});
test('actual dart replay gives weighted averages, visits and checkouts without inventing attempted targets',()=>{
  // Human wins 501 in nine darts: 180,180,141. Opponent misses six darts.
  const e:DartEvidence={matchId:'a',eventId:'e',format:{startingScore:501,inRule:'STRAIGHT',outRule:'DOUBLE',unit:'LEGS',bestOfLegs:1},firstThrower:0,
    darts:[d(20,3),d(20,3),d(20,3),d(0),d(0),d(0),d(20,3),d(20,3),d(20,3),d(0),d(0),d(0),d(20,3),d(19,3),d(12,2)]};
  const p=performanceStatistics([e,e],2);
  assert.equal(p.recordedMatches,1); assert.equal(p.unavailableMatches,1); assert.equal(p.darts,9); assert.equal(p.threeDartAverage,167);
  assert.equal(p.maximums,2); assert.equal(p.visits140Plus,3); assert.equal(p.visits100Plus,3); assert.equal(p.highestCheckout,141); assert.equal(p.checkoutsCompleted,1);
  assert.equal(p.checkoutAttempts,null); assert.equal(p.checkoutPercentage,null); assert.equal(p.bestMatchAverage?.value,167);
  // Bust visit contributes zero points but its actual two darts still count.
  const b:DartEvidence={...e,matchId:'b',format:{...e.format,startingScore:40},darts:[d(20),d(20),d(0),d(0),d(0),d(20,2)]};
  const bust=performanceStatistics([b],1); assert.equal(bust.darts,3); assert.equal(bust.threeDartAverage,40); assert.equal(bust.maximums,0);
  assert.equal(performanceStatistics([e,b],2).threeDartAverage,135.25);
  assert.equal(performanceStatistics([{...e,darts:e.darts.slice(0,-1)}],1).recordedMatches,0);
});
