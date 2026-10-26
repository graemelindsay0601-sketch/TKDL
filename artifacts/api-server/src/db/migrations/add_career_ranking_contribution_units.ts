import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";

/**
 * Make the stored value's unit explicit. Existing WDF rows are points; all
 * existing prize-table and prize-award contributions are GBP pence.
 */
export async function addCareerRankingContributionUnits(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    await tx.execute(sql`ALTER TABLE career_ranking_contributions
      ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'GBP'`);
    await tx.execute(sql`UPDATE career_ranking_contributions SET unit = CASE
      WHEN source = 'WDF_OFFICIAL_POINTS' THEN 'POINTS' ELSE 'GBP' END`);
    await tx.execute(sql`ALTER TABLE career_ranking_contributions
      DROP CONSTRAINT IF EXISTS career_ranking_contributions_unit_check`);
    await tx.execute(sql`ALTER TABLE career_ranking_contributions
      ADD CONSTRAINT career_ranking_contributions_unit_check CHECK (unit IN ('GBP','POINTS'))`);
    await tx.execute(sql`ALTER TABLE career_ranking_contributions
      DROP CONSTRAINT IF EXISTS career_ranking_contributions_source_unit`);
    await tx.execute(sql`ALTER TABLE career_ranking_contributions
      ADD CONSTRAINT career_ranking_contributions_source_unit
      CHECK ((source = 'WDF_OFFICIAL_POINTS' AND unit = 'POINTS') OR (source <> 'WDF_OFFICIAL_POINTS' AND unit = 'GBP'))`);
  });
}
