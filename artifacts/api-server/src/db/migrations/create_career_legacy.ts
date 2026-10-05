import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";
export async function createCareerLegacy(tx:CareerExecutor):Promise<void> {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_legacy_reviews (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    season integer NOT NULL CHECK(season>0),version integer NOT NULL CHECK(version=1),
    snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
    acknowledged boolean NOT NULL DEFAULT false,PRIMARY KEY(career_save_id,season))`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_legacy_inductions (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    participant_key text NOT NULL,evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object'),
    PRIMARY KEY(career_save_id,participant_key))`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_legacy_retirements (
    career_save_id uuid PRIMARY KEY REFERENCES career_saves(id) ON DELETE CASCADE,
    snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'))`);
  await tx.execute(sql`CREATE OR REPLACE FUNCTION career_legacy_guard() RETURNS trigger AS $$
    BEGIN
      IF TG_TABLE_NAME='career_legacy_reviews' AND NEW.snapshot=OLD.snapshot AND NEW.version=OLD.version
        AND NEW.career_save_id=OLD.career_save_id AND NEW.season=OLD.season AND (NOT OLD.acknowledged OR NEW.acknowledged)
        THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'Career legacy history is immutable';
    END; $$ LANGUAGE plpgsql`);
  for(const table of ["career_legacy_reviews","career_legacy_inductions","career_legacy_retirements"]) {
    await tx.execute(sql`DROP TRIGGER IF EXISTS career_legacy_history_guard ON ${sql.identifier(table)}`);
    await tx.execute(sql`CREATE TRIGGER career_legacy_history_guard BEFORE UPDATE ON ${sql.identifier(table)}
      FOR EACH ROW EXECUTE FUNCTION career_legacy_guard()`);
  }
}
