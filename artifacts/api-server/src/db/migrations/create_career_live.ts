import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";

/**
 * A6.5 additive Career schema. Idempotent (IF NOT EXISTS); invoked at the end of the
 * A1 (profiles) and A3 (match sessions) migrations so every environment that has
 * those tables also has these. Nothing existing is altered.
 */

/** Career identity: save-scoped, never the user's main TKDL profile. */
export async function ensureCareerProfileSchema(tx: CareerExecutor): Promise<void> {
  await tx.execute(sql`
    CREATE TABLE IF NOT EXISTS career_profiles (
      career_save_id UUID PRIMARY KEY REFERENCES career_saves(id) ON DELETE CASCADE,
      profile_version INTEGER NOT NULL CHECK (profile_version > 0),
      display_name TEXT CHECK (display_name IS NULL OR char_length(btrim(display_name)) BETWEEN 1 AND 80),
      date_of_birth DATE,
      career_start_date DATE NOT NULL,
      home_locality TEXT CHECK (home_locality IS NULL OR char_length(home_locality) BETWEEN 1 AND 80),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      -- Minimum Career start age 15; sanity upper bound 100. Not a sporting rule.
      CONSTRAINT career_profiles_age_check CHECK (date_of_birth IS NULL OR (
        date_of_birth <= (career_start_date - INTERVAL '15 years')::date AND date_of_birth > (career_start_date - INTERVAL '100 years')::date))
    )
  `);
  // DOB may be set once (legacy saves start PROFILE_INCOMPLETE) and never changed; the start date never changes.
  await tx.execute(sql`
    CREATE OR REPLACE FUNCTION career_profiles_immutable() RETURNS trigger AS $$
    BEGIN
      IF OLD.date_of_birth IS NOT NULL AND NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
        RAISE EXCEPTION 'Career date of birth is immutable' USING ERRCODE = 'check_violation';
      END IF;
      IF NEW.career_start_date IS DISTINCT FROM OLD.career_start_date THEN
        RAISE EXCEPTION 'Career start date is immutable' USING ERRCODE = 'check_violation';
      END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql
  `);
  await tx.execute(sql`DROP TRIGGER IF EXISTS career_profiles_immutable_trg ON career_profiles`);
  await tx.execute(sql`CREATE TRIGGER career_profiles_immutable_trg BEFORE UPDATE ON career_profiles FOR EACH ROW EXECUTE FUNCTION career_profiles_immutable()`);
}

/**
 * Server-authoritative live match sessions. One session per tournament match, ever
 * (refresh cannot re-roll the opponent, bull-up or bot). The dart log is the match:
 * the server replays it with the shared rules and regenerates every bot visit.
 */
export async function ensureCareerMatchSessionSchema(tx: CareerExecutor): Promise<void> {
  await tx.execute(sql`
    CREATE TABLE IF NOT EXISTS career_match_sessions (
      career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
      id UUID NOT NULL,
      match_id UUID NOT NULL,
      event_id UUID NOT NULL,
      session_version INTEGER NOT NULL CHECK (session_version > 0),
      status TEXT NOT NULL CHECK (status IN ('BULL_UP','IN_PLAY','COMPLETED')),
      human_side INTEGER NOT NULL CHECK (human_side IN (0,1)),
      opponent_key TEXT NOT NULL,
      best_of INTEGER NOT NULL CHECK (best_of BETWEEN 1 AND 101 AND best_of % 2 = 1),
      format JSONB NOT NULL CHECK (jsonb_typeof(format) = 'object'),
      first_throw_method TEXT NOT NULL,
      bot_config JSONB NOT NULL CHECK (jsonb_typeof(bot_config) = 'object'),
      bot_seed TEXT NOT NULL CHECK (bot_seed ~ '^[a-f0-9]{32}$'),
      bull_first_order INTEGER NOT NULL CHECK (bull_first_order IN (0,1)),
      bull_throws JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(bull_throws) = 'array'),
      first_thrower INTEGER CHECK (first_thrower IN (0,1)),
      darts JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(darts) = 'array'),
      revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
      result JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      PRIMARY KEY (career_save_id, id),
      CONSTRAINT career_match_sessions_one_per_match UNIQUE (career_save_id, match_id),
      FOREIGN KEY (career_save_id, match_id) REFERENCES career_tournament_matches(career_save_id, id) ON DELETE CASCADE,
      CONSTRAINT career_match_sessions_state_check CHECK (
        (status = 'BULL_UP') = (first_thrower IS NULL)
        AND (status = 'COMPLETED') = (result IS NOT NULL AND completed_at IS NOT NULL))
    )
  `);
}
