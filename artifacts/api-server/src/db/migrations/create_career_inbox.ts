import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";

/** The inbox's read state (created at boot by the schema repair; here too for test databases that skip it). */
export async function ensureInbox(tx: CareerExecutor) {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_inbox_state (career_save_id uuid PRIMARY KEY REFERENCES career_saves(id) ON DELETE CASCADE,
    seen jsonb NOT NULL DEFAULT '[]'::jsonb, dismissed jsonb NOT NULL DEFAULT '[]'::jsonb, muted jsonb NOT NULL DEFAULT '[]'::jsonb, updated_at timestamptz NOT NULL DEFAULT NOW())`);
}
