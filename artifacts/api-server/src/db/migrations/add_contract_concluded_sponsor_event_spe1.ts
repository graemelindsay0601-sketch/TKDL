import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";

/** Adds one persisted event type; existing sponsor history is left untouched. */
export async function addContractConcludedSponsorEventSPE1(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
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
