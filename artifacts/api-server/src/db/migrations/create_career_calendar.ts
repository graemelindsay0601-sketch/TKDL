import { sql } from "drizzle-orm";
import type { CareerDatabase, CareerExecutor } from "../../career/database.ts";
import { catalogueFor } from "../../career/calendar/catalogue.ts";
import { definitionHash } from "../../career/calendar/generation.ts";
import { SUPPORTED_EVENT_DATABASE_VERSIONS } from "../../career/calendar/config.ts";

/**
 * Additive A3 schema. Every save-owned row has career_save_id NOT NULL with an
 * ON DELETE CASCADE path to career_saves and composite (career_save_id, ...) child
 * references so no row can point into another save. No A1/A2/Tour table is altered.
 */
export async function createCareerCalendar(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    // Global, versioned, immutable authored content (not save-owned).
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_event_definitions (
        event_database_version INTEGER NOT NULL CHECK (event_database_version > 0),
        definition_key TEXT NOT NULL CHECK (length(definition_key) BETWEEN 1 AND 80),
        definition_hash TEXT NOT NULL CHECK (definition_hash ~ '^[a-f0-9]{64}$'),
        circuit TEXT NOT NULL,
        classification TEXT NOT NULL CHECK (classification IN ('RANKING','QUALIFIER','INVITATIONAL_EXHIBITION','SPECIAL')),
        definition JSONB NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (event_database_version, definition_key)
      )
    `);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_seasons (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        season INTEGER NOT NULL CHECK (season > 0),
        event_database_version INTEGER NOT NULL CHECK (event_database_version > 0),
        calendar_generation_version INTEGER NOT NULL CHECK (calendar_generation_version > 0),
        status TEXT NOT NULL CHECK (status IN ('ACTIVE','COMPLETED')),
        played_week INTEGER NOT NULL DEFAULT 0 CHECK (played_week BETWEEN 0 AND 52),
        developed_week INTEGER NOT NULL DEFAULT 0 CHECK (developed_week BETWEEN 0 AND 52),
        off_season_processed BOOLEAN NOT NULL DEFAULT FALSE,
        instance_count INTEGER NOT NULL CHECK (instance_count > 0),
        calendar_hash TEXT NOT NULL CHECK (calendar_hash ~ '^[a-f0-9]{64}$'),
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        PRIMARY KEY (career_save_id, season),
        CONSTRAINT career_seasons_week_order_check CHECK (developed_week <= played_week AND played_week <= developed_week + 1),
        CONSTRAINT career_seasons_completion_check CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL)
          AND (status <> 'COMPLETED' OR (off_season_processed AND developed_week = 52)))
      )
    `);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_event_instances (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        season INTEGER NOT NULL,
        instance_key TEXT NOT NULL CHECK (length(instance_key) BETWEEN 1 AND 120),
        ordinal INTEGER NOT NULL CHECK (ordinal > 0),
        event_database_version INTEGER NOT NULL,
        definition_key TEXT NOT NULL,
        name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
        family TEXT NOT NULL,
        circuit TEXT NOT NULL CHECK (circuit IN ('GRASSROOTS','COUNTY','REGIONAL','NATIONAL_AMATEUR','CHALLENGER','VAULT','Q_SCHOOL','PRO_CIRCUIT','EUROPEAN_SERIES','WORLD_SERIES','INVITATIONAL','MAJOR','WORLD_CHAMPIONSHIP','SPECIAL')),
        classification TEXT NOT NULL CHECK (classification IN ('RANKING','QUALIFIER','INVITATIONAL_EXHIBITION','SPECIAL')),
        ranking_category TEXT,
        presentation_tier TEXT NOT NULL CHECK (presentation_tier IN ('LOCAL','STANDARD','FEATURED','TELEVISED','MAJOR','WORLD')),
        featured BOOLEAN NOT NULL,
        calendar_priority INTEGER NOT NULL,
        venue_key TEXT NOT NULL, city TEXT NOT NULL, country TEXT NOT NULL CHECK (length(country) BETWEEN 2 AND 3),
        region TEXT NOT NULL, zone TEXT NOT NULL CHECK (zone IN ('UK_IRELAND','EUROPE','REST_OF_WORLD')), locality_key TEXT,
        start_week INTEGER NOT NULL CHECK (start_week BETWEEN 1 AND 52),
        end_week INTEGER NOT NULL CHECK (end_week BETWEEN 1 AND 52),
        start_day INTEGER NOT NULL CHECK (start_day BETWEEN 1 AND 364),
        end_day INTEGER NOT NULL CHECK (end_day BETWEEN 1 AND 364),
        registration_opens_week INTEGER NOT NULL CHECK (registration_opens_week BETWEEN 1 AND 52),
        registration_closes_week INTEGER NOT NULL CHECK (registration_closes_week BETWEEN 1 AND 52),
        field_size INTEGER NOT NULL CHECK (field_size BETWEEN 2 AND 128),
        minimum_entrants INTEGER NOT NULL CHECK (minimum_entrants BETWEEN 2 AND 128),
        executable BOOLEAN NOT NULL,
        series_key TEXT, series_day INTEGER,
        status TEXT NOT NULL CHECK (status IN ('SCHEDULED','REGISTRATION_OPEN','REGISTRATION_CLOSED','DRAW_PENDING','DRAWN','IN_PROGRESS','COMPLETED','CANCELLED')),
        status_reason TEXT,
        entrant_count INTEGER NOT NULL DEFAULT 0 CHECK (entrant_count BETWEEN 0 AND 128),
        champion_participant_key TEXT,
        champion_npc_id UUID,
        snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
        field_locked_at TIMESTAMPTZ, drawn_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
        PRIMARY KEY (career_save_id, id),
        CONSTRAINT career_event_instances_key_unique UNIQUE (career_save_id, season, instance_key),
        FOREIGN KEY (career_save_id, season) REFERENCES career_seasons(career_save_id, season) ON DELETE CASCADE,
        FOREIGN KEY (event_database_version, definition_key) REFERENCES career_event_definitions(event_database_version, definition_key),
        FOREIGN KEY (career_save_id, champion_npc_id) REFERENCES career_world_players(career_save_id, id),
        CONSTRAINT career_event_instances_window_check CHECK (start_week <= end_week AND start_day <= end_day
          AND registration_opens_week <= registration_closes_week AND registration_closes_week = start_week),
        CONSTRAINT career_event_instances_special_check CHECK ((classification = 'SPECIAL') = (circuit = 'SPECIAL')
          AND (classification <> 'SPECIAL' OR ranking_category IS NULL)
          AND (classification = 'RANKING') = (ranking_category IS NOT NULL)),
        CONSTRAINT career_event_instances_champion_check CHECK ((champion_participant_key IS NOT NULL) = (status = 'COMPLETED')
          AND (champion_npc_id IS NULL OR champion_participant_key = champion_npc_id::text)),
        CONSTRAINT career_event_instances_unsupported_check CHECK (executable OR status <> 'COMPLETED')
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_event_instances_week_idx ON career_event_instances(career_save_id, season, start_week)`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_event_instances_status_idx ON career_event_instances(career_save_id, season, status)`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_event_instances_definition_idx ON career_event_instances(career_save_id, definition_key, season)`);
    // Completed/cancelled history is immutable. Deletion stays possible only via the save cascade.
    await tx.execute(sql`
      CREATE OR REPLACE FUNCTION career_reject_finished_event_update() RETURNS trigger AS $$
      BEGIN
        IF OLD.status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'Career event % is historical and immutable', OLD.id; END IF;
        IF NEW.status <> OLD.status AND NOT (
          (OLD.status = 'SCHEDULED' AND NEW.status IN ('REGISTRATION_OPEN','CANCELLED')) OR
          (OLD.status = 'REGISTRATION_OPEN' AND NEW.status IN ('REGISTRATION_CLOSED','CANCELLED')) OR
          (OLD.status = 'REGISTRATION_CLOSED' AND NEW.status IN ('DRAW_PENDING','CANCELLED')) OR
          (OLD.status = 'DRAW_PENDING' AND NEW.status IN ('DRAWN','CANCELLED')) OR
          (OLD.status = 'DRAWN' AND NEW.status IN ('IN_PROGRESS','CANCELLED')) OR
          (OLD.status = 'IN_PROGRESS' AND NEW.status = 'COMPLETED')) THEN
          RAISE EXCEPTION 'Invalid Career event transition % -> %', OLD.status, NEW.status;
        END IF;
        IF NEW.snapshot->'resolvedFrom' IS DISTINCT FROM OLD.snapshot->'resolvedFrom' OR NEW.definition_key <> OLD.definition_key
          OR NEW.event_database_version <> OLD.event_database_version OR NEW.start_day <> OLD.start_day OR NEW.end_day <> OLD.end_day THEN
          RAISE EXCEPTION 'Career event identity/schedule is immutable';
        END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql
    `);
    await tx.execute(sql`DROP TRIGGER IF EXISTS career_event_instances_history_guard ON career_event_instances`);
    await tx.execute(sql`CREATE TRIGGER career_event_instances_history_guard BEFORE UPDATE ON career_event_instances FOR EACH ROW EXECUTE FUNCTION career_reject_finished_event_update()`);

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_event_entries (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        event_id UUID NOT NULL,
        participant_key TEXT NOT NULL,
        participant_kind TEXT NOT NULL CHECK (participant_kind IN ('HUMAN','NPC')),
        npc_id UUID,
        source TEXT NOT NULL CHECK (source IN ('HUMAN_ENTRY','SELECTION','ENTITLEMENT','INVITATION','SERIES')),
        entitlement_id UUID,
        status TEXT NOT NULL CHECK (status IN ('ENTERED','CONFIRMED','WITHDRAWN')),
        draw_seed INTEGER,
        entered_season INTEGER NOT NULL, entered_week INTEGER NOT NULL CHECK (entered_week BETWEEN 1 AND 52),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), withdrawn_at TIMESTAMPTZ,
        PRIMARY KEY (career_save_id, event_id, participant_key),
        FOREIGN KEY (career_save_id, event_id) REFERENCES career_event_instances(career_save_id, id) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, npc_id) REFERENCES career_world_players(career_save_id, id),
        CONSTRAINT career_event_entries_participant_check CHECK (
          (participant_kind = 'HUMAN' AND npc_id IS NULL AND participant_key = 'HUMAN')
          OR (participant_kind = 'NPC' AND npc_id IS NOT NULL AND participant_key = npc_id::text)),
        CONSTRAINT career_event_entries_withdrawn_check CHECK ((status = 'WITHDRAWN') = (withdrawn_at IS NOT NULL))
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_event_entries_participant_idx ON career_event_entries(career_save_id, participant_key, status)`);
    // One row per participant per occupied day: a hard database guarantee against double-booking.
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_participant_bookings (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        season INTEGER NOT NULL,
        participant_key TEXT NOT NULL,
        day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 364),
        event_id UUID NOT NULL,
        PRIMARY KEY (career_save_id, season, participant_key, day),
        FOREIGN KEY (career_save_id, event_id) REFERENCES career_event_instances(career_save_id, id) ON DELETE CASCADE
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_participant_bookings_event_idx ON career_participant_bookings(career_save_id, event_id)`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_tournament_matches (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        event_id UUID NOT NULL,
        stage_key TEXT NOT NULL,
        round INTEGER NOT NULL CHECK (round BETWEEN 1 AND 8),
        slot INTEGER NOT NULL CHECK (slot >= 1),
        best_of INTEGER NOT NULL CHECK (best_of BETWEEN 1 AND 101 AND best_of % 2 = 1),
        scheduled_day INTEGER NOT NULL CHECK (scheduled_day BETWEEN 1 AND 364),
        a_key TEXT, b_key TEXT, a_npc_id UUID, b_npc_id UUID,
        status TEXT NOT NULL CHECK (status IN ('PENDING','READY','AWAITING_HUMAN','COMPLETED','BYE','WALKOVER')),
        winner_key TEXT,
        legs_a INTEGER CHECK (legs_a >= 0), legs_b INTEGER CHECK (legs_b >= 0),
        first_throw INTEGER CHECK (first_throw IN (0,1)),
        first_throw_method TEXT NOT NULL,
        first_throw_detail JSONB,
        result_source TEXT CHECK (result_source IN ('A2_SIMULATION','HUMAN_LIVE','BYE','WALKOVER')),
        simulated_match_key TEXT,
        summary JSONB,
        completed_at TIMESTAMPTZ,
        PRIMARY KEY (career_save_id, id),
        CONSTRAINT career_tournament_matches_slot_unique UNIQUE (career_save_id, event_id, stage_key, round, slot),
        FOREIGN KEY (career_save_id, event_id) REFERENCES career_event_instances(career_save_id, id) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, a_npc_id) REFERENCES career_world_players(career_save_id, id),
        FOREIGN KEY (career_save_id, b_npc_id) REFERENCES career_world_players(career_save_id, id),
        FOREIGN KEY (career_save_id, simulated_match_key) REFERENCES career_simulated_matches(career_save_id, match_key),
        CONSTRAINT career_tournament_matches_result_check CHECK (
          (status IN ('COMPLETED','BYE','WALKOVER')) = (winner_key IS NOT NULL)
          AND (winner_key IS NULL OR winner_key IN (a_key, b_key))
          AND (status <> 'COMPLETED' OR (a_key IS NOT NULL AND b_key IS NOT NULL AND a_key <> b_key AND legs_a IS NOT NULL AND legs_b IS NOT NULL))
          AND (result_source <> 'A2_SIMULATION' OR simulated_match_key IS NOT NULL))
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_tournament_matches_pending_idx ON career_tournament_matches(career_save_id, status, scheduled_day)`);
    await tx.execute(sql`
      CREATE OR REPLACE FUNCTION career_reject_finished_match_update() RETURNS trigger AS $$
      BEGIN
        IF OLD.status IN ('COMPLETED','BYE','WALKOVER') THEN RAISE EXCEPTION 'Career match % is final', OLD.id; END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql
    `);
    await tx.execute(sql`DROP TRIGGER IF EXISTS career_tournament_matches_final_guard ON career_tournament_matches`);
    await tx.execute(sql`CREATE TRIGGER career_tournament_matches_final_guard BEFORE UPDATE ON career_tournament_matches FOR EACH ROW EXECUTE FUNCTION career_reject_finished_match_update()`);

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_event_results (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        event_id UUID NOT NULL,
        participant_key TEXT NOT NULL,
        participant_kind TEXT NOT NULL CHECK (participant_kind IN ('HUMAN','NPC')),
        npc_id UUID,
        season INTEGER NOT NULL,
        definition_key TEXT NOT NULL,
        finishing_position INTEGER NOT NULL CHECK (finishing_position >= 1),
        stage_reached TEXT NOT NULL,
        is_champion BOOLEAN NOT NULL,
        matches_played INTEGER NOT NULL CHECK (matches_played >= 0),
        wins INTEGER NOT NULL CHECK (wins >= 0), losses INTEGER NOT NULL CHECK (losses >= 0),
        legs_for INTEGER NOT NULL CHECK (legs_for >= 0), legs_against INTEGER NOT NULL CHECK (legs_against >= 0),
        metadata JSONB NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, event_id, participant_key),
        FOREIGN KEY (career_save_id, event_id, participant_key) REFERENCES career_event_entries(career_save_id, event_id, participant_key) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, npc_id) REFERENCES career_world_players(career_save_id, id),
        CONSTRAINT career_event_results_champion_check CHECK (is_champion = (finishing_position = 1) AND (NOT is_champion OR losses = 0))
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_event_results_participant_idx ON career_event_results(career_save_id, participant_key, season)`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_event_results_definition_idx ON career_event_results(career_save_id, definition_key, season, finishing_position)`);
    await tx.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS career_event_results_one_champion ON career_event_results(career_save_id, event_id) WHERE is_champion`);
    await tx.execute(sql`
      CREATE OR REPLACE FUNCTION career_reject_result_update() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'Career event results are permanent history'; END; $$ LANGUAGE plpgsql
    `);
    await tx.execute(sql`DROP TRIGGER IF EXISTS career_event_results_history_guard ON career_event_results`);
    await tx.execute(sql`CREATE TRIGGER career_event_results_history_guard BEFORE UPDATE ON career_event_results FOR EACH ROW EXECUTE FUNCTION career_reject_result_update()`);

    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_qualification_entitlements (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 200),
        recipient_key TEXT NOT NULL,
        recipient_kind TEXT NOT NULL CHECK (recipient_kind IN ('HUMAN','NPC')),
        npc_id UUID,
        entitlement_type TEXT NOT NULL CHECK (entitlement_type IN ('EVENT_ENTRY','STAGE_ENTRY','SERIES_ACCESS')),
        source_kind TEXT NOT NULL CHECK (source_kind IN ('EVENT_RESULT','PROVIDER')),
        source_event_id UUID,
        source_position INTEGER,
        source_detail JSONB NOT NULL CHECK (jsonb_typeof(source_detail) = 'object'),
        awarded_season INTEGER NOT NULL CHECK (awarded_season > 0),
        target_key TEXT NOT NULL,
        target_season INTEGER NOT NULL CHECK (target_season > 0),
        consumption TEXT NOT NULL CHECK (consumption IN ('SINGLE_USE','SEASON_PASS')),
        status TEXT NOT NULL CHECK (status IN ('ACTIVE','CONSUMED','EXPIRED')),
        consumed_by_event_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), resolved_at TIMESTAMPTZ,
        PRIMARY KEY (career_save_id, id),
        CONSTRAINT career_qualification_entitlements_idempotency_unique UNIQUE (career_save_id, idempotency_key),
        FOREIGN KEY (career_save_id, source_event_id) REFERENCES career_event_instances(career_save_id, id) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, consumed_by_event_id) REFERENCES career_event_instances(career_save_id, id) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, npc_id) REFERENCES career_world_players(career_save_id, id),
        CONSTRAINT career_qualification_entitlements_recipient_check CHECK (
          (recipient_kind = 'HUMAN' AND npc_id IS NULL AND recipient_key = 'HUMAN')
          OR (recipient_kind = 'NPC' AND npc_id IS NOT NULL AND recipient_key = npc_id::text)),
        CONSTRAINT career_qualification_entitlements_source_check CHECK ((source_kind = 'EVENT_RESULT') = (source_event_id IS NOT NULL)),
        CONSTRAINT career_qualification_entitlements_state_check CHECK (
          (status = 'CONSUMED') = (consumed_by_event_id IS NOT NULL) AND (status = 'ACTIVE') = (resolved_at IS NULL)
          AND (status <> 'CONSUMED' OR consumption = 'SINGLE_USE'))
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_qualification_entitlements_target_idx ON career_qualification_entitlements(career_save_id, target_season, target_key, status)`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_qualification_entitlements_recipient_idx ON career_qualification_entitlements(career_save_id, recipient_key, status)`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_calendar_operations (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        operation_key TEXT NOT NULL CHECK (length(operation_key) BETWEEN 1 AND 120),
        request JSONB NOT NULL CHECK (jsonb_typeof(request) = 'object'),
        result JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), completed_at TIMESTAMPTZ,
        PRIMARY KEY (career_save_id, operation_key)
      )
    `);
    await syncEventDefinitions(tx);
  });
}

/** Insert shipped definitions; a changed definition under an existing version is refused. */
export async function syncEventDefinitions(tx: CareerExecutor): Promise<void> {
  for (const version of SUPPORTED_EVENT_DATABASE_VERSIONS) {
    const definitions = catalogueFor(version).map(definition => ({ definition_key: definition.key, definition_hash: definitionHash(definition),
      circuit: definition.circuit, classification: definition.classification, definition }));
    const existing = new Map((await tx.execute(sql`SELECT definition_key, definition_hash FROM career_event_definitions WHERE event_database_version = ${version}`)).rows
      .map(row => [String(row.definition_key), String(row.definition_hash)]));
    for (const row of definitions) {
      const hash = existing.get(row.definition_key);
      if (hash && hash !== row.definition_hash) throw new Error(`Career event definition ${row.definition_key} changed inside shipped database version ${version}; publish a new version`);
    }
    await tx.execute(sql`
      INSERT INTO career_event_definitions (event_database_version, definition_key, definition_hash, circuit, classification, definition)
      SELECT ${version}, d.definition_key, d.definition_hash, d.circuit, d.classification, d.definition
      FROM jsonb_to_recordset(${JSON.stringify(definitions)}::jsonb) AS d(definition_key text, definition_hash text, circuit text, classification text, definition jsonb)
      ON CONFLICT (event_database_version, definition_key) DO NOTHING
    `);
  }
}
