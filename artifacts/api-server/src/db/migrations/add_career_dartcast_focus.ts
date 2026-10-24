import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";

/** Add DartCast as a guidance focus; it does not change event eligibility. */
export async function addCareerDartCastFocus(tx: CareerExecutor): Promise<void> {
  await tx.execute(sql`ALTER TABLE career_saves DROP CONSTRAINT IF EXISTS career_saves_focus_check`);
  await tx.execute(sql`ALTER TABLE career_saves ADD CONSTRAINT career_saves_focus_check CHECK
    (career_focus IN ('OPEN_SCHEDULE','PROFESSIONAL_PATHWAY','AMATEUR_CIRCUIT','PRIZE_MONEY','MAJOR_QUALIFICATION','DARTCAST_CREATOR'))`);
}
