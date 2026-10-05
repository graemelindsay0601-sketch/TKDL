import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";

/** Bull playoffs are not dart matches, titles, H2H meetings or a second scoring engine. */
export async function ensureCareerGroupSchema(tx: CareerExecutor) {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_group_bull_playoffs (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    event_id uuid NOT NULL, group_key text NOT NULL CHECK (group_key IN ('A','B','C','D')),
    tie_key text NOT NULL, ordinal integer NOT NULL CHECK (ordinal > 0),
    a_key text NOT NULL, b_key text NOT NULL CHECK (a_key <> b_key),
    throws jsonb NOT NULL DEFAULT '[]', revision integer NOT NULL DEFAULT 0,
    winner_key text CHECK (winner_key IN (a_key,b_key)), completed_at timestamptz,
    PRIMARY KEY (career_save_id,event_id,group_key,tie_key,ordinal),
    FOREIGN KEY (career_save_id,event_id) REFERENCES career_event_instances(career_save_id,id) ON DELETE CASCADE,
    CHECK ((winner_key IS NOT NULL) = (completed_at IS NOT NULL))
  )`);
  await tx.execute(sql`CREATE OR REPLACE FUNCTION career_reject_finished_bull_update() RETURNS trigger AS $$
    BEGIN IF OLD.winner_key IS NOT NULL THEN RAISE EXCEPTION 'Career bull playoff is final'; END IF; RETURN NEW; END;
    $$ LANGUAGE plpgsql`);
  await tx.execute(sql`DROP TRIGGER IF EXISTS career_group_bull_final_guard ON career_group_bull_playoffs`);
  await tx.execute(sql`CREATE TRIGGER career_group_bull_final_guard BEFORE UPDATE ON career_group_bull_playoffs
    FOR EACH ROW EXECUTE FUNCTION career_reject_finished_bull_update()`);
  // A group-stage loss is not elimination. Preserve the old zero-loss KO champion rule.
  await tx.execute(sql`ALTER TABLE career_event_results DROP CONSTRAINT IF EXISTS career_event_results_champion_check`);
  await tx.execute(sql`ALTER TABLE career_event_results ADD CONSTRAINT career_event_results_champion_check
    CHECK (is_champion=(finishing_position=1) AND (NOT is_champion OR losses=0 OR
      COALESCE(metadata->>'structure'='GROUP_KNOCKOUT' AND losses=(metadata->>'groupLosses')::integer,FALSE)))`);
  // Honest double withdrawal: no invented winner and no played statistics.
  await tx.execute(sql`ALTER TABLE career_tournament_matches DROP CONSTRAINT IF EXISTS career_tournament_matches_status_check`);
  await tx.execute(sql`ALTER TABLE career_tournament_matches ADD CONSTRAINT career_tournament_matches_status_check
    CHECK (status IN ('PENDING','AWAITING_HUMAN','COMPLETED','BYE','WALKOVER','VOID'))`);
  await tx.execute(sql`CREATE OR REPLACE FUNCTION career_reject_finished_match_update() RETURNS trigger AS $$
    BEGIN IF OLD.status IN ('COMPLETED','BYE','WALKOVER','VOID') THEN RAISE EXCEPTION 'Career match % is final', OLD.id; END IF; RETURN NEW; END;
    $$ LANGUAGE plpgsql`);
}
