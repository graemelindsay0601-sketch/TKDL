import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../career/database.ts";
import { CAREER_SCHEMA_EXPECTED } from "./schema-expectations/career-schema.ts";

/**
 * Production databases are years of migrations deep, and a ledgered migration that failed (and so was never recorded)
 * or was edited after it was recorded leaves the schema short in ways a fresh database never shows: a missing column,
 * a CHECK without a newer value. Each one surfaces later as a 500 in the middle of a Career. This compares the live
 * Career schema with the one every migration and repair produces, so drift is found (and repaired) at boot instead.
 *
 * Checks compare their quoted values (the lists of allowed statuses, sources, kinds), which is what goes stale, rather
 * than Postgres' exact formatting of the expression.
 */
export type SchemaDrift = { missingTables: string[]; missingColumns: string[]; missingChecks: string[]; staleChecks: string[] };

const literals = (def: string) => [...new Set([...def.matchAll(/'((?:[^']|'')*)'/g)].map(m => m[1]))].sort();

export async function findCareerSchemaDrift(tx: CareerExecutor, expected = CAREER_SCHEMA_EXPECTED): Promise<SchemaDrift> {
  const cols = (await tx.execute(sql`SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name LIKE 'career\\_%'`)).rows;
  const have = new Map<string, Set<string>>();
  for (const r of cols) { const t = String(r.table_name); if (!have.has(t)) have.set(t, new Set()); have.get(t)!.add(String(r.column_name)); }
  const checks = new Map((await tx.execute(sql`SELECT c.relname || '.' || con.conname AS k, pg_get_constraintdef(con.oid) AS d
    FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema() AND con.contype = 'c' AND c.relname LIKE 'career\\_%'`)).rows.map(r => [String(r.k), String(r.d)]));
  const drift: SchemaDrift = { missingTables: [], missingColumns: [], missingChecks: [], staleChecks: [] };
  for (const [table, columns] of Object.entries(expected.columns)) {
    const got = have.get(table);
    if (!got) { drift.missingTables.push(table); continue; }
    for (const c of Object.keys(columns)) if (!got.has(c)) drift.missingColumns.push(`${table}.${c}`);
  }
  for (const [key, values] of Object.entries(expected.checks)) {
    const table = key.slice(0, key.indexOf("."));
    if (!have.has(table)) continue;
    const def = checks.get(key);
    if (def === undefined) { drift.missingChecks.push(key); continue; }
    const got = literals(def);
    // A check that has lost values it should allow is stale; one that allows more (a newer value) is fine.
    if (values.some(v => !got.includes(v))) drift.staleChecks.push(`${key} (missing ${values.filter(v => !got.includes(v)).join(", ")})`);
  }
  return drift;
}

export const driftCount = (d: SchemaDrift) => d.missingTables.length + d.missingColumns.length + d.missingChecks.length + d.staleChecks.length;

/**
 * Add columns that are still missing after the migrations ran again (a column added to a CREATE TABLE after production
 * had created that table never arrives otherwise). With its default where it has one; otherwise nullable, so it can
 * never fail on rows that already exist. Returns what it added.
 */
export async function addMissingCareerColumns(tx: CareerExecutor, missing: string[], expected = CAREER_SCHEMA_EXPECTED): Promise<string[]> {
  const added: string[] = [];
  for (const key of missing) {
    const [table, column] = key.split(".");
    const def = expected.columns[table]?.[column];
    if (!def || !/^[a-z0-9_]+$/.test(table) || !/^[a-z0-9_]+$/.test(column) || !/^[a-z0-9 ()_,\[\]]+$/i.test(def[0])) continue;
    const [type, dflt, notNull] = def;
    const usableDefault = dflt !== null && !/nextval\(/i.test(dflt);
    await tx.execute(sql.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}${usableDefault ? ` DEFAULT ${dflt}` : ""}${usableDefault && notNull ? " NOT NULL" : ""}`));
    added.push(key);
  }
  return added;
}
