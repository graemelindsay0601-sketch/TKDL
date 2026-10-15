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
  await ensureLegacySeasonTotals(tx);
  await ensureWorldRecords(tx);
  for(const table of ["career_legacy_reviews","career_legacy_inductions","career_legacy_retirements"]) {
    await tx.execute(sql`DROP TRIGGER IF EXISTS career_legacy_history_guard ON ${sql.identifier(table)}`);
    await tx.execute(sql`CREATE TRIGGER career_legacy_history_guard BEFORE UPDATE ON ${sql.identifier(table)}
      FOR EACH ROW EXECUTE FUNCTION career_legacy_guard()`);
  }
}

/**
 * Per-player totals of each finished season, stored once (a finished season's results never change). Legacy,
 * season reviews and the close season otherwise re-aggregated every result of every season (~35,000 a season).
 * Filled on first read of a finished season, so existing saves fill themselves. Idempotent; runs every boot.
 */
export async function ensureLegacySeasonTotals(tx:CareerExecutor):Promise<void> {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_legacy_season_totals (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    season integer NOT NULL CHECK(season>0),participant_key text NOT NULL,
    appearances integer NOT NULL,titles integer NOT NULL,finals integer NOT NULL,major_titles integer NOT NULL,worlds integer NOT NULL,
    amateur_titles integer NOT NULL,national_titles integer NOT NULL,pro_titles integer NOT NULL,wins integer NOT NULL,losses integer NOT NULL,
    PRIMARY KEY(career_save_id,season,participant_key))`);
}

/**
 * The darts world's records book: the best match statistics recorded in a Career (top entries per record) and every
 * nine-dart leg. Kept up to date as events finish, so reading it never scans the save's match history. Every boot.
 */
export async function ensureWorldRecords(tx:CareerExecutor):Promise<void> {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_world_records (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    record_key text NOT NULL,participant_key text NOT NULL,match_id uuid NOT NULL,event_id uuid NOT NULL,
    value numeric NOT NULL,season integer NOT NULL,day integer NOT NULL,source text NOT NULL CHECK(source IN ('SIMULATED','QUICK_SIM','LIVE')),
    PRIMARY KEY(career_save_id,record_key,match_id,participant_key))`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_world_records_state (
    career_save_id uuid PRIMARY KEY REFERENCES career_saves(id) ON DELETE CASCADE,had_history boolean NOT NULL,
    backfilled_at timestamptz NOT NULL DEFAULT NOW())`);
}
