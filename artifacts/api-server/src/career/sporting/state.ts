import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { HUMAN, rootIdentity, type RootRow } from "../calendar/engine.ts";
import { ageOn, careerWeekDate } from "../identity/age.ts";
import { stableUuid } from "../world/random.ts";
import { CareerError } from "../service.ts";
import { RANKING_RULES_VERSION, TOUR_CARD_RULES_VERSION, Q_SCHOOL_RULES_VERSION, SUPPORTED_SPORTING_VERSIONS } from "./config.ts";

export type SportingState = { ranking_rules_version: number; tour_card_rules_version: number; q_school_rules_version: number; force_publish: boolean; reviewed_season: number };

/**
 * Per-save A5 state: pins the rules versions the save is played under. Created
 * once (idempotent); founding Tour Cards are issued in the same step by the caller.
 */
export async function loadSportingState(tx: CareerExecutor, saveId: string): Promise<SportingState | null> {
  const row = (await tx.execute(sql`SELECT * FROM career_sporting_state WHERE career_save_id = ${saveId}`)).rows[0] as SportingState | undefined;
  if (!row) return null;
  if (!SUPPORTED_SPORTING_VERSIONS.ranking.some(v => v === Number(row.ranking_rules_version)) || !SUPPORTED_SPORTING_VERSIONS.tourCard.some(v => v === Number(row.tour_card_rules_version))
    || !SUPPORTED_SPORTING_VERSIONS.qSchool.some(v => v === Number(row.q_school_rules_version))) throw new CareerError(409, "Career sporting rules require a version migration");
  return row;
}
export async function createSportingState(tx: CareerExecutor, saveId: string): Promise<boolean> {
  const created = await tx.execute(sql`INSERT INTO career_sporting_state (career_save_id, ranking_rules_version, tour_card_rules_version, q_school_rules_version)
    SELECT ${saveId}, CASE WHEN event_database_version>=3 THEN 2 ELSE 1 END, ${TOUR_CARD_RULES_VERSION}, ${Q_SCHOOL_RULES_VERSION}
    FROM career_saves WHERE id=${saveId} ON CONFLICT DO NOTHING RETURNING career_save_id`);
  return created.rows.length > 0;
}

export type Milestone = { operationKey: string; participantKey: string; participantKind: string; npcId: string | null; kind: string; listKey?: string | null; season: number; week: number; detail?: Record<string, unknown> };
/** Idempotent factual milestones (one row per operation key). No prose. */
export async function recordMilestones(tx: CareerExecutor, root: RootRow, milestones: readonly Milestone[]) {
  if (!milestones.length) return;
  // A6.5: the human's age on the milestone's Career date is persisted as a fact (for A7; no narrative).
  const identity = rootIdentity(root as RootRow & { identity_dob?: unknown; identity_start?: unknown });
  const withAge = (m: Milestone) => m.participantKey === HUMAN && identity?.dateOfBirth
    ? { ...(m.detail ?? {}), humanAge: ageOn(identity.dateOfBirth, careerWeekDate(identity.careerStartDate, m.season, Math.min(52, Math.max(1, m.week)))) }
    : m.detail ?? {};
  const rows = milestones.map(m => ({ id: stableUuid(root.world_seed, RANKING_RULES_VERSION, "sporting-milestone", root.id, m.operationKey), operation_key: m.operationKey,
    participant_key: m.participantKey, participant_kind: m.participantKind, npc_id: m.npcId, kind: m.kind, list_key: m.listKey ?? null, season: m.season, week: m.week, detail: withAge(m) }));
  for (let i = 0; i < rows.length; i += 400) {
    await tx.execute(sql`INSERT INTO career_sporting_milestones (career_save_id, id, operation_key, participant_key, participant_kind, npc_id, kind, list_key, season, week, detail)
      SELECT ${root.id}::uuid, m.id, m.operation_key, m.participant_key, m.participant_kind, m.npc_id, m.kind, m.list_key, m.season, m.week, m.detail
      FROM jsonb_to_recordset(${JSON.stringify(rows.slice(i, i + 400))}::jsonb) AS m(id uuid, operation_key text, participant_key text, participant_kind text, npc_id uuid,
        kind text, list_key text, season integer, week integer, detail jsonb)
      ON CONFLICT (career_save_id, operation_key) DO NOTHING`);
  }
}
