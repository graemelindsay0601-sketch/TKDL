/**
 * Production regression: the ranking-unit migration UPDATEd an immutable table and rolled back wherever ranking rows
 * already existed, leaving no `unit` column, so every completed event failed to record contributions and the Career
 * couldn't advance. The every-boot repair must add it to a populated table, keep the table immutable, and be repeatable.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
const immutable = (e: unknown) => /immutable/.test(String((e as { cause?: { message?: string } })?.cause?.message ?? (e as Error)?.message));
import { addCareerRankingContributionUnits, ensureRankingContributionUnits } from "../../db/migrations/add_career_ranking_contribution_units.ts";

test("the ranking unit repair works on a populated, immutable table and can run every boot", async () => {
  const pg = new PGlite(), db = drizzle(pg);
  // The table as an older production database has it: no unit column, rows already recorded, updates refused.
  await pg.exec(`
    CREATE OR REPLACE FUNCTION career_sporting_reject_update() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Career sporting evidence is immutable'; END; $$ LANGUAGE plpgsql;
    CREATE TABLE career_ranking_contributions (career_save_id uuid NOT NULL, id uuid NOT NULL, source text NOT NULL, amount_pence bigint NOT NULL, PRIMARY KEY (career_save_id, id));
    CREATE TRIGGER career_ranking_contributions_immutable BEFORE UPDATE ON career_ranking_contributions FOR EACH ROW EXECUTE FUNCTION career_sporting_reject_update();
    INSERT INTO career_ranking_contributions VALUES
      ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'A4_PRIZE_TABLE', 2500),
      ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000012', 'WDF_OFFICIAL_POINTS', 30);`);
  // What used to happen: the old UPDATE hits the trigger and everything rolls back.
  await assert.rejects(db.transaction(async tx => {
    await tx.execute(sql`ALTER TABLE career_ranking_contributions ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'GBP'`);
    await tx.execute(sql`UPDATE career_ranking_contributions SET unit = CASE WHEN source = 'WDF_OFFICIAL_POINTS' THEN 'POINTS' ELSE 'GBP' END`);
  }), immutable);
  assert.equal((await db.execute(sql`SELECT 1 FROM information_schema.columns WHERE table_name='career_ranking_contributions' AND column_name='unit'`)).rows.length, 0, "the column never arrived");

  await addCareerRankingContributionUnits(db);
  await db.transaction(tx => ensureRankingContributionUnits(tx));
  await db.transaction(tx => ensureRankingContributionUnits(tx));
  const units = (await db.execute(sql`SELECT source, unit FROM career_ranking_contributions ORDER BY source`)).rows;
  assert.deepEqual(units.map(r => [r.source, r.unit]), [["A4_PRIZE_TABLE", "GBP"], ["WDF_OFFICIAL_POINTS", "POINTS"]]);
  // New contributions record their unit (what advancing the Career does), and the checks hold.
  await db.execute(sql`INSERT INTO career_ranking_contributions (career_save_id, id, source, amount_pence, unit) VALUES
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000013', 'A4_PRIZE_TABLE', 1000, 'GBP')`);
  await assert.rejects(db.execute(sql`INSERT INTO career_ranking_contributions (career_save_id, id, source, amount_pence, unit) VALUES
    ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000014', 'WDF_OFFICIAL_POINTS', 5, 'GBP')`), "WDF rows must be points");
  await assert.rejects(db.execute(sql`UPDATE career_ranking_contributions SET amount_pence = 1`), immutable, "still immutable afterwards");
  await pg.close();
});
