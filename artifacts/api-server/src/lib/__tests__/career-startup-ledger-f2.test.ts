/**
 * F2 pre-integration certification — P0-2: replay the EXACT Career migration
 * sequence of app.ts initSchemaAndData() (read from source, in order) on a real
 * PostgreSQL (PGlite) and check the finance ledger category constraint that the
 * final schema enforces.
 *
 * The A9 upgrade (upgradeCareerContentA9V1) re-runs the A4 createCareerFinance
 * migration, which drops and re-adds career_finance_entries_category_check with
 * the A4 category list, after SP-C/SP-E2 widened it. Steps are run-once
 * (runMigrationStep), so the narrowed constraint persists: SPONSOR_GUARANTEED_PAYMENT
 * and SPONSOR_RELEASE_SETTLEMENT inserts then fail, and the weekly calendar advance
 * (finance onCalendarMoved → postDueGuaranteedPayments) throws.
 * Fixed in G1: a keyed step after A9 re-applies the SP-E2 constraint.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

const SRC = path.resolve(import.meta.dirname, "../..");
const app = readFileSync(path.join(SRC, "app.ts"), "utf8");

/** Career migration functions in app.ts order: [stepName, functionName, module]. */
function careerStartupSequence() {
  const modules = new Map<string, string>();
  for (const m of app.matchAll(/import\s*\{([^}]+)\}\s*from\s*"\.\/db\/migrations\/([^"]+?)(?:\.ts)?"/g))
    for (const n of m[1].split(",").map(s => s.trim()).filter(Boolean)) modules.set(n, m[2]);
  const body = app.slice(app.indexOf("async function initSchemaAndData"));
  const steps: [string, string, string][] = [];
  for (const m of body.matchAll(/runMigrationStep\(\s*([A-Za-z0-9_"]+)\s*,\s*\(\)\s*=>\s*([A-Za-z0-9]+)\(db\)\s*\)/g)) {
    const fn = m[2], mod = modules.get(fn);
    if (mod && /career|sponsor/i.test(mod)) steps.push([m[1], fn, mod]);
  }
  return steps;
}
async function finalSchema() {
  const pg = new PGlite(); const db = drizzle(pg);
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT)`);
  for (const [, fn, mod] of careerStartupSequence()) await (await import(path.join(SRC, "db/migrations", `${mod}.ts`)))[fn](db);
  const def = (await pg.query<{ def: string }>(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='career_finance_entries_category_check'`)).rows[0].def;
  await pg.close();
  return def;
}
const spe2 = readFileSync(path.join(SRC, "db/migrations/create_career_sponsor_contract_actions_spe2.ts"), "utf8");
const widest = [...new Set([...spe2.slice(spe2.indexOf("category IN")).split(")")[0].matchAll(/'([A-Z_]+)'/g)].map(m => m[1]))];

test("the startup sequence is read from app.ts in order and ends with the A9 upgrade", () => {
  const seq = careerStartupSequence().map(s => s[1]);
  assert.ok(seq.length >= 15, seq.join(","));
  assert.ok(seq.indexOf("createCareerFinanceSPC") > seq.indexOf("createCareerFinance"));
  assert.ok(seq.indexOf("upgradeCareerContentA9V1") > seq.indexOf("createCareerSponsorContractActionsSPE2"), "A9 runs after SP-E2");
  assert.ok(widest.includes("SPONSOR_GUARANTEED_PAYMENT") && widest.includes("SPONSOR_RELEASE_SETTLEMENT"));
});

test("after production startup the ledger accepts every sponsor category the runtime posts", async () => {
  const def = await finalSchema();
  assert.deepEqual(widest.filter(c => !def.includes(`'${c}'`)), []);
});
