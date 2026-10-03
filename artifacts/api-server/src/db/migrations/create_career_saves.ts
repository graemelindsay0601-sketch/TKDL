import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";

/** Immutable A1 migration. Do not import mutable balancing/version constants. */
export async function createCareerSaves(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_saves (
        id UUID PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        slot_number INTEGER NOT NULL,
        career_name TEXT,
        status TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        current_season INTEGER NOT NULL,
        current_week INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        retired_at TIMESTAMPTZ,
        career_schema_version INTEGER NOT NULL,
        world_generation_version INTEGER NOT NULL,
        event_database_version INTEGER NOT NULL,
        player_database_version INTEGER NOT NULL,
        world_seed TEXT NOT NULL,
        settings_snapshot JSONB NOT NULL,
        balance_pence INTEGER NOT NULL,
        standing TEXT NOT NULL,
        professional_ranking INTEGER,
        professional_ranking_money_pence INTEGER NOT NULL,
        sponsor TEXT,
        has_tour_card BOOLEAN NOT NULL,
        CONSTRAINT career_saves_slot_check CHECK (slot_number BETWEEN 1 AND 3),
        CONSTRAINT career_saves_status_check CHECK (status IN ('ACTIVE', 'RETIRED')),
        CONSTRAINT career_saves_difficulty_check CHECK (difficulty IN ('ACCESSIBLE', 'STANDARD', 'CHALLENGING')),
        CONSTRAINT career_saves_name_check CHECK (career_name IS NULL OR char_length(btrim(career_name)) BETWEEN 1 AND 80),
        CONSTRAINT career_saves_time_check CHECK (current_season > 0 AND current_week > 0),
        CONSTRAINT career_saves_retired_check CHECK ((status = 'RETIRED') = (retired_at IS NOT NULL)),
        CONSTRAINT career_saves_versions_check CHECK (
          career_schema_version > 0 AND world_generation_version > 0
          AND event_database_version > 0 AND player_database_version > 0),
        CONSTRAINT career_saves_seed_check CHECK (world_seed ~ '^[0-9a-f]{64}$'),
        CONSTRAINT career_saves_settings_check CHECK (jsonb_typeof(settings_snapshot) = 'object'),
        CONSTRAINT career_saves_ranking_check CHECK (professional_ranking IS NULL OR professional_ranking > 0),
        CONSTRAINT career_saves_ranking_money_check CHECK (professional_ranking_money_pence >= 0)
      )
    `);
    await tx.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS career_saves_active_slot_unique
      ON career_saves (player_id, slot_number) WHERE status = 'ACTIVE'
    `);
    await tx.execute(sql`
      CREATE INDEX IF NOT EXISTS career_saves_player_status_idx ON career_saves (player_id, status)
    `);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_finance_entries (
        id UUID PRIMARY KEY,
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        amount_pence INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await tx.execute(sql`
      CREATE INDEX IF NOT EXISTS career_finance_entries_save_idx ON career_finance_entries (career_save_id)
    `);
    await tx.execute(sql`
      INSERT INTO feature_flags (feature_name, enabled, admin_test_mode, description)
      VALUES ('tour_career_2', false, false, 'Tour Career 2.0 foundation - enable admin test mode for development')
      ON CONFLICT (feature_name) DO NOTHING
    `);
  });
}
