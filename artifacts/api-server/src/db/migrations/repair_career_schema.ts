import type { CareerDatabase, CareerExecutor } from "../../career/database.ts";
import { sql } from "drizzle-orm";
import { ensureSoftTipCircuit, ensureLeagueRounds, ensureEventPairs, ensureQuickSimSource, ensureCareerForeignKeyIndexes, ensureEntryTier, syncEventDefinitions } from "./create_career_calendar.ts";
import { ensureCareerMatchSessionSchema } from "./create_career_live.ts";
import { ensureCareerGroupSchema } from "./create_career_groups.ts";
import { ensureDevelopmentCardSource, ensureRankingArchive, ensureTourCardOffers } from "./create_career_sporting.ts";
import { createCareerContent } from "./create_career_content.ts";
import { ensureMoneyMatches } from "./create_career_money.ts";
import { ensureClubTeams } from "./create_career_club_teams.ts";
import { ensureCareerCountyTeams } from "./create_career_county_teams.ts";
import { ensureHostingLedger } from "./create_career_hosting.ts";
import { ensureStreaming } from "./create_career_streaming.ts";
import { ensureRoadTrips } from "./create_career_road_trips.ts";
import { ensureCamLeagues } from "./create_career_cam_leagues.ts";
import { ensureProAm } from "./create_career_proam.ts";

async function ensureQualificationEntitlementSourceConstraint(tx: CareerExecutor): Promise<void> {
  const row = (await tx.execute(sql`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid='career_qualification_entitlements'::regclass AND conname='career_qualification_entitlements_source_check'`)).rows[0];
  if (String(row?.definition ?? "").includes("source_kind <> 'EVENT_RESULT'")) return;
  await tx.execute(sql`ALTER TABLE career_qualification_entitlements DROP CONSTRAINT IF EXISTS career_qualification_entitlements_source_check`);
  await tx.execute(sql`ALTER TABLE career_qualification_entitlements ADD CONSTRAINT career_qualification_entitlements_source_check
    CHECK (source_kind <> 'EVENT_RESULT' OR source_event_id IS NOT NULL)`);
}
import { ensureManagers } from "./create_career_manager.ts";
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
  await database.transaction(async tx => {
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
    await ensureCareerGroupSchema(tx);
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
    await ensureRoadTrips(tx);
    await ensureCamLeagues(tx);
    await ensureProAm(tx);
    await ensureManagers(tx);
    // SP-G (signature products, equipment) tables were added to createCareerContent after its ledgered
    // caller (createCareerFinanceA4 / the A9 upgrade) had already run in production. All IF NOT EXISTS.
    await createCareerContent(tx);
  });
}

/** Shipped event definitions for every supported version (insert-only; its own step so a refusal cannot undo the repairs). */
export async function syncCareerEventDefinitions(database: CareerDatabase): Promise<void> {
  await database.transaction(tx => syncEventDefinitions(tx));
}
