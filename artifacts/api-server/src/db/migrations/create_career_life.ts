import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";

/** A7.5 semantic choices / commitments only. No copied sporting or weekly profile counters. */
export async function createCareerLife(tx:CareerExecutor):Promise<void> {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_life_decisions (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('DIALOGUE','ATMOSPHERE','OPPORTUNITY','MERCHANDISE')),
    choice text NOT NULL,season integer NOT NULL CHECK(season>0),week integer NOT NULL CHECK(week BETWEEN 1 AND 52),
    data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),created_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY(career_save_id,id))`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_life_commitments (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,id uuid NOT NULL,
    family text NOT NULL,title text NOT NULL,season integer NOT NULL CHECK(season>0),day integer NOT NULL CHECK(day BETWEEN 1 AND 364),
    fee_pence bigint NOT NULL CHECK(fee_pence>=0),contract_id uuid,
    status text NOT NULL CHECK(status IN ('ACCEPTED','COMPLETED')),
    PRIMARY KEY(career_save_id,id),UNIQUE(career_save_id,season,day))`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_life_merchandise (
    career_save_id uuid PRIMARY KEY REFERENCES career_saves(id) ON DELETE CASCADE,
    category text NOT NULL CHECK(category IN ('REPLICA_SHIRT','SIGNED_ITEMS','SPONSOR_LINKED')),
    royalty_pence bigint NOT NULL CHECK(royalty_pence>0),active boolean NOT NULL DEFAULT true,
    signed_season integer NOT NULL,signed_week integer NOT NULL,contract_id uuid)`);
}
