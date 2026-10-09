import type { SQL } from "drizzle-orm";

/** Server-internal contract. No HTTP writer or raw-reader is exposed. */
export interface ShadowExecutor { execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>; }
export type Provenance = "HUMAN" | "BOT" | "NPC" | "SIMULATION" | "REPLAY_GENERATED" | "UNKNOWN";
export type Participant = { key: string; playerId: number | null; slot: number; provenance: Provenance };
export type Observation = {
  participantKey: string; ordinal: number; unit: "DART" | "VISIT" | "RESULT";
  physicalHit: { segment: number; multiplier: number; value: number } | null;
  /** Null unless the authority supplies unambiguous per-event scoring semantics. */
  effectiveValue: number | null;
  intendedTarget: { segment: number; multiplier: number; origin: "EXPLICIT_INPUT" } | null;
  setIndex: number | null; legIndex: number | null; roundIndex: number | null;
  visitNumber: number | null; dartNumber: number | null;
  phase: string | null; preState: Record<string, unknown> | null; postState: Record<string, unknown> | null;
  occurredAt: string | null; quality: 1 | 2 | 3 | 4 | 5;
};
export type ActivitySnapshot = {
  schemaVersion: 1; namespace: string; sourceId: string; sourceRevision: number;
  ownerPlayerId: number | null; participants: Participant[];
  aliases: { namespace: string; sourceId: string }[];
  gameFamily: string; gameVariant: string; rulesVersion: string; config: Record<string, unknown>;
  status: "IN_PROGRESS" | "COMPLETED" | "SUPERSEDED";
  occurredAt: string | null; completedAt: string | null;
  verification: "SERVER_VALIDATED_SELF_REPORTED" | "UNVERIFIED";
  observations: Observation[];
};
