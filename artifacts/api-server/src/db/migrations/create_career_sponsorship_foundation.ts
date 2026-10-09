import {sql} from "drizzle-orm";
import type {CareerDatabase} from "../../career/database.ts";

/** Additive SP-A persistence only. No human sponsorship or financial writes. */
export async function createCareerSponsorshipFoundation(database:CareerDatabase):Promise<void>{
  await database.transaction(async tx=>{
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_sponsor_world_state(
        career_save_id UUID PRIMARY KEY REFERENCES career_saves(id) ON DELETE CASCADE,
        content_version INTEGER NOT NULL CHECK(content_version>0),
        generation_version INTEGER NOT NULL CHECK(generation_version>0),
        npc_count INTEGER NOT NULL CHECK(npc_count>=0),
        relationship_count INTEGER NOT NULL CHECK(relationship_count>=0 AND relationship_count<=npc_count),
        initialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_npc_sponsor_relationships(
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        npc_id UUID NOT NULL,
        sponsor_key TEXT NOT NULL CHECK(sponsor_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
        category TEXT NOT NULL CHECK(category IN ('MAIN_PARTNER','EQUIPMENT_PARTNER','TRAVEL_PARTNER','LOCAL_PARTNER','APPAREL_PARTNER','SECONDARY_PARTNER')),
        representative_id TEXT CHECK(representative_id IS NULL OR representative_id ~ '^rep-[a-z0-9-]+$'),
        status TEXT NOT NULL CHECK(status IN ('ACTIVE','ENDED')),
        start_season INTEGER NOT NULL CHECK(start_season>0),
        start_week INTEGER NOT NULL CHECK(start_week BETWEEN 1 AND 52),
        end_season INTEGER,
        end_week INTEGER,
        sponsor_snapshot JSONB NOT NULL CHECK(jsonb_typeof(sponsor_snapshot)='object'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY(career_save_id,id),
        FOREIGN KEY(career_save_id,npc_id) REFERENCES career_world_players(career_save_id,id) ON DELETE CASCADE,
        CHECK((end_season IS NULL)=(end_week IS NULL)),
        CHECK(end_season IS NULL OR end_season>0 AND end_week BETWEEN 1 AND 52),
        CHECK((status='ACTIVE')=(end_season IS NULL)),
        CHECK(end_season IS NULL OR end_season>start_season OR (end_season=start_season AND end_week>=start_week))
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_npc_sponsor_relationships_npc_idx
      ON career_npc_sponsor_relationships(career_save_id,npc_id,status)`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_npc_sponsor_relationships_sponsor_idx
      ON career_npc_sponsor_relationships(career_save_id,sponsor_key,start_season,start_week)`);
    await tx.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS career_npc_sponsor_relationships_active_category_idx
      ON career_npc_sponsor_relationships(career_save_id,npc_id,category) WHERE status='ACTIVE'`);
    await tx.execute(sql`
      CREATE OR REPLACE FUNCTION career_npc_sponsor_relationship_snapshot_guard() RETURNS trigger AS $$
      BEGIN
        IF NEW.career_save_id IS DISTINCT FROM OLD.career_save_id OR NEW.id IS DISTINCT FROM OLD.id OR
          NEW.npc_id IS DISTINCT FROM OLD.npc_id OR NEW.sponsor_key IS DISTINCT FROM OLD.sponsor_key OR
          NEW.category IS DISTINCT FROM OLD.category OR NEW.representative_id IS DISTINCT FROM OLD.representative_id OR
          NEW.start_season IS DISTINCT FROM OLD.start_season OR NEW.start_week IS DISTINCT FROM OLD.start_week OR
          NEW.sponsor_snapshot IS DISTINCT FROM OLD.sponsor_snapshot THEN
          RAISE EXCEPTION 'Career sponsor relationship identity and historical snapshot are immutable';
        END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql
    `);
    await tx.execute(sql`DROP TRIGGER IF EXISTS career_npc_sponsor_relationship_snapshot_guard ON career_npc_sponsor_relationships`);
    await tx.execute(sql`CREATE TRIGGER career_npc_sponsor_relationship_snapshot_guard
      BEFORE UPDATE ON career_npc_sponsor_relationships FOR EACH ROW EXECUTE FUNCTION career_npc_sponsor_relationship_snapshot_guard()`);
  });
}
