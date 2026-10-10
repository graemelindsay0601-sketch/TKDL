import { sql } from "drizzle-orm";
import type {CareerExecutor} from "../../career/database.ts";
export async function createCareerContent(tx:CareerExecutor):Promise<void> {
  await tx.execute(sql`DROP INDEX IF EXISTS career_sponsor_contracts_one_active`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_signature_products (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL,participant_key text NOT NULL CHECK(participant_key='HUMAN'),
    product_type text NOT NULL CHECK(product_type IN ('SIGNATURE_DARTS','SIGNATURE_RANGE')),
    manufacturer text NOT NULL,product_name text NOT NULL CHECK(length(product_name)<=160),
    contract_id uuid NOT NULL,launch_season integer NOT NULL CHECK(launch_season>0),
    evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),
    PRIMARY KEY(career_save_id,id), UNIQUE(career_save_id,contract_id,product_type),
    FOREIGN KEY(career_save_id,contract_id) REFERENCES career_sponsor_contracts(career_save_id,id) ON DELETE CASCADE)`);
  await tx.execute(sql`CREATE OR REPLACE FUNCTION career_product_guard() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'Signature product launch history is immutable'; END; $$ LANGUAGE plpgsql`);
  await tx.execute(sql`DROP TRIGGER IF EXISTS career_product_history_guard ON career_signature_products`);
  await tx.execute(sql`CREATE TRIGGER career_product_history_guard BEFORE UPDATE OR DELETE ON career_signature_products FOR EACH ROW EXECUTE FUNCTION career_product_guard()`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_equipment_loadouts (
    career_save_id uuid PRIMARY KEY REFERENCES career_saves(id) ON DELETE CASCADE,
    loadout jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(loadout)='object'),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_signature_product_drafts (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL,contract_id uuid NOT NULL,product_id uuid,
    product_type text NOT NULL CHECK(product_type IN ('SIGNATURE_DARTS','SIGNATURE_RANGE')),
    product_name text NOT NULL CHECK(length(product_name) BETWEEN 3 AND 80),
    design jsonb NOT NULL CHECK(jsonb_typeof(design)='object'),
    status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','APPROVED','LAUNCHED','RETIRED')),
    season integer NOT NULL CHECK(season>0),week integer NOT NULL CHECK(week BETWEEN 1 AND 52),
    created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(career_save_id,id),
    FOREIGN KEY(career_save_id,contract_id) REFERENCES career_sponsor_contracts(career_save_id,id)
  )`);
  await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_signature_product_drafts_product
    ON career_signature_product_drafts(career_save_id,product_id) WHERE product_id IS NOT NULL`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_signature_product_sales (
    career_save_id uuid NOT NULL,product_id uuid NOT NULL,season integer NOT NULL CHECK(season>0),
    week integer NOT NULL CHECK(week BETWEEN 1 AND 52),units integer NOT NULL CHECK(units BETWEEN 0 AND 100),
    gross_pence bigint NOT NULL CHECK(gross_pence>=0),royalty_pence bigint NOT NULL CHECK(royalty_pence>=0),
    operation_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(career_save_id,product_id,season,week),UNIQUE(career_save_id,operation_key),
    FOREIGN KEY(career_save_id,product_id) REFERENCES career_signature_products(career_save_id,id)
  )`);
  await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_signature_product_sales_period
    ON career_signature_product_sales(career_save_id,season,week)`);
  await tx.execute(sql`CREATE OR REPLACE FUNCTION career_product_sales_guard() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'Signature product sales are append-only'; END; $$ LANGUAGE plpgsql`);
  await tx.execute(sql`DROP TRIGGER IF EXISTS career_signature_product_sales_guard ON career_signature_product_sales`);
  await tx.execute(sql`CREATE TRIGGER career_signature_product_sales_guard BEFORE UPDATE OR DELETE ON career_signature_product_sales
    FOR EACH ROW EXECUTE FUNCTION career_product_sales_guard()`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_signature_product_events (
    career_save_id uuid NOT NULL,id uuid NOT NULL,draft_id uuid NOT NULL,
    event_type text NOT NULL CHECK(event_type IN ('CREATED','APPROVED','LAUNCHED','RETIRED')),
    season integer NOT NULL CHECK(season>0),week integer NOT NULL CHECK(week BETWEEN 1 AND 52),
    details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(details)='object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(career_save_id,id),UNIQUE(career_save_id,draft_id,event_type),
    FOREIGN KEY(career_save_id,draft_id) REFERENCES career_signature_product_drafts(career_save_id,id)
  )`);
  await tx.execute(sql`CREATE OR REPLACE FUNCTION career_product_events_guard() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'Signature product lifecycle events are append-only'; END; $$ LANGUAGE plpgsql`);
  await tx.execute(sql`DROP TRIGGER IF EXISTS career_signature_product_events_guard ON career_signature_product_events`);
  await tx.execute(sql`CREATE TRIGGER career_signature_product_events_guard BEFORE UPDATE OR DELETE ON career_signature_product_events
    FOR EACH ROW EXECUTE FUNCTION career_product_events_guard()`);
}
