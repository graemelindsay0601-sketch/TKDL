import {before,after,test} from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {sql} from "drizzle-orm";
import {createCareerSaves} from "../../db/migrations/create_career_saves.ts";
import {createCareerWorld} from "../../db/migrations/create_career_world.ts";
import {createCareerSponsorshipFoundation} from "../../db/migrations/create_career_sponsorship_foundation.ts";
import {createCareerService} from "../../career/service.ts";
import {createCareerWorldService} from "../../career/world/service.ts";
import {BRANDS,SPONSOR_CATEGORIES} from "../../career/content/brands.ts";
import {SPONSOR_REPRESENTATIVES} from "../../career/content/sponsor-representatives.ts";
import {NPC_SPONSOR_CONTENT_VERSION,initialNpcSponsorRelationships,parseNpcSponsorSnapshot} from "../../career/sponsorship/npc-foundation.ts";
import {parseSponsorTerms,sponsorCatalogue,sponsorContractFoundationSchema} from "../../career/finance/sponsors.catalogue.ts";

const pg=new PGlite(),db=drizzle(pg),saves=createCareerService(db),world=createCareerWorldService(db),actor={playerId:1};
const seed="a".repeat(64);
let saveId="",secondSaveId="";
const rows=async(query:ReturnType<typeof sql>)=>(await db.execute(query)).rows;

before(async()=>{
  await pg.exec(`CREATE TABLE players(id integer PRIMARY KEY);
    INSERT INTO players VALUES(1),(2);
    CREATE TABLE feature_flags(feature_name text UNIQUE,enabled boolean,admin_test_mode boolean,description text);
    INSERT INTO feature_flags VALUES('tour_career_2',true,false,'test')`);
  await createCareerSaves(db);
  await createCareerWorld(db);
  await createCareerSponsorshipFoundation(db);
  saveId=(await saves.create(actor.playerId,{slot:1,dateOfBirth:"1990-01-01"})).id;
  await db.execute(sql`UPDATE career_saves SET world_seed=${seed} WHERE id=${saveId}`);
  await world.initialize(actor,saveId);
});
after(async()=>await pg.close());

test("sponsor content and all versioned contract terms validate, with stable fictional representatives",()=>{
  assert.equal(BRANDS.length,52);
  assert.equal(new Set(BRANDS.map(brand=>brand.id)).size,BRANDS.length);
  assert.deepEqual(new Set(BRANDS.map(brand=>brand.category)),new Set(SPONSOR_CATEGORIES));
  assert.equal(SPONSOR_REPRESENTATIVES.length,16);
  assert.equal(new Set(SPONSOR_REPRESENTATIVES.map(rep=>rep.id)).size,SPONSOR_REPRESENTATIVES.length);
  for(const rep of SPONSOR_REPRESENTATIVES)assert.equal(BRANDS.find(brand=>brand.id===rep.sponsorId)?.representativeId,rep.id);
  for(const version of [1,2,3])for(const definition of sponsorCatalogue(version))parseSponsorTerms(definition.terms);
  const current=sponsorCatalogue(3)[0].terms.contractFoundation!;
  assert.equal(current.schemaVersion,1);
  assert.deepEqual(current.guaranteedPayments,[]);
  assert.deepEqual(current.commitments,[]);
  assert.doesNotThrow(()=>sponsorContractFoundationSchema.parse(current));
  assert.throws(()=>parseSponsorTerms({...sponsorCatalogue(3)[0].terms,signingBonusPence:-1}));
});

test("a fresh world gets deterministic save-scoped NPC relationships without changing player finances",async()=>{
  const before=(await rows(sql`SELECT balance_pence,(SELECT COUNT(*)::int FROM career_finance_entries WHERE career_save_id=${saveId}) AS ledger_count
    FROM career_saves WHERE id=${saveId}`))[0];
  const population=(await rows(sql`SELECT id FROM career_world_players WHERE career_save_id=${saveId} ORDER BY id`)).map(row=>String(row.id));
  const expected=initialNpcSponsorRelationships(seed,1,population);
  const persisted=await rows(sql`SELECT id,npc_id,sponsor_key,category,representative_id,status,start_season,start_week,end_season,end_week,sponsor_snapshot
    FROM career_npc_sponsor_relationships WHERE career_save_id=${saveId} ORDER BY id`);
  const marker=(await rows(sql`SELECT * FROM career_sponsor_world_state WHERE career_save_id=${saveId}`))[0];
  assert.ok(expected.length>0);
  assert.equal(Number(marker.content_version),NPC_SPONSOR_CONTENT_VERSION);
  assert.equal(Number(marker.npc_count),population.length);
  assert.equal(Number(marker.relationship_count),expected.length);
  assert.equal(persisted.length,expected.length);
  assert.deepEqual(persisted.map(row=>String(row.id)),expected.map(row=>row.id).sort());
  for(const record of persisted){
    const snapshot=parseNpcSponsorSnapshot(record.sponsor_snapshot);
    assert.equal(snapshot.sponsorId,String(record.sponsor_key));
    assert.equal(snapshot.representative.id,String(record.representative_id));
    assert.equal(record.status,"ACTIVE");
    assert.equal(record.end_season,null);
  }
  const after=(await rows(sql`SELECT balance_pence,(SELECT COUNT(*)::int FROM career_finance_entries WHERE career_save_id=${saveId}) AS ledger_count
    FROM career_saves WHERE id=${saveId}`))[0];
  assert.deepEqual(after,before);
});

test("world retries and repeated migration preserve the initial snapshot; other saves remain isolated",async()=>{
  const before=await rows(sql`SELECT id,sponsor_key,sponsor_snapshot FROM career_npc_sponsor_relationships
    WHERE career_save_id=${saveId} ORDER BY id`);
  assert.deepEqual(await world.initialize(actor,saveId),{initialized:true,created:false});
  await createCareerSponsorshipFoundation(db);
  const after=await rows(sql`SELECT id,sponsor_key,sponsor_snapshot FROM career_npc_sponsor_relationships
    WHERE career_save_id=${saveId} ORDER BY id`);
  assert.deepEqual(after,before);
  if(before.length){
    const first=before[0];
    await assert.rejects(db.execute(sql`UPDATE career_npc_sponsor_relationships SET sponsor_snapshot='{}'::jsonb
      WHERE career_save_id=${saveId} AND id=${first.id}`));
  }
  secondSaveId=(await saves.create(2,{slot:1,dateOfBirth:"1990-01-01"})).id;
  await db.execute(sql`UPDATE career_saves SET world_seed=${"b".repeat(64)} WHERE id=${secondSaveId}`);
  await world.initialize({playerId:2},secondSaveId);
  assert.equal(Number((await rows(sql`SELECT COUNT(*)::int AS n FROM career_npc_sponsor_relationships WHERE career_save_id=${secondSaveId}`))[0].n),
    initialNpcSponsorRelationships("b".repeat(64),1,(await rows(sql`SELECT id FROM career_world_players WHERE career_save_id=${secondSaveId}`)).map(row=>String(row.id))).length);
  assert.equal(Number((await rows(sql`SELECT COUNT(*)::int AS n FROM career_npc_sponsor_relationships WHERE career_save_id=${saveId}`))[0].n),before.length);
});
