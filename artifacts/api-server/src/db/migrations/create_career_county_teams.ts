import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";

/** Save-scoped UKDA-style county representative fixtures and the player's squad eligibility. */
export async function ensureCareerCountyTeams(tx: CareerExecutor): Promise<void> {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_county_eligibility (
    career_save_id uuid PRIMARY KEY REFERENCES career_saves(id) ON DELETE CASCADE,
    category text NOT NULL CHECK (category IN ('MEN','WOMEN')),
    updated_at timestamptz NOT NULL DEFAULT NOW()
  )`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_county_fixtures (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    season integer NOT NULL CHECK (season > 0),
    round integer NOT NULL CHECK (round > 0),
    week integer NOT NULL CHECK (week > 0),
    home_key text NOT NULL,
    away_key text NOT NULL,
    status text NOT NULL CHECK (status IN ('SCHEDULED','IN_PROGRESS','COMPLETED')),
    matches jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(matches)='array'),
    created_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (career_save_id, season, round, home_key),
    CHECK (home_key <> away_key)
  )`);
  await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_county_fixtures_week_idx
    ON career_county_fixtures(career_save_id, season, week, status)`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_county_trials (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    season integer NOT NULL CHECK (season > 1),
    source_season integer NOT NULL CHECK (source_season = season - 1),
    status text NOT NULL CHECK (status IN ('INVITED','LIVE','WON','LOST','EXPIRED')),
    category text CHECK (category IS NULL OR category IN ('MEN','WOMEN')),
    appearances integer NOT NULL CHECK (appearances >= 0),
    wins integer NOT NULL CHECK (wins >= 0 AND wins <= appearances),
    match_id uuid,
    opponent_key uuid,
    opponent_name text,
    bot jsonb CHECK (bot IS NULL OR jsonb_typeof(bot)='object'),
    seed text,
    darts jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(darts)='array'),
    won boolean,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    completed_at timestamptz,
    PRIMARY KEY (career_save_id, season),
    UNIQUE (career_save_id, match_id)
  )`);
}
