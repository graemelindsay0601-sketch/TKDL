import { sql } from "drizzle-orm";
import type { CareerDatabase, CareerExecutor } from "../../career/database.ts";

/**
 * Make the stored value's unit explicit. Existing WDF rows are points; all
 * existing prize-table and prize-award contributions are GBP pence.
 */
export async function addCareerRankingContributionUnits(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => { await ensureRankingContributionUnits(tx); });
}

/**
 * The `unit` column and its checks, safe on any database and run at every startup. The first version of this migration
 * set WDF rows with an UPDATE, which the table's immutability trigger refuses: on a database that already held ranking
 * rows the whole migration rolled back, the column never arrived, and every completed event then failed to record its
 * ranking contributions (so the Career couldn't advance). Adding the column with a default fills existing rows without
 * an UPDATE, and the one correction (WDF rows are points) runs with that table's triggers briefly disabled.
 */
export async function ensureRankingContributionUnits(tx: CareerExecutor): Promise<void> {
  if ((await tx.execute(sql`SELECT to_regclass('career_ranking_contributions') IS NOT NULL AS ok`)).rows[0]?.ok !== true) return;
  await tx.execute(sql`ALTER TABLE career_ranking_contributions ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'GBP'`);
  const wrong = (await tx.execute(sql`SELECT 1 FROM career_ranking_contributions
    WHERE (source = 'WDF_OFFICIAL_POINTS' AND unit <> 'POINTS') OR (source <> 'WDF_OFFICIAL_POINTS' AND unit <> 'GBP') LIMIT 1`)).rows.length > 0;
  if (wrong) {
    await tx.execute(sql`ALTER TABLE career_ranking_contributions DISABLE TRIGGER USER`);
    await tx.execute(sql`UPDATE career_ranking_contributions SET unit = CASE WHEN source = 'WDF_OFFICIAL_POINTS' THEN 'POINTS' ELSE 'GBP' END
      WHERE unit IS DISTINCT FROM CASE WHEN source = 'WDF_OFFICIAL_POINTS' THEN 'POINTS' ELSE 'GBP' END`);
    await tx.execute(sql`ALTER TABLE career_ranking_contributions ENABLE TRIGGER USER`);
  }
  const constraints = new Set((await tx.execute(sql`SELECT conname FROM pg_constraint WHERE conrelid = 'career_ranking_contributions'::regclass`)).rows.map(r => String(r.conname)));
  if (!constraints.has("career_ranking_contributions_unit_check"))
    await tx.execute(sql`ALTER TABLE career_ranking_contributions ADD CONSTRAINT career_ranking_contributions_unit_check CHECK (unit IN ('GBP','POINTS'))`);
  if (!constraints.has("career_ranking_contributions_source_unit"))
    await tx.execute(sql`ALTER TABLE career_ranking_contributions ADD CONSTRAINT career_ranking_contributions_source_unit
      CHECK ((source = 'WDF_OFFICIAL_POINTS' AND unit = 'POINTS') OR (source <> 'WDF_OFFICIAL_POINTS' AND unit = 'GBP'))`);
}
