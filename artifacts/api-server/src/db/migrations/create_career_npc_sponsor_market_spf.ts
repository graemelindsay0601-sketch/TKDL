import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";

/** SP-F: persistent, save-scoped NPC market history and idempotent week processing. */
export async function createCareerNpcSponsorMarketSPF(database: CareerDatabase): Promise<void> {
  await database.transaction(async (tx) => {
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_npc_sponsor_market_terms (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        relationship_id UUID NOT NULL,
        contract_end_season INTEGER NOT NULL CHECK (contract_end_season > 0),
        contract_end_week INTEGER NOT NULL CHECK (contract_end_week BETWEEN 1 AND 52),
        PRIMARY KEY (career_save_id, relationship_id),
        FOREIGN KEY (career_save_id, relationship_id)
          REFERENCES career_npc_sponsor_relationships(career_save_id, id) ON DELETE CASCADE
      )
    `);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_npc_sponsor_market_periods (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        season INTEGER NOT NULL CHECK (season > 0),
        week INTEGER NOT NULL CHECK (week BETWEEN 1 AND 52),
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, season, week)
      )
    `);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_npc_sponsor_market_events (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        relationship_id UUID NOT NULL,
        npc_id UUID NOT NULL,
        sponsor_key TEXT NOT NULL,
        source_event_id UUID,
        event_type TEXT NOT NULL CHECK (event_type IN ('SIGNED', 'RENEWED', 'ENDED')),
        season INTEGER NOT NULL CHECK (season > 0),
        week INTEGER NOT NULL CHECK (week BETWEEN 1 AND 52),
        operation_key TEXT NOT NULL,
        details JSONB NOT NULL CHECK (jsonb_typeof(details) = 'object'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id, id),
        UNIQUE (career_save_id, operation_key),
        FOREIGN KEY (career_save_id, relationship_id)
          REFERENCES career_npc_sponsor_relationships(career_save_id, id) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id, npc_id)
          REFERENCES career_world_players(career_save_id, id) ON DELETE CASCADE
      )
    `);
    await tx.execute(sql`ALTER TABLE career_npc_sponsor_market_events
      ADD COLUMN IF NOT EXISTS source_event_id UUID`);
    // NPC brand rivalry is data, not an exclusive-category contract rule.
    await tx.execute(sql`DROP INDEX IF EXISTS career_npc_sponsor_relationships_active_category_idx`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_npc_sponsor_market_events_feed_idx
      ON career_npc_sponsor_market_events(career_save_id, season DESC, week DESC, id DESC)`);
  });
}
