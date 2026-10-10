import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";

/** Additive SP-D persistence. Historical contracts are never backfilled. */
export async function createCareerSponsorHQSPD(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_sponsor_commitments (
        career_save_id UUID NOT NULL, id UUID NOT NULL, contract_id UUID NOT NULL,
        sponsor_key TEXT NOT NULL CHECK (length(sponsor_key) BETWEEN 1 AND 80),
        clause_id TEXT NOT NULL CHECK (length(clause_id) BETWEEN 1 AND 120),
        occurrence INTEGER NOT NULL CHECK (occurrence BETWEEN 1 AND 100),
        commitment_type TEXT NOT NULL CHECK (commitment_type IN
          ('EVENT_APPEARANCE','MEDIA_APPEARANCE','COMMUNITY_SESSION','PRODUCT_FEEDBACK','EXCLUSIVE_USE',
           'PROMOTIONAL_APPEARANCE','PRODUCT_APPEARANCE')),
        required BOOLEAN NOT NULL, cadence TEXT NOT NULL CHECK (cadence IN ('PER_EVENT','PER_SEASON','ON_REQUEST')),
        season INTEGER NOT NULL CHECK (season BETWEEN 1 AND 1000),
        available_from_week INTEGER CHECK (available_from_week BETWEEN 1 AND 52),
        window_weeks INTEGER CHECK (window_weeks BETWEEN 1 AND 5),
        due_week INTEGER CHECK (due_week BETWEEN 1 AND 52),
        scheduled_week INTEGER CHECK (scheduled_week BETWEEN 1 AND 52),
        status TEXT NOT NULL CHECK (status IN ('PLANNED','AVAILABLE','CONFIRMED','COMPLETED','MISSED','CANCELLED')),
        scheduling_requirements JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(scheduling_requirements) = 'object'),
        resolution_evidence JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(resolution_evidence) = 'object'),
        operation_key TEXT NOT NULL CHECK (length(operation_key) BETWEEN 8 AND 180),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id,id), UNIQUE (career_save_id,contract_id,clause_id,season,occurrence),
        UNIQUE (career_save_id,operation_key),
        FOREIGN KEY (career_save_id,contract_id) REFERENCES career_sponsor_contracts(career_save_id,id) ON DELETE CASCADE
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_sponsor_commitments_schedule_idx
      ON career_sponsor_commitments (career_save_id,season,(COALESCE(scheduled_week,due_week)),status)`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_sponsor_opportunities (
        career_save_id UUID NOT NULL, id UUID NOT NULL, contract_id UUID NOT NULL,
        sponsor_key TEXT NOT NULL CHECK (length(sponsor_key) BETWEEN 1 AND 80),
        clause_id TEXT NOT NULL CHECK (length(clause_id) BETWEEN 1 AND 120),
        occurrence INTEGER NOT NULL CHECK (occurrence BETWEEN 1 AND 100),
        opportunity_type TEXT NOT NULL CHECK (opportunity_type IN
          ('EXHIBITION','MEDIA','COMMUNITY','PRODUCT_TESTING','PROMOTIONAL_EVENT','PRODUCT_LAUNCH')),
        season INTEGER NOT NULL CHECK (season BETWEEN 1 AND 1000),
        available_from_week INTEGER NOT NULL CHECK (available_from_week BETWEEN 1 AND 52),
        available_to_week INTEGER NOT NULL CHECK (available_to_week BETWEEN available_from_week AND 52),
        scheduled_week INTEGER CHECK (scheduled_week BETWEEN 1 AND 52),
        status TEXT NOT NULL CHECK (status IN ('AVAILABLE','ACCEPTED','CONFIRMED','DECLINED','COMPLETED','EXPIRED','CANCELLED')),
        terms JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(terms) = 'object'),
        operation_key TEXT NOT NULL CHECK (length(operation_key) BETWEEN 8 AND 180),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id,id), UNIQUE (career_save_id,contract_id,clause_id,season,occurrence),
        UNIQUE (career_save_id,operation_key),
        FOREIGN KEY (career_save_id,contract_id) REFERENCES career_sponsor_contracts(career_save_id,id) ON DELETE CASCADE
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_sponsor_opportunities_window_idx
      ON career_sponsor_opportunities (career_save_id,season,available_from_week,available_to_week,status)`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_sponsor_week_bookings (
        career_save_id UUID NOT NULL, season INTEGER NOT NULL CHECK (season BETWEEN 1 AND 1000),
        week INTEGER NOT NULL CHECK (week BETWEEN 1 AND 52), activity_id UUID NOT NULL,
        activity_kind TEXT NOT NULL CHECK (activity_kind IN ('COMMITMENT','OPPORTUNITY')),
        status TEXT NOT NULL CHECK (status IN ('CONFIRMED','COMPLETED')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id,season,week), UNIQUE (career_save_id,activity_id),
        FOREIGN KEY (career_save_id) REFERENCES career_saves(id) ON DELETE CASCADE
      )
    `);
  });
}
