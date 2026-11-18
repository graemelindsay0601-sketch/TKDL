import { ensureRankingContributionUnits } from "./add_career_ranking_contribution_units.ts";
import type { CareerDatabase, CareerExecutor } from "../../career/database.ts";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { ensureSoftTipCircuit, ensureTeamEventClassification, ensureLeagueRounds, ensureEventPairs, ensureQuickSimSource, ensureCareerForeignKeyIndexes, ensureEntryTier, syncEventDefinitions, insertMissingEventDefinitions } from "./create_career_calendar.ts";
import { ensureCareerMatchSessionSchema, ensureCareerProfileSchema } from "./create_career_live.ts";
import { ensureCareerGroupSchema } from "./create_career_groups.ts";
import { ensureDevelopmentCardSource, ensureRankingArchive, ensureTourCardOffers } from "./create_career_sporting.ts";
import { createCareerContent } from "./create_career_content.ts";
import { ensureMoneyMatches } from "./create_career_money.ts";
import { ensureClubTeams } from "./create_career_club_teams.ts";
import { ensureCareerCountyTeams } from "./create_career_county_teams.ts";
import { ensureHostingLedger } from "./create_career_hosting.ts";
import { ensureStreaming } from "./create_career_streaming.ts";
import { ensureInbox } from "./create_career_inbox.ts";
import { ensureLocalNights } from "./create_career_local_nights.ts";
import { ensureRoadTrips } from "./create_career_road_trips.ts";
import { ensureCamLeagues } from "./create_career_cam_leagues.ts";
import { ensureProAm } from "./create_career_proam.ts";
import { ensureSponsorContractGuard } from "./add_scheduled_sponsor_renewals_spe1b.ts";

async function ensureQualificationEntitlementSourceConstraint(tx: CareerExecutor): Promise<void> {
  const row = (await tx.execute(sql`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid='career_qualification_entitlements'::regclass AND conname='career_qualification_entitlements_source_check'`)).rows[0];
  if (String(row?.definition ?? "").includes("source_kind <> 'EVENT_RESULT'")) return;
  await tx.execute(sql`ALTER TABLE career_qualification_entitlements DROP CONSTRAINT IF EXISTS career_qualification_entitlements_source_check`);
  await tx.execute(sql`ALTER TABLE career_qualification_entitlements ADD CONSTRAINT career_qualification_entitlements_source_check
    CHECK (source_kind <> 'EVENT_RESULT' OR source_event_id IS NOT NULL)`);
}
import { ensureManagers } from "./create_career_manager.ts";
import { ensureLocalCompetitions } from "./create_career_local_competitions.ts";
import { ensureCareerMaintenance, ensureFastMatchCompression, ensureSimulatedMatchCopiesOptional } from "./create_career_world.ts";
import { ensureLegacySeasonTotals, ensureWorldRecords, ensureClubSeasons, ensureCalendarAddons, ensureSavingsGoals } from "./create_career_legacy.ts";

/**
 * Career schema repairs that later event databases (v7 soft-tip, v11 league nights, v12 Development Tour,
 * v13 pairs) depend on. They were first added inside createCareerCalendarA3 / createCareerSportingA5, but
 * those are ledgered startup migrations: a database that recorded them as complete before the repairs
 * existed skips them on every boot, so production never received them (Career initialize then failed on
 * career_event_instances_circuit_check for soft-tip events). Every repair here checks before it changes
 * anything, so this runs on EVERY startup — a new repair belongs here, never inside a ledgered migration.
 */
export async function repairCareerSchema(database: CareerDatabase): Promise<void> {
  await politely(database, async tx => {
    await ensureSoftTipCircuit(tx);
    await ensureQualificationEntitlementSourceConstraint(tx);
    await ensureLeagueRounds(tx);
    await ensureEventPairs(tx);
    await ensureQuickSimSource(tx);
    await ensureCareerForeignKeyIndexes(tx);
    await ensureEntryTier(tx);
    await ensureFastMatchCompression(tx);
    await ensureCareerMaintenance(tx);
    await ensureSimulatedMatchCopiesOptional(tx);
    await ensureCareerMatchSessionSchema(tx);
    // Added to the ledgered A1/A3 migrations after production had already recorded them, so they never ran there:
    // without TEAM, every v31+ edition's definitions (the World Cup is a TEAM event) were refused and new Careers failed.
    await ensureCareerProfileSchema(tx);
    // The ranking unit migration rolled back on databases that already held ranking rows (the table refuses UPDATEs), so
    // completed events there couldn't record their ranking contributions and the Career wouldn't advance.
    await ensureRankingContributionUnits(tx);
    await ensureTeamEventClassification(tx);
    await ensureCareerGroupSchema(tx);
    // Scheduled sponsor renewals must be able to start (the A9 upgrade reinstalled the older guard on fresh databases).
    await ensureSponsorContractGuard(tx);
    await ensureDevelopmentCardSource(tx);
    await ensureRankingArchive(tx);
    await ensureTourCardOffers(tx);
    await ensureLegacySeasonTotals(tx);
    await ensureWorldRecords(tx);
    await ensureClubSeasons(tx);
    await ensureCalendarAddons(tx);
    await ensureSavingsGoals(tx);
    await ensureMoneyMatches(tx);
    await ensureClubTeams(tx);
    await ensureCareerCountyTeams(tx);
    await ensureHostingLedger(tx);
    await ensureStreaming(tx);
    await ensureInbox(tx);
    await ensureLocalNights(tx);
    await ensureRoadTrips(tx);
    await ensureCamLeagues(tx);
    await ensureProAm(tx);
    await ensureManagers(tx);
    // Player-created local leagues and cups (career/club/local-competitions.ts): created lazily before, now at startup too.
    await ensureLocalCompetitions(tx);
    // SP-G (signature products, equipment) tables were added to createCareerContent after its ledgered
    // caller (createCareerFinanceA4 / the A9 upgrade) had already run in production. All IF NOT EXISTS.
    await createCareerContent(tx);
  });
}

/**
 * Every-boot schema work runs while players are mid-game (a deploy restarts the server under live traffic). Most repairs
 * are no-ops, but DDL takes its table lock before it checks (ALTER TABLE ... IF NOT EXISTS, CREATE INDEX IF NOT EXISTS),
 * and queued behind a player's transaction that is a deadlock in which Postgres may abort the player. So the repair waits
 * at most half a second for any lock (under the one-second deadlock check: it gives way before any player's game is
 * chosen as the victim), and tries again a few times, pausing longer each time. If the tables stay busy it gives up and
 * the server starts anyway: an up-to-date database loses nothing, and the next start tries again.
 */
const LOCK_WAIT = "500ms", ATTEMPTS = 6;
const dialect = new PgDialect();
type Tx = Parameters<Parameters<CareerDatabase["transaction"]>[0]>[0];
/**
 * The executor the repairs see: an "ADD COLUMN IF NOT EXISTS" for a column that exists, or a "CREATE INDEX IF NOT EXISTS" for an
 * index that exists, is a no-op by definition, so it is skipped after a catalog read (which takes no table lock) instead of
 * locking the table to find that out. Everything else runs as written.
 */
export function skippingNoOps(tx: Tx): { tx: Tx; flush: () => Promise<void> } {
  const execute = tx.execute.bind(tx);
  const textOf = (query: unknown) => { try { return dialect.sqlToQuery(query as Parameters<PgDialect["sqlToQuery"]>[0]).sql; } catch { return null; } };
  const has = async (q: ReturnType<typeof sql>) => (await execute(q)).rows.length > 0;
  // "DROP CONSTRAINT IF EXISTS c" is held back for one statement: when the next re-adds the same CHECK constraint
  // unchanged, both are skipped (the re-add would lock the table and re-check every row on every start).
  let pendingDrop: { kind: "CONSTRAINT" | "TRIGGER"; table: string; name: string; query: Parameters<Tx["execute"]>[0] } | null = null;
  const exists = (kind: "CONSTRAINT" | "TRIGGER", table: string, name: string) => kind === "CONSTRAINT"
    ? has(sql`SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid WHERE t.relname = ${table} AND t.relnamespace = current_schema()::regnamespace AND c.conname = ${name}`)
    : has(sql`SELECT 1 FROM pg_trigger g JOIN pg_class t ON t.oid = g.tgrelid WHERE t.relname = ${table} AND t.relnamespace = current_schema()::regnamespace AND g.tgname = ${name} AND NOT g.tgisinternal`);
  // A held-back drop runs only if there is something to drop.
  const flush = async () => { if (pendingDrop) { const d = pendingDrop; pendingDrop = null; if (await exists(d.kind, d.table, d.name)) await execute(d.query); } };
  let probes = 0;
  const sameCheck = async (table: string, name: string, definition: string) => {
    const existing = (await execute(sql`SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = ${table} AND t.relnamespace = current_schema()::regnamespace AND c.conname = ${name} AND c.contype = 'c'`)).rows[0];
    if (!existing) return false;
    // Postgres's own normal form for the new definition: add it to an empty temporary copy of the table (no lock on the real one).
    const probe = `career_repair_probe_${++probes}`;
    await execute(sql.raw(`CREATE TEMP TABLE ${probe} (LIKE "${table}") ON COMMIT DROP`));
    await execute(sql.raw(`ALTER TABLE ${probe} ADD CONSTRAINT "${name}" ${definition}`));
    const fresh = (await execute(sql`SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c WHERE c.conrelid = ${probe}::regclass AND c.conname = ${name}`)).rows[0];
    await execute(sql.raw(`DROP TABLE ${probe}`));
    return !!fresh && String(fresh.def) === String(existing.def);
  };
  const sameTrigger = async (table: string, name: string, createText: string) => {
    const existing = (await execute(sql`SELECT pg_get_triggerdef(g.oid) AS def FROM pg_trigger g JOIN pg_class t ON t.oid = g.tgrelid
      WHERE t.relname = ${table} AND t.relnamespace = current_schema()::regnamespace AND g.tgname = ${name} AND NOT g.tgisinternal`)).rows[0];
    if (!existing) return false;
    const probe = `career_repair_probe_${++probes}`;
    const onProbe = createText.replace(new RegExp(`\\bON\\s+"?${table}"?(?=\\s)`, "i"), `ON ${probe}`);
    if (onProbe === createText) return false;
    await execute(sql.raw(`CREATE TEMP TABLE ${probe} (LIKE "${table}") ON COMMIT DROP`));
    await execute(sql.raw(onProbe));
    const fresh = (await execute(sql`SELECT pg_get_triggerdef(g.oid) AS def FROM pg_trigger g WHERE g.tgrelid = ${probe}::regclass AND g.tgname = ${name}`)).rows[0];
    await execute(sql.raw(`DROP TABLE ${probe}`));
    const normal = (def: unknown) => String(def).replace(/\bON\s+\S+\s/, "ON _ ");
    return !!fresh && normal(fresh.def) === normal(existing.def);
  };
  const run = async (query: Parameters<Tx["execute"]>[0]) => {
    const text = textOf(query);
    const single = text !== null && !/,\s*(ADD|DROP|ALTER)\s/i.test(text);
    const drop = single ? /^\s*ALTER\s+TABLE\s+"?(\w+)"?\s+DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+"?(\w+)"?\s*;?\s*$/i.exec(text!) : null;
    const add = single ? /^\s*ALTER\s+TABLE\s+"?(\w+)"?\s+ADD\s+CONSTRAINT\s+"?(\w+)"?\s+(CHECK\s*\([\s\S]*\))\s*;?\s*$/i.exec(text!) : null;
    const createTrigger = text ? /^\s*CREATE\s+TRIGGER\s+"?(\w+)"?\s[\s\S]*?\bON\s+"?(\w+)"?\s/i.exec(text) : null;
    if (pendingDrop?.kind === "CONSTRAINT" && add && add[1] === pendingDrop.table && add[2] === pendingDrop.name && await sameCheck(add[1], add[2], add[3])) {
      pendingDrop = null; return { rows: [], rowCount: 0 };
    }
    if (pendingDrop?.kind === "TRIGGER" && createTrigger && createTrigger[1] === pendingDrop.name && createTrigger[2] === pendingDrop.table
      && await sameTrigger(createTrigger[2], createTrigger[1], text!)) { pendingDrop = null; return { rows: [], rowCount: 0 }; }
    await flush();
    if (drop) { pendingDrop = { kind: "CONSTRAINT", table: drop[1], name: drop[2], query }; return { rows: [], rowCount: 0 }; }
    const dropTrigger = text ? /^\s*DROP\s+TRIGGER\s+IF\s+EXISTS\s+"?(\w+)"?\s+ON\s+"?(\w+)"?\s*;?\s*$/i.exec(text) : null;
    if (dropTrigger) { pendingDrop = { kind: "TRIGGER", table: dropTrigger[2], name: dropTrigger[1], query }; return { rows: [], rowCount: 0 }; }
    const column = single ? /^\s*ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?"?(\w+)"?\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+"?(\w+)"?/i.exec(text!) : null;
    if (column && await has(sql`SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = ${column[1]} AND column_name = ${column[2]}`)) return { rows: [], rowCount: 0 };
    const index = text ? /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?IF\s+NOT\s+EXISTS\s+"?(\w+)"?/i.exec(text) : null;
    if (index && await has(sql`SELECT 1 FROM pg_class WHERE relname = ${index[1]} AND relkind IN ('i', 'I')
      AND relnamespace = current_schema()::regnamespace`)) return { rows: [], rowCount: 0 };
    return execute(query);
  };
  const wrapped = new Proxy(tx, { get(target, prop, receiver) {
    if (prop === "execute") return run;
    return Reflect.get(target, prop, receiver);
  } }) as Tx;
  return { tx: wrapped, flush };
}
async function politely(database: CareerDatabase, work: (tx: Parameters<Parameters<CareerDatabase["transaction"]>[0]>[0]) => Promise<void>) {
  for (let attempt = 1; ; attempt++) {
    try {
      await database.transaction(async tx => {
        await tx.execute(sql`SET LOCAL lock_timeout = '${sql.raw(LOCK_WAIT)}'`);
        const quiet = skippingNoOps(tx);
        await work(quiet.tx);
        await quiet.flush();
      });
      return;
    } catch (err) {
      const code = (err as { code?: string; cause?: { code?: string } }).cause?.code ?? (err as { code?: string }).code;
      // 55P03 lock_not_available (gave way), 40P01 deadlock: busy tables, try again shortly. Anything else is a real failure.
      if (!(code === "55P03" || code === "40P01") || attempt >= ATTEMPTS) throw err;
      await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
}

/** Shipped event definitions for every supported version (insert-only; its own step so a refusal cannot undo the repairs). */
export async function syncCareerEventDefinitions(database: CareerDatabase): Promise<void> {
  // Missing rows first, in their own transaction, so a refused sync below still leaves every edition complete.
  await politely(database, async tx => { await ensureTeamEventClassification(tx); await insertMissingEventDefinitions(tx); });
  await politely(database, async tx => { await syncEventDefinitions(tx); });
}
