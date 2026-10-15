import type { CareerDatabase } from "../../career/database.ts";
import { ensureSoftTipCircuit, ensureLeagueRounds, ensureEventPairs, ensureQuickSimSource, ensureCareerForeignKeyIndexes, syncEventDefinitions } from "./create_career_calendar.ts";
import { ensureCareerMatchSessionSchema } from "./create_career_live.ts";
import { ensureCareerGroupSchema } from "./create_career_groups.ts";
import { ensureDevelopmentCardSource } from "./create_career_sporting.ts";
import { createCareerContent } from "./create_career_content.ts";
import { ensureLegacySeasonTotals } from "./create_career_legacy.ts";

/**
 * Career schema repairs that later event databases (v7 soft-tip, v11 league nights, v12 Development Tour,
 * v13 pairs) depend on. They were first added inside createCareerCalendarA3 / createCareerSportingA5, but
 * those are ledgered startup migrations: a database that recorded them as complete before the repairs
 * existed skips them on every boot, so production never received them (Career initialize then failed on
 * career_event_instances_circuit_check for soft-tip events). Every repair here checks before it changes
 * anything, so this runs on EVERY startup — a new repair belongs here, never inside a ledgered migration.
 */
export async function repairCareerSchema(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    await ensureSoftTipCircuit(tx);
    await ensureLeagueRounds(tx);
    await ensureEventPairs(tx);
    await ensureQuickSimSource(tx);
    await ensureCareerForeignKeyIndexes(tx);
    await ensureCareerMatchSessionSchema(tx);
    await ensureCareerGroupSchema(tx);
    await ensureDevelopmentCardSource(tx);
    await ensureLegacySeasonTotals(tx);
    // SP-G (signature products, equipment) tables were added to createCareerContent after its ledgered
    // caller (createCareerFinanceA4 / the A9 upgrade) had already run in production. All IF NOT EXISTS.
    await createCareerContent(tx);
  });
}

/** Shipped event definitions for every supported version (insert-only; its own step so a refusal cannot undo the repairs). */
export async function syncCareerEventDefinitions(database: CareerDatabase): Promise<void> {
  await database.transaction(tx => syncEventDefinitions(tx));
}
