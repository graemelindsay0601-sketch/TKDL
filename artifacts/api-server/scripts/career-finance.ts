/**
 * A4 finance validation harness (dev only). Plays a deterministic human Career for a
 * full season (+ rollover) through the real A1–A4 services on in-memory PostgreSQL,
 * then runs labelled fixture scenarios.
 *   node scripts/career-finance.ts [seed] [--weeks=N]
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createCareerSaves } from "../src/db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../src/db/migrations/create_career_world.ts";
import { createCareerSponsorshipFoundation } from "../src/db/migrations/create_career_sponsorship_foundation.ts";
import { createCareerNpcSponsorMarketSPF } from "../src/db/migrations/create_career_npc_sponsor_market_spf.ts";
import { createCareerCalendar } from "../src/db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../src/db/migrations/create_career_finance.ts";
import { createCareerFinanceSPC } from "../src/db/migrations/create_career_finance_spc.ts";
import { createCareerSponsorJourneysSPB } from "../src/db/migrations/create_career_sponsor_journeys_spb.ts";
import { createCareerSponsorJourneysSPB3 } from "../src/db/migrations/create_career_sponsor_journeys_spb3.ts";
import { createCareerSponsorHQSPD } from "../src/db/migrations/create_career_sponsor_hq_spd.ts";
import { addContractConcludedSponsorEventSPE1 } from "../src/db/migrations/add_contract_concluded_sponsor_event_spe1.ts";
import { addScheduledSponsorRenewalsSPE1B } from "../src/db/migrations/add_scheduled_sponsor_renewals_spe1b.ts";
import { createCareerSponsorContractActionsSPE2 } from "../src/db/migrations/create_career_sponsor_contract_actions_spe2.ts";
import { ensureCareerCountyTeams } from "../src/db/migrations/create_career_county_teams.ts";
import { createCareerSporting } from "../src/db/migrations/create_career_sporting.ts";
import { runFinanceHarness } from "../src/career/finance/harness.ts";
import { HARNESS_SEED } from "../src/career/world/harness.ts";

const seed = process.argv.find(a => /^[a-f0-9]{64}$/.test(a)) ?? HARNESS_SEED;
const weeks = Number(process.argv.find(a => a.startsWith("--weeks="))?.slice(8) ?? 53);
const pg = new PGlite();
const db = drizzle(pg);
await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1), (2);
  CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
  INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'harness')`);
await createCareerSaves(db);
await createCareerWorld(db);
await createCareerSponsorshipFoundation(db);
await createCareerNpcSponsorMarketSPF(db);
await createCareerCalendar(db);
await db.transaction(tx=>ensureCareerCountyTeams(tx));
await createCareerFinance(db);
await createCareerSponsorJourneysSPB(db);
await createCareerSponsorJourneysSPB3(db);
await createCareerFinanceSPC(db);
await createCareerSponsorHQSPD(db);
await addContractConcludedSponsorEventSPE1(db);
await addScheduledSponsorRenewalsSPE1B(db);
await createCareerSponsorContractActionsSPE2(db);
await createCareerSporting(db);
console.log(JSON.stringify(await runFinanceHarness(db, seed, { weeks }), null, 2));
await pg.close();
