import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/** Adds the optional player equipment locker. Safe for every existing row. */
export async function addDartsSetupColumn(): Promise<void> {
  await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS darts_setup JSONB`);
  await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS darts_setup_updated_at TIMESTAMPTZ`);
}
