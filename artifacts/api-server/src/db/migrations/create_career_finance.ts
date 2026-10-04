import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";

/**
 * Additive A4 schema. The A1 table `career_finance_entries` becomes the single
 * immutable Career ledger: new nullable columns, a BEFORE INSERT trigger that
 * completes A1's CAREER_START rows, an operation-key uniqueness constraint and a
 * no-update guard. A1's create/restart code is unchanged. `career_saves.balance_pence`
 * stays the A1 balance column and is now a rebuildable cache of SUM(ledger) with a
 * database no-debt check. Every new save-owned table cascades from career_saves.
 */
export async function createCareerFinance(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    // ---------------------------------------------------------------- ledger (A1 table, extended)
    await tx.execute(sql`
      ALTER TABLE career_finance_entries
        ADD COLUMN IF NOT EXISTS category TEXT,
        ADD COLUMN IF NOT EXISTS headline TEXT,
        ADD COLUMN IF NOT EXISTS operation_key TEXT,
        ADD COLUMN IF NOT EXISTS season INTEGER,
        ADD COLUMN IF NOT EXISTS week INTEGER,
        ADD COLUMN IF NOT EXISTS event_id UUID,
        ADD COLUMN IF NOT EXISTS trip_id UUID,
        ADD COLUMN IF NOT EXISTS contract_id UUID,
        ADD COLUMN IF NOT EXISTS reverses_entry_id UUID,
        ADD COLUMN IF NOT EXISTS gross_amount_pence INTEGER,
        ADD COLUMN IF NOT EXISTS sponsor_covered_pence INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS finance_version INTEGER,
        ADD COLUMN IF NOT EXISTS reason TEXT,
        ADD COLUMN IF NOT EXISTS detail JSONB NOT NULL DEFAULT '{}'::jsonb
    `);
    // A1 inserts CAREER_START with only (id, save, kind, amount): complete it here.
    await tx.execute(sql`
      CREATE OR REPLACE FUNCTION career_finance_entry_defaults() RETURNS trigger AS $$
      BEGIN
        IF NEW.category IS NULL AND NEW.kind = 'CAREER_START' THEN
          NEW.category := 'CAREER_START';
          NEW.headline := 'START';
          NEW.operation_key := COALESCE(NEW.operation_key, 'career-start');
          NEW.reason := COALESCE(NEW.reason, 'A1 Career start balance');
        END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql
    `);
    await tx.execute(sql`DROP TRIGGER IF EXISTS career_finance_entries_defaults ON career_finance_entries`);
    await tx.execute(sql`CREATE TRIGGER career_finance_entries_defaults BEFORE INSERT ON career_finance_entries FOR EACH ROW EXECUTE FUNCTION career_finance_entry_defaults()`);
    // Backfill rows created before A4 (A1 starts), then make the ledger fields mandatory.
    await tx.execute(sql`UPDATE career_finance_entries SET category = 'CAREER_START', headline = 'START', operation_key = 'career-start', reason = 'A1 Career start balance'
      WHERE category IS NULL AND kind = 'CAREER_START'`);
    await tx.execute(sql`UPDATE career_finance_entries SET category = 'ADJUSTMENT', headline = 'START', operation_key = 'legacy:' || id::text WHERE category IS NULL`);
    await tx.execute(sql`ALTER TABLE career_finance_entries ALTER COLUMN category SET NOT NULL, ALTER COLUMN headline SET NOT NULL, ALTER COLUMN operation_key SET NOT NULL`);
    await tx.execute(sql`ALTER TABLE career_finance_entries DROP CONSTRAINT IF EXISTS career_finance_entries_category_check`);
    await tx.execute(sql`ALTER TABLE career_finance_entries ADD CONSTRAINT career_finance_entries_category_check CHECK (
      category IN ('CAREER_START','ENTRY_FEE','TRAVEL','ACCOMMODATION','PRIZE','SPONSOR_SIGNING_BONUS','SPONSOR_EVENT_PAYMENT','SPONSOR_PERFORMANCE_BONUS','REFUND','ADJUSTMENT')
      AND headline IN ('START','EARNINGS','SPONSOR','EXPENSE')
      AND (category <> 'CAREER_START' OR (headline = 'START' AND amount_pence >= 0))
      AND (category NOT IN ('ENTRY_FEE','TRAVEL','ACCOMMODATION') OR (headline = 'EXPENSE' AND amount_pence <= 0))
      AND (category <> 'PRIZE' OR (headline = 'EARNINGS' AND amount_pence > 0))
      AND (category NOT IN ('SPONSOR_SIGNING_BONUS','SPONSOR_EVENT_PAYMENT','SPONSOR_PERFORMANCE_BONUS') OR (headline = 'SPONSOR' AND amount_pence > 0))
      AND (category <> 'REFUND' OR (headline = 'EXPENSE' AND amount_pence > 0 AND reverses_entry_id IS NOT NULL))
      AND (category <> 'ADJUSTMENT' OR reverses_entry_id IS NOT NULL OR operation_key LIKE 'legacy:%' OR operation_key LIKE 'adjustment:%')
      AND sponsor_covered_pence >= 0 AND (gross_amount_pence IS NULL OR gross_amount_pence >= 0)
      AND (week IS NULL OR week BETWEEN 1 AND 52) AND (season IS NULL OR season > 0))`);
    await tx.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS career_finance_entries_operation_unique ON career_finance_entries (career_save_id, operation_key)`);
    await tx.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS career_finance_entries_save_id_unique ON career_finance_entries (career_save_id, id)`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_finance_entries_recent_idx ON career_finance_entries (career_save_id, created_at DESC, id)`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_finance_entries_event_idx ON career_finance_entries (career_save_id, event_id) WHERE event_id IS NOT NULL`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_finance_entries_contract_idx ON career_finance_entries (career_save_id, contract_id, season) WHERE contract_id IS NOT NULL`);
    await tx.execute(sql`
      CREATE OR REPLACE FUNCTION career_finance_reject_update() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'Career ledger entries are immutable; post a reversal instead'; END; $$ LANGUAGE plpgsql
    `);
    await tx.execute(sql`DROP TRIGGER IF EXISTS career_finance_entries_immutable ON career_finance_entries`);
    await tx.execute(sql`CREATE TRIGGER career_finance_entries_immutable BEFORE UPDATE ON career_finance_entries FOR EACH ROW EXECUTE FUNCTION career_finance_reject_update()`);
    // No debt: the A1 balance cache can never go negative.
    await tx.execute(sql`ALTER TABLE career_saves DROP CONSTRAINT IF EXISTS career_saves_balance_nonnegative`);
    await tx.execute(sql`ALTER TABLE career_saves ADD CONSTRAINT career_saves_balance_nonnegative CHECK (balance_pence >= 0)`);

    // ---------------------------------------------------------------- per-save finance state
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_finance_state (
        career_save_id UUID PRIMARY KEY REFERENCES career_saves(id) ON DELETE CASCADE,
        finance_version INTEGER NOT NULL CHECK (finance_version > 0),
        sponsor_database_version INTEGER NOT NULL CHECK (sponsor_database_version > 0),
        initialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ---------------------------------------------------------------- sponsorship
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_sponsor_offers (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        operation_key TEXT NOT NULL CHECK (length(operation_key) BETWEEN 1 AND 200),
        sponsor_key TEXT NOT NULL,
        sponsor_database_version INTEGER NOT NULL,
        tier TEXT NOT NULL CHECK (tier IN ('LOCAL','REGIONAL','PROFESSIONAL','ELITE')),
        kind TEXT NOT NULL CHECK (kind IN ('NEW','RENEWAL')),
        terms JSONB NOT NULL CHECK (jsonb_typeof(terms) = 'object'),
        source JSONB NOT NULL CHECK (jsonb_typeof(source) = 'object'),
        offered_season INTEGER NOT NULL, offered_week INTEGER NOT NULL CHECK (offered_week BETWEEN 1 AND 52),
        expires_season INTEGER NOT NULL, expires_week INTEGER NOT NULL CHECK (expires_week BETWEEN 1 AND 52),
        status TEXT NOT NULL CHECK (status IN ('AVAILABLE','ACCEPTED','DECLINED','EXPIRED','WITHDRAWN')),
        status_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), resolved_at TIMESTAMPTZ,
        PRIMARY KEY (career_save_id, id),
        CONSTRAINT career_sponsor_offers_operation_unique UNIQUE (career_save_id, operation_key),
        CONSTRAINT career_sponsor_offers_resolution_check CHECK ((status = 'AVAILABLE') = (resolved_at IS NULL))
      )
    `);
    await tx.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS career_sponsor_offers_one_open ON career_sponsor_offers (career_save_id, sponsor_key) WHERE status = 'AVAILABLE'`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_sponsor_contracts (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        offer_id UUID NOT NULL,
        sponsor_key TEXT NOT NULL,
        sponsor_database_version INTEGER NOT NULL,
        tier TEXT NOT NULL CHECK (tier IN ('LOCAL','REGIONAL','PROFESSIONAL','ELITE')),
        terms JSONB NOT NULL CHECK (jsonb_typeof(terms) = 'object'),
        start_season INTEGER NOT NULL, start_week INTEGER NOT NULL CHECK (start_week BETWEEN 1 AND 52),
        end_season INTEGER NOT NULL, end_week INTEGER NOT NULL CHECK (end_week BETWEEN 1 AND 52),
        status TEXT NOT NULL CHECK (status IN ('ACTIVE','COMPLETED','EXPIRED','TERMINATED')),
        end_reason TEXT,
        signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ended_at TIMESTAMPTZ,
        PRIMARY KEY (career_save_id, id),
        CONSTRAINT career_sponsor_contracts_offer_unique UNIQUE (career_save_id, offer_id),
        FOREIGN KEY (career_save_id, offer_id) REFERENCES career_sponsor_offers(career_save_id, id) ON DELETE CASCADE,
        CONSTRAINT career_sponsor_contracts_end_check CHECK ((status = 'ACTIVE') = (ended_at IS NULL) AND (status = 'ACTIVE' OR end_reason IS NOT NULL)
          AND (end_season > start_season OR (end_season = start_season AND end_week >= start_week)))
      )
    `);
    await tx.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS career_sponsor_contracts_one_active ON career_sponsor_contracts (career_save_id) WHERE status = 'ACTIVE'`);
    await tx.execute(sql`
      CREATE OR REPLACE FUNCTION career_sponsor_contract_guard() RETURNS trigger AS $$
      BEGIN
        IF OLD.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Ended sponsor contracts are history'; END IF;
        IF NEW.terms IS DISTINCT FROM OLD.terms OR NEW.offer_id <> OLD.offer_id OR NEW.sponsor_key <> OLD.sponsor_key THEN RAISE EXCEPTION 'Sponsor contract terms are immutable'; END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql
    `);
    await tx.execute(sql`DROP TRIGGER IF EXISTS career_sponsor_contracts_guard ON career_sponsor_contracts`);
    await tx.execute(sql`CREATE TRIGGER career_sponsor_contracts_guard BEFORE UPDATE ON career_sponsor_contracts FOR EACH ROW EXECUTE FUNCTION career_sponsor_contract_guard()`);
    await tx.execute(sql`
      CREATE OR REPLACE FUNCTION career_sponsor_offer_guard() RETURNS trigger AS $$
      BEGIN
        IF OLD.status <> 'AVAILABLE' THEN RAISE EXCEPTION 'Resolved sponsor offers are history'; END IF;
        IF NEW.terms IS DISTINCT FROM OLD.terms OR NEW.sponsor_key <> OLD.sponsor_key THEN RAISE EXCEPTION 'Sponsor offer terms are immutable'; END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql
    `);
    await tx.execute(sql`DROP TRIGGER IF EXISTS career_sponsor_offers_guard ON career_sponsor_offers`);
    await tx.execute(sql`CREATE TRIGGER career_sponsor_offers_guard BEFORE UPDATE ON career_sponsor_offers FOR EACH ROW EXECUTE FUNCTION career_sponsor_offer_guard()`);

    // ---------------------------------------------------------------- trips + event finance
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_trips (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        season INTEGER NOT NULL,
        trip_key TEXT NOT NULL,
        band TEXT NOT NULL CHECK (band IN ('LOCAL','DOMESTIC','UK_IRELAND','EUROPE','LONG_HAUL')),
        destination TEXT NOT NULL,
        start_day INTEGER NOT NULL, end_day INTEGER NOT NULL,
        nights INTEGER NOT NULL CHECK (nights >= 0),
        event_ids JSONB NOT NULL CHECK (jsonb_typeof(event_ids) = 'array'),
        travel_gross_pence INTEGER NOT NULL CHECK (travel_gross_pence >= 0),
        travel_covered_pence INTEGER NOT NULL CHECK (travel_covered_pence >= 0),
        accommodation_gross_pence INTEGER NOT NULL CHECK (accommodation_gross_pence >= 0),
        accommodation_covered_pence INTEGER NOT NULL CHECK (accommodation_covered_pence >= 0),
        committed_season INTEGER NOT NULL, committed_week INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, id),
        CONSTRAINT career_trips_key_unique UNIQUE (career_save_id, season, trip_key),
        CONSTRAINT career_trips_window_check CHECK (start_day <= end_day
          AND travel_covered_pence <= travel_gross_pence AND accommodation_covered_pence <= accommodation_gross_pence)
      )
    `);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_event_finance (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        event_id UUID NOT NULL,
        season INTEGER NOT NULL,
        finance_version INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('ENTERED','TRAVEL_COMMITTED','WITHDRAWN','CANCELLED','COMPLETED')),
        snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
        entry_fee_gross_pence INTEGER NOT NULL CHECK (entry_fee_gross_pence >= 0),
        entry_fee_covered_pence INTEGER NOT NULL CHECK (entry_fee_covered_pence >= 0),
        entry_fee_paid_pence INTEGER NOT NULL CHECK (entry_fee_paid_pence >= 0),
        estimated_trip_pence INTEGER NOT NULL CHECK (estimated_trip_pence >= 0),
        trip_id UUID,
        entered_season INTEGER NOT NULL, entered_week INTEGER NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, event_id),
        FOREIGN KEY (career_save_id, event_id) REFERENCES career_event_instances(career_save_id, id) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, trip_id) REFERENCES career_trips(career_save_id, id) ON DELETE CASCADE,
        CONSTRAINT career_event_finance_paid_check CHECK (entry_fee_paid_pence + entry_fee_covered_pence = entry_fee_gross_pence)
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_event_finance_status_idx ON career_event_finance (career_save_id, season, status)`);
    // Ledger foreign keys (composite, save-scoped) now that the referenced tables exist.
    for (const [name, clause] of [
      ["career_finance_entries_event_fk", sql`FOREIGN KEY (career_save_id, event_id) REFERENCES career_event_instances(career_save_id, id) ON DELETE CASCADE`],
      ["career_finance_entries_trip_fk", sql`FOREIGN KEY (career_save_id, trip_id) REFERENCES career_trips(career_save_id, id) ON DELETE CASCADE`],
      ["career_finance_entries_contract_fk", sql`FOREIGN KEY (career_save_id, contract_id) REFERENCES career_sponsor_contracts(career_save_id, id) ON DELETE CASCADE`],
      ["career_finance_entries_reversal_fk", sql`FOREIGN KEY (career_save_id, reverses_entry_id) REFERENCES career_finance_entries(career_save_id, id) ON DELETE CASCADE`],
    ] as const) {
      await tx.execute(sql`ALTER TABLE career_finance_entries DROP CONSTRAINT IF EXISTS ${sql.raw(name)}`);
      await tx.execute(sql`ALTER TABLE career_finance_entries ADD CONSTRAINT ${sql.raw(name)} ${clause}`);
    }

    // ---------------------------------------------------------------- prizes
    // Prize table snapshot for every completed executable event (A5 can derive NPC ranking money from it).
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_event_prize_tables (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        event_id UUID NOT NULL,
        season INTEGER NOT NULL,
        finance_version INTEGER NOT NULL,
        prize_profile_key TEXT NOT NULL,
        classification TEXT NOT NULL,
        ranking_eligible BOOLEAN NOT NULL,
        bands JSONB NOT NULL CHECK (jsonb_typeof(bands) = 'array'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, event_id),
        FOREIGN KEY (career_save_id, event_id) REFERENCES career_event_instances(career_save_id, id) ON DELETE CASCADE,
        CONSTRAINT career_event_prize_tables_special_check CHECK (classification <> 'SPECIAL' OR NOT ranking_eligible)
      )
    `);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_prize_awards (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        event_id UUID NOT NULL,
        participant_key TEXT NOT NULL CHECK (participant_key = 'HUMAN'),
        season INTEGER NOT NULL,
        finishing_position INTEGER NOT NULL CHECK (finishing_position >= 1),
        cash_award_pence INTEGER NOT NULL CHECK (cash_award_pence >= 0),
        ranking_eligible_pence INTEGER NOT NULL CHECK (ranking_eligible_pence >= 0 AND ranking_eligible_pence <= cash_award_pence),
        classification TEXT NOT NULL,
        ledger_entry_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, event_id, participant_key),
        FOREIGN KEY (career_save_id, event_id, participant_key) REFERENCES career_event_results(career_save_id, event_id, participant_key) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, ledger_entry_id) REFERENCES career_finance_entries(career_save_id, id) ON DELETE CASCADE,
        CONSTRAINT career_prize_awards_special_check CHECK (classification <> 'SPECIAL' OR ranking_eligible_pence = 0),
        CONSTRAINT career_prize_awards_ledger_check CHECK ((cash_award_pence > 0) = (ledger_entry_id IS NOT NULL))
      )
    `);
    await tx.execute(sql`
      CREATE OR REPLACE FUNCTION career_reject_prize_update() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'Career prize facts are immutable'; END; $$ LANGUAGE plpgsql
    `);
    for (const table of ["career_prize_awards", "career_event_prize_tables", "career_trips"]) {
      await tx.execute(sql`DROP TRIGGER IF EXISTS ${sql.raw(`${table}_immutable`)} ON ${sql.raw(table)}`);
      await tx.execute(sql`CREATE TRIGGER ${sql.raw(`${table}_immutable`)} BEFORE UPDATE ON ${sql.raw(table)} FOR EACH ROW EXECUTE FUNCTION career_reject_prize_update()`);
    }
  });
}
