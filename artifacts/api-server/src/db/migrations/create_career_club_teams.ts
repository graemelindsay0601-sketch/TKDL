import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";

/** Club team nights: one row per played fixture (the six singles in `rubbers`). Every startup; checks first. */
export async function ensureClubTeams(tx: CareerExecutor): Promise<void> {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_club_fixtures (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    season integer NOT NULL, round integer NOT NULL, week integer NOT NULL,
    home_key text NOT NULL, away_key text NOT NULL, home_score integer NOT NULL, away_score integer NOT NULL,
    rubbers jsonb NOT NULL CHECK(jsonb_typeof(rubbers)='array'),
    you_played boolean NOT NULL DEFAULT false, you_unavailable boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY(career_save_id,season,round,home_key))`);
  await tx.execute(sql`ALTER TABLE career_club_fixtures ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'COMPLETED'`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_club_team_memberships (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    season integer NOT NULL,
    club_key text NOT NULL,
    joined_week integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY(career_save_id,season))`);
}
