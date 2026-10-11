/**
 * DEV-ONLY verification of the two G1 startup repairs, replaying the Career migration
 * steps of src/app.ts (scripts/career-startup-steps.ts) with run-once semantics:
 *
 *   P0-1  createCareerSPHCommercial + createCareerNpcSponsorMarketSPF restored, so Career
 *         creation works on a fresh database and on one deployed without them.
 *   P0-2  reapplyCareerLedgerConstraintSPE2AfterA9, so sponsor guaranteed payments post on a
 *         database whose ledger constraint the A9 upgrade had narrowed.
 *
 * Scenarios: FRESH, UPGRADED_WITHOUT_SPF_SPH (deployed after 5c51822), UPGRADED_NARROWED_LEDGER
 * (A9 ran after SP-E2 with saves and a guarantee contract already present) and IDEMPOTENCE
 * (every step re-run twice: schema fingerprint and data unchanged).
 *
 *   node scripts/career-startup-repair-check.ts                 # PGlite
 *   node scripts/career-startup-repair-check.ts --pg=postgres://postgres@127.0.0.1:55432/postgres
 * With --pg a new database is created per scenario (tkdl_cert_<scenario>_<pid>) and dropped afterwards.
 */
import path from "node:path";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { careerStartupSteps, runCareerStartupSteps, type CareerStartupStep } from "./career-startup-steps.ts";
import { createCareerService } from "../src/career/service.ts";
import { createCareerSportingService } from "../src/career/sporting/service.ts";
import { postDueGuaranteedPayments, activeContracts } from "../src/career/finance/engine.ts";
import { scheduleContractGuarantees } from "../src/career/finance/sponsor-guarantees.ts";
import { sponsorCatalogue, CURRENT_SPONSOR_DATABASE_VERSION } from "../src/career/finance/sponsors.catalogue.ts";
import { lockRoot } from "../src/career/world/service.ts";
import { post } from "../src/career/finance/ledger.ts";
import { stableUuid } from "../src/career/world/random.ts";
import type { RootRow } from "../src/career/calendar/engine.ts";

type Db = ReturnType<typeof drizzlePglite>;
export type Check = { scenario: string; check: string; ok: boolean; detail?: string };
const REPAIR_KEYS = ["createCareerSPHCommercial", "createCareerNpcSponsorMarketSPF", "reapplyCareerLedgerConstraintSPE2AfterA9"];
const actor = { playerId: 1 };

export type DbFactory = (name: string) => Promise<{ db: Db; exec: (q: string) => Promise<void>; close: () => Promise<void> }>;
export const pgliteFactory: DbFactory = async () => {
  const pg = new PGlite();
  return { db: drizzlePglite(pg), exec: async q => { await pg.exec(q); }, close: () => pg.close() };
};
export function postgresFactory(url: string): DbFactory {
  const pg = createRequire(path.resolve(import.meta.dirname, "../../../lib/db/package.json"))("pg") as typeof import("pg");
  return async name => {
    const admin = new pg.Client({ connectionString: url }); await admin.connect();
    const dbName = `tkdl_cert_${name.toLowerCase()}_${process.pid}`;
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`); await admin.query(`CREATE DATABASE ${dbName}`);
    const u = new URL(url); u.pathname = `/${dbName}`;
    const pool = new pg.Pool({ connectionString: u.toString(), max: 4 });
    return { db: drizzlePg(pool) as unknown as Db, exec: async q => { await pool.query(q); },
      close: async () => { await pool.end(); await admin.query(`DROP DATABASE IF EXISTS ${dbName}`); await admin.end(); } };
  };
}

async function base(exec: (q: string) => Promise<void>) {
  await exec(`CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1) ON CONFLICT DO NOTHING;
    CREATE TABLE IF NOT EXISTS feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'startup repair check') ON CONFLICT DO NOTHING`);
}
const rows = async (db: Db, q: ReturnType<typeof sql>) => (await db.execute(q)).rows as Record<string, unknown>[];
async function createCareer(db: Db, slot: number) {
  const saves = createCareerService(db), sporting = createCareerSportingService(db);
  const s = await saves.create(1, { slot, careerName: `Startup check ${slot}`, dateOfBirth: "1995-01-01", homeLocality: "ayrshire" });
  await sporting.initialize(actor, s.id);
  return s.id as string;
}
/** An active agreement whose signed terms carry guaranteed payments (current catalogue). */
async function guaranteeContract(db: Db, saveId: string) {
  const def = sponsorCatalogue(CURRENT_SPONSOR_DATABASE_VERSION).find(d => (d.terms.contractFoundation?.guaranteedPayments ?? []).length > 0)!;
  const terms = def.terms, offerId = stableUuid("c".repeat(64), 1, "startup-offer", saveId), contractId = stableUuid("c".repeat(64), 1, "startup-contract", saveId);
  await db.execute(sql`INSERT INTO career_sponsor_offers (career_save_id,id,operation_key,sponsor_key,sponsor_database_version,tier,kind,terms,source,
    offered_season,offered_week,expires_season,expires_week,status,resolved_at)
    VALUES (${saveId},${offerId},${`startup:${saveId}`},${def.key},${CURRENT_SPONSOR_DATABASE_VERSION},${terms.tier},'NEW',${JSON.stringify(terms)}::jsonb,'{}'::jsonb,1,1,1,52,'ACCEPTED',NOW())`);
  await db.execute(sql`INSERT INTO career_sponsor_contracts (career_save_id,id,offer_id,sponsor_key,sponsor_database_version,tier,terms,start_season,start_week,end_season,end_week,status)
    VALUES (${saveId},${contractId},${offerId},${def.key},${CURRENT_SPONSOR_DATABASE_VERSION},${terms.tier},${JSON.stringify(terms)}::jsonb,1,1,1,52,'ACTIVE')`);
  return def.key;
}
/** Post the first scheduled guarantee instalment through the A4 ledger, exactly as the weekly advance does. */
async function postFirstGuarantee(db: Db, saveId: string) {
  return db.transaction(async tx => {
    const root = await lockRoot(tx, actor, saveId) as RootRow;
    const contracts = await activeContracts(tx, saveId);
    const first = scheduleContractGuarantees(contracts[0]!).payments[0]!;
    const posted = await postDueGuaranteedPayments(tx, root, contracts, first.season, first.week);
    const again = await postDueGuaranteedPayments(tx, root, contracts, first.season, first.week);
    return { posted, again, first };
  });
}
async function ledgerCount(db: Db, saveId: string) {
  return Number((await rows(db, sql`SELECT COUNT(*)::int n FROM career_finance_entries WHERE career_save_id=${saveId} AND category='SPONSOR_GUARANTEED_PAYMENT'`))[0]!.n);
}
async function fingerprint(db: Db) {
  const cols = await rows(db, sql`SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name LIKE 'career_%' ORDER BY 1,2`);
  const cons = await rows(db, sql`SELECT conrelid::regclass::text t,conname,pg_get_constraintdef(oid) d FROM pg_constraint
    WHERE connamespace='public'::regnamespace AND conrelid::regclass::text LIKE 'career_%' ORDER BY 1,2`);
  const idx = await rows(db, sql`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename LIKE 'career_%' ORDER BY 1,2`);
  return JSON.stringify({ cols, cons, idx });
}
/** A4's ledger constraint statement, read from the migration source (what A9 used to re-apply). */
function legacyA4Constraint() {
  const src = readFileSync(path.resolve(import.meta.dirname, "../src/db/migrations/create_career_finance.ts"), "utf8");
  const m = src.match(/ALTER TABLE career_finance_entries ADD CONSTRAINT career_finance_entries_category_check CHECK \(([\s\S]*?)\)`\);/);
  if (!m || m[0].includes("SPONSOR_GUARANTEED_PAYMENT")) throw new Error("A4 ledger constraint statement not found");
  return m[0].slice(0, -3);
}
/** LABELLED FIXTURE rows using the latest ledger category and journey event type (SP-E2 / SP-E1B vocabularies). */
async function widestVocabularyRows(db: Db, saveId: string) {
  const [contract] = await rows(db, sql`SELECT id,offer_id,sponsor_key,sponsor_database_version FROM career_sponsor_contracts WHERE career_save_id=${saveId} LIMIT 1`);
  await db.transaction(async tx => post(tx, await lockRoot(tx, actor, saveId) as RootRow, { operationKey: `startup-check:release:${saveId}`,
    category: "SPONSOR_RELEASE_SETTLEMENT", amountPence: -100, reason: "STARTUP CHECK FIXTURE release settlement", season: 1, week: 1, contractId: String(contract!.id) }));
  const journeyId = stableUuid("c".repeat(64), 1, "startup-journey", saveId);
  await db.execute(sql`INSERT INTO career_sponsor_journeys (career_save_id,id,operation_key,sponsor_key,sponsor_database_version,opening_offer_id,current_offer_id,signed_contract_id,status,brand_personality,source)
    VALUES (${saveId},${journeyId},${`startup-check:${saveId}`},${contract!.sponsor_key},${contract!.sponsor_database_version},${contract!.offer_id},${contract!.offer_id},${contract!.id},'SIGNED','startup check','{}'::jsonb)`);
  await db.execute(sql`INSERT INTO career_sponsor_journey_events (career_save_id,id,journey_id,ordinal,event_key,event_type,offer_id)
    VALUES (${saveId},${stableUuid("c".repeat(64), 1, "startup-journey-event", saveId)},${journeyId},1,${`startup-check:activated:${saveId}`},'CONTRACT_ACTIVATED',${contract!.offer_id})`);
}
const tableExists = async (db: Db, t: string) => (await rows(db, sql`SELECT to_regclass(${`public.${t}`}) AS r`))[0]!.r !== null;

export async function checkStartupRepairs(factory: DbFactory, log: (c: Check) => void = () => {}) {
  const steps = careerStartupSteps(), out: Check[] = [];
  const check = (scenario: string, what: string, ok: boolean, detail?: unknown) => {
    const c: Check = { scenario, check: what, ok, ...(detail === undefined ? {} : { detail: typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300) }) };
    out.push(c); log(c); return ok;
  };
  const attempt = async <T>(f: () => Promise<T>) => { try { return { ok: true as const, value: await f() }; } catch (e) { return { ok: false as const, error: e as Error }; } };
  const errText = (e: Error) => { let m = e.message; for (let c = (e as { cause?: Error }).cause, d = 0; c && d < 4; c = (c as { cause?: Error }).cause, d++) m += ` <- ${c.message}`; return m.slice(0, 240); };
  check("SEQUENCE", "every sponsor/Career migration called by app.ts is replayed (SP-E1/SP-E1B included)",
    ["addContractConcludedSponsorEventSPE1", "addScheduledSponsorRenewalsSPE1B", "createCareerSponsorContractActionsSPE2", "createCareerLegacyA76"].every(k => steps.some(s => s.key === k)), steps.map(s => s.key));
  check("SEQUENCE", "app.ts includes all three repair steps, A9 before the ledger re-apply", REPAIR_KEYS.every(k => steps.some(s => s.key === k))
    && steps.findIndex(s => s.fn === "upgradeCareerContentA9V1") < steps.findIndex(s => s.key === "reapplyCareerLedgerConstraintSPE2AfterA9"), steps.map(s => s.key));

  { // FRESH
    const S = "FRESH", h = await factory(S);
    try {
      await base(h.exec); await runCareerStartupSteps(h.db, steps);
      const c = await attempt(() => createCareer(h.db, 1));
      if (check(S, "a new Career can be created", c.ok, c.ok ? undefined : errText(c.error))) {
        await guaranteeContract(h.db, c.value);
        const g = await attempt(() => postFirstGuarantee(h.db, c.value));
        check(S, "a sponsor guaranteed payment posts once (retry-safe)", g.ok && g.value.posted >= 1 && g.value.again === 0 && await ledgerCount(h.db, c.value) === g.value.posted, g.ok ? g.value : errText(g.error));
      }
    } finally { await h.close(); }
  }
  { // UPGRADED_WITHOUT_SPF_SPH: a database first deployed with the post-5c51822 startup (no SPF/SPH, no re-apply).
    const S = "UPGRADED_WITHOUT_SPF_SPH", h = await factory(S);
    try {
      await base(h.exec);
      const done = await runCareerStartupSteps(h.db, steps.filter(s => !REPAIR_KEYS.includes(s.key)));
      check(S, "before repair: the NPC sponsor market table is missing (P0-1 reproduced)", !(await tableExists(h.db, "career_npc_sponsor_market_events")));
      const broken = await attempt(() => createCareer(h.db, 1));
      check(S, "before repair: Career creation fails (P0-1 reproduced)", !broken.ok, broken.ok ? "unexpectedly succeeded" : errText(broken.error));
      await h.exec("DELETE FROM career_saves");
      const ran: string[] = []; const pending = steps.filter(s => !done.has(s.key)); ran.push(...pending.map(s => s.key));
      await runCareerStartupSteps(h.db, steps, done);
      check(S, "the current startup runs exactly the three repair steps on this database", JSON.stringify(ran.sort()) === JSON.stringify([...REPAIR_KEYS].sort()), ran);
      const c = await attempt(() => createCareer(h.db, 1));
      if (check(S, "after repair: a new Career can be created", c.ok, c.ok ? undefined : errText(c.error))) {
        await guaranteeContract(h.db, c.value);
        const g = await attempt(() => postFirstGuarantee(h.db, c.value));
        check(S, "after repair: a sponsor guaranteed payment posts", g.ok && g.value.posted >= 1, g.ok ? g.value : errText(g.error));
      }
    } finally { await h.close(); }
  }
  { // UPGRADED_NARROWED_LEDGER: SPF/SPH present (pre-5c51822), A9 ran after SP-E2 with live saves; no re-apply yet.
    const S = "UPGRADED_NARROWED_LEDGER", h = await factory(S);
    try {
      await base(h.exec);
      const a9 = steps.findIndex(s => s.fn === "upgradeCareerContentA9V1");
      const done = await runCareerStartupSteps(h.db, steps.slice(0, a9));
      const saveId = await createCareer(h.db, 1); await guaranteeContract(h.db, saveId);
      const before = await rows(h.db, sql`SELECT id,current_season,current_week,balance_pence,world_seed FROM career_saves ORDER BY id`);
      await runCareerStartupSteps(h.db, [steps[a9]!], done);
      // Databases upgraded before the guard: A9's replay of A4 re-added A4's narrower ledger constraint. Re-create that
      // state with A4's own constraint statement (LABELLED: simulates a database upgraded by the earlier startup code).
      await h.exec(`ALTER TABLE career_finance_entries DROP CONSTRAINT IF EXISTS career_finance_entries_category_check; ${legacyA4Constraint()}`);
      const narrowed = await attempt(() => postFirstGuarantee(h.db, saveId));
      check(S, "before repair: the guaranteed payment is rejected by the narrowed ledger constraint (P0-2 reproduced)", !narrowed.ok, narrowed.ok ? narrowed.value : errText(narrowed.error));
      await runCareerStartupSteps(h.db, steps, done);
      const def = String((await rows(h.db, sql`SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conname='career_finance_entries_category_check'`))[0]!.d);
      check(S, "after repair: the ledger constraint accepts SPONSOR_GUARANTEED_PAYMENT and SPONSOR_RELEASE_SETTLEMENT",
        def.includes("SPONSOR_GUARANTEED_PAYMENT") && def.includes("SPONSOR_RELEASE_SETTLEMENT"), def.slice(0, 200));
      const g = await attempt(() => postFirstGuarantee(h.db, saveId));
      check(S, "after repair: the existing save's guaranteed payment posts once", g.ok && g.value.posted >= 1 && g.value.again === 0, g.ok ? g.value : errText(g.error));
      const after = await rows(h.db, sql`SELECT id,current_season,current_week,world_seed FROM career_saves ORDER BY id`);
      check(S, "existing saves are preserved (identity, clock, seed)", JSON.stringify(after) === JSON.stringify(before.map(({ balance_pence: _b, ...r }) => r)));
      const c = await attempt(() => createCareer(h.db, 2));
      check(S, "a further Career can be created after the repair", c.ok, c.ok ? undefined : errText(c.error));
    } finally { await h.close(); }
  }
  { // IDEMPOTENCE: every step re-run (ignoring the run-once ledger) twice over a populated database.
    const S = "IDEMPOTENCE", h = await factory(S);
    try {
      await base(h.exec); await runCareerStartupSteps(h.db, steps);
      const saveId = await createCareer(h.db, 1); await guaranteeContract(h.db, saveId); await postFirstGuarantee(h.db, saveId);
      // Rows only the newest vocabularies admit: a replayed older migration must not narrow its constraint below them.
      await widestVocabularyRows(h.db, saveId);
      const schema = await fingerprint(h.db);
      const data = JSON.stringify(await rows(h.db, sql`SELECT (SELECT COUNT(*) FROM career_finance_entries)::int fe,(SELECT COUNT(*) FROM career_world_players)::int wp,
        (SELECT COUNT(*) FROM career_event_instances)::int ev,(SELECT COUNT(*) FROM career_sponsor_contracts)::int sc,(SELECT SUM(balance_pence) FROM career_saves)::bigint bal`));
      for (let i = 0; i < 2; i++) {
        const r = await attempt(() => runCareerStartupSteps(h.db, steps, new Set()));
        check(S, `full re-run ${i + 1} of every Career step succeeds`, r.ok, r.ok ? undefined : errText(r.error));
      }
      check(S, "schema fingerprint (columns, constraints, indexes) is unchanged", await fingerprint(h.db) === schema);
      check(S, "Career data is unchanged", JSON.stringify(await rows(h.db, sql`SELECT (SELECT COUNT(*) FROM career_finance_entries)::int fe,(SELECT COUNT(*) FROM career_world_players)::int wp,
        (SELECT COUNT(*) FROM career_event_instances)::int ev,(SELECT COUNT(*) FROM career_sponsor_contracts)::int sc,(SELECT SUM(balance_pence) FROM career_saves)::bigint bal`)) === data);
    } finally { await h.close(); }
  }
  return out;
}

if (import.meta.main) {
  const url = process.argv.find(a => a.startsWith("--pg="))?.slice(5);
  const results = await checkStartupRepairs(url ? postgresFactory(url) : pgliteFactory,
    c => console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.scenario.padEnd(26)} ${c.check}${c.detail && !c.ok ? ` — ${c.detail}` : ""}`));
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${url ? "PostgreSQL" : "PGlite"}: ${results.length - failed}/${results.length} checks pass`);
  process.exit(failed ? 1 : 0);
}
export type { CareerStartupStep };
