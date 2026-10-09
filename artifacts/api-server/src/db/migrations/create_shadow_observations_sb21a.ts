import { sql } from "drizzle-orm";
import type { ShadowExecutor } from "../../shadow/observation-types.ts";

export const SHADOW_OBSERVATIONS_SB21A = "createShadowObservationsSB21A_v1";
/** New additive ledger entry; no old migration is edited and no backfill is run. */
export async function createShadowObservations(tx: ShadowExecutor): Promise<void> {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS shadow_activities (
    id UUID PRIMARY KEY, source_namespace TEXT NOT NULL, source_id TEXT NOT NULL,
    owner_player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    source_revision INTEGER NOT NULL DEFAULT -1 CHECK (source_revision >= -1),
    payload_hash TEXT, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source_namespace,source_id), CHECK (jsonb_typeof(metadata)='object'))`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS shadow_activity_revisions (
    activity_id UUID NOT NULL REFERENCES shadow_activities(id) ON DELETE CASCADE,
    source_revision INTEGER NOT NULL CHECK(source_revision>=0), payload_hash TEXT NOT NULL,
    snapshot JSONB NOT NULL CHECK(jsonb_typeof(snapshot)='object'), received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(activity_id,source_revision))`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS shadow_observations (
    id UUID PRIMARY KEY, activity_id UUID NOT NULL REFERENCES shadow_activities(id) ON DELETE CASCADE,
    source_revision INTEGER NOT NULL, participant_key TEXT NOT NULL,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE, player_slot INTEGER NOT NULL CHECK(player_slot>=0),
    source_ordinal INTEGER NOT NULL CHECK(source_ordinal>=0), unit TEXT NOT NULL CHECK(unit IN ('DART','VISIT','RESULT')),
    provenance TEXT NOT NULL CHECK(provenance IN ('HUMAN','BOT','NPC','SIMULATION','REPLAY_GENERATED','UNKNOWN')),
    data_quality INTEGER NOT NULL CHECK(data_quality BETWEEN 1 AND 5), training_eligible BOOLEAN NOT NULL,
    exclusion_reason TEXT, payload_hash TEXT NOT NULL, evidence JSONB NOT NULL CHECK(jsonb_typeof(evidence)='object'),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(activity_id,participant_key,source_ordinal),
    FOREIGN KEY(activity_id,source_revision) REFERENCES shadow_activity_revisions(activity_id,source_revision) ON DELETE CASCADE,
    CHECK ((training_eligible AND provenance='HUMAN' AND player_id IS NOT NULL AND exclusion_reason IS NULL AND unit='DART' AND data_quality>=3)
      OR (NOT training_eligible AND exclusion_reason IS NOT NULL)))`);
  await tx.execute(sql`CREATE INDEX IF NOT EXISTS shadow_observations_player_idx ON shadow_observations(player_id,activity_id,source_ordinal) WHERE training_eligible`);
}
