import { sql } from "drizzle-orm";
import type { CareerDatabase, CareerExecutor } from "../../career/database.ts";

/** Adds a dormant state for accepted renewals; existing contracts are untouched. */
export async function addScheduledSponsorRenewalsSPE1B(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    await tx.execute(sql`ALTER TABLE career_sponsor_journey_events
      DROP CONSTRAINT IF EXISTS career_sponsor_journey_events_event_type_check`);
    await tx.execute(sql`ALTER TABLE career_sponsor_journey_events
      ADD CONSTRAINT career_sponsor_journey_events_event_type_check CHECK (event_type IN (
        'INTEREST','APPROACH','OFFER_RECEIVED','PLAYER_COUNTERED','SPONSOR_COUNTERED',
        'SPONSOR_ACCEPTED_REQUEST','SPONSOR_REJECTED','SPONSOR_WITHDREW','PLAYER_DECLINED',
        'PLAYER_WALKED_AWAY','SIGNED','OFFER_EXPIRED','FINANCIAL_PAYMENT','ACTIVITY_UPDATE',
        'CONTRACT_CONCLUDED','CONTRACT_ACTIVATED'
      ))`);
    await tx.execute(sql`ALTER TABLE career_sponsor_contracts
      DROP CONSTRAINT IF EXISTS career_sponsor_contracts_status_check`);
    await tx.execute(sql`ALTER TABLE career_sponsor_contracts
      ADD CONSTRAINT career_sponsor_contracts_status_check
      CHECK (status IN ('ACTIVE','SCHEDULED','COMPLETED','EXPIRED','TERMINATED'))`);
    await tx.execute(sql`ALTER TABLE career_sponsor_contracts
      DROP CONSTRAINT IF EXISTS career_sponsor_contracts_end_check`);
    await tx.execute(sql`ALTER TABLE career_sponsor_contracts
      ADD CONSTRAINT career_sponsor_contracts_end_check CHECK (
        (status IN ('ACTIVE','SCHEDULED')) = (ended_at IS NULL)
        AND (status IN ('ACTIVE','SCHEDULED')) = (end_reason IS NULL)
        AND (end_season > start_season OR (end_season = start_season AND end_week >= start_week))
      )`);
    await ensureSponsorContractGuard(tx);
  });
}

/**
 * The contract guard that lets a SCHEDULED renewal become ACTIVE. The A9 content upgrade re-runs the A4 finance
 * migration, which reinstalls the original guard (only ACTIVE contracts may change); on a database where A9 ran after
 * SP-E1b (every fresh database) a renewal could then never start and every Continue from its start week failed with
 * "Ended sponsor contracts are history". Called from the every-boot repair; changes nothing when already current.
 */
export async function ensureSponsorContractGuard(tx: CareerExecutor): Promise<void> {
  const current = String((await tx.execute(sql`SELECT prosrc FROM pg_proc WHERE proname = 'career_sponsor_contract_guard' LIMIT 1`)).rows[0]?.prosrc ?? "");
  if (current.includes("NOT IN ('ACTIVE','SCHEDULED')")) return;
  await tx.execute(sql`
      CREATE OR REPLACE FUNCTION career_sponsor_contract_guard() RETURNS trigger AS $$
      BEGIN
        IF OLD.status NOT IN ('ACTIVE','SCHEDULED') THEN RAISE EXCEPTION 'Ended sponsor contracts are history'; END IF;
        IF NEW.terms IS DISTINCT FROM OLD.terms OR NEW.offer_id <> OLD.offer_id OR NEW.sponsor_key <> OLD.sponsor_key
          OR NEW.start_season <> OLD.start_season OR NEW.start_week <> OLD.start_week
          OR NEW.end_season <> OLD.end_season OR NEW.end_week <> OLD.end_week
          THEN RAISE EXCEPTION 'Sponsor contract terms and dates are immutable'; END IF;
        IF OLD.status='SCHEDULED' AND NEW.status<>'ACTIVE' THEN RAISE EXCEPTION 'Scheduled renewals can only activate at their start'; END IF;
        IF OLD.status='ACTIVE' AND NEW.status NOT IN ('COMPLETED','EXPIRED','TERMINATED') THEN RAISE EXCEPTION 'Invalid active contract transition'; END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql
    `);
}
