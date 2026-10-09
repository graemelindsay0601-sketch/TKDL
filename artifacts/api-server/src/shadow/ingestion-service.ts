import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { ShadowExecutor } from "./observation-types.ts";
import { validateSnapshot, exclusionReason } from "./observation-validation.ts";

/** Canonical JSON avoids hashes changing when PostgreSQL jsonb reorders keys. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  return JSON.stringify(value);
}

/** Caller MUST supply a transaction. Source write and projection commit/rollback together.
 * Current rows are the only training candidates. Revision snapshots are audit evidence,
 * not another training dataset. IDs survive corrections at the same logical event key.
 */
export async function ingestSnapshot(tx: ShadowExecutor, input: unknown) {
  const s = validateSnapshot(input);
  const payload = canonicalJson(s);
  const hash = createHash("sha256").update(payload).digest("hex");
  await tx.execute(sql`INSERT INTO shadow_activities (id, source_namespace, source_id, owner_player_id)
    VALUES (${randomUUID()}, ${s.namespace}, ${s.sourceId}, ${s.ownerPlayerId}) ON CONFLICT (source_namespace, source_id) DO NOTHING`);
  const a = (await tx.execute(sql`SELECT * FROM shadow_activities WHERE source_namespace=${s.namespace} AND source_id=${s.sourceId} FOR UPDATE`)).rows[0];
  if (a.owner_player_id !== s.ownerPlayerId) throw new Error("Source owner cannot change");
  if (Number(a.source_revision) > s.sourceRevision) throw new Error("Stale source revision");
  if (Number(a.source_revision) === s.sourceRevision) {
    if (a.payload_hash !== hash) throw new Error("Conflicting source revision");
    return { activityId: String(a.id), duplicate: true };
  }
  const previous = (await tx.execute(sql`SELECT metadata FROM shadow_activities WHERE id=${a.id}`)).rows[0].metadata as Record<string, unknown>;
  if (Number(a.source_revision) >= 0 && canonicalJson(previous.participants) !== canonicalJson(s.participants)) throw new Error("Source participants cannot change");
  const prior = (await tx.execute(sql`SELECT evidence FROM shadow_observations WHERE activity_id=${a.id}`)).rows;
  const eventKey = (o: {participantKey: string; ordinal: number}) => JSON.stringify([o.participantKey,o.ordinal]);
  const old = new Map(prior.map(r => { const o = r.evidence as typeof s.observations[number]; return [eventKey(o), o]; }));
  const keys = new Set(s.observations.map(eventKey));
  const { observations: _, ...metadata } = s;
  // Revision deltas avoid archiving the entire growing match after every visit.
  const audit = { schemaVersion: 1, previousRevision: Number(a.source_revision), metadata,
    upserts: s.observations.filter(o => canonicalJson(old.get(eventKey(o)) ?? null) !== canonicalJson(o)),
    retractions: [...old].filter(([key]) => !keys.has(key)).map(([,o]) => ({participantKey:o.participantKey,ordinal:o.ordinal})) };
  await tx.execute(sql`INSERT INTO shadow_activity_revisions (activity_id, source_revision, payload_hash, snapshot)
    VALUES (${a.id}, ${s.sourceRevision}, ${hash}, ${JSON.stringify(audit)}::jsonb)`);
  // Replace the active projection, retaining prior revisions above. A shorter stream
  // retracts removed events; no authoritative Career row is modified here.
  await tx.execute(sql`DELETE FROM shadow_observations WHERE activity_id=${a.id}`);
  if (s.observations.length) {
    const rows = s.observations.map(o => {
      const p = s.participants.find(p => p.key === o.participantKey)!;
      const reason = exclusionReason(s, p, o);
      const digest = createHash("sha256").update(`${a.id}:${p.key}:${o.ordinal}`).digest("hex");
      const id = `${digest.slice(0,8)}-${digest.slice(8,12)}-${digest.slice(12,16)}-${digest.slice(16,20)}-${digest.slice(20,32)}`;
      return sql`(${id}, ${a.id}, ${s.sourceRevision}, ${p.key}, ${p.playerId}, ${p.slot}, ${o.ordinal}, ${o.unit}, ${p.provenance}, ${o.quality}, ${reason === null}, ${reason}, ${hash}, ${JSON.stringify(o)}::jsonb)`;
    });
    for (let offset = 0; offset < rows.length; offset += 500) {
      await tx.execute(sql`INSERT INTO shadow_observations (id,activity_id,source_revision,participant_key,player_id,player_slot,source_ordinal,unit,provenance,data_quality,training_eligible,exclusion_reason,payload_hash,evidence)
        VALUES ${sql.join(rows.slice(offset, offset + 500), sql`, `)}`);
    }
  }
  await tx.execute(sql`UPDATE shadow_activities SET source_revision=${s.sourceRevision}, payload_hash=${hash}, metadata=${JSON.stringify(metadata)}::jsonb, updated_at=NOW() WHERE id=${a.id}`);
  return { activityId: String(a.id), duplicate: false };
}
