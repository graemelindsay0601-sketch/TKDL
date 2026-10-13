import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";

/** A career may pin one existing personal goal as its main ambition. */
export async function addCareerMainGoal(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    await tx.execute(sql`ALTER TABLE career_saves ADD COLUMN IF NOT EXISTS main_goal_id uuid`);
    await tx.execute(sql`ALTER TABLE career_saves ADD COLUMN IF NOT EXISTS near_term_event_id text`);
    await tx.execute(sql`UPDATE career_saves s SET main_goal_id = (
      SELECT g.id FROM career_personal_goals g
      WHERE g.career_save_id=s.id AND g.status='ACTIVE'
      ORDER BY g.created_at,g.id LIMIT 1
    ) WHERE s.main_goal_id IS NULL`);
  });
}
