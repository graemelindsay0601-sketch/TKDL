import {Router} from "express";
import type {} from "express-session";
import {sql, type SQL} from "drizzle-orm";
import {requireAdminSession} from "../middleware/requireAdminSession.ts";
import type {CareerDatabase} from "./database.ts";

/** Temporary, fixed-target diagnostic. Never accept SQL or a save ID from callers. */
export const CAREER_DIAGNOSTIC_SAVE_ID = "97ce22eb-7fbe-4e04-95ad-9f858476289a";
export const CAREER_DIAGNOSTIC_PATH = "/admin/career/schema-diagnostic";
export const EXPECTED_CAREER_TABLES = [
  "career_calendar_operations","career_event_definitions","career_event_entries",
  "career_event_finance","career_event_instances","career_event_prize_tables","career_event_results",
  "career_finance_entries","career_finance_state","career_group_bull_playoffs",
  "career_legacy_inductions","career_legacy_retirements","career_legacy_reviews",
  "career_life_commitments","career_life_decisions","career_life_merchandise","career_match_sessions",
  "career_participant_bookings","career_personal_goals","career_prize_awards","career_profiles",
  "career_qschool_allocations","career_qschool_card_awards","career_qschool_results",
  "career_qualification_entitlements","career_ranking_contributions","career_ranking_participants",
  "career_ranking_snapshot_rows","career_ranking_snapshots","career_saves","career_seasons",
  "career_signature_products","career_simulated_matches","career_sponsor_contracts",
  "career_sponsor_offers","career_sporting_milestones","career_sporting_state","career_tour_cards",
  "career_tournament_matches","career_trips","career_world_periods","career_world_players","career_world_state",
] as const;
const INSTANCE_COLUMNS = [
  "career_save_id","id","season","instance_key","ordinal","event_database_version","definition_key",
  "name","family","circuit","classification","ranking_category","presentation_tier","featured",
  "calendar_priority","venue_key","city","country","region","zone","locality_key","start_week",
  "end_week","start_day","end_day","registration_opens_week","registration_closes_week",
  "field_size","minimum_entrants","executable","series_key","series_day","status","status_reason",
  "entrant_count","champion_participant_key","champion_npc_id","snapshot","field_locked_at","drawn_at","completed_at",
];
const SAVE_COLUMNS = ["id","status","current_season","current_week","career_schema_version",
  "world_generation_version","event_database_version","player_database_version"];
const names = sql.join(EXPECTED_CAREER_TABLES.map(name=>sql`(${name})`),sql`,`);
const relations = sql`WITH expected(name) AS (VALUES ${names})
  SELECT name,c.oid::text AS oid,n.nspname AS schema,c.relkind AS kind
  FROM expected LEFT JOIN pg_catalog.pg_class c ON c.oid=to_regclass(name)
  LEFT JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace ORDER BY name`;
const scope = sql`SELECT to_regclass(name) FROM (VALUES ${names}) AS expected(name)`;
export async function readCareerSchemaDiagnostic(database:CareerDatabase) {
  return database.transaction(async tx=>{
    // First statement after BEGIN. PostgreSQL, not a convention, prevents writes.
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`);
    await tx.execute(sql`SET LOCAL statement_timeout = '5s'`);
    await tx.execute(sql`SET LOCAL lock_timeout = '1s'`);
    const q=async(query:SQL)=>(await tx.execute(query)).rows;
    const transaction=(await q(sql`SELECT current_setting('transaction_read_only') AS read_only,
      current_setting('transaction_isolation') AS isolation,current_setting('server_version') AS server_version`))[0];
    if(transaction?.read_only!=="on")throw new Error("Read-only transaction required");
    const tables=await q(relations);
    const columns=await q(sql`SELECT c.relname AS table_name,n.nspname AS schema,a.attname AS column_name,
      format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull AS not_null,
      pg_get_expr(d.adbin,d.adrelid) AS default_expression
      FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
      WHERE a.attrelid IN (${scope}) AND a.attnum>0 AND NOT a.attisdropped
      ORDER BY c.relname,a.attnum`);
    const constraints=await q(sql`SELECT c.relname AS table_name,p.conname AS name,p.contype AS type,
      pg_get_constraintdef(p.oid) AS definition,p.convalidated AS validated
      FROM pg_catalog.pg_constraint p JOIN pg_catalog.pg_class c ON c.oid=p.conrelid
      WHERE p.conrelid IN (${scope}) ORDER BY c.relname,p.conname`);
    const indexes=await q(sql`SELECT c.relname AS table_name,i.relname AS name,
      pg_get_indexdef(x.indexrelid) AS definition,x.indisvalid AS valid,x.indisready AS ready
      FROM pg_catalog.pg_index x JOIN pg_catalog.pg_class c ON c.oid=x.indrelid
      JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid
      WHERE x.indrelid IN (${scope}) ORDER BY c.relname,i.relname`);
    const triggers=await q(sql`SELECT c.relname AS table_name,t.tgname AS name,t.tgenabled AS enabled,
      pg_get_triggerdef(t.oid) AS definition,p.proname AS function_name
      FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
      JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid
      WHERE t.tgrelid IN (${scope}) AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`);
    // Return hashes, not function bodies (which could contain operational literals).
    const functions=await q(sql`SELECT DISTINCT n.nspname AS schema,p.proname AS name,
      pg_get_function_identity_arguments(p.oid) AS arguments,l.lanname AS language,
      md5(p.prosrc) AS body_md5
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      JOIN pg_catalog.pg_language l ON l.oid=p.prolang
      JOIN pg_catalog.pg_trigger t ON t.tgfoid=p.oid
      WHERE t.tgrelid IN (${scope}) AND NOT t.tgisinternal ORDER BY schema,name,arguments`);
    const table=(name:string)=>tables.find(t=>t.name===name);
    const has=(name:string,required:string[])=>{
      const t=table(name);
      return !!t?.oid&&["r","p"].includes(String(t.kind))&&
        required.every(column=>columns.some(c=>c.table_name===name&&c.column_name===column));
    };
    const identifier=(name:string)=>sql`${sql.identifier(String(table(name)!.schema))}.${sql.identifier(name)}`;
    const ledger=async(name:string,required:string[])=>{
      const meta=(await q(sql`SELECT c.oid::text AS oid,c.relkind AS kind,
        ARRAY(SELECT a.attname::text FROM pg_catalog.pg_attribute a
          WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns
        FROM pg_catalog.pg_class c WHERE c.oid=to_regclass(${name})`))[0];
      return {present:!!meta,readable:!!meta&&["r","p"].includes(String(meta.kind))&&
        required.every(c=>(meta.columns as string[]).includes(c))};
    };
    const schemaLedger=await ledger("app_schema_migrations",["migration_key","completed_at"]);
    const careerMigrations=schemaLedger.readable?await q(sql`SELECT migration_key,completed_at
      FROM app_schema_migrations WHERE migration_key ~* 'career' ORDER BY migration_key`):[];
    const bootstrapLedger=await ledger("app_bootstrap_versions",["version_key","completed_at"]);
    const deployed=process.env.RENDER_GIT_COMMIT?.trim();
    const deployedCommit=deployed&&/^[a-f0-9]{40}$/i.test(deployed)?deployed:null;
    const bootstrapKey=process.env.NODE_ENV==="production"?
      process.env.RENDER_GIT_COMMIT?.trim()||process.env.TKDL_BOOTSTRAP_VERSION?.trim()||null:null;
    // Never return arbitrary environment/ledger key strings.
    const bootstrapRows=bootstrapLedger.readable?await q(sql`SELECT version_key,completed_at
      FROM app_bootstrap_versions WHERE version_key=${bootstrapKey}
      OR version_key ~ '^[a-f0-9]{40}$' ORDER BY completed_at DESC LIMIT 10`):[];
    const definitionReadable=has("career_event_definitions",["event_database_version","definition_key"]);
    const definitionCounts=definitionReadable?await q(sql`SELECT event_database_version,count(*)::int AS count
      FROM ${identifier("career_event_definitions")} GROUP BY event_database_version ORDER BY event_database_version`):[];
    const friday501Exists=definitionReadable?
      (await q(sql`SELECT EXISTS(SELECT 1 FROM ${identifier("career_event_definitions")}
        WHERE event_database_version=5 AND definition_key='friday-night-501') AS present`))[0].present:null;
    const saveReadable=has("career_saves",SAVE_COLUMNS);
    const save=saveReadable?(await q(sql`SELECT status,current_season,current_week,career_schema_version,
      world_generation_version,event_database_version,player_database_version FROM ${identifier("career_saves")}
      WHERE id=${CAREER_DIAGNOSTIC_SAVE_ID}::uuid`))[0]??null:null;
    const countQueries=tables.filter(t=>["r","p"].includes(String(t.kind))&&
      columns.some(c=>c.table_name===t.name&&c.column_name==="career_save_id"))
      .map(t=>sql`SELECT ${t.name}::text AS table_name,count(*)::int AS count FROM ${identifier(String(t.name))}
        WHERE career_save_id=${CAREER_DIAGNOSTIC_SAVE_ID}::uuid`);
    const ownedRowCounts=countQueries.length?await q(sql.join(countQueries,sql` UNION ALL `)):[];
    const missingTables=tables.filter(t=>!t.oid).map(t=>String(t.name));
    const missingInstanceColumns=INSTANCE_COLUMNS.filter(name=>!columns.some(c=>
      c.table_name==="career_event_instances"&&c.column_name===name));
    const recorded=new Set(careerMigrations.map(r=>String(r.migration_key)));
    const missingLaterDefinitionVersions=[3,4,5].filter(v=>!definitionCounts.some(r=>r.event_database_version===v&&Number(r.count)>0));
    return {
      diagnosticVersion:1,deployedCommit,expected:{tableCount:43,eventInstanceColumnCount:41,
        columns:568,constraints:401,indexes:96,triggers:24,functions:14,
        definitionCounts:[{version:1,count:73},{version:2,count:75},{version:3,count:92},{version:4,count:92},{version:5,count:92}]},
      transaction,
      schemaLedger:{...schemaLedger,careerMigrations},
      bootstrapLedger:{...bootstrapLedger,keyConfigured:!!bootstrapKey,
        matchingKeyRecorded:bootstrapRows.some(r=>r.version_key===bootstrapKey),
        rows:bootstrapRows.map(r=>({commit:/^[a-f0-9]{40}$/i.test(String(r.version_key))?r.version_key:null,
          matchesConfiguredKey:r.version_key===bootstrapKey,completedAt:r.completed_at}))},
      tables:tables.map(({name,schema,kind,oid})=>({name,present:!!oid,schema:schema??null,kind:kind??null})),
      columns,constraints,indexes,triggers,functions,definitionReadable,definitionCounts,friday501Exists,
      failedSave:{schemaReadable:saveReadable,present:saveReadable?!!save:null,status:save,ownedRowCounts},
      signals:{missingTables,missingInstanceColumns,missingLaterDefinitionVersions,
        a3Recorded:recorded.has("createCareerCalendarA3"),a4Recorded:recorded.has("createCareerFinanceA4"),
        matchesHistoricalStaleIndicators:recorded.has("createCareerCalendarA3")&&recorded.has("createCareerFinanceA4")&&
          missingTables.includes("career_signature_products")&&missingTables.includes("career_group_bull_playoffs")&&
          missingLaterDefinitionVersions.length===3&&friday501Exists===false},
    };
  });
}

export function createCareerSchemaDiagnosticRouter(database:CareerDatabase) {
  const router=Router();
  router.get(CAREER_DIAGNOSTIC_PATH,(_req,res,next)=>{
    res.set("Cache-Control","private, no-store");next();
  },requireAdminSession,async(req,res)=>{
    if(Object.keys(req.query).length){res.status(400).json({error:"Diagnostic accepts no parameters"});return;}
    try{res.json(await readCareerSchemaDiagnostic(database));}
    catch{
      // No raw query, parameters, connection errors or private rows leave this route.
      res.status(500).json({error:"Read-only Career schema diagnostic failed"});
    }
  });
  return router;
}
