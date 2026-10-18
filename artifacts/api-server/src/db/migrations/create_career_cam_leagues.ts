import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";

/** Webcam leagues: each league you join (its players and how you finished) and its fixtures (yours booked on a night). Every startup; checks first. */
export async function ensureCamLeagues(tx: CareerExecutor): Promise<void> {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_cam_leagues (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL, season integer NOT NULL, week_start integer NOT NULL, week_end integer NOT NULL, level integer NOT NULL,
    status text NOT NULL CHECK(status IN ('ACTIVE','FINISHED')), players jsonb NOT NULL, position integer, prize_pence bigint, next_level integer,
    created_at timestamptz NOT NULL DEFAULT NOW(), PRIMARY KEY(career_save_id, id))`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_cam_fixtures (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL, league_id uuid NOT NULL, season integer NOT NULL, round integer NOT NULL, week integer NOT NULL, a_key text NOT NULL, b_key text NOT NULL,
    status text NOT NULL CHECK(status IN ('SCHEDULED','BOOKED','PLAYED','FORFEIT')), day integer, source text CHECK(source IN ('LIVE','SIM','FORFEIT')),
    legs_a integer, legs_b integer, darts jsonb, created_at timestamptz NOT NULL DEFAULT NOW(), PRIMARY KEY(career_save_id, id))`);
  await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_cam_fixtures_league_idx ON career_cam_fixtures(career_save_id, league_id, week)`);
}
