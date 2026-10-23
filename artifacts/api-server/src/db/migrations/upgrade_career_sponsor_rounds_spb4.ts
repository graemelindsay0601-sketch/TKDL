import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";

/**
 * SP-B4 widens negotiation history from two to four rounds. Existing journey
 * and negotiation rows are preserved; only the validated range changes.
 */
export async function upgradeCareerSponsorRoundsSPB4(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    await tx.execute(sql`ALTER TABLE career_sponsor_journeys DROP CONSTRAINT IF EXISTS career_sponsor_journeys_negotiation_rounds_check`);
    await tx.execute(sql`ALTER TABLE career_sponsor_journeys ADD CONSTRAINT career_sponsor_journeys_negotiation_rounds_check
      CHECK (negotiation_rounds BETWEEN 0 AND 4)`);
    await tx.execute(sql`ALTER TABLE career_sponsor_negotiations DROP CONSTRAINT IF EXISTS career_sponsor_negotiations_round_check`);
    await tx.execute(sql`ALTER TABLE career_sponsor_negotiations ADD CONSTRAINT career_sponsor_negotiations_round_check
      CHECK (round BETWEEN 1 AND 4)`);
  });
}
