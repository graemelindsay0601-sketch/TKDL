import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";

/** Pro-Am nights: the one you've taken this week (as an amateur with a slot, or as the pro) and how it went. Every startup; checks first. */
export async function ensureProAm(tx: CareerExecutor): Promise<void> {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_proam_nights (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL, season integer NOT NULL, week integer NOT NULL, day integer NOT NULL, locality_key text NOT NULL,
    role text NOT NULL CHECK(role IN ('AMATEUR','PRO')), status text NOT NULL CHECK(status IN ('BOOKED','PLAYED','MISSED','CANCELLED')),
    pro jsonb, fee_pence bigint NOT NULL DEFAULT 0, prize_pence bigint NOT NULL DEFAULT 0, appearance_pence bigint NOT NULL DEFAULT 0, travel_pence bigint NOT NULL DEFAULT 0,
    darts jsonb, result jsonb, created_at timestamptz NOT NULL DEFAULT NOW(), PRIMARY KEY(career_save_id, id), UNIQUE(career_save_id, season, week))`);
}
