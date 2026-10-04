import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";

/**
 * Additive A5 schema: rankings, Tour Cards, Q-School and sporting milestones.
 * Every table is save-scoped and cascades from career_saves (restart/delete).
 * Evidence is immutable: ranking contributions reference the A3 result they come
 * from, snapshots are append-only, Q-School points reference A3 results, card
 * awards reference their allocation. The only mutable rows are a Tour Card's
 * status/end fields (guarded) and the ranking-participant cache, which is fully
 * derivable from snapshots. A5 stores no money and no duplicate of A3 results.
 */
export async function createCareerSporting(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    await tx.execute(sql`
      CREATE OR REPLACE FUNCTION career_sporting_reject_update() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'Career sporting evidence is immutable'; END; $$ LANGUAGE plpgsql
    `);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_sporting_state (
        career_save_id UUID PRIMARY KEY REFERENCES career_saves(id) ON DELETE CASCADE,
        ranking_rules_version INTEGER NOT NULL,
        tour_card_rules_version INTEGER NOT NULL,
        q_school_rules_version INTEGER NOT NULL,
        force_publish BOOLEAN NOT NULL DEFAULT FALSE,
        reviewed_season INTEGER NOT NULL DEFAULT 0,
        initialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ---------------------------------------------------------------- rankings
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_ranking_contributions (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        list_key TEXT NOT NULL,
        participant_key TEXT NOT NULL,
        participant_kind TEXT NOT NULL CHECK (participant_kind IN ('HUMAN','NPC')),
        npc_id UUID,
        event_id UUID NOT NULL,
        season INTEGER NOT NULL,
        week INTEGER NOT NULL CHECK (week BETWEEN 1 AND 52),
        completion_index INTEGER NOT NULL CHECK (completion_index >= 1),
        expires_index INTEGER NOT NULL,
        finishing_position INTEGER NOT NULL CHECK (finishing_position >= 1),
        amount_pence BIGINT NOT NULL CHECK (amount_pence > 0),
        source TEXT NOT NULL CHECK (source IN ('A4_PRIZE_AWARD','A4_PRIZE_TABLE')),
        ranking_category TEXT NOT NULL,
        ranking_rules_version INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, id),
        CONSTRAINT career_ranking_contributions_once UNIQUE (career_save_id, list_key, event_id, participant_key),
        CONSTRAINT career_ranking_contributions_window CHECK (expires_index > completion_index),
        CONSTRAINT career_ranking_contributions_kind CHECK ((participant_kind = 'HUMAN') = (participant_key = 'HUMAN') AND ((participant_kind = 'NPC') = (npc_id IS NOT NULL))),
        FOREIGN KEY (career_save_id, event_id, participant_key) REFERENCES career_event_results(career_save_id, event_id, participant_key) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, event_id) REFERENCES career_event_prize_tables(career_save_id, event_id) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, npc_id) REFERENCES career_world_players(career_save_id, id)
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_ranking_contributions_window_idx ON career_ranking_contributions(career_save_id, list_key, completion_index, expires_index)`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_ranking_contributions_participant_idx ON career_ranking_contributions(career_save_id, list_key, participant_key, completion_index)`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_ranking_snapshots (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        list_key TEXT NOT NULL,
        sequence INTEGER NOT NULL CHECK (sequence >= 1),
        season INTEGER NOT NULL,
        week INTEGER NOT NULL CHECK (week BETWEEN 1 AND 52),
        publication_index INTEGER NOT NULL,
        ranking_rules_version INTEGER NOT NULL,
        participant_count INTEGER NOT NULL CHECK (participant_count >= 0),
        counted_contributions INTEGER NOT NULL,
        new_contributions INTEGER NOT NULL,
        expired_contributions INTEGER NOT NULL,
        removed_retired INTEGER NOT NULL DEFAULT 0,
        cut_values JSONB NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, id),
        CONSTRAINT career_ranking_snapshots_publication UNIQUE (career_save_id, list_key, publication_index),
        CONSTRAINT career_ranking_snapshots_sequence UNIQUE (career_save_id, list_key, sequence)
      )
    `);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_ranking_snapshot_rows (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        snapshot_id UUID NOT NULL,
        list_key TEXT NOT NULL,
        publication_index INTEGER NOT NULL,
        season INTEGER NOT NULL,
        participant_key TEXT NOT NULL,
        participant_kind TEXT NOT NULL CHECK (participant_kind IN ('HUMAN','NPC')),
        npc_id UUID,
        position INTEGER NOT NULL CHECK (position >= 1),
        value_pence BIGINT NOT NULL CHECK (value_pence > 0),
        previous_position INTEGER,
        movement INTEGER,
        is_new BOOLEAN NOT NULL,
        gap_above_pence BIGINT,
        gap_below_pence BIGINT,
        career_high_position INTEGER NOT NULL,
        counted_contributions INTEGER NOT NULL CHECK (counted_contributions >= 1),
        PRIMARY KEY (career_save_id, snapshot_id, participant_key),
        CONSTRAINT career_ranking_snapshot_rows_position UNIQUE (career_save_id, snapshot_id, position),
        FOREIGN KEY (career_save_id, snapshot_id) REFERENCES career_ranking_snapshots(career_save_id, id) ON DELETE CASCADE
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_ranking_snapshot_rows_history_idx ON career_ranking_snapshot_rows(career_save_id, list_key, participant_key, publication_index)`);
    // Derivable cache of the latest published state per participant (current table, movement, career high).
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_ranking_participants (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        list_key TEXT NOT NULL,
        participant_key TEXT NOT NULL,
        participant_kind TEXT NOT NULL,
        npc_id UUID,
        current_position INTEGER,
        current_value_pence BIGINT NOT NULL DEFAULT 0,
        previous_position INTEGER,
        career_high_position INTEGER NOT NULL,
        career_high_index INTEGER NOT NULL,
        first_ranked_index INTEGER NOT NULL,
        updated_index INTEGER NOT NULL,
        PRIMARY KEY (career_save_id, list_key, participant_key)
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_ranking_participants_position ON career_ranking_participants(career_save_id, list_key, current_position) WHERE current_position IS NOT NULL`);

    // ---------------------------------------------------------------- Tour Cards
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_tour_cards (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        operation_key TEXT NOT NULL,
        participant_key TEXT NOT NULL,
        participant_kind TEXT NOT NULL CHECK (participant_kind IN ('HUMAN','NPC')),
        npc_id UUID,
        source TEXT NOT NULL CHECK (source IN ('FOUNDING','Q_SCHOOL_DIRECT','Q_SCHOOL_ORDER_OF_MERIT','RANKING_RETENTION','CHALLENGER_RANKING')),
        source_detail JSONB NOT NULL,
        source_event_id UUID,
        awarded_season INTEGER NOT NULL,
        awarded_week INTEGER NOT NULL,
        start_season INTEGER NOT NULL,
        end_season INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('ACTIVE','EXPIRED','LOST','SURRENDERED')),
        end_reason TEXT,
        ended_season INTEGER,
        ended_week INTEGER,
        previous_card_id UUID,
        tour_card_rules_version INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, id),
        CONSTRAINT career_tour_cards_operation UNIQUE (career_save_id, operation_key),
        CONSTRAINT career_tour_cards_term CHECK (end_season >= start_season AND start_season >= awarded_season),
        CONSTRAINT career_tour_cards_end CHECK ((status = 'ACTIVE') = (end_reason IS NULL) AND (status = 'ACTIVE') = (ended_season IS NULL)),
        CONSTRAINT career_tour_cards_kind CHECK ((participant_kind = 'HUMAN') = (participant_key = 'HUMAN') AND ((participant_kind = 'NPC') = (npc_id IS NOT NULL))),
        FOREIGN KEY (career_save_id, npc_id) REFERENCES career_world_players(career_save_id, id),
        FOREIGN KEY (career_save_id, previous_card_id) REFERENCES career_tour_cards(career_save_id, id)
      )
    `);
    // A participant can never hold two live cards.
    await tx.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS career_tour_cards_one_active ON career_tour_cards(career_save_id, participant_key) WHERE status = 'ACTIVE'`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_tour_cards_participant_idx ON career_tour_cards(career_save_id, participant_key, start_season)`);
    await tx.execute(sql`
      CREATE OR REPLACE FUNCTION career_tour_card_guard() RETURNS trigger AS $$
      BEGIN
        IF OLD.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Ended Tour Cards are history'; END IF;
        IF NEW.participant_key <> OLD.participant_key OR NEW.source <> OLD.source OR NEW.start_season <> OLD.start_season OR NEW.end_season <> OLD.end_season
          OR NEW.awarded_season <> OLD.awarded_season OR NEW.source_detail IS DISTINCT FROM OLD.source_detail OR NEW.operation_key <> OLD.operation_key
          OR NEW.tour_card_rules_version <> OLD.tour_card_rules_version THEN RAISE EXCEPTION 'Tour Card terms are immutable'; END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql
    `);
    await tx.execute(sql`DROP TRIGGER IF EXISTS career_tour_cards_guard ON career_tour_cards`);
    await tx.execute(sql`CREATE TRIGGER career_tour_cards_guard BEFORE UPDATE ON career_tour_cards FOR EACH ROW EXECUTE FUNCTION career_tour_card_guard()`);

    // ---------------------------------------------------------------- Q-School
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_qschool_results (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        event_id UUID NOT NULL,
        participant_key TEXT NOT NULL,
        participant_kind TEXT NOT NULL CHECK (participant_kind IN ('HUMAN','NPC')),
        npc_id UUID,
        season INTEGER NOT NULL,
        pathway TEXT NOT NULL CHECK (pathway IN ('UK_IRELAND','EUROPE')),
        stage TEXT NOT NULL CHECK (stage IN ('FIRST','FINAL')),
        series_day INTEGER NOT NULL,
        finishing_position INTEGER NOT NULL,
        points INTEGER NOT NULL CHECK (points >= 0),
        legs_for INTEGER NOT NULL,
        legs_against INTEGER NOT NULL,
        q_school_rules_version INTEGER NOT NULL,
        PRIMARY KEY (career_save_id, event_id, participant_key),
        FOREIGN KEY (career_save_id, event_id, participant_key) REFERENCES career_event_results(career_save_id, event_id, participant_key) ON DELETE CASCADE
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_qschool_results_standing_idx ON career_qschool_results(career_save_id, season, pathway, stage, participant_key)`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_qschool_allocations (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        season INTEGER NOT NULL,
        pathway TEXT NOT NULL CHECK (pathway IN ('UK_IRELAND','EUROPE')),
        allocated_week INTEGER NOT NULL,
        final_days INTEGER NOT NULL,
        completed_days INTEGER NOT NULL,
        direct_cards INTEGER NOT NULL,
        unused_direct_cards INTEGER NOT NULL,
        order_of_merit_cards INTEGER NOT NULL,
        standings JSONB NOT NULL,
        q_school_rules_version INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, season, pathway)
      )
    `);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_qschool_card_awards (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        season INTEGER NOT NULL,
        pathway TEXT NOT NULL,
        participant_key TEXT NOT NULL,
        route TEXT NOT NULL CHECK (route IN ('DIRECT','ORDER_OF_MERIT')),
        series_day INTEGER,
        order_of_merit_position INTEGER,
        points INTEGER NOT NULL,
        card_id UUID NOT NULL,
        PRIMARY KEY (career_save_id, season, participant_key),
        CONSTRAINT career_qschool_card_awards_card UNIQUE (career_save_id, card_id),
        CONSTRAINT career_qschool_card_awards_route CHECK ((route = 'DIRECT') = (series_day IS NOT NULL) AND (route = 'ORDER_OF_MERIT') = (order_of_merit_position IS NOT NULL)),
        FOREIGN KEY (career_save_id, season, pathway) REFERENCES career_qschool_allocations(career_save_id, season, pathway) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, card_id) REFERENCES career_tour_cards(career_save_id, id) ON DELETE CASCADE
      )
    `);

    // ---------------------------------------------------------------- milestones (facts, not prose)
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_sporting_milestones (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        operation_key TEXT NOT NULL,
        participant_key TEXT NOT NULL,
        participant_kind TEXT NOT NULL CHECK (participant_kind IN ('HUMAN','NPC')),
        npc_id UUID,
        kind TEXT NOT NULL,
        list_key TEXT,
        season INTEGER NOT NULL,
        week INTEGER NOT NULL,
        detail JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, id),
        CONSTRAINT career_sporting_milestones_operation UNIQUE (career_save_id, operation_key)
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_sporting_milestones_participant_idx ON career_sporting_milestones(career_save_id, participant_key, season, week)`);

    for (const table of ["career_ranking_contributions", "career_ranking_snapshots", "career_ranking_snapshot_rows", "career_qschool_results",
      "career_qschool_allocations", "career_qschool_card_awards", "career_sporting_milestones"]) {
      await tx.execute(sql`DROP TRIGGER IF EXISTS ${sql.raw(`${table}_immutable`)} ON ${sql.raw(table)}`);
      await tx.execute(sql`CREATE TRIGGER ${sql.raw(`${table}_immutable`)} BEFORE UPDATE ON ${sql.raw(table)} FOR EACH ROW EXECUTE FUNCTION career_sporting_reject_update()`);
    }
  });
}
