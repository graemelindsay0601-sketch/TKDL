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
  await tx.execute(sql`CREATE TRIGGER career_product_history_guard BEFORE UPDATE ON career_signature_products FOR EACH ROW EXECUTE FUNCTION career_product_guard()`);
}
