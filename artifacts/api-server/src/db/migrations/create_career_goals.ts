import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";

/** A7.3 additive choices/lifecycle only; no copied sporting counters. */
export async function createCareerGoals(tx: CareerExecutor): Promise<void> {
  await tx.execute(sql`ALTER TABLE career_saves ADD COLUMN IF NOT EXISTS career_focus text NOT NULL DEFAULT 'OPEN_SCHEDULE'`);
  await tx.execute(sql`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='career_saves'::regclass AND conname='career_saves_focus_check') THEN
      ALTER TABLE career_saves ADD CONSTRAINT career_saves_focus_check CHECK
        (career_focus IN ('OPEN_SCHEDULE','PROFESSIONAL_PATHWAY','AMATEUR_CIRCUIT','PRIZE_MONEY','MAJOR_QUALIFICATION'));
    END IF;
  END $$`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_personal_goals (
    id uuid PRIMARY KEY,
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    request_key uuid NOT NULL,
    definition jsonb NOT NULL CONSTRAINT career_goals_definition_check CHECK (jsonb_typeof(definition)='object'),
    target_key text NOT NULL,
    baseline_evidence text[] NOT NULL DEFAULT '{}',
    status text NOT NULL DEFAULT 'ACTIVE' CONSTRAINT career_goals_status_check CHECK (status IN ('ACTIVE','COMPLETED','ABANDONED')),
    created_season integer NOT NULL CONSTRAINT career_goals_season_check CHECK (created_season>0),
    created_week integer NOT NULL CONSTRAINT career_goals_week_check CHECK (created_week BETWEEN 1 AND 52),
    created_at timestamptz NOT NULL DEFAULT NOW(),
    completed_evidence jsonb,
    abandoned_at timestamptz,
    CONSTRAINT career_goals_completion_check CHECK ((status='COMPLETED') = (completed_evidence IS NOT NULL)),
    CONSTRAINT career_goals_abandoned_check CHECK ((status='ABANDONED') = (abandoned_at IS NOT NULL)),
    CONSTRAINT career_goals_request_unique UNIQUE(career_save_id,request_key)
  )`);
  await tx.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS career_goals_active_target_unique ON career_personal_goals(career_save_id,target_key) WHERE status='ACTIVE'`);
  await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_goals_save_idx ON career_personal_goals(career_save_id,created_at,id)`);
}
