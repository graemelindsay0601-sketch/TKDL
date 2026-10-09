import { z } from "zod";
import { validateDart } from "../shared/darts-rules/index.ts";
import type { ActivitySnapshot, Observation, Participant } from "./observation-types.ts";

const name = z.string().min(1).max(240);
const index = z.number().int().nonnegative();
const time = z.string().datetime().nullable();
const object = z.record(z.string(), z.unknown());
const hit = z.object({ segment: z.number().int(), multiplier: z.number().int(), value: z.number().int() }).strict();
const observation = z.object({
  participantKey: name, ordinal: index, unit: z.enum(["DART", "VISIT", "RESULT"]),
  physicalHit: hit.nullable(), effectiveValue: z.number().finite().nullable(),
  intendedTarget: z.object({ segment: z.number().int(), multiplier: z.number().int(), origin: z.literal("EXPLICIT_INPUT") }).strict().nullable(),
  setIndex: index.nullable(), legIndex: index.nullable(), roundIndex: index.nullable(),
  visitNumber: index.nullable(), dartNumber: index.nullable(), phase: name.nullable(),
  preState: object.nullable(), postState: object.nullable(), occurredAt: time, quality: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
}).strict();
const snapshot = z.object({
  schemaVersion: z.literal(1), namespace: name, sourceId: name, sourceRevision: index,
  ownerPlayerId: z.number().int().positive().nullable(),
  participants: z.array(z.object({ key: name, playerId: z.number().int().positive().nullable(), slot: index,
    provenance: z.enum(["HUMAN", "BOT", "NPC", "SIMULATION", "REPLAY_GENERATED", "UNKNOWN"]) }).strict()).min(1).max(100),
  aliases: z.array(z.object({ namespace: name, sourceId: name }).strict()).max(20),
  gameFamily: name, gameVariant: name, rulesVersion: name, config: object,
  status: z.enum(["IN_PROGRESS", "COMPLETED", "SUPERSEDED"]), occurredAt: time, completedAt: time,
  verification: z.enum(["SERVER_VALIDATED_SELF_REPORTED", "UNVERIFIED"]), observations: z.array(observation).max(6000),
}).strict();

export function validateSnapshot(input: unknown): ActivitySnapshot {
  const s = snapshot.parse(input);
  const participants = new Set(s.participants.map(p => p.key));
  if (participants.size !== s.participants.length || new Set(s.participants.map(p => p.slot)).size !== s.participants.length) throw new Error("Duplicate participant/slot");
  const events = new Set<string>();
  for (const o of s.observations) {
    const key = `${o.participantKey}:${o.ordinal}`;
    if (!participants.has(o.participantKey) || events.has(key)) throw new Error("Unattributed or duplicate source event");
    events.add(key);
    if (o.unit === "DART") {
      if (!validateDart(o.physicalHit) || o.quality < 3) throw new Error("Malformed physical dart");
    } else if (o.physicalHit || o.intendedTarget || o.quality > (o.unit === "VISIT" ? 2 : 1)) throw new Error("Aggregate cannot represent individual darts");
    if (o.quality >= 4 && (!o.preState || !o.postState)) throw new Error("Context required for quality 4/5");
    if (o.quality === 5 && !o.intendedTarget) throw new Error("Explicit aim required for quality 5");
    if (o.intendedTarget && !validateDart({ ...o.intendedTarget, value: o.intendedTarget.segment * o.intendedTarget.multiplier })) throw new Error("Invalid intended target");
  }
  return s;
}

/** Eligibility is computed here, never accepted from a client or a source payload. */
export function exclusionReason(s: ActivitySnapshot, p: Participant, o: Observation): string | null {
  if (s.status === "SUPERSEDED") return "SUPERSEDED";
  if (p.provenance !== "HUMAN") return p.provenance === "UNKNOWN" ? "UNATTRIBUTED" : p.provenance;
  if (p.playerId === null) return "UNATTRIBUTED";
  if (s.verification !== "SERVER_VALIDATED_SELF_REPORTED") return "UNVERIFIED";
  if (s.gameFamily !== "X01") return "UNSUPPORTED_GAME";
  if (o.unit !== "DART") return "INSUFFICIENT_DETAIL";
  return null;
}
