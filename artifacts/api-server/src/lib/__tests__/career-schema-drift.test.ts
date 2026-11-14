/** Boot-time Career schema drift check: finds what production is short of, and adds missing columns safely. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { addMissingCareerColumns, driftCount, findCareerSchemaDrift } from "../../db/career-schema-drift.ts";
import { CAREER_SCHEMA_EXPECTED } from "../../db/schema-expectations/career-schema.ts";

test("drift: missing tables, columns, checks and stale check values are found; missing columns are added", async () => {
  const pg = new PGlite(), db = drizzle(pg);
  await pg.exec(`CREATE TABLE career_demo (id int PRIMARY KEY, status text NOT NULL CONSTRAINT career_demo_status_check CHECK (status IN ('ON','OFF')));
    INSERT INTO career_demo VALUES (1, 'ON');`);
  const expected = { columns: { career_demo: { id: ["integer", null, true], status: ["text", null, true], kind: ["text", "'PLAIN'::text", true], note: ["text", null, true] },
      career_gone: { id: ["integer", null, true] } } as Record<string, Record<string, [string, string | null, boolean]>>,
    checks: { "career_demo.career_demo_status_check": ["OFF", "ON", "PAUSED"], "career_demo.career_demo_kind_check": ["PLAIN"] } };
  let drift = await db.transaction(tx => findCareerSchemaDrift(tx, expected));
  assert.deepEqual(drift.missingTables, ["career_gone"]);
  assert.deepEqual(drift.missingColumns, ["career_demo.kind", "career_demo.note"]);
  assert.deepEqual(drift.missingChecks, ["career_demo.career_demo_kind_check"]);
  assert.equal(drift.staleChecks.length, 1); assert.match(drift.staleChecks[0], /PAUSED/);
  const added = await db.transaction(tx => addMissingCareerColumns(tx, drift.missingColumns, expected));
  assert.deepEqual(added, ["career_demo.kind", "career_demo.note"]);
  const row = (await db.execute(sql`SELECT kind, note FROM career_demo`)).rows[0];
  assert.equal(row.kind, "PLAIN", "a column with a default is filled for existing rows");
  assert.equal(row.note, null, "a NOT NULL column without a default arrives nullable, so existing rows never block it");
  drift = await db.transaction(tx => findCareerSchemaDrift(tx, expected));
  assert.deepEqual(drift.missingColumns, []);
  await pg.close();
});

test("the expected Career schema snapshot is well formed", () => {
  const tables = Object.keys(CAREER_SCHEMA_EXPECTED.columns);
  assert.ok(tables.length > 50 && tables.every(t => t.startsWith("career_")));
  assert.ok(CAREER_SCHEMA_EXPECTED.columns.career_ranking_contributions.unit, "includes the column production was missing");
  assert.ok(CAREER_SCHEMA_EXPECTED.checks["career_event_definitions.career_event_definitions_classification_check"].includes("TEAM"));
  assert.equal(driftCount({ missingTables: [], missingColumns: ["a"], missingChecks: [], staleChecks: ["b"] }), 2);
});
