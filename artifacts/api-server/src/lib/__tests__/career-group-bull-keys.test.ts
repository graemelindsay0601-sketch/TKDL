/** World Cup groups: ties settled by bull-offs in any group (A to L), and a champion who dropped a group game is allowed. */
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
import { createCareerSponsorContractActionsSPE2 } from "../../db/migrations/create_career_sponsor_contract_actions_spe2.ts";
import { createCareerSporting } from "../../db/migrations/create_career_sporting.ts";
import { createShadowObservations } from "../../db/migrations/create_shadow_observations_sb21a.ts";
import { repairCareerSchema } from "../../db/migrations/repair_career_schema.ts";
import { ensureCareerGroupSchema } from "../../db/migrations/create_career_groups.ts";

const pg = new PGlite(), db = drizzle(pg);
before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
    createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
  await repairCareerSchema(db);
});
after(async () => { await pg.close(); });

const groupCheck = async () => String((await db.execute(sql`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint
  WHERE conrelid = 'career_group_bull_playoffs'::regclass AND conname = 'career_group_bull_playoffs_group_key_check'`)).rows[0]?.d ?? "");

test("bull-offs accept every group the layouts use, and older databases are repaired at boot", async () => {
  for (const g of ["A", "E", "H", "L"]) assert.ok((await groupCheck()).includes(`'${g}'`), `group ${g}`);
  // An older database: only A to D.
  await db.execute(sql`ALTER TABLE career_group_bull_playoffs DROP CONSTRAINT career_group_bull_playoffs_group_key_check`);
  await db.execute(sql`ALTER TABLE career_group_bull_playoffs ADD CONSTRAINT career_group_bull_playoffs_group_key_check CHECK (group_key IN ('A','B','C','D'))`);
  assert.ok(!(await groupCheck()).includes("'L'"));
  await repairCareerSchema(db);
  assert.ok((await groupCheck()).includes("'L'"), "repaired at boot");
  await db.transaction(tx => ensureCareerGroupSchema(tx));
  assert.ok((await groupCheck()).includes("'K'"), "and repeatable");
});

test("a World Cup champion may have lost a group game (as in group-knockout and league events)", async () => {
  const def = String((await db.execute(sql`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint
    WHERE conrelid = 'career_event_results'::regclass AND conname = 'career_event_results_champion_check'`)).rows[0]?.d ?? "");
  for (const s of ["GROUP_KNOCKOUT", "LEAGUE", "WORLD_CUP"]) assert.ok(def.includes(`'${s}'`), s);
});
