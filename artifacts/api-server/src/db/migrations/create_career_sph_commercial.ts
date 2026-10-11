import {sql} from "drizzle-orm";
import type {CareerDatabase} from "../../career/database.ts";

/** Additive SP-H support. Existing sales retain their original values and version-1 interpretation. */
export async function createCareerSPHCommercial(database:CareerDatabase):Promise<void>{
  await database.transaction(async tx=>{
    await tx.execute(sql`ALTER TABLE career_signature_product_sales
      ADD COLUMN IF NOT EXISTS demand_version integer NOT NULL DEFAULT 1`);
    await tx.execute(sql`ALTER TABLE career_signature_product_sales
      ADD COLUMN IF NOT EXISTS demand_evidence jsonb NOT NULL DEFAULT '{}'::jsonb`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_commercial_message_reads (
      career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
      message_id text NOT NULL CHECK(length(message_id) BETWEEN 1 AND 120),
      read_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(career_save_id,message_id)
    )`);
  });
}
