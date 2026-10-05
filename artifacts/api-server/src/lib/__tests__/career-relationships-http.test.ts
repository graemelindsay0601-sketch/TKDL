import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createCareerRelationshipsService } from "../../career/relationships/service.ts";
import { createCareerRelationshipsRouter } from "../../career/relationships/router.ts";

// Small SQL source fixtures exercise the real read queries/HTTP boundary. The
// existing A6.5 suite additionally checks A7.2 against the full migration graph.
const pg = new PGlite(), db=drizzle(pg), service=createCareerRelationshipsService(db);
const A="11111111-1111-4111-8111-111111111111", B="22222222-2222-4222-8222-222222222222";
let server: ReturnType<ReturnType<typeof express>["listen"]>, base="";
before(async()=>{
  await pg.exec(`
    CREATE TABLE feature_flags(feature_name text,enabled boolean,admin_test_mode boolean);
    INSERT INTO feature_flags VALUES('tour_career_2',true,false);
    CREATE TABLE career_saves(id uuid PRIMARY KEY,player_id int,status text,world_generation_version int,current_season int);
    CREATE TABLE career_profiles(career_save_id uuid,date_of_birth date,career_start_date date);
    CREATE TABLE career_world_players(career_save_id uuid,id text,first_name text,surname text,nationality text,home_region text,
      age int,starting_age int,created_season int,retired_season int,status text,scoring int,potential int);
    CREATE TABLE career_ranking_snapshots(career_save_id uuid,id text,list_key text,sequence int);
    CREATE TABLE career_ranking_snapshot_rows(career_save_id uuid,npc_id text,snapshot_id text,position int);
    CREATE TABLE career_event_instances(career_save_id uuid,id text,name text,season int,presentation_tier text,circuit text,classification text,family text,series_key text);
    CREATE TABLE career_tournament_matches(career_save_id uuid,id text,event_id text,status text,a_key text,b_key text,a_npc_id text,b_npc_id text,
      winner_key text,result_source text,stage_key text,round int,scheduled_day int,legs_a int,legs_b int,summary jsonb);
    CREATE TABLE career_event_entries(career_save_id uuid,event_id text,participant_key text,status text);
    CREATE TABLE career_event_results(career_save_id uuid,event_id text,participant_key text,matches_played int);
  `);
  for (const save of [A,B]) {
    await pg.query("INSERT INTO career_saves VALUES($1,1,'ACTIVE',1,2)",[save]);
    await pg.query("INSERT INTO career_profiles VALUES($1,'2008-01-01','2026-01-01')",[save]);
    for (const id of ["a","b","c","d"]) await pg.query("INSERT INTO career_world_players VALUES($1,$2,'Fictional',$2,'GBR','Ayrshire',19,18,1,NULL,'ACTIVE',90,99)",[save,id]);
    await pg.query("INSERT INTO career_ranking_snapshots VALUES($1,'rank-old','pro-world',1),($1,'rank-new','pro-world',2)",[save]);
    await pg.query("INSERT INTO career_ranking_snapshot_rows VALUES($1,'a','rank-old',10),($1,'a','rank-new',7)",[save]);
    const events=[
      ["ordinary","STANDARD","GRASSROOTS","RANKING","local",null],
      ["q1","FEATURED","Q_SCHOOL","QUALIFIER","q-school","q-school-first-uk"],
      ["q2","FEATURED","Q_SCHOOL","QUALIFIER","q-school","q-school-first-uk"],
      ["q-eu","FEATURED","Q_SCHOOL","QUALIFIER","q-school","q-school-first-eu"],
      ["q-final","FEATURED","Q_SCHOOL","QUALIFIER","q-school","q-school-final-uk"],
      ["j1","STANDARD","GRASSROOTS","RANKING","junior-development-circuit",null],
      ["j2","STANDARD","GRASSROOTS","RANKING","junior-development-circuit",null],
    ];
    for (const [id,tier,circuit,classification,family,series] of events)
      await pg.query("INSERT INTO career_event_instances VALUES($1,$2,$2,1,$3,$4,$5,$6,$7)",[save,id,tier,circuit,classification,family,series]);
  }
  await pg.query("INSERT INTO career_world_players VALUES($1,'new-entry','Fictional','Entrant','GBR','Ayrshire',16,16,2,NULL,'ACTIVE',30,60)",[A]);
  const add = async(id:string,event:string,a:string,b:string,status="COMPLETED",source="LIVE",winner=a,round=1)=>
    pg.query("INSERT INTO career_tournament_matches VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'MAIN',$11,7,3,1,'{\"sets\":[2,0]}')",
      [A,id,event,status,a,b,a==="HUMAN"?null:a,b==="HUMAN"?null:b,winner,source,round]);
  await add("played","ordinary","HUMAN","a");
  await add("bye","ordinary","HUMAN","a","BYE","BYE","HUMAN",2);
  await add("walk","ordinary","HUMAN","a","WALKOVER","WALKOVER","HUMAN",3);
  await add("pending","ordinary","HUMAN","a","AWAITING_HUMAN","LIVE","",4);
  await add("invalid-source","ordinary","HUMAN","a","COMPLETED","WALKOVER","HUMAN",5);
  await add("invalid-winner","ordinary","HUMAN","a","COMPLETED","LIVE","not-a-participant",6);
  await add("q-human","q1","HUMAN","a");
  await add("q-others","q2","b","c"); // same session, different day
  await add("q-other-path","q-eu","c","d");
  await add("q-other-stage","q-final","c","d");
  await add("junior-human","j1","a","HUMAN"); // human on B side: reverse score
  await add("junior-others","j1","b","c");
  await add("junior-different","j2","c","d");
  await pg.query("INSERT INTO career_event_entries VALUES($1,'q1','d','WITHDRAWN'),($1,'j1','d','ENTERED')",[A]);
  await pg.query("INSERT INTO career_event_results VALUES($1,'q1','d',0),($1,'ordinary','HUMAN',1),($1,'ordinary','HUMAN',1)",[A]);
  const app=express();
  app.use((req,_res,next)=>{ (req as unknown as {session:unknown}).session={playerId:Number(req.header("x-player")??0)};next(); });
  app.use(createCareerRelationshipsRouter(service));
  server=app.listen(0);base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async()=>{server.close();await pg.close();});
test("completed valid A3 match IDs alone count, persisted scores orient correctly, latest ranking is used, saves isolate identical NPC IDs",async()=>{
  const read=await service.read({playerId:1},A), o=read.opponents.find(o=>o.player.id==="a")!;
  assert.equal(o.meetings,3);assert.equal(o.humanWins,2);assert.equal(o.npcWins,1);assert.equal(o.player.worldRanking,7);
  assert.equal(o.history.find(m=>m.id==="junior-human")?.legsHuman,1);
  assert.equal(o.history.find(m=>m.id==="junior-human")?.setsHuman,0);
  assert.deepEqual(await service.read({playerId:1},A),read);
  assert.deepEqual((await service.read({playerId:1},B)).opponents,[]);
  assert.equal(read.world.newEntrants,1);
  assert.equal((await service.read({playerId:1},B)).world.newEntrants,0,"new entrants stay save-scoped");
  assert.doesNotMatch(JSON.stringify(read),/"(?:scoring|potential|form|ability|developmentRate|pressure|clutch)"\s*:/);
  assert.equal(read.opponents.some(o=>o.player.id==="d"),false);
  await pg.query("DELETE FROM career_profiles WHERE career_save_id=$1",[B]);
  assert.equal((await service.read({playerId:1},B)).opponents.length,0,"legacy missing identity doesn't regenerate the world");
});
test("Q-School derives from actual shared season/pathway/stage session; Junior requires played overlap at same event",async()=>{
  const read=await service.read({playerId:1},A);
  for (const id of ["a","b","c"]) {
    const o=read.opponents.find(o=>o.player.id===id)!;
    assert.ok(o.labels.includes("Q-School Class"));assert.ok(o.labels.includes("Junior Contemporary"));
    assert.equal(o.cohorts.length,2);
  }
  assert.equal(read.opponents.find(o=>o.player.id==="b")!.meetings,0,"cohort doesn't fabricate H2H");
  assert.equal(read.opponents.some(o=>o.labels.includes("Career Rival")),false);
  assert.equal(read.opponents.some(o=>o.cohorts.some(c=>c.session==="q-school-final-uk" || c.session==="q-school-first-eu" || c.session==="j2")),false);
});
test("historical cohorts and H2H survive ageing and NPC/save retirement, without any read mutation",async()=>{
  const before=await service.read({playerId:1},A);
  await pg.query("UPDATE career_world_players SET age=65,status='RETIRED',retired_season=2 WHERE career_save_id=$1 AND id='a'",[A]);
  await pg.query("UPDATE career_saves SET status='RETIRED',current_season=3 WHERE id=$1",[A]);
  const snapshot=await pg.query("SELECT * FROM career_world_players ORDER BY career_save_id,id");
  const afterRead=await service.read({playerId:1},A), a=afterRead.opponents.find(o=>o.player.id==="a")!;
  assert.deepEqual(a.cohorts,before.opponents.find(o=>o.player.id==="a")!.cohorts);
  assert.equal(a.meetings,3);assert.equal(a.player.status,"RETIRED");assert.equal(afterRead.world.retired,1);
  assert.deepEqual(await pg.query("SELECT * FROM career_world_players ORDER BY career_save_id,id"),snapshot);
});
test("HTTP authentication, ownership, invalid IDs, no-store, and feature gate",async()=>{
  const get=(id:string,player=1)=>fetch(`${base}/saves/${id}/relationships`,{headers:{"x-player":String(player)}});
  assert.equal((await get(A,0)).status,401);assert.equal((await get(A,2)).status,404);
  assert.equal((await get("bad-id")).status,400);
  const success=await get(A);assert.equal(success.status,200);assert.equal(success.headers.get("cache-control"),"no-store");
  assert.equal((await success.json() as {careerSaveId:string}).careerSaveId,A);
  await pg.exec("UPDATE feature_flags SET enabled=false");
  assert.equal((await get(A)).status,404);
});
