import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";
export async function createCareerEvents(db: CareerDatabase) {
  await db.transaction(async tx => {
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_seasons (
      career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
      season INTEGER NOT NULL CHECK(season > 0), event_database_version INTEGER NOT NULL CHECK(event_database_version > 0),
      day INTEGER NOT NULL DEFAULT 0 CHECK(day BETWEEN 0 AND 364), status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','COMPLETED')),
      PRIMARY KEY(career_save_id,season))`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_events (
      career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE, id UUID NOT NULL, season INTEGER NOT NULL,
      instance_key TEXT NOT NULL, circuit TEXT NOT NULL, classification TEXT NOT NULL CHECK(classification IN ('RANKING','QUALIFIER','INVITATIONAL_EXHIBITION','SPECIAL')),
      start_day INTEGER NOT NULL CHECK(start_day BETWEEN 0 AND 363), end_day INTEGER NOT NULL CHECK(end_day BETWEEN start_day AND 363),
      opens_day INTEGER NOT NULL CHECK(opens_day BETWEEN 0 AND start_day), closes_day INTEGER NOT NULL CHECK(closes_day BETWEEN opens_day AND start_day),
      status TEXT NOT NULL CHECK(status IN ('SCHEDULED','REGISTRATION_OPEN','DRAWN','IN_PROGRESS','COMPLETED','CANCELLED')),
      snapshot JSONB NOT NULL CHECK(jsonb_typeof(snapshot)='object'), draw JSONB, result JSONB, cancellation_reason TEXT,
      PRIMARY KEY(career_save_id,id), UNIQUE(career_save_id,season,instance_key),
      FOREIGN KEY(career_save_id,season) REFERENCES career_seasons(career_save_id,season) ON DELETE CASCADE,
      CHECK((status='COMPLETED')=(result IS NOT NULL)), CHECK(status NOT IN ('DRAWN','IN_PROGRESS','COMPLETED') OR draw IS NOT NULL),
      CHECK(classification <> 'SPECIAL' OR COALESCE(snapshot->'definition'->'rankingCategory'='null'::jsonb AND snapshot->'definition'->'qualification'='null'::jsonb,false)))`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_events_calendar_idx ON career_events(career_save_id,season,start_day,id)`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_events_status_idx ON career_events(career_save_id,season,status,circuit)`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_event_entries (
      career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE, event_id UUID NOT NULL, participant_key TEXT NOT NULL, npc_id UUID,
      status TEXT NOT NULL CHECK(status IN ('ENTERED','WITHDRAWN','CONFIRMED','ELIMINATED','CHAMPION','MISSED')),
      identity JSONB NOT NULL CHECK(jsonb_typeof(identity)='object'), PRIMARY KEY(career_save_id,event_id,participant_key),
      CHECK((participant_key='human' AND npc_id IS NULL) OR (npc_id IS NOT NULL AND participant_key=npc_id::text)),
      FOREIGN KEY(career_save_id,event_id) REFERENCES career_events(career_save_id,id) ON DELETE CASCADE,
      FOREIGN KEY(career_save_id,npc_id) REFERENCES career_world_players(career_save_id,id) ON DELETE CASCADE)`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_entries_participant_idx ON career_event_entries(career_save_id,participant_key,status)`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_event_entitlements (
      career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE, source_event_id UUID NOT NULL, participant_key TEXT NOT NULL,
      target_key TEXT NOT NULL, target_kind TEXT NOT NULL CHECK(target_kind IN ('EVENT','FAMILY','STAGE')), target_event_id UUID,
      season INTEGER NOT NULL CHECK(season > 0), status TEXT NOT NULL DEFAULT 'EARNED' CHECK(status IN ('EARNED','CONSUMED','REVOKED')),
      earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(career_save_id,source_event_id,participant_key,target_key),
      FOREIGN KEY(career_save_id,source_event_id,participant_key) REFERENCES career_event_entries(career_save_id,event_id,participant_key) ON DELETE CASCADE,
      FOREIGN KEY(career_save_id,target_event_id) REFERENCES career_events(career_save_id,id) ON DELETE CASCADE)`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_entitlement_target_idx ON career_event_entitlements(career_save_id,season,participant_key,target_key,status)`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_calendar_operations (
      career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE, operation_key TEXT NOT NULL CHECK(length(operation_key) BETWEEN 1 AND 120),
      request JSONB NOT NULL, result JSONB NOT NULL, PRIMARY KEY(career_save_id,operation_key))`);
    // Root deletion still cascades. These triggers prevent rewriting established sporting facts, not deletion of a universe.
    await tx.execute(sql`CREATE OR REPLACE FUNCTION career_event_immutable() RETURNS trigger AS $$ DECLARE prior_match JSONB; BEGIN
      IF NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.season <> OLD.season OR NEW.instance_key <> OLD.instance_key
        OR NEW.start_day <> OLD.start_day OR NEW.end_day <> OLD.end_day OR NEW.opens_day <> OLD.opens_day OR NEW.closes_day <> OLD.closes_day
        OR NEW.circuit <> OLD.circuit OR NEW.classification <> OLD.classification THEN RAISE EXCEPTION 'Career event snapshot is immutable'; END IF;
      IF OLD.status IN ('COMPLETED','CANCELLED') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Career event history is immutable'; END IF;
      IF OLD.draw IS NOT NULL AND (NEW.draw IS NULL OR NEW.draw->'slots' IS DISTINCT FROM OLD.draw->'slots'
        OR NEW.draw->'field' IS DISTINCT FROM OLD.draw->'field' OR NEW.draw->'seeds' IS DISTINCT FROM OLD.draw->'seeds') THEN RAISE EXCEPTION 'Career field/draw is locked'; END IF;
      IF NEW.status <> OLD.status AND NOT (
        (OLD.status='SCHEDULED' AND NEW.status IN ('REGISTRATION_OPEN','DRAWN','CANCELLED')) OR
        (OLD.status='REGISTRATION_OPEN' AND NEW.status IN ('DRAWN','CANCELLED')) OR
        (OLD.status='DRAWN' AND NEW.status IN ('IN_PROGRESS','COMPLETED')) OR
        (OLD.status='IN_PROGRESS' AND NEW.status='COMPLETED')) THEN RAISE EXCEPTION 'Invalid Career event transition'; END IF;
      IF OLD.draw IS NOT NULL THEN
        FOR prior_match IN SELECT m FROM jsonb_array_elements(OLD.draw->'rounds') r, jsonb_array_elements(r) m WHERE m->>'winner' IS NOT NULL LOOP
          IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.draw->'rounds') r, jsonb_array_elements(r) m WHERE m=prior_match) THEN RAISE EXCEPTION 'Completed Career match is immutable'; END IF;
        END LOOP;
      END IF;
      RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await tx.execute(sql`DROP TRIGGER IF EXISTS career_event_immutable_trigger ON career_events`);
    await tx.execute(sql`CREATE TRIGGER career_event_immutable_trigger BEFORE UPDATE ON career_events FOR EACH ROW EXECUTE FUNCTION career_event_immutable()`);
    await tx.execute(sql`CREATE OR REPLACE FUNCTION career_entry_locked() RETURNS trigger AS $$ BEGIN
      IF EXISTS(SELECT 1 FROM career_events WHERE career_save_id=NEW.career_save_id AND id=NEW.event_id AND draw IS NOT NULL) THEN
        IF TG_OP='INSERT' THEN RAISE EXCEPTION 'Career field is locked'; END IF;
        IF NEW.identity IS DISTINCT FROM OLD.identity OR NEW.npc_id IS DISTINCT FROM OLD.npc_id OR NEW.participant_key<>OLD.participant_key OR NEW.event_id<>OLD.event_id THEN RAISE EXCEPTION 'Career field identity is immutable'; END IF;
      END IF;
      RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await tx.execute(sql`DROP TRIGGER IF EXISTS career_entry_locked_trigger ON career_event_entries`);
    await tx.execute(sql`CREATE TRIGGER career_entry_locked_trigger BEFORE INSERT OR UPDATE ON career_event_entries FOR EACH ROW EXECUTE FUNCTION career_entry_locked()`);
    await tx.execute(sql`CREATE OR REPLACE FUNCTION career_entitlement_source() RETURNS trigger AS $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM career_events WHERE career_save_id=NEW.career_save_id AND id=NEW.source_event_id AND status='COMPLETED' AND classification <> 'SPECIAL') THEN RAISE EXCEPTION 'Qualification requires a completed sporting result'; END IF;
      RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await tx.execute(sql`DROP TRIGGER IF EXISTS career_entitlement_source_trigger ON career_event_entitlements`);
    await tx.execute(sql`CREATE TRIGGER career_entitlement_source_trigger BEFORE INSERT ON career_event_entitlements FOR EACH ROW EXECUTE FUNCTION career_entitlement_source()`);
  });
}
