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
import { repairCareerSchema, syncCareerEventDefinitions } from "../../db/migrations/repair_career_schema.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerSportingService } from "../../career/sporting/service.ts";
import { awardCard, cardHoldersIn } from "../../career/sporting/cards.ts";


import { catalogueFor } from "../../career/calendar/catalogue.ts";
import { CURRENT_EVENT_DATABASE_VERSION } from "../../career/calendar/config.ts";

/**
 * Production regression: the TEAM classification was added to the A3 tables inside the ledgered createCareerCalendar
 * migration after production had already recorded it, so production kept the old CHECK. Every edition with a TEAM event
 * (the World Cup, v31+) was then refused at startup and by the calendar's own definition insert, and new Careers failed.
 */
const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db);

before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
    createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
});
after(async () => { await pg.close(); });

const OLD = "CHECK (classification IN ('RANKING','QUALIFIER','INVITATIONAL_EXHIBITION','SPECIAL'))";

test("startup restores the TEAM classification on an older database, stores every edition and a new Career initializes", async () => {
  // Recreate production: no TEAM definitions were ever stored and both tables carry the pre-v31 CHECK.
  await pg.exec(`DELETE FROM career_event_definitions WHERE classification = 'TEAM' OR event_database_version >= 31;
    ALTER TABLE career_event_definitions DROP CONSTRAINT career_event_definitions_classification_check;
    ALTER TABLE career_event_definitions ADD CONSTRAINT career_event_definitions_classification_check ${OLD};
    ALTER TABLE career_event_instances DROP CONSTRAINT career_event_instances_classification_check;
    ALTER TABLE career_event_instances ADD CONSTRAINT career_event_instances_classification_check ${OLD};`);
  const id = (await saves.create(1, { slot: 1, careerName: "Old database", dateOfBirth: "1992-08-01" })).id;
  await assert.rejects(career.initialize({ playerId: 1 }, id), "the old CHECK refuses the World Cup definition, as production did");

  await repairCareerSchema(db);
  await syncCareerEventDefinitions(db);
  for (const table of ["career_event_definitions", "career_event_instances"]) {
    const def = (await pg.query<{ def: string }>(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = '${table}_classification_check'`)).rows[0].def;
    assert.match(def, /'TEAM'/, table);
  }
  const stored = (await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM career_event_definitions WHERE event_database_version = ${CURRENT_EVENT_DATABASE_VERSION}`)).rows[0].n;
  assert.equal(stored, catalogueFor(CURRENT_EVENT_DATABASE_VERSION).length, "the current edition is complete");

  await career.initialize({ playerId: 1 }, id);
  const team = (await db.execute(sql`SELECT count(*)::int AS n FROM career_event_instances WHERE career_save_id = ${id} AND classification = 'TEAM'`)).rows[0];
  assert.ok(Number(team.n) > 0, "the World Cup is on the new calendar");
});
