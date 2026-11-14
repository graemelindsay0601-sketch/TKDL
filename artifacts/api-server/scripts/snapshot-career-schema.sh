#!/bin/sh
# Regenerate src/db/schema-expectations/career-schema.ts from a database that every Career migration and repair has run
# on (e.g. a local database after the API has booted on the current code). Usage: DATABASE_URL=... scripts/snapshot-career-schema.sh
set -e
cd "$(dirname "$0")/.."
cols=$(psql "$DATABASE_URL" -tA -c "SELECT json_object_agg(t, cols) FROM (SELECT c.relname t, json_object_agg(a.attname, json_build_array(format_type(a.atttypid, a.atttypmod), pg_get_expr(d.adbin, d.adrelid), a.attnotnull) ORDER BY a.attname) cols FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum WHERE n.nspname = current_schema() AND c.relkind = 'r' AND c.relname LIKE 'career\_%' AND a.attnum > 0 AND NOT a.attisdropped GROUP BY c.relname) x")
checks=$(psql "$DATABASE_URL" -tA -c "SELECT json_object_agg(c.relname || '.' || con.conname, pg_get_constraintdef(con.oid)) FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = current_schema() AND con.contype = 'c' AND c.relname LIKE 'career\_%'")
COLS="$cols" CHECKS="$checks" node -e '
const fs = require("fs"); const cols = JSON.parse(process.env.COLS), raw = JSON.parse(process.env.CHECKS);
const sortObj = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
const columns = sortObj(Object.fromEntries(Object.entries(cols).map(([t, c]) => [t, sortObj(c)])));
const checks = sortObj(Object.fromEntries(Object.entries(raw).map(([k, d]) => [k, [...new Set([...d.matchAll(/\x27((?:[^\x27]|\x27\x27)*)\x27/g)].map(m => m[1]))].sort()])));
const head = "// Generated from a database built by every Career migration and repair: scripts/snapshot-career-schema.sh.\n// columns: table -> column -> [type, default expression or null, not null]; checks: constraint -> its quoted values.\n// The boot-time drift check (../career-schema-drift.ts) compares production against it. Regenerate after schema changes.\nexport type ExpectedColumn = [type: string, defaultExpr: string | null, notNull: boolean];\nexport const CAREER_SCHEMA_EXPECTED: { columns: Record<string, Record<string, ExpectedColumn>>; checks: Record<string, string[]> } = ";
fs.writeFileSync("src/db/schema-expectations/career-schema.ts", head + JSON.stringify({ columns, checks }) + ";\n");
console.log(Object.keys(columns).length + " tables, " + Object.keys(checks).length + " checks");'
