import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";

/**
 * SP-B additive persistence. Commercial journeys reference immutable A4 offer and
 * contract snapshots; they do not own balances, payments, or contract execution.
 */
export async function createCareerSponsorJourneysSPB(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    await tx.execute(sql`ALTER TABLE career_sponsor_offers DROP CONSTRAINT IF EXISTS career_sponsor_offers_status_check`);
    await tx.execute(sql`ALTER TABLE career_sponsor_offers ADD CONSTRAINT career_sponsor_offers_status_check
      CHECK (status IN ('AVAILABLE','ACCEPTED','DECLINED','EXPIRED','WITHDRAWN','COUNTERED'))`);

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_sponsor_journeys (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        operation_key TEXT NOT NULL CHECK (length(operation_key) BETWEEN 1 AND 200),
        sponsor_key TEXT NOT NULL,
        sponsor_database_version INTEGER NOT NULL CHECK (sponsor_database_version > 0),
        opening_offer_id UUID NOT NULL,
        current_offer_id UUID NOT NULL,
        signed_contract_id UUID,
        status TEXT NOT NULL CHECK (status IN ('OFFERED','NEGOTIATING','SIGNED','WALKED_AWAY','REJECTED','WITHDRAWN','EXPIRED')),
        revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
        negotiation_rounds INTEGER NOT NULL DEFAULT 0 CHECK (negotiation_rounds BETWEEN 0 AND 2),
        representative JSONB CHECK (representative IS NULL OR jsonb_typeof(representative) = 'object'),
        brand_personality TEXT NOT NULL CHECK (length(brand_personality) BETWEEN 2 AND 200),
        source JSONB NOT NULL CHECK (jsonb_typeof(source) = 'object'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, id),
        CONSTRAINT career_sponsor_journeys_operation_unique UNIQUE (career_save_id, operation_key),
        CONSTRAINT career_sponsor_journeys_opening_offer_unique UNIQUE (career_save_id, opening_offer_id),
        FOREIGN KEY (career_save_id, opening_offer_id) REFERENCES career_sponsor_offers(career_save_id, id) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, current_offer_id) REFERENCES career_sponsor_offers(career_save_id, id) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, signed_contract_id) REFERENCES career_sponsor_contracts(career_save_id, id) ON DELETE CASCADE
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_sponsor_journeys_current_idx ON career_sponsor_journeys (career_save_id, current_offer_id)`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_sponsor_journeys_status_idx ON career_sponsor_journeys (career_save_id, status, updated_at)`);

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_sponsor_journey_events (
        career_save_id UUID NOT NULL,
        id UUID NOT NULL,
        journey_id UUID NOT NULL,
        ordinal INTEGER NOT NULL CHECK (ordinal > 0),
        event_key TEXT NOT NULL CHECK (length(event_key) BETWEEN 1 AND 200),
        event_type TEXT NOT NULL CHECK (event_type IN (
          'INTEREST','APPROACH','OFFER_RECEIVED','PLAYER_COUNTERED','SPONSOR_COUNTERED',
          'SPONSOR_ACCEPTED_REQUEST','SPONSOR_REJECTED','SPONSOR_WITHDREW','PLAYER_WALKED_AWAY','SIGNED','OFFER_EXPIRED'
        )),
        offer_id UUID,
        details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, id),
        CONSTRAINT career_sponsor_journey_events_key_unique UNIQUE (career_save_id, event_key),
        CONSTRAINT career_sponsor_journey_events_ordinal_unique UNIQUE (career_save_id, journey_id, ordinal),
        FOREIGN KEY (career_save_id, journey_id) REFERENCES career_sponsor_journeys(career_save_id, id) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, offer_id) REFERENCES career_sponsor_offers(career_save_id, id) ON DELETE CASCADE
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_sponsor_journey_events_timeline_idx ON career_sponsor_journey_events (career_save_id, journey_id, created_at)`);

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_sponsor_negotiations (
        career_save_id UUID NOT NULL,
        id UUID NOT NULL,
        journey_id UUID NOT NULL,
        request_key TEXT NOT NULL CHECK (length(request_key) BETWEEN 8 AND 120),
        round INTEGER NOT NULL CHECK (round BETWEEN 1 AND 2),
        source_offer_id UUID NOT NULL,
        response_offer_id UUID,
        request JSONB NOT NULL CHECK (jsonb_typeof(request) = 'object'),
        outcome TEXT NOT NULL CHECK (outcome IN ('ACCEPTED','COUNTERED','REJECTED','WITHDRAWN')),
        response JSONB NOT NULL CHECK (jsonb_typeof(response) = 'object'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, id),
        CONSTRAINT career_sponsor_negotiations_request_unique UNIQUE (career_save_id, request_key),
        CONSTRAINT career_sponsor_negotiations_round_unique UNIQUE (career_save_id, journey_id, round),
        FOREIGN KEY (career_save_id, journey_id) REFERENCES career_sponsor_journeys(career_save_id, id) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, source_offer_id) REFERENCES career_sponsor_offers(career_save_id, id) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, response_offer_id) REFERENCES career_sponsor_offers(career_save_id, id) ON DELETE CASCADE
      )
    `);
  });
}
