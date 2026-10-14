import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import { createCareerSponsorshipFoundation } from "../../db/migrations/create_career_sponsorship_foundation.ts";
import { createCareerCalendar } from "../../db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../../db/migrations/create_career_finance.ts";
import { createCareerSporting } from "../../db/migrations/create_career_sporting.ts";
import { repairCareerSchema, syncCareerEventDefinitions } from "../../db/migrations/repair_career_schema.ts";

/**
 * Production regression: createCareerCalendarA3 / createCareerSportingA5 are ledgered migrations, recorded
 * complete before the v7–v13 repairs were added inside them, so production skipped those repairs and every
 * Career initialize failed on career_event_instances_circuit_check (soft-tip). The every-boot repair step
 * must bring such a database up to date, and be safe to repeat.
 */
test("every-boot repair restores the Career schema a ledger-skipped migration never applied", async () => {
  const pg = new PGlite(), db = drizzle(pg);
  await pg.exec(`CREATE TABLE players(id integer PRIMARY KEY); CREATE TABLE feature_flags(feature_name text UNIQUE, enabled boolean, admin_test_mode boolean, description text);`);
  await createCareerSaves(db); await createCareerWorld(db); await createCareerSponsorshipFoundation(db);
  await createCareerCalendar(db); await createCareerFinance(db); await createCareerSporting(db);
  const def = async (table: string, name: string) => String((await db.execute(sql`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint
    WHERE conrelid = ${table}::regclass AND conname = ${name}`)).rows[0]?.d ?? "");
  // The production database as it stood: the pre-v7 rules, no pairs table, no session team column.
  await pg.exec(`
    ALTER TABLE career_event_instances DROP CONSTRAINT career_event_instances_circuit_check;
    ALTER TABLE career_event_instances ADD CONSTRAINT career_event_instances_circuit_check CHECK (circuit IN ('GRASSROOTS','COUNTY','REGIONAL',
      'NATIONAL_AMATEUR','CHALLENGER','VAULT','Q_SCHOOL','PRO_CIRCUIT','EUROPEAN_SERIES','WORLD_SERIES','INVITATIONAL','MAJOR','WORLD_CHAMPIONSHIP','SPECIAL')) NOT VALID;
    ALTER TABLE career_tournament_matches DROP CONSTRAINT career_tournament_matches_round_check;
    ALTER TABLE career_tournament_matches ADD CONSTRAINT career_tournament_matches_round_check CHECK (round BETWEEN 1 AND 8) NOT VALID;
    ALTER TABLE career_event_results DROP CONSTRAINT career_event_results_champion_check;
    ALTER TABLE career_event_results ADD CONSTRAINT career_event_results_champion_check CHECK (is_champion = (finishing_position = 1)) NOT VALID;
    DROP TABLE career_event_pairs;
    ALTER TABLE career_match_sessions DROP COLUMN team;
    ALTER TABLE career_tour_cards DROP CONSTRAINT career_tour_cards_source_check;
    ALTER TABLE career_tour_cards ADD CONSTRAINT career_tour_cards_source_check CHECK (source IN ('FOUNDING','Q_SCHOOL_DIRECT','Q_SCHOOL_ORDER_OF_MERIT',
      'RANKING_RETENTION','CHALLENGER_RANKING')) NOT VALID;
    DELETE FROM career_event_definitions WHERE event_database_version >= 7;`);
  assert.doesNotMatch(await def("career_event_instances", "career_event_instances_circuit_check"), /SOFT_TIP/);

  for (let run = 0; run < 2; run++) { await repairCareerSchema(db); await syncCareerEventDefinitions(db); }

  assert.match(await def("career_event_instances", "career_event_instances_circuit_check"), /SOFT_TIP/, "soft-tip events can be stored (v7+)");
  assert.match(await def("career_tournament_matches", "career_tournament_matches_round_check"), /30/, "league nights' 14 rounds (v11)");
  assert.match(await def("career_event_results", "career_event_results_champion_check"), /LEAGUE/, "league champions with league-stage losses (v11)");
  assert.match(await def("career_tour_cards", "career_tour_cards_source_check"), /DEVELOPMENT_RANKING/, "Development Tour cards (v12)");
  assert.ok((await db.execute(sql`SELECT to_regclass('career_event_pairs') AS t`)).rows[0].t, "pairs table (v13)");
  assert.equal((await db.execute(sql`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'career_match_sessions' AND column_name = 'team'`)).rows[0].n, 1, "live pairs sessions (v13)");
  assert.ok(Number((await db.execute(sql`SELECT count(*)::int AS n FROM career_event_definitions WHERE event_database_version = 13`)).rows[0].n) > 0, "current definitions synced");
  await pg.close();
});
