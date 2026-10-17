import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";

/** Your manager: one active contract at a time; ended contracts are kept (commission history reads the ledger). Every startup; checks first. */
export async function ensureManagers(tx: CareerExecutor): Promise<void> {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_manager_contracts (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    manager_key text NOT NULL, status text NOT NULL CHECK(status IN ('ACTIVE','ENDED')),
    signed_season integer NOT NULL, signed_week integer NOT NULL, ended_season integer, ended_week integer,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY(career_save_id,id))`);
  // Invitation events your manager got you into: their cut of the prize money comes from these alone.
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_manager_invites (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    event_id uuid NOT NULL, manager_key text NOT NULL, manager_contract_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY(career_save_id,event_id))`);
  await tx.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS career_manager_contracts_active_idx ON career_manager_contracts(career_save_id) WHERE status='ACTIVE'`);
}
