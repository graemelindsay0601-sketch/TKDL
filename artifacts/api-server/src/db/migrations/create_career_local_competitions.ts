import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";

/** Player-created local leagues and cups; additive so existing Career saves need no reset. */
export async function ensureLocalCompetitions(tx: CareerExecutor): Promise<void> {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_local_competitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    season integer NOT NULL,
    home_club text NOT NULL,
    name text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('LEAGUE','SINGLES_CUP','TEAM_CUP')),
    rules jsonb NOT NULL CHECK (jsonb_typeof(rules)='object'),
    participants jsonb NOT NULL CHECK (jsonb_typeof(participants)='array'),
    fixtures jsonb NOT NULL CHECK (jsonb_typeof(fixtures)='array'),
    status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETE')),
    created_at timestamptz NOT NULL DEFAULT NOW()
  )`);
  await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_local_competitions_save_idx
    ON career_local_competitions(career_save_id, season, created_at DESC)`);
}
