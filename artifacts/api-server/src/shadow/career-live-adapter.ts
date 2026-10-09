import { sql } from "drizzle-orm";
import { createMatch, throwDart, validateDart, type X01Format, type X01MatchState } from "../shared/darts-rules/index.ts";
import { ingestSnapshot } from "./ingestion-service.ts";
import type { ActivitySnapshot, Observation, ShadowExecutor } from "./observation-types.ts";

const timestamp = (v: unknown) => v == null ? null : new Date(v as string | Date).toISOString();
const context = (s: X01MatchState) => ({ scores: s.scores, opened: s.opened, turn: s.turn, set: s.setNo, leg: s.legNo,
  legs: s.legs, sets: s.sets, totalLegs: s.totalLegs, complete: s.complete, winner: s.winner });

/** Pure projection of a persisted, server-validated Career row, not frontend state.
 * Seat zero is Career's normalization ONLY; the universal contract has no seat rule.
 * Bull-up remains in config/source history: it has ring labels, not physical miss segments.
 */
export function careerSnapshot(row: Record<string, unknown>): ActivitySnapshot {
  if (row.session_version !== 1 || !["IN_PLAY", "COMPLETED"].includes(String(row.status)) || ![0, 1].includes(Number(row.first_thrower)) || row.first_thrower === null) throw new Error("Unsupported Career live recording");
  if (!Number.isSafeInteger(row.player_id) || Number(row.player_id) <= 0 || !Array.isArray(row.darts)) throw new Error("Unattributed or malformed Career recording");
  const owner = Number(row.player_id), human = `player:${owner}`, npc = `npc:${row.opponent_key}`;
  if (typeof row.opponent_key !== "string" || !row.opponent_key) throw new Error("Missing Career opponent");
  let state = createMatch(row.format as X01Format, row.first_thrower as 0 | 1);
  const observations: Observation[] = [];
  for (const [ordinal, raw] of row.darts.entries()) {
    const dart = validateDart(raw);
    if (!dart) throw new Error("Malformed Career dart");
    const before = state;
    const result = throwDart(before, dart); // existing scoring authority; no Shadow scoring logic
    state = result.state;
    observations.push({ participantKey: before.turn === 0 ? human : npc, ordinal, unit: "DART",
      physicalHit: { segment: dart.segment, multiplier: dart.multiplier, value: dart.value }, effectiveValue: null,
      intendedTarget: null, setIndex: before.setNo, legIndex: before.legNo, roundIndex: null,
      visitNumber: before.visits.length + 1, dartNumber: (before.visit?.darts.length ?? 0) + 1,
      phase: result.outcome, preState: context(before), postState: context(state), occurredAt: null, quality: 4 });
  }
  if (state.complete !== (row.status === "COMPLETED")) throw new Error("Career status disagrees with authoritative replay");
  if (typeof row.id !== "string" || typeof row.career_save_id !== "string" || typeof row.match_id !== "string") throw new Error("Missing Career source identity");
  return { schemaVersion: 1, namespace: "CAREER_LIVE", sourceId: `${row.career_save_id}/${row.id}`,
    sourceRevision: Number(row.revision), ownerPlayerId: owner,
    participants: [{ key: human, playerId: owner, slot: 0, provenance: "HUMAN" }, { key: npc, playerId: null, slot: 1, provenance: "NPC" }],
    aliases: [{ namespace: "CAREER_MATCH", sourceId: `${row.career_save_id}/${row.match_id}` }],
    gameFamily: "X01", gameVariant: "CAREER_LIVE", rulesVersion: "TKDL_X01_LIVE_V1",
    config: { format: row.format, firstThrower: row.first_thrower, firstThrowMethod: row.first_throw_method,
      bullFirstOrder: row.bull_first_order, bullThrows: row.bull_throws, sessionVersion: row.session_version },
    status: state.complete ? "COMPLETED" : "IN_PROGRESS", occurredAt: timestamp(row.created_at), completedAt: timestamp(row.completed_at),
    verification: "SERVER_VALIDATED_SELF_REPORTED", observations };
}

/** Called only after Career writes the validated stream, inside that same transaction.
 * Ownership comes from the save join, never from a requested player ID. No public route.
 */
export async function ingestCareerLive(tx: ShadowExecutor, saveId: string, sessionId: string): Promise<void> {
  const row = (await tx.execute(sql`SELECT c.*, s.player_id FROM career_match_sessions c
    JOIN career_saves s ON s.id=c.career_save_id WHERE c.career_save_id=${saveId} AND c.id=${sessionId}`)).rows[0];
  if (!row) throw new Error("Committed Career source not found");
  await ingestSnapshot(tx, careerSnapshot(row));
}
