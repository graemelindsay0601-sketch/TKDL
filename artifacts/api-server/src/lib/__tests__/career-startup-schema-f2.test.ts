/**
 * F2 pre-integration certification: every table the Career runtime uses must be
 * created by a migration that production startup (app.ts initSchemaAndData)
 * actually reaches. Static: follows app.ts calls into db/migrations and their
 * transitive migration imports.
 *
 * KNOWN P0 (F2 register P0-1): commit 5c51822 removed the startup calls to
 * createCareerSPHCommercial and createCareerNpcSponsorMarketSPF. On a fresh
 * database, creating a Career then fails in world initialisation
 * (persistInitialNpcSponsorRelationships → relation "career_npc_sponsor_market_events"
 * does not exist). The strict assertion is marked `todo` until the integration
 * owner restores the two runMigrationStep calls; remove `todo` then.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync, readdirSync } from "node:fs";

const SRC = path.resolve(import.meta.dirname, "../..");
const MIG = path.join(SRC, "db/migrations");
const read = (f: string) => readFileSync(f, "utf8");
const created = (s: string) => new Set([...s.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+([a-z_][a-z0-9_]*)/gi)].map(m => m[1].toLowerCase()));

/** Migration files reachable from app.ts startup calls, following migration-to-migration imports. */
function reachableMigrationTables() {
  const app = read(path.join(SRC, "app.ts"));
  const fnToFile = new Map<string, string>();
  for (const m of app.matchAll(/import\s*\{([^}]+)\}\s*from\s*"\.\/db\/migrations\/([^"]+?)(?:\.ts)?"/g))
    for (const name of m[1].split(",").map(s => s.trim().split(/\s+as\s+/).pop()!)) fnToFile.set(name, path.join(MIG, `${m[2]}.ts`));
  const called = [...fnToFile.keys()].filter(fn => new RegExp(`\\b${fn}\\s*\\(`).test(app.replace(/^import.*$/gm, "")));
  const seen = new Set<string>(), queue = called.map(fn => fnToFile.get(fn)!);
  while (queue.length) {
    const f = queue.pop()!; if (seen.has(f)) continue; seen.add(f);
    for (const m of read(f).matchAll(/from\s*"\.\/([^"]+?)(?:\.ts)?"/g)) queue.push(path.join(MIG, `${m[1]}.ts`));
  }
  const tables = new Set<string>(); for (const f of seen) for (const t of created(read(f))) tables.add(t);
  return { tables, files: seen };
}

/** Career tables written or read by runtime (non-test, non-migration) Career code. */
function runtimeCareerTables() {
  const out = new Map<string, string>();
  const walk = (dir: string) => { for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "__tests__") walk(p); continue; }
    if (!/\.ts$/.test(e.name) || /harness/.test(e.name)) continue;
    for (const m of read(p).matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+(career_[a-z0-9_]+)/g)) if (!out.has(m[1])) out.set(m[1], path.relative(SRC, p));
  } };
  walk(path.join(SRC, "career"));
  return out;
}

test("static scan finds the migration graph and the Career runtime tables", () => {
  const { tables, files } = reachableMigrationTables();
  assert.ok(files.size >= 15, `reachable migration files: ${files.size}`);
  assert.ok(tables.has("career_saves") && tables.has("career_event_instances"));
  assert.ok(runtimeCareerTables().size > 40);
});

test("every Career runtime table is created by a migration production startup runs", { todo: "P0-1: restore createCareerSPHCommercial + createCareerNpcSponsorMarketSPF in app.ts" }, () => {
  const { tables } = reachableMigrationTables();
  const missing = [...runtimeCareerTables()].filter(([t]) => !tables.has(t)).map(([t, f]) => `${t} (used by ${f})`);
  assert.deepEqual(missing, []);
});

test("the P0-1 gap is exactly the two dropped migrations (guards against further drift)", () => {
  const { tables } = reachableMigrationTables();
  const missing = [...runtimeCareerTables().keys()].filter(t => !tables.has(t)).sort();
  const dropped = new Set([...created(read(path.join(MIG, "create_career_npc_sponsor_market_spf.ts"))), ...created(read(path.join(MIG, "create_career_sph_commercial.ts")))]);
  assert.deepEqual(missing.filter(t => !dropped.has(t)), [], "no Career table is missing beyond the two known dropped migrations");
});
