import {before,after,test} from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {sql} from "drizzle-orm";
import {createCareerSaves} from "../../db/migrations/create_career_saves.ts";
import {createCareerWorld} from "../../db/migrations/create_career_world.ts";
import {createCareerCalendar} from "../../db/migrations/create_career_calendar.ts";
import {createCareerFinance} from "../../db/migrations/create_career_finance.ts";
import {createCareerSporting} from "../../db/migrations/create_career_sporting.ts";
import {createCareerService} from "../../career/service.ts";
import {createCareerSportingService} from "../../career/sporting/service.ts";
import {createCareerLiveMatchService} from "../../career/live/service.ts";
import {createCareerTournamentService,createCareerTournamentRouter,importance,presentationDepth} from "../../career/tournament/service.ts";
import {catalogueFor} from "../../career/calendar/catalogue.ts";
import {assessCapability,groupKnockout501} from "../../career/calendar/formats.ts";
import {GROUP_SCHEDULE,groupTable,bullRanking,groupSeats,GROUP_KEYS} from "../../career/calendar/groups.ts";
import {makeGroupRows,resolvedGroups,loadBulls} from "../../career/calendar/group-engine.ts";
import {loadInstances,loadMatches,lockField,makeDraw,progressEvent,type RootRow,type InstanceRow,type MatchRow} from "../../career/calendar/engine.ts";
import {loadNpcs} from "../../career/world/repository.ts";
import {lockRoot,worldState} from "../../career/world/service.ts";
import {calendarHashOf} from "../../career/calendar/generation.ts";
import {allocateQSchool} from "../../career/sporting/qschool.ts";

const pg=new PGlite(),db=drizzle(pg),saves=createCareerService(db),sporting=createCareerSportingService(db);
const calendar=sporting.calendar,tournaments=createCareerTournamentService(db,calendar),live=createCareerLiveMatchService(db,calendar);
const actor={playerId:1},seed="8".repeat(64);
let saveId="",eventId="",withdrawSave="",withdrawEvent="",server:ReturnType<ReturnType<typeof express>["listen"]>,base="";
const rows=async(q:ReturnType<typeof sql>)=>(await db.execute(q)).rows;
const rejects=(p:Promise<unknown>,status=409)=>assert.rejects(p,(e:unknown)=>(e as {status?:number}).status===status);
const format=groupKnockout501(9,[11,13,15],4,2,"stage",1);
function fixtures(keys=["A","B","C","D"]) {
  return GROUP_SCHEDULE.flatMap((pairs,r)=>pairs.map(([a,b],s)=>({
    id:`${r}:${s}`,event_id:"test",stage_key:"groups:A",round:r+1,slot:s+1,
    a_key:keys[a],b_key:keys[b],status:"PENDING",winner_key:null,legs_a:null,legs_b:null,
  } as MatchRow)));
}
function circular(keys=["A","B","C","D"]) {
  const f=fixtures(keys),scores=[[5,0],[5,4],[4,5],[0,5],[5,4],[5,0]];
  f.forEach((m,i)=>{m.status="COMPLETED";m.legs_a=scores[i][0];m.legs_b=scores[i][1];m.winner_key=m.legs_a>m.legs_b?m.a_key:m.b_key;});
  return f;
}
before(async()=>{
  await pg.exec(`CREATE TABLE players(id integer PRIMARY KEY);INSERT INTO players VALUES(1),(2);
    CREATE TABLE feature_flags(feature_name text UNIQUE,enabled boolean,admin_test_mode boolean,description text);
    INSERT INTO feature_flags VALUES('tour_career_2',true,false,'test')`);
  await createCareerSaves(db);await createCareerWorld(db);await createCareerCalendar(db);await createCareerFinance(db);await createCareerSporting(db);
  const app=express();app.use(express.json());app.use((req,_res,next)=>{
    (req as unknown as {session:unknown}).session={playerId:Number(req.header("x-test-player")??0)};
    (req as unknown as {log:unknown}).log={error:()=>{}};next();
  });
  app.use(createCareerTournamentRouter(tournaments,calendar,a=>saves.isAvailable(a)));
  server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
  base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
});
after(async()=>{if(server)await new Promise<void>(r=>server.close(()=>r()));await pg.close();});

test("five presentation levels and all speeds are cosmetic and skippable",()=>{
  assert.deepEqual(["STANDARD","FEATURED","TELEVISED","MAJOR","WORLD"].map(t=>importance(t,"LOCAL")),[1,2,3,4,5]);
  assert.equal(importance("FEATURED","WORLD_CHAMPIONSHIP","QUALIFIER"),2,"a Palace qualifier is not the World Championship");
  for(const mode of ["FULL","BALANCED","QUICK"] as const)for(const reduced of [true,false]) {
    const p=presentationDepth(5,mode,reduced);assert.equal(p.sportingEffects,false);assert.equal(p.skippable,true);
    if(reduced||mode==="QUICK")assert.equal(p.animate,false);
  }
});
test("v4 Vault is 16 real entrants, 4x4 groups; immutable v3 and Grand fallback remain knockout",()=>{
  const vault=catalogueFor(4).find(d=>d.key==="vault-nights")!;
  assert.equal(vault.fieldSize,16);assert.equal(vault.minimumEntrants,16);assert.deepEqual(vault.npcFill,[1,1]);
  assert.equal(vault.format.structure,"GROUP_KNOCKOUT");assert.equal(assessCapability(vault.format,true).executable,true);
  assert.equal(catalogueFor(3).find(d=>d.key==="vault-nights")!.format.structure,"KNOCKOUT");
  assert.equal(assessCapability(format).executable,false,"older unsupported group content is not silently activated");
  assert.equal(catalogueFor(4).find(d=>d.key==="grand-slam-of-champions")!.format.structure,"KNOCKOUT");
});
test("exact once round robin A-D/B-C; A-C/D-B; A-B/C-D",()=>{
  assert.deepEqual(fixtures().map(m=>[m.a_key,m.b_key]),[["A","D"],["B","C"],["A","C"],["D","B"],["A","B"],["C","D"]]);
  assert.equal(new Set(fixtures().map(m=>[m.a_key,m.b_key].sort().join(":"))).size,6);
  const r={world_seed:seed} as RootRow,e={id:"event",start_day:1,end_day:7,snapshot:{format}} as InstanceRow;
  assert.equal(makeGroupRows(r,e,Array.from({length:16},(_,i)=>String(i))).length,24);
  assert.throws(()=>makeGroupRows(r,e,Array(16).fill("A")),/real confirmed/);
});
test("circular three-way ties use aggregates, not ID, ability, RNG or premature head-to-head",()=>{
  const t=groupTable(circular(),"A");
  assert.equal(t.finished,true);assert.deepEqual(t.pendingTie,["A","B","C"]);
  assert.deepEqual(t.buckets[0].map(p=>[p.played,p.wins,p.losses,p.legDifference,p.legsFor,p.legsAgainst]),Array(3).fill([3,2,1,5,14,9]));
  const renamed=groupTable(circular(["z","a","middle","last"]),"A");assert.deepEqual(renamed.pendingTie,["z","a","middle"]);
});
test("unplayed fixtures have no final qualifiers; corrupt fixtures are rejected, not invented",()=>{
  const f=fixtures();assert.equal(groupTable(f,"A").finished,false);assert.equal(groupTable(f,"A").pendingTie,null);
  assert.throws(()=>groupTable(f.slice(1),"A"),/incomplete/);
  f[5].b_key="B";assert.throws(()=>groupTable(f,"A"),/official draw/);
});
test("bull knockout requires real winners at every pair and resolves both qualifying places",()=>{
  assert.deepEqual(bullRanking(["A","B","C"],[],2).pair,["A","B"]);
  const result=bullRanking(["A","B","C"],[
    {a_key:"A",b_key:"B",winner_key:"A"},{a_key:"A",b_key:"C",winner_key:"C"},{a_key:"A",b_key:"B",winner_key:"A"},
  ],2);assert.deepEqual(result.ranked,["C","A"]);assert.equal(result.pair,null);
  assert.throws(()=>bullRanking(["A","B"],[{a_key:"A",b_key:"B",winner_key:"outsider"}],1),/sporting tie/);
});
test("walkovers and withdrawals are honest sporting facts but never played darts",()=>{
  const f=circular();f[0].status="WALKOVER";f[0].legs_a=null;f[0].legs_b=null;
  const a=groupTable(f,"A").buckets.flat().find(p=>p.key==="A")!;
  assert.equal(a.played,2);assert.equal(a.wins,1);assert.equal(a.walkoverWins,1);
  const withdrawn=groupTable(circular(),"A",new Set(["A"]));assert.equal(withdrawn.buckets.at(-1)![0].key,"A");
});

async function prepare(slot:number,progress=true) {
  const save=await saves.create(1,{slot,careerName:"Tournament Player",dateOfBirth:"1990-01-01",homeLocality:"ayrshire"});
  await db.execute(sql`UPDATE career_saves SET world_seed=${seed} WHERE id=${save.id}`);
  await sporting.initialize(actor,save.id);
  const e=(await rows(sql`SELECT id,start_week FROM career_event_instances WHERE career_save_id=${save.id} AND definition_key='vault-nights' ORDER BY start_day LIMIT 1`))[0];
  // Test clock only: keep the real immutable event schedule; do not simulate ten unrelated weeks.
  await db.execute(sql`UPDATE career_saves SET current_week=${Number(e.start_week)} WHERE id=${save.id}`);
  await db.execute(sql`UPDATE career_event_instances SET status='REGISTRATION_OPEN' WHERE career_save_id=${save.id} AND id=${e.id}`);
  const entered=await calendar.enter(actor,save.id,{eventId:String(e.id)});assert.equal(entered.entered,true);
  await db.transaction(async tx=>{
    const root=await lockRoot(tx,actor,save.id) as RootRow;
    await tx.execute(sql`UPDATE career_event_instances SET status='REGISTRATION_CLOSED' WHERE career_save_id=${save.id} AND id=${e.id}`);
    const event=(await loadInstances(tx,save.id,sql`id=${e.id}`))[0],providers=await calendar.bind(tx,root);
    assert.equal((await lockField(tx,root,event,await loadNpcs(tx,root.id,{activeOnly:true}),providers,1)).locked,true);
    await makeDraw(tx,root,event,providers);
    if(progress)await progressEvent(tx,root,await worldState(tx,root),event,Number(e.start_week)*7,providers);
  });
  return {saveId:save.id,eventId:String(e.id)};
}
async function sportingHash() {
  return calendarHashOf(await rows(sql`SELECT jsonb_build_object(
    'clock',(SELECT jsonb_build_array(current_season,current_week,difficulty) FROM career_saves WHERE id=${saveId}),
    'matches',(SELECT jsonb_agg(m ORDER BY id) FROM career_tournament_matches m WHERE career_save_id=${saveId}),
    'entries',(SELECT jsonb_agg(e ORDER BY event_id,participant_key) FROM career_event_entries e WHERE career_save_id=${saveId}),
    'simulations',(SELECT jsonb_agg(s ORDER BY match_key) FROM career_simulated_matches s WHERE career_save_id=${saveId}),
    'ledger',(SELECT jsonb_agg(l ORDER BY id) FROM career_finance_entries l WHERE career_save_id=${saveId}),
    'results',(SELECT jsonb_agg(r ORDER BY event_id,participant_key) FROM career_event_results r WHERE career_save_id=${saveId})
  ) AS evidence`));
}
test("A3 creates 24+7 stored fixtures once; NPC rounds cannot run ahead of pending human rounds",async()=>{
  ({saveId,eventId}=await prepare(1));
  const v=await tournaments.read(actor,saveId,eventId);
  assert.equal(v.event.drawLocked,true);assert.equal(v.field.length,16);assert.equal(v.matches.length,31);
  assert.equal(v.matches.filter(m=>m.stage_key.startsWith("groups:")).length,24);assert.equal(v.phase,"MATCH_READY");
  assert.equal(v.matches.filter(m=>m.round>1&&m.status==="COMPLETED").length,0);
  assert.equal(v.groups.every(g=>g.qualifiers.length===0),true);
  const hash=await sportingHash();await tournaments.read(actor,saveId,eventId);await tournaments.read(actor,saveId,eventId);
  assert.equal(await sportingHash(),hash);
  await rejects(tournaments.dismiss(actor,saveId,eventId));
});
test("FULL/BALANCED/QUICK + reduced motion do not alter sporting, RNG, result or finance rows",async()=>{
  const hash=await sportingHash();
  for(const mode of ["FULL","BALANCED","QUICK"] as const) {
    await tournaments.presentation(actor,saveId,{mode,reducedMotion:true});
    const v=await tournaments.read(actor,saveId,eventId);assert.equal(v.presentation.mode,mode);assert.equal(v.depth.animate,false);
    assert.equal(await sportingHash(),hash);
  }
});
test("A5 still owns Q-School: an unfinished pathway cannot award a card on tournament reads or retries",async()=>{
  await db.transaction(async tx=>{
    const root=await lockRoot(tx,actor,saveId) as RootRow;
    assert.equal(await allocateQSchool(tx,root,1,1,1,Number(root.current_week),"UK_IRELAND"),null);
    assert.equal(await allocateQSchool(tx,root,1,1,1,Number(root.current_week),"UK_IRELAND"),null);
  });
  await tournaments.read(actor,saveId,eventId);
  assert.equal((await rows(sql`SELECT COUNT(*)::int n FROM career_tour_cards WHERE career_save_id=${saveId} AND participant_key='HUMAN'`))[0].n,0);
});
test("owned/authenticated/no-store tournament routes; hidden ability and unconfirmed concession rejected",async()=>{
  const url=`${base}/saves/${saveId}/tournaments/${eventId}`;
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url,{headers:{"x-test-player":"2"}})).status,404);
  const response=await fetch(url,{headers:{"x-test-player":"1"}});
  assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");
  const body=await response.text();assert.ok(!/"(ability|potential|effective|hitAcc|difficulty|bot_seed|bot_config)"\s*:/.test(body));
  const bad=await fetch(`${url}/concede`,{method:"POST",headers:{"x-test-player":"1","content-type":"application/json"},body:JSON.stringify({matchId:(await tournaments.read(actor,saveId,eventId)).nextMatchId})});
  assert.equal(bad.status,400);
  await rejects(tournaments.presentation({playerId:2},saveId,{mode:"FULL",reducedMotion:false}),404);
});
test("real shared live session resumes on reopen; explicit group concession is not a withdrawal",async()=>{
  const v=await tournaments.read(actor,saveId,eventId),match=v.nextMatchId!;
  const opened=await live.open(actor,saveId,match),restored=await live.open(actor,saveId,match);
  assert.equal(opened.sessionId,restored.sessionId);assert.deepEqual(opened.darts,restored.darts);
  assert.equal(opened.format.unit,"LEGS");if(opened.format.unit==="LEGS")assert.equal(opened.format.bestOfLegs,9);assert.equal(opened.format.inRule,"STRAIGHT");
  const hash=await sportingHash();await tournaments.read(actor,saveId,eventId);assert.equal(await sportingHash(),hash);
  await calendar.concedeMatch(actor,saveId,eventId,{matchId:match,confirmation:"CONCEDE_MATCH"});
  const after=await tournaments.read(actor,saveId,eventId);
  assert.notEqual(after.phase,"WITHDRAWN");assert.notEqual(after.phase,"ELIMINATED");
  assert.equal(after.latestMatch?.status,"WALKOVER");assert.ok(after.nextMatchId);
  assert.equal((await live.read(actor,saveId,match)).status,"SUPERSEDED");
  assert.equal((await calendar.concedeMatch(actor,saveId,eventId,{matchId:match,confirmation:"CONCEDE_MATCH"})).conceded,false);
});
test("actual group wins feed cross-group QFs; championship/settlement/results are exactly once",async()=>{
  for(let guard=0;guard<10;guard++) {
    const v=await tournaments.read(actor,saveId,eventId);
    if(v.phase==="CHAMPION")break;
    assert.equal(v.phase,"MATCH_READY");
    const m=v.matches.find(m=>m.id===v.nextMatchId)!;
    await calendar.recordHumanMatchResult(actor,saveId,{matchId:m.id,humanLegs:(m.best_of+1)/2,opponentLegs:0,humanThrewFirst:true});
  }
  const v=await tournaments.read(actor,saveId,eventId);
  assert.equal(v.phase,"CHAMPION");assert.equal(v.achievements.tournamentChampion,true);assert.equal(v.championKey,"HUMAN");
  assert.equal(v.results.length,16);assert.equal(v.money.paid,true);
  assert.equal(Number(v.humanResult!.matches_played),5,"two played group wins + three KO wins; W/O is excluded");
  assert.equal(Number(v.humanResult!.losses),0);
  const qfs=v.matches.filter(m=>m.stage_key==="knockout"&&m.round===1);
  assert.equal(qfs.length,4);
  const groupOf=(k:string|null)=>v.groups.find(g=>g.buckets.flat().some(p=>p.key===k))!.key;
  assert.ok(qfs.every(m=>groupOf(m.a_key)!==groupOf(m.b_key)));
  assert.equal(v.results.filter(r=>r.stage_reached==="GROUP_STAGE").length,8);
  const awards=await rows(sql`SELECT COUNT(*)::int n FROM career_prize_awards WHERE career_save_id=${saveId} AND event_id=${eventId} AND participant_key='HUMAN'`);
  assert.equal(awards[0].n,1);
  assert.equal((await rows(sql`SELECT COUNT(*)::int n FROM career_ranking_contributions WHERE career_save_id=${saveId} AND event_id=${eventId}`))[0].n,0,
    "Special-event cash is not invented pro-world ranking money");
  const later=(await rows(sql`SELECT id FROM career_event_instances WHERE career_save_id=${saveId} AND definition_key='vault-nights'
    AND id<>${eventId} ORDER BY start_day LIMIT 1`))[0];
  const historical=await tournaments.read(actor,saveId,String(later.id));
  assert.equal(historical.history.previousAppearances.length,1);assert.equal(historical.history.bestFinish,1);
  assert.equal(historical.history.recentChampions[0].champion_participant_key,"HUMAN");
  const hash=await sportingHash();
  await db.transaction(async tx=>{
    const root=await lockRoot(tx,actor,saveId) as RootRow,event=(await loadInstances(tx,saveId,sql`id=${eventId}`))[0];
    await progressEvent(tx,root,await worldState(tx,root),event,7,await calendar.bind(tx,root));
  });
  assert.equal(await sportingHash(),hash);
  await assert.rejects(db.execute(sql`UPDATE career_tournament_matches SET legs_a=1 WHERE career_save_id=${saveId} AND id=${v.latestMatch!.id}`));
  assert.equal((await tournaments.active(actor,saveId)).tournaments.find(t=>t.eventId===eventId)!.terminal,true);
  await tournaments.dismiss(actor,saveId,eventId);
  assert.equal((await tournaments.active(actor,saveId)).tournaments.some(t=>t.eventId===eventId),false);
  assert.equal(await sportingHash(),hash,"acknowledging the championship has no sporting effects");
});
test("human circular tie persists real bull throws, restores exact revision, blocks calendar and feeds QF once",async()=>{
  const f=await prepare(3,false);
  await db.transaction(async tx=>{
    const root=await lockRoot(tx,actor,f.saveId) as RootRow,event=(await loadInstances(tx,f.saveId,sql`id=${f.eventId}`))[0];
    const matches=await loadMatches(tx,f.saveId,f.eventId);
    for(const group of GROUP_KEYS) {
      const seats=groupSeats(matches,group),hasHuman=seats.includes("HUMAN"),weak=seats.find(k=>k!=="HUMAN")!;
      const contenders=seats.filter(k=>k!==weak);
      // Controlled A3 score fixtures force a rare circular tie; no production ability or RNG is used to rank.
      for(const m of matches.filter(m=>m.stage_key===`groups:${group}`)) {
        let a=5,b=0;
        if(hasHuman) {
          if(m.a_key===weak){a=0;b=5;}
          else if(m.b_key!==weak) {
            const ai=contenders.indexOf(m.a_key!),bi=contenders.indexOf(m.b_key!);
            a=(ai+1)%3===bi?5:4;b=a===5?4:5;
          }
        } else {a=seats.indexOf(m.a_key!)<seats.indexOf(m.b_key!)?5:0;b=a===5?0:5;}
        await tx.execute(sql`UPDATE career_tournament_matches SET status='COMPLETED',legs_a=${a},legs_b=${b},
          winner_key=${a>b?m.a_key:m.b_key},summary='{"fixture":"controlled circular tie"}'::jsonb,completed_at=NOW()
          WHERE career_save_id=${f.saveId} AND id=${m.id} AND status='PENDING'`);
      }
    }
    await progressEvent(tx,root,await worldState(tx,root),event,Number(root.current_week)*7,await calendar.bind(tx,root));
  });
  let v=await tournaments.read(actor,f.saveId,f.eventId);
  assert.equal(v.phase,"GROUP_BULL");assert.ok(v.groupBull?.row);
  assert.equal((await calendar.calendar(actor,f.saveId)).overview.pendingTournamentActions[0].kind,"GROUP_BULL_UP");
  const first=v.groupBull!,body={group:first.group,tieKey:first.tieKey,ordinal:first.ordinal,expectedRevision:first.row!.revision,throw:"INNER"};
  const restored=await tournaments.read(actor,f.saveId,f.eventId);assert.deepEqual(restored.groupBull,v.groupBull);
  await calendar.groupBull(actor,f.saveId,f.eventId,body);
  await rejects(calendar.groupBull(actor,f.saveId,f.eventId,body));
  for(let guard=0;guard<32;guard++) {
    v=await tournaments.read(actor,f.saveId,f.eventId);
    if(v.phase!=="GROUP_BULL")break;
    const bull=v.groupBull!;
    await calendar.groupBull(actor,f.saveId,f.eventId,{group:bull.group,tieKey:bull.tieKey,ordinal:bull.ordinal,
      expectedRevision:bull.row!.revision,throw:"INNER"});
  }
  assert.equal(v.phase,"MATCH_READY");assert.equal(v.matches.find(m=>m.id===v.nextMatchId)!.stage_key,"knockout");
  assert.equal(v.achievements.groupWinner,true);assert.equal(v.achievements.tournamentChampion,false);
  assert.equal(v.results.length,0);assert.equal(v.matches.length,31,"bull throws are not scoring matches");
  const bulls=await rows(sql`SELECT * FROM career_group_bull_playoffs WHERE career_save_id=${f.saveId} AND event_id=${f.eventId}`);
  assert.ok(bulls.length>0&&bulls.every(r=>r.winner_key));
  await assert.rejects(db.execute(sql`UPDATE career_group_bull_playoffs SET throws='[]'::jsonb WHERE career_save_id=${f.saveId} AND event_id=${f.eventId}`));
  const originalQf=v.matches.filter(m=>m.stage_key==="knockout"&&m.round===1).map(m=>[m.a_key,m.b_key]);
  await calendar.withdraw(actor,f.saveId,{eventId:f.eventId});
  const withdrawn=await tournaments.read(actor,f.saveId,f.eventId);
  assert.equal(withdrawn.phase,"WITHDRAWN");
  assert.deepEqual(withdrawn.matches.filter(m=>m.stage_key==="knockout"&&m.round===1).map(m=>[m.a_key,m.b_key]),originalQf,
    "late withdrawal cannot change locked qualification or replace a bracket participant");
  await db.execute(sql`DELETE FROM career_saves WHERE id=${f.saveId}`);
});
test("corrupt active draw errors; withdrawal stays distinct from browser loss and uses no replacement player",async()=>{
  ({saveId:withdrawSave,eventId:withdrawEvent}=await prepare(2));
  const v=await tournaments.read(actor,withdrawSave,withdrawEvent),keys=v.field.map(p=>p.key).sort();
  await calendar.withdraw(actor,withdrawSave,{eventId:withdrawEvent});
  const after=await tournaments.read(actor,withdrawSave,withdrawEvent);
  assert.equal(after.phase,"WITHDRAWN");assert.deepEqual(after.field.map(p=>p.key).sort(),keys);
  assert.equal(after.matches.filter(m=>[m.a_key,m.b_key].includes("HUMAN")&&m.status==="COMPLETED").length,0);
  assert.equal(after.matches.filter(m=>[m.a_key,m.b_key].includes("HUMAN")&&m.status==="WALKOVER").length,3);
  const corrupted=await prepare(3);
  const before=await tournaments.read(actor,corrupted.saveId,corrupted.eventId);
  const m=before.matches.find(m=>m.stage_key==="knockout"&&m.round===1)!;
  await db.execute(sql`DELETE FROM career_tournament_matches WHERE career_save_id=${corrupted.saveId} AND id=${m.id}`);
  await rejects(db.transaction(async tx=>{
    const root=await lockRoot(tx,actor,corrupted.saveId) as RootRow,event=(await loadInstances(tx,corrupted.saveId,sql`id=${corrupted.eventId}`))[0];
    return progressEvent(tx,root,await worldState(tx,root),event,7,await calendar.bind(tx,root));
  }));
});
