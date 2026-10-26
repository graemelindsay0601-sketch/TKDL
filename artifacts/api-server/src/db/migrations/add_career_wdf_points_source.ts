import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";

/** Allow immutable WDF point contributions alongside legacy prize-money rows. */
export async function addCareerWdfPointsSource(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    await tx.execute(sql`ALTER TABLE career_ranking_contributions
      DROP CONSTRAINT IF EXISTS career_ranking_contributions_source_check`);
    await tx.execute(sql`ALTER TABLE career_ranking_contributions
      ADD CONSTRAINT career_ranking_contributions_source_check
      CHECK (source IN ('A4_PRIZE_AWARD','A4_PRIZE_TABLE','WDF_OFFICIAL_POINTS'))`);
  });
}
