import {before,after,test} from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {sql} from "drizzle-orm";
import express from "express";
import {createCareerSaves} from "../../db/migrations/create_career_saves.ts";
import {createCareerWorld} from "../../db/migrations/create_career_world.ts";
import {createCareerCalendar} from "../../db/migrations/create_career_calendar.ts";
import {createCareerFinance} from "../../db/migrations/create_career_finance.ts";
import {createCareerSporting} from "../../db/migrations/create_career_sporting.ts";
import {createCareerService} from "../../career/service.ts";
import {createCareerSportingService} from "../../career/sporting/service.ts";
import {createCareerContentService,createCareerContentRouter} from "../../career/content/service.ts";
import {createCareerFinanceRouter} from "../../career/finance/router.ts";
import {sponsorCatalogue,type SportingFacts} from "../../career/finance/sponsors.catalogue.ts";
import {activeContracts,advanceSponsorLifecycle} from "../../career/finance/engine.ts";
import {lockRoot} from "../../career/world/service.ts";
import {calendarHashOf} from "../../career/calendar/generation.ts";
import {stableUuid} from "../../career/world/random.ts";
import {createCareerLegacyService} from "../../career/legacy/service.ts";
import type {RootRow} from "../../career/calendar/engine.ts";
const pg=new PGlite(),db=drizzle(pg),saves=createCareerService(db),actor={playerId:1},seed="a".repeat(64);
const facts:SportingFacts={careerStarted:true,titles:20,professionalStatus:"PROFESSIONAL",tourCard:true,worldRanking:8,qualifications:[],bestFinishByCircuit:{VAULT:1}};
const sporting=createCareerSportingService(db,{facts:{id:"TEST_FACTUAL_STATURE",facts:async()=>structuredClone(facts)}}),content=createCareerContentService(db,sporting);
let saveId="",oldId="",equipment="",local="",replacement="";
const rows=async(q:ReturnType<typeof sql>)=>(await db.execute(q)).rows;
const status=(p:Promise<unknown>,n=409)=>assert.rejects(p,(e:unknown)=>(e as {status:number}).status===n);
async function offer(brandId:string) {
  const terms=sponsorCatalogue(2).find(d=>d.key===brandId)!.terms,id=stableUuid(seed,1,"test-offer",brandId);
  await db.execute(sql`INSERT INTO career_sponsor_offers (career_save_id,id,operation_key,sponsor_key,sponsor_database_version,tier,kind,terms,source,
    offered_season,offered_week,expires_season,expires_week,status)
    VALUES (${saveId},${id},${`test:${brandId}`},${brandId},2,${terms.tier},'NEW',${JSON.stringify(terms)}::jsonb,'{}'::jsonb,1,1,1,52,'AVAILABLE') ON CONFLICT DO NOTHING`);
  return id;
}
before(async()=>{
  await pg.exec(`CREATE TABLE players(id integer PRIMARY KEY);INSERT INTO players VALUES(1),(2);
    CREATE TABLE feature_flags(feature_name text UNIQUE,enabled boolean,admin_test_mode boolean,description text);
    INSERT INTO feature_flags VALUES('tour_career_2',true,false,'test')`);
  await createCareerSaves(db);await createCareerWorld(db);await createCareerCalendar(db);await createCareerFinance(db);await createCareerSporting(db);
  const save=await saves.create(1,{slot:1,dateOfBirth:"1990-01-01",homeLocality:"ayrshire"});saveId=save.id;
  // Preserve the published A8.1 v3 universe; A8.2 v4 has its own tournament tests.
  await db.execute(sql`UPDATE career_saves SET world_seed=${seed},event_database_version=3 WHERE id=${saveId}`);
  await sporting.initialize(actor,saveId);
  const old=await saves.create(1,{slot:2,dateOfBirth:"1990-01-01"});oldId=old.id;
  await db.execute(sql`UPDATE career_saves SET event_database_version=2,player_database_version=1,world_seed=${seed} WHERE id=${oldId}`);
  await sporting.initialize(actor,oldId);
});
after(async()=>await pg.close());
test("new and old roots are genuinely pinned, initialize idempotently and expose real lists",async()=>{
  const versions=await rows(sql`SELECT id,event_database_version,player_database_version FROM career_saves ORDER BY slot_number`);
  assert.equal(versions[0].event_database_version,3);assert.equal(versions[1].event_database_version,2);
  assert.equal((await rows(sql`SELECT COUNT(*)::int n FROM career_world_players WHERE career_save_id=${saveId}`))[0].n,340);
  assert.equal((await rows(sql`SELECT COUNT(*)::int n FROM career_world_players WHERE career_save_id=${oldId}`))[0].n,260);
  assert.equal((await sporting.rankingLists(actor,saveId)).length,9);assert.equal((await sporting.rankingLists(actor,oldId)).length,6);
  await sporting.initialize(actor,saveId);
  assert.equal((await rows(sql`SELECT COUNT(*)::int n FROM career_world_players WHERE career_save_id=${saveId}`))[0].n,340);
});
test("read-only content/almanac/presentation do not rewrite an old world or Legacy",async()=>{
  const snapshot=async()=>calendarHashOf(await rows(sql`SELECT jsonb_build_object('save',s,'players',(SELECT jsonb_agg(p ORDER BY p.id) FROM career_world_players p WHERE p.career_save_id=s.id),
    'events',(SELECT jsonb_agg(i ORDER BY i.id) FROM career_event_instances i WHERE i.career_save_id=s.id)) AS evidence FROM career_saves s WHERE s.id=${oldId}`));
  const before=await snapshot();
  const catalogue=await content.read(actor,oldId);assert.equal(catalogue.eventDatabaseVersion,2);
  await content.presentation(actor,oldId);await content.players(actor,oldId);await content.map(actor,oldId,{fromWeek:1,toWeek:5});
  assert.equal((await content.trophies(actor,oldId)).total,0);
  assert.equal(await snapshot(),before);
  const legacy=await createCareerLegacyService(db).read(actor,oldId);assert.ok(legacy);
});
test("women/category and safe palette change no identities, ability, RNG, clock, balances or age",async()=>{
  const snapshot=async()=>calendarHashOf(await rows(sql`SELECT jsonb_build_object('seed',s.world_seed,'balance',s.balance_pence,'season',s.current_season,'week',s.current_week,
    'players',(SELECT jsonb_agg(p ORDER BY p.id) FROM career_world_players p WHERE p.career_save_id=s.id),
    'profile',(SELECT to_jsonb(p) FROM career_profiles p WHERE p.career_save_id=s.id)) AS evidence FROM career_saves s WHERE s.id=${saveId}`));
  const before=await snapshot();await content.editPresentation(actor,saveId,{competitionCategory:"WOMEN",nickname:"The Quiet One",primaryColour:"#334455"});
  assert.equal(await snapshot(),before);
  const calendar=await sporting.calendar.calendar(actor,saveId,{scope:"WORLD"});
  const woman=calendar.events.find(e=>e.definitionKey==="women-tour")!,open=calendar.events.find(e=>e.definitionKey==="friday-night-501")!;
  assert.equal(woman.human!.eligible,true);assert.equal(open.human!.eligible,true);
  assert.equal(woman.content!.circuitId,"women");assert.ok(calendar.events.find(e=>e.definitionKey==="world-darts-championship")!.opportunity);
});
test("map includes inaccessible Palace/majors, actual qualifications, city anchors and finances",async()=>{
  const map=await content.map(actor,saveId);
  const palace=map.events.find(e=>e.definitionId==="world-darts-championship")!;
  assert.equal(palace.opportunity.state,"NOT_QUALIFIED");assert.ok(palace.qualification?.routes);assert.ok(palace.financialCommitment);
  assert.equal(palace.venue.displayName,"Alexandra Grand Hall");
  assert.equal(map.events.filter(e=>e.definitionId==="vault-nights").length,5);
  const local=await content.map(actor,saveId,{scope:"LOCAL"});assert.ok(local.total>0);
  assert.ok(local.events.every(e=>e.venue.city===local.home.city));
  const region=await content.map(actor,saveId,{scope:"REGION"});
  assert.ok(region.total>local.total);assert.ok(region.events.some(e=>e.venue.city!==local.home.city));
});
test("two compatible contracts sign and retries neither terminate nor repay either",async()=>{
  equipment=(await sporting.finance.acceptOffer(actor,saveId,{offerId:await offer("ironflight")})).contractId;
  const id=await offer("forge-workwear");local=(await sporting.finance.acceptOffer(actor,saveId,{offerId:id})).contractId;
  const money=calendarHashOf(await rows(sql`SELECT * FROM career_finance_entries WHERE career_save_id=${saveId} ORDER BY id`));
  assert.equal((await sporting.finance.acceptOffer(actor,saveId,{offerId:id})).created,false);
  assert.equal(calendarHashOf(await rows(sql`SELECT * FROM career_finance_entries WHERE career_save_id=${saveId} ORDER BY id`)),money);
  const sponsors=await sporting.finance.sponsors(actor,saveId);assert.equal(sponsors.activeContracts.length,2);
  assert.ok(sponsors.activeContracts.some(c=>c.slot==="EQUIPMENT_PARTNER"));assert.ok(sponsors.activeContracts.some(c=>c.slot==="LOCAL_REGIONAL_PARTNER"));
});
test("competitor conflicts and foreign replacements fail atomically; explicit replacement keeps other deals",async()=>{
  const id=await offer("redpoint-darts"),before=calendarHashOf(await rows(sql`SELECT * FROM career_sponsor_contracts WHERE career_save_id=${saveId} ORDER BY id`));
  await status(sporting.finance.acceptOffer(actor,saveId,{offerId:id}));
  await status(sporting.finance.acceptOffer(actor,saveId,{offerId:id,replaceContractIds:[stableUuid(seed,1,"foreign")]}));
  assert.equal(calendarHashOf(await rows(sql`SELECT * FROM career_sponsor_contracts WHERE career_save_id=${saveId} ORDER BY id`)),before);
  replacement=(await sporting.finance.acceptOffer(actor,saveId,{offerId:id,replaceContractIds:[equipment]})).contractId;
  const active=await activeContracts(db,saveId);assert.equal(active.length,2);assert.ok(active.some(c=>c.id===local));assert.ok(active.some(c=>c.id===replacement));
  assert.equal((await rows(sql`SELECT end_reason FROM career_sponsor_contracts WHERE career_save_id=${saveId} AND id=${equipment}`))[0].end_reason,"EXPLICITLY_REPLACED");
  await createCareerFinance(db);assert.equal((await activeContracts(db,saveId)).length,2);
});
test("all active contracts complete/review together; rollback protects fixture and old terms",async()=>{
  class Rollback extends Error{}
  await db.transaction(async tx=>{
    const root=await lockRoot(tx,actor,saveId) as RootRow;
    await advanceSponsorLifecycle(tx,root,async()=>facts,10,1);
    assert.equal((await activeContracts(tx,saveId)).length,0);
    const renewals=(await tx.execute(sql`SELECT * FROM career_sponsor_offers WHERE career_save_id=${saveId} AND kind='RENEWAL'`)).rows;
    assert.ok(renewals.length>=2);throw new Rollback();
  }).catch(e=>{if(!(e instanceof Rollback))throw e;});
  assert.equal((await activeContracts(db,saveId)).length,2);
});
test("signature launches are factual, immutable, retry-safe metadata, never money or ability",async()=>{
  await status(content.launchSignature(actor,saveId,{contractId:local,productType:"SIGNATURE_DARTS"}));
  await status(content.launchSignature(actor,saveId,{contractId:replacement,productType:"SIGNATURE_DARTS"}));
  await db.execute(sql`INSERT INTO career_life_merchandise (career_save_id,category,royalty_pence,signed_season,signed_week) VALUES (${saveId},'SIGNED_ITEMS',2500,1,1)`);
  const money=calendarHashOf(await rows(sql`SELECT * FROM career_finance_entries WHERE career_save_id=${saveId} ORDER BY id`));
  const p=await content.launchSignature(actor,saveId,{contractId:replacement,productType:"SIGNATURE_DARTS"});
  assert.equal(p.created,true);assert.equal((await content.launchSignature(actor,saveId,{contractId:replacement,productType:"SIGNATURE_DARTS"})).created,false);
  assert.equal((await content.presentation(actor,saveId)).products[0].state,"ACTIVE");
  assert.equal(calendarHashOf(await rows(sql`SELECT * FROM career_finance_entries WHERE career_save_id=${saveId} ORDER BY id`)),money);
  await assert.rejects(db.execute(sql`UPDATE career_signature_products SET product_name='fake' WHERE career_save_id=${saveId}`));
});
test("ownership/feature gates, edit window and retired behavior are enforced by services",async()=>{
  await status(content.read({playerId:2},saveId),404);
  await db.execute(sql`UPDATE career_saves SET current_week=2 WHERE id=${saveId}`);
  await status(content.editPresentation(actor,saveId,{nickname:"Later"}));
  await db.execute(sql`UPDATE career_saves SET current_week=1 WHERE id=${saveId}`);
  await db.execute(sql`UPDATE feature_flags SET enabled=false WHERE feature_name='tour_career_2'`);
  await status(content.read(actor,saveId),404);await db.execute(sql`UPDATE feature_flags SET enabled=true`);
});
test("HTTP accepts explicit replacement data and validates content, auth and no-store",async()=>{
  const app=express();app.use(express.json());app.use((req,_res,next)=>{(req as any).session=req.headers["x-test-player"]?{playerId:Number(req.headers["x-test-player"])}:{};next();});
  app.use(createCareerContentRouter(content));app.use(createCareerFinanceRouter(sporting.finance,async()=>true));
  const server=app.listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));
  const address=server.address() as {port:number},base=`http://127.0.0.1:${address.port}`;
  try{
    assert.equal((await fetch(`${base}/saves/${saveId}/world-content`)).status,401);
    const get=await fetch(`${base}/saves/${saveId}/presentation`,{headers:{"x-test-player":"1"}});assert.equal(get.status,200);assert.equal(get.headers.get("cache-control"),"no-store");
    const malformed=await fetch(`${base}/saves/${saveId}/presentation`,{method:"POST",headers:{"content-type":"application/json","x-test-player":"1"},body:JSON.stringify({ability:100})});assert.equal(malformed.status,400);
    const newOffer=await offer("northline-darts");
    const conflict=await fetch(`${base}/saves/${saveId}/sponsors/offers/${newOffer}/accept`,{method:"POST",headers:{"content-type":"application/json","x-test-player":"1"},body:"{}"});assert.equal(conflict.status,409);
    const accepted=await fetch(`${base}/saves/${saveId}/sponsors/offers/${newOffer}/accept`,{method:"POST",headers:{"content-type":"application/json","x-test-player":"1"},
      body:JSON.stringify({replaceContractIds:[replacement]})});assert.equal(accepted.status,200);
    assert.equal((await content.presentation(actor,saveId)).products[0].state,"LEGACY");
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
test("retired identity and products remain readable but immutable; no NPC bank account is invented",async()=>{
  await saves.retire(1,saveId);
  const p=await content.presentation(actor,saveId);assert.equal(p.canEdit,false);assert.equal(p.products[0].state,"LEGACY");
  await status(content.editPresentation(actor,saveId,{nickname:"After retirement"}));
  assert.equal((await rows(sql`SELECT to_regclass('career_npc_accounts') AS accounts`))[0].accounts,null);
});
