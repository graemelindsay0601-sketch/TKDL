import {test} from "node:test";
import assert from "node:assert/strict";
import {sql} from "drizzle-orm";
import {PgDialect} from "drizzle-orm/pg-core";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import type {CareerDatabase} from "../../career/database.ts";
import {createCareerSaves} from "../../db/migrations/create_career_saves.ts";
import {createCareerWorld} from "../../db/migrations/create_career_world.ts";
import {createCareerSponsorshipFoundation} from "../../db/migrations/create_career_sponsorship_foundation.ts";
import {createCareerCalendar} from "../../db/migrations/create_career_calendar.ts";
import {createCareerFinance} from "../../db/migrations/create_career_finance.ts";
import {createCareerSporting} from "../../db/migrations/create_career_sporting.ts";
import {createCareerGoals} from "../../db/migrations/create_career_goals.ts";
import {createCareerLife} from "../../db/migrations/create_career_life.ts";
import {createCareerLegacy} from "../../db/migrations/create_career_legacy.ts";
import {CAREER_CONTENT_UPGRADE_A9_V1,upgradeCareerContentA9V1} from "../../db/migrations/upgrade_career_content_a9_v1.ts";
import {createCareerService} from "../../career/service.ts";
import {createCareerSportingService} from "../../career/sporting/service.ts";

const oldKeys=["createCareerSavesA1","createCareerWorldA2","createCareerCalendarA3",
  "createCareerFinanceA4","createCareerSportingA5","createCareerGoalsA73","createCareerLifeA75","createCareerLegacyA76"];
const chain=[createCareerSaves,createCareerWorld,createCareerSponsorshipFoundation,createCareerCalendar,createCareerFinance,
  createCareerSporting,createCareerGoals,createCareerLife,createCareerLegacy];
const actor={playerId:1,isAdmin:false};
const dialect=new PgDialect();
async function foundation(pg:PGlite){
  await pg.exec(`CREATE TABLE players(id integer PRIMARY KEY);INSERT INTO players VALUES(1);
    CREATE TABLE feature_flags(feature_name text UNIQUE,enabled boolean,admin_test_mode boolean,description text);
    INSERT INTO feature_flags VALUES('tour_career_2',true,false,'isolated test');
    CREATE TABLE app_schema_migrations(migration_key text PRIMARY KEY,completed_at timestamptz NOT NULL DEFAULT NOW());`);
}
async function prepare(pg:PGlite,db:CareerDatabase,stale=false){
  await foundation(pg);
  for(const migrate of chain)await migrate(db);
  for(const key of oldKeys)await pg.query("INSERT INTO app_schema_migrations(migration_key) VALUES($1)",[key]);
  if(stale)await pg.exec(`DROP TABLE career_signature_products;DROP TABLE career_group_bull_playoffs;
    DELETE FROM career_event_definitions WHERE event_database_version>=3;
    CREATE UNIQUE INDEX career_sponsor_contracts_one_active ON career_sponsor_contracts(career_save_id) WHERE status='ACTIVE';`);
}
async function contents(pg:PGlite,only?:string[]){
  const tables=(await pg.query<{tablename:string}>("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
  const result:Record<string,unknown>={};
  for(const {tablename} of tables){
    if(only&&!only.includes(tablename))continue;
    assert.match(tablename,/^[a-z_]+$/);
    result[tablename]=(await pg.query(`SELECT count(*)::int AS count,
      md5(COALESCE(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) AS hash FROM "${tablename}" t`)).rows[0];
  }
  return result;
}
async function schema(pg:PGlite){
  return (await pg.query(`SELECT md5(string_agg(definition,'' ORDER BY definition)) AS hash FROM (
    SELECT table_name||column_name||data_type||is_nullable||COALESCE(column_default,'') AS definition FROM information_schema.columns WHERE table_schema='public'
    UNION ALL SELECT pg_get_constraintdef(p.oid) FROM pg_constraint p JOIN pg_class c ON c.oid=p.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    UNION ALL SELECT indexdef FROM pg_indexes WHERE schemaname='public'
    UNION ALL SELECT pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
    UNION ALL SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'career_%'
  ) definitions`)).rows;
}
async function marker(pg:PGlite){
  return (await pg.query("SELECT migration_key FROM app_schema_migrations WHERE migration_key=$1",[CAREER_CONTENT_UPGRADE_A9_V1])).rows;
}
async function legacyMarkers(pg:PGlite){
  return (await pg.query("SELECT * FROM app_schema_migrations WHERE migration_key<>$1 ORDER BY migration_key",[CAREER_CONTENT_UPGRADE_A9_V1])).rows;
}
async function newSave(db:CareerDatabase){
  return createCareerService(db).create(1,{slot:1,careerName:"Isolated repair test",dateOfBirth:"1990-06-15"});
}

test("new migration independently installs the full Career schema and v1-v5 catalogue",async()=>{
  const pg=new PGlite(),db=drizzle(pg);
  try{
    await foundation(pg);await upgradeCareerContentA9V1(db);
    const versions=await pg.query<{event_database_version:number;count:number}>(
      "SELECT event_database_version,count(*)::int AS count FROM career_event_definitions GROUP BY 1 ORDER BY 1");
    assert.deepEqual(versions.rows,[{event_database_version:1,count:73},{event_database_version:2,count:75},
      {event_database_version:3,count:92},{event_database_version:4,count:92},{event_database_version:5,count:92}]);
    assert.equal((await marker(pg)).length,1);
    const before=await contents(pg),beforeSchema=await schema(pg);
    await upgradeCareerContentA9V1(db);
    assert.deepEqual(await contents(pg),before);assert.deepEqual(await schema(pg),beforeSchema);
  }finally{await pg.close();}
});

test("recorded old keys cannot skip the upgrade; the failed world/save survives and initialization recovers",async()=>{
  const pg=new PGlite(),db=drizzle(pg);
  try{
    await prepare(pg,db,true);const save=await newSave(db),career=createCareerSportingService(db);
    await assert.rejects(()=>career.initialize(actor,save.id),error=>{
      for(let e=error as {code?:string;cause?:unknown};e;e=e.cause as typeof e)if(e.code)return e.code==="23503";
      return false;
    });
    const preserved=["career_saves","career_world_state","career_world_players","players","feature_flags"];
    const before=await contents(pg,preserved),keys=await legacyMarkers(pg);
    assert.equal((before.career_world_players as {count:number}).count,340);
    await upgradeCareerContentA9V1(db);
    assert.deepEqual(await contents(pg,preserved),before);assert.deepEqual(await legacyMarkers(pg),keys);
    assert.equal((await marker(pg)).length,1);
    assert.equal((await pg.query("SELECT 1 FROM career_signature_products")).rows.length,0);
    await career.initialize(actor,save.id);
    const initialized=await contents(pg);await career.initialize(actor,save.id);
    assert.deepEqual(await contents(pg),initialized);
  }finally{await pg.close();}
});

test("current initialized Careers and all other existing rows remain byte-identical",async()=>{
  const pg=new PGlite(),db=drizzle(pg);
  try{
    await prepare(pg,db);const save=await newSave(db);
    await createCareerSportingService(db).initialize(actor,save.id);
    const before=await contents(pg),beforeSchema=await schema(pg),keys=await legacyMarkers(pg);
    await upgradeCareerContentA9V1(db);
    const after=await contents(pg);delete before.app_schema_migrations;delete after.app_schema_migrations;
    assert.deepEqual(after,before);assert.deepEqual(await schema(pg),beforeSchema);
    assert.deepEqual(await legacyMarkers(pg),keys);assert.equal((await marker(pg)).length,1);
  }finally{await pg.close();}
});

test("failure after the completion insert rolls back EVERY schema/data/ledger change and allows a safe retry",async()=>{
  const pg=new PGlite(),db=drizzle(pg);
  try{
    await prepare(pg,db,true);await newSave(db);
    const before=await contents(pg),beforeSchema=await schema(pg);
    const fault:CareerDatabase={
      execute:q=>db.execute(q),
      transaction:work=>db.transaction(tx=>work({execute:async q=>{
        const result=await tx.execute(q);
        if(/INSERT INTO app_schema_migrations/.test(dialect.sqlToQuery(q).sql))throw new Error("injected failure after marker");
        return result;
      }})),
    };
    await assert.rejects(()=>upgradeCareerContentA9V1(fault),/injected failure after marker/);
    assert.deepEqual(await contents(pg),before);assert.deepEqual(await schema(pg),beforeSchema);
    assert.equal((await marker(pg)).length,0);
    await upgradeCareerContentA9V1(db);assert.equal((await marker(pg)).length,1);
  }finally{await pg.close();}
});

test("conflicting shipped definition hashes abort rather than silently rewriting authored content",async()=>{
  const pg=new PGlite(),db=drizzle(pg);
  try{
    await prepare(pg,db,true);
    await db.execute(sql`UPDATE career_event_definitions SET definition_hash=${"0".repeat(64)}
      WHERE event_database_version=1 AND definition_key='friday-night-501'`);
    const before=await contents(pg),beforeSchema=await schema(pg);
    await assert.rejects(()=>upgradeCareerContentA9V1(db),/publish a new version/);
    assert.deepEqual(await contents(pg),before);assert.deepEqual(await schema(pg),beforeSchema);
    assert.equal((await marker(pg)).length,0);
  }finally{await pg.close();}
});

test("concurrent native PostgreSQL workers perform one upgrade and preserve historical ledger entries",
  {skip:!process.env.CAREER_CERT_PG_SOCKET},async()=>{
    const pg=new PGlite(),db=drizzle(pg);
    try{
      await prepare(pg,db,true);const before=await legacyMarkers(pg);
      await Promise.all([upgradeCareerContentA9V1(db),upgradeCareerContentA9V1(db)]);
      assert.equal((await marker(pg)).length,1);assert.deepEqual(await legacyMarkers(pg),before);
      assert.equal((await pg.query("SELECT 1 FROM career_event_definitions WHERE event_database_version=5")).rows.length,92);
    }finally{await pg.close();}
  });
