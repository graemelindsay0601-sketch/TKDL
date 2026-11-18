// Regression: on a fresh database the A9 content upgrade runs after SP-E1b and re-runs the A4 finance migration,
// which reinstalled the original sponsor contract guard (only ACTIVE contracts may change). A scheduled renewal then
// could never start: every Continue from its start week failed with "Ended sponsor contracts are history" and the
// save was stuck (found by the Career soak tester at season 2 week 1). The every-boot repair restores the guard.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import { createCareerSponsorshipFoundation } from "../../db/migrations/create_career_sponsorship_foundation.ts";
import { createCareerNpcSponsorMarketSPF } from "../../db/migrations/create_career_npc_sponsor_market_spf.ts";
import { createCareerCalendar } from "../../db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../../db/migrations/create_career_finance.ts";
import { createCareerSponsorJourneysSPB } from "../../db/migrations/create_career_sponsor_journeys_spb.ts";
import { createCareerSponsorJourneysSPB3 } from "../../db/migrations/create_career_sponsor_journeys_spb3.ts";
import { createCareerFinanceSPC } from "../../db/migrations/create_career_finance_spc.ts";
import { createCareerSponsorHQSPD } from "../../db/migrations/create_career_sponsor_hq_spd.ts";
import { addContractConcludedSponsorEventSPE1 } from "../../db/migrations/add_contract_concluded_sponsor_event_spe1.ts";
import { addScheduledSponsorRenewalsSPE1B, ensureSponsorContractGuard } from "../../db/migrations/add_scheduled_sponsor_renewals_spe1b.ts";

const pg = new PGlite();
const db = drizzle(pg);

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  await createCareerSaves(db); await createCareerWorld(db); await createCareerSponsorshipFoundation(db); await createCareerNpcSponsorMarketSPF(db);
  await createCareerCalendar(db); await createCareerFinance(db); await createCareerSponsorJourneysSPB(db); await createCareerSponsorJourneysSPB3(db);
  await createCareerFinanceSPC(db); await createCareerSponsorHQSPD(db); await addContractConcludedSponsorEventSPE1(db);
  await addScheduledSponsorRenewalsSPE1B(db);
  // A fresh database: the A9 upgrade then re-runs the A4 finance migration.
  await createCareerFinance(db);
  // A stand-in table carrying the real guard, so its rules can be exercised without a full contract fixture.
  await pg.exec(`CREATE TABLE guard_probe (status TEXT, terms JSONB, offer_id UUID, sponsor_key TEXT,
      start_season INT, start_week INT, end_season INT, end_week INT);
    CREATE TRIGGER guard_probe_guard BEFORE UPDATE ON guard_probe FOR EACH ROW EXECUTE FUNCTION career_sponsor_contract_guard();`);
});
after(async () => { await pg.close(); });

/** Drizzle wraps the database error; the guard's message is on the cause. */
const raises = (pattern: RegExp) => (e: unknown) => pattern.test(String((e as { cause?: { message?: string } })?.cause?.message ?? (e as Error)?.message));
const probe = async () => {
  await pg.exec(`DELETE FROM guard_probe; INSERT INTO guard_probe VALUES ('SCHEDULED', '{}', '00000000-0000-0000-0000-000000000001', 'k', 2, 1, 2, 52)`);
  return db.execute(sql`UPDATE guard_probe SET status = 'ACTIVE'`);
};

test("after the A9 re-run a scheduled renewal cannot start; the every-boot repair restores the guard", async () => {
  await assert.rejects(probe(), raises(/Ended sponsor contracts are history/), "reproduces the stuck save");
  await db.transaction(async tx => ensureSponsorContractGuard(tx));
  await probe();
  assert.equal((await db.execute(sql`SELECT status FROM guard_probe`)).rows[0]?.status, "ACTIVE");
  // Still a guard: a scheduled renewal can only become ACTIVE, and ended contracts stay history.
  await pg.exec(`UPDATE guard_probe SET status = 'SCHEDULED'`).catch(() => undefined);
  await pg.exec(`DELETE FROM guard_probe; INSERT INTO guard_probe VALUES ('SCHEDULED', '{}', '00000000-0000-0000-0000-000000000001', 'k', 2, 1, 2, 52)`);
  await assert.rejects(db.execute(sql`UPDATE guard_probe SET status = 'COMPLETED'`), raises(/Scheduled renewals can only activate/));
  await pg.exec(`DELETE FROM guard_probe; INSERT INTO guard_probe VALUES ('EXPIRED', '{}', '00000000-0000-0000-0000-000000000001', 'k', 2, 1, 2, 52)`);
  await assert.rejects(db.execute(sql`UPDATE guard_probe SET status = 'ACTIVE'`), raises(/Ended sponsor contracts are history/));
});

test("the repair is a no-op when the guard is already current", async () => {
  const before = (await db.execute(sql`SELECT xmin::text AS x FROM pg_proc WHERE proname = 'career_sponsor_contract_guard'`)).rows[0]?.x;
  await db.transaction(async tx => ensureSponsorContractGuard(tx));
  const after = (await db.execute(sql`SELECT xmin::text AS x FROM pg_proc WHERE proname = 'career_sponsor_contract_guard'`)).rows[0]?.x;
  assert.equal(after, before);
});
