import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";

/** The tables (created at boot by the schema repair). */
export async function ensureLocalNights(tx: CareerExecutor) {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_local_nights (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL, season integer NOT NULL, week integer NOT NULL, day integer NOT NULL,
    kind text NOT NULL CHECK (kind IN ('PUB_LEAGUE','KNOCKOUT','PRACTICE','FRIENDLY','EXHIBITION','COACHING')),
    status text NOT NULL CHECK (status IN ('BOOKED','DONE','MISSED')), title text NOT NULL,
    matches jsonb NOT NULL DEFAULT '[]'::jsonb, drill jsonb, result jsonb, fee_pence integer NOT NULL DEFAULT 0, paid_pence integer NOT NULL DEFAULT 0,
    league_id uuid, round integer, created_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (career_save_id, id), UNIQUE (career_save_id, season, day))`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_local_leagues (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL, season integer NOT NULL, week_start integer NOT NULL, week_end integer NOT NULL,
    players jsonb NOT NULL, fixtures jsonb NOT NULL, status text NOT NULL CHECK (status IN ('ACTIVE','FINISHED')),
    position integer, prize_pence integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT NOW(), PRIMARY KEY (career_save_id, id))`);
}
