import { sql } from "drizzle-orm";
import { constraintAlreadyAdmits } from "./career_constraint_guard.ts";
import type { CareerDatabase } from "../../career/database.ts";

/** Adds one persisted event type; existing sponsor history is left untouched. */
export async function addContractConcludedSponsorEventSPE1(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    // Never narrow the event vocabulary SP-E1B widened when this migration is replayed.
    if (await constraintAlreadyAdmits(tx, "career_sponsor_journey_events_event_type_check", "CONTRACT_ACTIVATED")) return;
    await tx.execute(sql`ALTER TABLE career_sponsor_journey_events
      DROP CONSTRAINT IF EXISTS career_sponsor_journey_events_event_type_check`);
    await tx.execute(sql`ALTER TABLE career_sponsor_journey_events
      ADD CONSTRAINT career_sponsor_journey_events_event_type_check CHECK (event_type IN (
        'INTEREST','APPROACH','OFFER_RECEIVED','PLAYER_COUNTERED','SPONSOR_COUNTERED',
        'SPONSOR_ACCEPTED_REQUEST','SPONSOR_REJECTED','SPONSOR_WITHDREW','PLAYER_DECLINED',
        'PLAYER_WALKED_AWAY','SIGNED','OFFER_EXPIRED','FINANCIAL_PAYMENT','ACTIVITY_UPDATE',
        'CONTRACT_CONCLUDED'
      ))`);
  });
}
