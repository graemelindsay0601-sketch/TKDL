import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";

/** Additive A2/v1 schema. No existing save versions/seeds or Tour data are rewritten. */
export async function createCareerWorld(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_world_state (
        career_save_id UUID PRIMARY KEY REFERENCES career_saves(id) ON DELETE CASCADE,
        generation_version INTEGER NOT NULL CHECK (generation_version > 0),
        simulation_version INTEGER NOT NULL CHECK (simulation_version > 0),
        season INTEGER NOT NULL CHECK (season > 0),
        period INTEGER NOT NULL CHECK (period >= 0),
        elapsed_year DOUBLE PRECISION NOT NULL CHECK (elapsed_year BETWEEN 0 AND 1),
        config_snapshot JSONB NOT NULL CHECK (jsonb_typeof(config_snapshot) = 'object'),
        initialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_world_players (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        world_key TEXT NOT NULL,
        first_name TEXT NOT NULL CHECK (length(first_name) BETWEEN 1 AND 80),
        surname TEXT NOT NULL CHECK (length(surname) BETWEEN 1 AND 160),
        nickname TEXT,
        nationality TEXT NOT NULL CHECK (length(nationality) BETWEEN 2 AND 3),
        home_region TEXT NOT NULL,
        dominant_hand TEXT NOT NULL CHECK (dominant_hand IN ('RIGHT', 'LEFT')),
        starting_age INTEGER NOT NULL CHECK (starting_age BETWEEN 16 AND 110),
        age INTEGER NOT NULL CHECK (age BETWEEN 16 AND 110),
        stage TEXT NOT NULL CHECK (stage IN ('PROSPECT', 'DEVELOPING', 'PRIME', 'VETERAN', 'RETIRED')),
        tier TEXT NOT NULL CHECK (tier IN ('GRASSROOTS', 'AMATEUR', 'PROFESSIONAL', 'ELITE')),
        professional_status TEXT NOT NULL CHECK (professional_status IN ('AMATEUR', 'PROFESSIONAL')),
        detail_tier TEXT NOT NULL CHECK (detail_tier IN ('BASIC', 'STANDARD', 'FEATURED')),
        template_key TEXT,
        status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'RETIRED')),
        created_season INTEGER NOT NULL CHECK (created_season > 0),
        retired_season INTEGER,
        scoring DOUBLE PRECISION NOT NULL CHECK (scoring BETWEEN 1 AND 100),
        finishing DOUBLE PRECISION NOT NULL CHECK (finishing BETWEEN 1 AND 100),
        consistency DOUBLE PRECISION NOT NULL CHECK (consistency BETWEEN 1 AND 100),
        pressure DOUBLE PRECISION NOT NULL CHECK (pressure BETWEEN 1 AND 100),
        power_scoring DOUBLE PRECISION NOT NULL CHECK (power_scoring BETWEEN 1 AND 100),
        clutch DOUBLE PRECISION NOT NULL CHECK (clutch BETWEEN 1 AND 100),
        form DOUBLE PRECISION NOT NULL CHECK (form BETWEEN -1 AND 1),
        potential DOUBLE PRECISION NOT NULL CHECK (potential BETWEEN 1 AND 100),
        development_rate DOUBLE PRECISION NOT NULL CHECK (development_rate BETWEEN 0 AND 10),
        development_volatility DOUBLE PRECISION NOT NULL CHECK (development_volatility BETWEEN 0 AND 5),
        peak_start INTEGER NOT NULL CHECK (peak_start BETWEEN 18 AND 70),
        peak_end INTEGER NOT NULL CHECK (peak_end BETWEEN 18 AND 80 AND peak_end >= peak_start),
        breakthrough_age INTEGER NOT NULL CHECK (breakthrough_age BETWEEN 16 AND 70),
        decline_profile TEXT NOT NULL CHECK (decline_profile IN ('GRADUAL', 'PLATEAU', 'SHARP', 'EARLY')),
        low_ability_years DOUBLE PRECISION NOT NULL CHECK (low_ability_years BETWEEN 0 AND 110),
        recent_development DOUBLE PRECISION NOT NULL CHECK (recent_development BETWEEN -100 AND 100),
        tendencies JSONB NOT NULL,
        PRIMARY KEY (career_save_id, id),
        CONSTRAINT career_world_players_identity_unique UNIQUE (career_save_id, world_key),
        CONSTRAINT career_world_players_retirement_check CHECK (
          (status = 'RETIRED') = (retired_season IS NOT NULL)
          AND (status = 'RETIRED') = (stage = 'RETIRED')
          AND (retired_season IS NULL OR retired_season >= created_season)),
        CONSTRAINT career_world_players_tendencies_check CHECK (
          COALESCE(jsonb_typeof(tendencies) = 'object' AND tendencies ?& ARRAY['local','floor','stage','qualifier','major']
          AND jsonb_typeof(tendencies->'local') = 'number' AND (tendencies->>'local')::double precision BETWEEN -2 AND 2
          AND jsonb_typeof(tendencies->'floor') = 'number' AND (tendencies->>'floor')::double precision BETWEEN -2 AND 2
          AND jsonb_typeof(tendencies->'stage') = 'number' AND (tendencies->>'stage')::double precision BETWEEN -2 AND 2
          AND jsonb_typeof(tendencies->'qualifier') = 'number' AND (tendencies->>'qualifier')::double precision BETWEEN -2 AND 2
          AND jsonb_typeof(tendencies->'major') = 'number' AND (tendencies->>'major')::double precision BETWEEN -2 AND 2, false))
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_world_players_active_tier_idx ON career_world_players(career_save_id, status, tier)`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_world_periods (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        season INTEGER NOT NULL CHECK (season > 0),
        kind TEXT NOT NULL CHECK (kind IN ('PERIOD', 'OFF_SEASON')),
        sequence INTEGER NOT NULL CHECK (sequence >= 0),
        request JSONB NOT NULL CHECK (jsonb_typeof(request) = 'object'),
        summary JSONB NOT NULL CHECK (jsonb_typeof(summary) = 'object'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, season, kind, sequence)
      )
    `);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_simulated_matches (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        match_key TEXT NOT NULL CHECK (length(match_key) BETWEEN 1 AND 120),
        season INTEGER NOT NULL CHECK (season > 0),
        period INTEGER NOT NULL CHECK (period >= 0),
        simulation_version INTEGER NOT NULL CHECK (simulation_version > 0),
        player_a_id UUID NOT NULL,
        player_b_id UUID NOT NULL,
        winner_id UUID NOT NULL,
        request JSONB NOT NULL CHECK (jsonb_typeof(request) = 'object'),
        input_snapshot JSONB NOT NULL CHECK (jsonb_typeof(input_snapshot) = 'object'),
        result JSONB NOT NULL CHECK (jsonb_typeof(result) = 'object'),
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, id),
        CONSTRAINT career_simulated_matches_key_unique UNIQUE (career_save_id, match_key),
        CONSTRAINT career_simulated_matches_participants_check CHECK (player_a_id <> player_b_id AND winner_id IN (player_a_id, player_b_id)),
        FOREIGN KEY (career_save_id, player_a_id) REFERENCES career_world_players(career_save_id, id) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, player_b_id) REFERENCES career_world_players(career_save_id, id) ON DELETE CASCADE
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_simulated_matches_a_idx ON career_simulated_matches(career_save_id, player_a_id, completed_at)`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_simulated_matches_b_idx ON career_simulated_matches(career_save_id, player_b_id, completed_at)`);
  });
}
