import {after,before,test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import express from "express";
import {sql,type SQL} from "drizzle-orm";
import {PgDialect} from "drizzle-orm/pg-core";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {createCareerSaves} from "../../db/migrations/create_career_saves.ts";
import {createCareerWorld} from "../../db/migrations/create_career_world.ts";
import {createCareerCalendar} from "../../db/migrations/create_career_calendar.ts";
import {createCareerFinance} from "../../db/migrations/create_career_finance.ts";
import {createCareerSporting} from "../../db/migrations/create_career_sporting.ts";
import {createCareerGoals} from "../../db/migrations/create_career_goals.ts";
import {createCareerLife} from "../../db/migrations/create_career_life.ts";
import {createCareerLegacy} from "../../db/migrations/create_career_legacy.ts";
import {createCareerService} from "../../career/service.ts";
import {createCareerWorldService} from "../../career/world/service.ts";
import type {CareerDatabase,CareerExecutor} from "../../career/database.ts";
import {CAREER_DIAGNOSTIC_SAVE_ID,CAREER_DIAGNOSTIC_PATH,EXPECTED_CAREER_TABLES,
  createCareerSchemaDiagnosticRouter,readCareerSchemaDiagnostic} from "../../career/schema-diagnostic.ts";

const pg=new PGlite(),db=drizzle(pg),dialect=new PgDialect();
let server:ReturnType<ReturnType<typeof express>["listen"]>,base="";
const statements:string[]=[];
const observed:CareerDatabase={
  execute:q=>db.execute(q),
  transaction:work=>db.transaction(tx=>work({
    execute:q=>{statements.push(dialect.sqlToQuery(q).sql);return tx.execute(q);},
  })),
};
const PRIVACY_MARKER="PRIVATE-NAME-SEED-SESSION-CONNECTION";
const migrationKeys=["createCareerSavesA1","createCareerWorldA2","createCareerCalendarA3",
  "createCareerFinanceA4","createCareerSportingA5","createCareerGoalsA73","createCareerLifeA75","createCareerLegacyA76"];

async function snapshot(){
  const tables=(await pg.query<{tablename:string}>(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`)).rows;
  const out:Record<string,unknown>={};
  for(const {tablename} of tables){
    const safe=String(tablename).replaceAll('"','""');
    out[String(tablename)]=(await pg.query(`SELECT count(*)::int AS count,
      md5(COALESCE(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) AS contents
      FROM "${safe}" t`)).rows[0];
  }
  out.schema=(await pg.query(`SELECT md5(string_agg(definition,'' ORDER BY definition)) AS contents FROM (
    SELECT pg_get_constraintdef(p.oid) AS definition FROM pg_constraint p JOIN pg_class c ON c.oid=p.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    UNION ALL SELECT indexdef FROM pg_indexes WHERE schemaname='public'
    UNION ALL SELECT pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
    UNION ALL SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname LIKE 'career_%'
  )s`)).rows[0];
  return out;
}
before(async()=>{
  await pg.exec(`CREATE TABLE players(id integer PRIMARY KEY);INSERT INTO players VALUES(1);
    CREATE TABLE feature_flags(feature_name text UNIQUE,enabled boolean,admin_test_mode boolean,description text);
    INSERT INTO feature_flags VALUES('tour_career_2',true,false,'test');
    CREATE TABLE app_schema_migrations(migration_key text PRIMARY KEY,completed_at timestamptz NOT NULL DEFAULT NOW());
    CREATE TABLE app_bootstrap_versions(version_key text PRIMARY KEY,completed_at timestamptz NOT NULL DEFAULT NOW());`);
  for(const migrate of [createCareerSaves,createCareerWorld,createCareerCalendar,createCareerFinance,
    createCareerSporting,createCareerGoals,createCareerLife,createCareerLegacy])await migrate(db);
  for(const key of migrationKeys)await pg.query("INSERT INTO app_schema_migrations(migration_key) VALUES($1)",[key]);
  await pg.query("INSERT INTO app_bootstrap_versions(version_key) VALUES($1)",[PRIVACY_MARKER]);
  const original=await createCareerService(db).create(1,{slot:1,careerName:PRIVACY_MARKER,dateOfBirth:"1990-06-15"});
  const root=(await pg.query<{root:Record<string,unknown>}>("SELECT row_to_json(s) AS root FROM career_saves s WHERE id=$1",[original.id])).rows[0].root;
  const failed={...root,id:CAREER_DIAGNOSTIC_SAVE_ID,slot_number:2,world_seed:"a".repeat(64)};
  await pg.query("INSERT INTO career_saves SELECT (jsonb_populate_record(NULL::career_saves,$1::jsonb)).*",[JSON.stringify(failed)]);
  for(const table of ["career_profiles","career_finance_entries"]){
    const row=(await pg.query<{data:Record<string,unknown>}>(`SELECT row_to_json(t) AS data FROM ${table} t WHERE career_save_id=$1`,[original.id])).rows[0].data;
    row.career_save_id=CAREER_DIAGNOSTIC_SAVE_ID;
    if(table==="career_finance_entries")row.id=randomUUID();
    await pg.query(`INSERT INTO ${table} SELECT (jsonb_populate_record(NULL::${table},$1::jsonb)).*`,[JSON.stringify(row)]);
  }
  // Legitimate partial state: world committed, calendar/finance/sporting not initialized.
  await createCareerWorldService(db).initialize({playerId:1,isAdmin:true},CAREER_DIAGNOSTIC_SAVE_ID);
  const app=express();
  app.use((req,_res,next)=>{
    (req as unknown as {session:unknown}).session={isAdmin:req.header("x-test-admin")==="true"};next();
  });
  app.use("/api",createCareerSchemaDiagnosticRouter(observed));
  server=app.listen(0);
  await new Promise<void>(r=>server.listening?r():server.once("listening",r));
  base="http://127.0.0.1:"+(server.address() as {port:number}).port+"/api"+CAREER_DIAGNOSTIC_PATH;
});
after(async()=>{if(server)await new Promise<void>(r=>server.close(()=>r()));await pg.close();});
async function call(admin=true,suffix="",method="GET"){
  const response=await fetch(base+suffix,{method,headers:admin?{"x-test-admin":"true"}:{}});
  const text=await response.text();
  return {status:response.status,cache:response.headers.get("cache-control"),
    body:text.startsWith("{")?JSON.parse(text):null,text};
}

test("existing admin session is mandatory; parameters and mutation methods cannot query the DB",async()=>{
  statements.length=0;
  const denied=await call(false);
  assert.equal(denied.status,403);assert.match(denied.cache!,/no-store/);
  assert.equal(statements.length,0);
  assert.equal((await call(true,"?saveId=another-player")).status,400);
  assert.equal((await call(true,"","POST")).status,404);
  assert.equal(statements.length,0);
});

test("current schema, v5 Friday definition and partial fixed-save state are reported without private values",async()=>{
  statements.length=0;
  const result=await call();
  assert.equal(result.status,200);assert.match(result.cache!,/private.*no-store/);
  const d=result.body;
  assert.equal(d.transaction.read_only,"on");assert.equal(d.transaction.isolation,"repeatable read");
  assert.equal(d.tables.length,43);assert.ok(d.tables.every((t:{present:boolean})=>t.present));
  assert.equal(d.columns.length,568);assert.equal(d.constraints.length,401);
  assert.equal(d.indexes.length,96);assert.equal(d.triggers.length,24);assert.equal(d.functions.length,14);
  assert.deepEqual(d.definitionCounts.map((x:{count:number})=>x.count),[73,75,92,92,92]);
  assert.equal(d.friday501Exists,true);assert.equal(d.failedSave.present,true);
  assert.equal(d.failedSave.status.current_season,1);assert.equal(d.failedSave.status.current_week,1);
  assert.equal(d.failedSave.ownedRowCounts.find((x:{table_name:string})=>x.table_name==="career_world_players").count,340);
  assert.equal(d.failedSave.ownedRowCounts.find((x:{table_name:string})=>x.table_name==="career_event_instances").count,0);
  assert.deepEqual(d.signals.missingTables,[]);assert.deepEqual(d.signals.missingInstanceColumns,[]);
  assert.equal(d.signals.matchesHistoricalStaleIndicators,false);
  for(const privateValue of [PRIVACY_MARKER,"1990-06-15","a".repeat(64)])assert.ok(!result.text.includes(privateValue));
  assert.ok(!d.functions.some((f:Record<string,unknown>)=>"definition" in f));
  assert.match(statements[0],/^SET TRANSACTION .*READ ONLY/);
  assert.ok(statements.every(s=>/^(SELECT|WITH|SET TRANSACTION|SET LOCAL)\b/i.test(s.trim())));
});

test("all row contents/counts, schema and migration/bootstrap ledgers remain unchanged after repeated GETs",async()=>{
  const before=await snapshot();
  assert.equal((await call()).status,200);assert.equal((await call()).status,200);
  assert.deepEqual(await snapshot(),before);
});

test("PostgreSQL rejects a test-injected write with 25006 after the diagnostic's read-only boundary",async()=>{
  const before=await snapshot();
  const attempted:CareerDatabase={
    execute:q=>db.execute(q),
    transaction:work=>db.transaction(tx=>work({
      execute:async(q:SQL)=>{
        if(dialect.sqlToQuery(q).sql.startsWith("SELECT current_setting"))
          await tx.execute(sql`INSERT INTO feature_flags(feature_name) VALUES ('write_must_be_rejected')`);
        return tx.execute(q);
      },
    })),
  };
  await assert.rejects(()=>readCareerSchemaDiagnostic(attempted),(error:unknown)=>{
    for(let e=error as {code?:string;cause?:unknown};e;e=e.cause as typeof e)if(e.code==="25006")return true;
    return false;
  });
  assert.deepEqual(await snapshot(),before);
});

test("arbitrary bootstrap/environment keys are never returned",async()=>{
  const previous={mode:process.env.NODE_ENV,commit:process.env.RENDER_GIT_COMMIT,version:process.env.TKDL_BOOTSTRAP_VERSION};
  try{
    process.env.NODE_ENV="production";delete process.env.RENDER_GIT_COMMIT;
    process.env.TKDL_BOOTSTRAP_VERSION=PRIVACY_MARKER;
    const result=await call();
    assert.equal(result.status,200);assert.equal(result.body.deployedCommit,null);
    assert.equal(result.body.bootstrapLedger.matchingKeyRecorded,true);
    assert.ok(!result.text.includes(PRIVACY_MARKER));
    process.env.RENDER_GIT_COMMIT="c358b8b581d0beba8eb5201fafc5c4bfb2ce74da";
    assert.equal((await call()).body.deployedCommit,process.env.RENDER_GIT_COMMIT);
  }finally{
    for(const [key,value] of [["NODE_ENV",previous.mode],["RENDER_GIT_COMMIT",previous.commit],["TKDL_BOOTSTRAP_VERSION",previous.version]]){
      if(value===undefined)delete process.env[key!];else process.env[key!]=value;
    }
  }
});

test("stale pre-A8.1/A8.2 indicators are recognized, including the old sponsor index, without repairing them",async()=>{
  // Reconstruct the relevant missing-object/catalogue state verified against
  // genuine 7f47f2e in the preceding native PostgreSQL investigation.
  await pg.exec(`DROP TABLE career_signature_products;DROP TABLE career_group_bull_playoffs;
    DROP FUNCTION career_product_guard();DROP FUNCTION career_reject_finished_bull_update();
    DELETE FROM career_event_definitions WHERE event_database_version>=3;
    CREATE UNIQUE INDEX career_sponsor_contracts_one_active ON career_sponsor_contracts(career_save_id) WHERE status='ACTIVE';`);
  const before=await snapshot(),result=await call(),d=result.body;
  assert.equal(result.status,200);
  assert.deepEqual(d.signals.missingTables,["career_group_bull_playoffs","career_signature_products"]);
  assert.deepEqual(d.signals.missingInstanceColumns,[]);
  assert.deepEqual(d.signals.missingLaterDefinitionVersions,[3,4,5]);
  assert.equal(d.signals.a3Recorded,true);assert.equal(d.signals.a4Recorded,true);
  assert.equal(d.signals.matchesHistoricalStaleIndicators,true);
  assert.equal(d.friday501Exists,false);
  assert.deepEqual(d.definitionCounts.map((x:{count:number})=>x.count),[73,75]);
  assert.ok(d.indexes.some((x:{name:string})=>x.name==="career_sponsor_contracts_one_active"));
  assert.equal(d.functions.length,12);
  assert.deepEqual(await snapshot(),before);
});

test("absent Career schema and partially drifted save columns report absence rather than exposing raw errors",async()=>{
  const empty=new PGlite();
  try{
    const result=await readCareerSchemaDiagnostic(drizzle(empty));
    assert.deepEqual(result.signals.missingTables,[...EXPECTED_CAREER_TABLES].sort());
    assert.equal(result.definitionReadable,false);assert.equal(result.friday501Exists,null);
    assert.equal(result.failedSave.present,null);assert.equal(result.schemaLedger.present,false);
    assert.deepEqual(result.failedSave.ownedRowCounts,[]);
  }finally{await empty.close();}
  await pg.exec("ALTER TABLE career_saves DROP COLUMN current_week CASCADE");
  const before=await snapshot(),result=await call();
  assert.equal(result.status,200);assert.equal(result.body.failedSave.schemaReadable,false);
  assert.equal(result.body.failedSave.present,null);assert.deepEqual(await snapshot(),before);
});

test("connection/query failures are sanitized",async()=>{
  const broken:CareerDatabase={
    execute:async()=>{throw new Error(PRIVACY_MARKER);},
    transaction:async()=>{throw new Error("postgres://"+PRIVACY_MARKER+"; session=secret");},
  };
  const app=express();app.use((req,_res,next)=>{(req as unknown as {session:unknown}).session={isAdmin:true};next();});
  app.use("/api",createCareerSchemaDiagnosticRouter(broken));
  const local=app.listen(0);
  await new Promise<void>(r=>local.listening?r():local.once("listening",r));
  try{
    const response=await fetch("http://127.0.0.1:"+(local.address() as {port:number}).port+"/api"+CAREER_DIAGNOSTIC_PATH);
    assert.equal(response.status,500);
    assert.deepEqual(await response.json(),{error:"Read-only Career schema diagnostic failed"});
  }finally{await new Promise<void>(r=>local.close(()=>r()));}
});
