import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";

/**
 * SP-B3 additive journey state. Existing offer, contract, negotiation and
 * ledger records are preserved; no historical interest events are backfilled.
 */
export async function createCareerSponsorJourneysSPB3(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    await tx.execute(sql`ALTER TABLE career_sponsor_journeys
      ALTER COLUMN opening_offer_id DROP NOT NULL,
      ALTER COLUMN current_offer_id DROP NOT NULL`);
    await tx.execute(sql`ALTER TABLE career_sponsor_journeys DROP CONSTRAINT IF EXISTS career_sponsor_journeys_status_check`);
    await tx.execute(sql`ALTER TABLE career_sponsor_journeys ADD CONSTRAINT career_sponsor_journeys_status_check
      CHECK (status IN ('INTEREST','OFFERED','NEGOTIATING','SIGNED','DECLINED','WALKED_AWAY','REJECTED','WITHDRAWN','EXPIRED'))`);
    await tx.execute(sql`ALTER TABLE career_sponsor_journeys DROP CONSTRAINT IF EXISTS career_sponsor_journeys_interest_offer_check`);
    await tx.execute(sql`ALTER TABLE career_sponsor_journeys ADD CONSTRAINT career_sponsor_journeys_interest_offer_check
      CHECK ((status = 'INTEREST' AND opening_offer_id IS NULL AND current_offer_id IS NULL)
        OR (status <> 'INTEREST' AND opening_offer_id IS NOT NULL AND current_offer_id IS NOT NULL))`);
    await tx.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS career_sponsor_journeys_one_interest_per_brand
      ON career_sponsor_journeys (career_save_id, sponsor_key) WHERE status = 'INTEREST'`);

    await tx.execute(sql`ALTER TABLE career_sponsor_journey_events
      ADD COLUMN IF NOT EXISTS season INTEGER,
      ADD COLUMN IF NOT EXISTS week INTEGER`);
    await tx.execute(sql`ALTER TABLE career_sponsor_journey_events DROP CONSTRAINT IF EXISTS career_sponsor_journey_events_event_type_check`);
    await tx.execute(sql`ALTER TABLE career_sponsor_journey_events ADD CONSTRAINT career_sponsor_journey_events_event_type_check
      CHECK (event_type IN (
        'INTEREST','APPROACH','OFFER_RECEIVED','PLAYER_COUNTERED','SPONSOR_COUNTERED',
        'SPONSOR_ACCEPTED_REQUEST','SPONSOR_REJECTED','SPONSOR_WITHDREW','PLAYER_DECLINED',
        'PLAYER_WALKED_AWAY','SIGNED','OFFER_EXPIRED'
      ))`);
    await tx.execute(sql`ALTER TABLE career_sponsor_journey_events DROP CONSTRAINT IF EXISTS career_sponsor_journey_events_game_time_check`);
    await tx.execute(sql`ALTER TABLE career_sponsor_journey_events ADD CONSTRAINT career_sponsor_journey_events_game_time_check
      CHECK ((season IS NULL AND week IS NULL) OR (season BETWEEN 1 AND 1000 AND week BETWEEN 1 AND 52))`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_sponsor_journey_events_career_time_idx
      ON career_sponsor_journey_events (career_save_id, season, week, ordinal)`);

    // A rejected-expiry request is durable/idempotent but does not consume a
    // negotiation round, so it must not collide with the two real round records.
    await tx.execute(sql`ALTER TABLE career_sponsor_negotiations
      DROP CONSTRAINT IF EXISTS career_sponsor_negotiations_outcome_check`);
    await tx.execute(sql`ALTER TABLE career_sponsor_negotiations
      ADD CONSTRAINT career_sponsor_negotiations_outcome_check
      CHECK (outcome IN ('ACCEPTED','COUNTERED','REJECTED','WITHDRAWN','EXPIRED'))`);
    await tx.execute(sql`ALTER TABLE career_sponsor_negotiations
      DROP CONSTRAINT IF EXISTS career_sponsor_negotiations_round_unique`);
    await tx.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS career_sponsor_negotiations_round_unique_idx
      ON career_sponsor_negotiations (career_save_id, journey_id, round) WHERE outcome <> 'EXPIRED'`);
  });
}
