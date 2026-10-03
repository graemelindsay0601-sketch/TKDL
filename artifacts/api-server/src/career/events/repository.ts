import { sql } from "drizzle-orm";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CAREER_FEATURE } from "../config.ts";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { createCareerWorldService, type CareerActor } from "../world/service.ts";
import type { StoredEvent, EventSnapshot, Entrant } from "./types.ts";
import { catalogue, generateSeason } from "./catalogue.ts";

export type Root = { id: string; status: "ACTIVE" | "RETIRED"; current_season: number; current_week: number; event_database_version: number; world_seed: string; has_tour_card: boolean };
export async function lockRoot(tx: CareerExecutor, actor: CareerActor, id: string, active = true): Promise<Root> {
  careerIdSchema.parse(id);
  if (!Number.isSafeInteger(actor.playerId) || actor.playerId < 1) throw new CareerError(404, "Career not found");
  const flag = (await tx.execute(sql`SELECT enabled,admin_test_mode FROM feature_flags WHERE feature_name=${CAREER_FEATURE}`)).rows[0];
  if (!(flag?.enabled || (flag?.admin_test_mode && actor.isAdmin === true))) throw new CareerError(404, "Career not available");
  const root = (await tx.execute(sql`SELECT * FROM career_saves WHERE id=${id} AND player_id=${actor.playerId} FOR UPDATE`)).rows[0];
  if (!root) throw new CareerError(404, "Career not found");
  if (active && root.status !== "ACTIVE") throw new CareerError(409, "Career is retired");
  catalogue(Number(root.event_database_version));
  return root as Root;
}
/** A2 executes within the already owned/locked outer transaction; no independent commit or nested connection. */
export const worldIn = (tx: CareerExecutor) => createCareerWorldService({ execute: q => tx.execute(q), transaction: work => work(tx) } satisfies CareerDatabase);
export async function initializeSeason(tx: CareerExecutor, actor: CareerActor, root: Root) {
  await worldIn(tx).initialize(actor, root.id);
  const old = (await tx.execute(sql`SELECT * FROM career_seasons WHERE career_save_id=${root.id} AND season=${root.current_season}`)).rows[0];
  if (old) return;
  const world = (await tx.execute(sql`SELECT period FROM career_world_state WHERE career_save_id=${root.id}`)).rows[0];
  if (root.current_week !== 1 || Number(world?.period) !== 0) throw new CareerError(409, "Advanced A2 save needs an explicit calendar migration");
  const events = generateSeason(root.world_seed, root.event_database_version, root.current_season);
  await tx.execute(sql`INSERT INTO career_seasons(career_save_id,season,event_database_version) VALUES(${root.id},${root.current_season},${root.event_database_version})`);
  await tx.execute(sql`INSERT INTO career_events(career_save_id,id,season,instance_key,circuit,classification,start_day,end_day,opens_day,closes_day,status,snapshot)
    SELECT ${root.id}::uuid,p.id,p.season,p.key,p.circuit,p.classification,p.start,p.finish,p.opens,p.closes,
      CASE WHEN p.opens=0 THEN 'REGISTRATION_OPEN' ELSE 'SCHEDULED' END,p.snapshot
    FROM jsonb_to_recordset(${JSON.stringify(events.map(e => ({ id: e.id, season: e.season, key: e.key, circuit: e.definition.circuit, classification: e.definition.classification,
      start: e.startDay, finish: e.endDay, opens: e.opensDay, closes: e.closesDay, snapshot: e })))}::jsonb)
      AS p(id uuid,season integer,key text,circuit text,classification text,start integer,finish integer,opens integer,closes integer,snapshot jsonb)`);
}
export async function seasonState(tx: CareerExecutor, root: Root) {
  const state = (await tx.execute(sql`SELECT * FROM career_seasons WHERE career_save_id=${root.id} AND season=${root.current_season}`)).rows[0];
  if (!state) throw new CareerError(409, "Initialize Career calendar first");
  return { day: Number(state.day), status: String(state.status), season: Number(state.season) };
}
export function eventFrom(row: Record<string, unknown>): StoredEvent {
  return { ...(row.snapshot as EventSnapshot), status: row.status as StoredEvent["status"], draw: row.draw as StoredEvent["draw"], result: row.result as StoredEvent["result"], cancellationReason: row.cancellation_reason as string | null };
}
export async function loadEvent(tx: CareerExecutor, saveId: string, eventId: string) {
  careerIdSchema.parse(eventId);
  const row = (await tx.execute(sql`SELECT * FROM career_events WHERE career_save_id=${saveId} AND id=${eventId}`)).rows[0];
  if (!row) throw new CareerError(404, "Career event not found");
  return eventFrom(row);
}
export async function saveEvent(tx: CareerExecutor, saveId: string, event: StoredEvent) {
  await tx.execute(sql`UPDATE career_events SET status=${event.status}, draw=${event.draw ? JSON.stringify(event.draw) : null}::jsonb,
    result=${event.result ? JSON.stringify(event.result) : null}::jsonb,cancellation_reason=${event.cancellationReason} WHERE career_save_id=${saveId} AND id=${event.id}`);
}
export async function putEntry(tx: CareerExecutor, saveId: string, eventId: string, who: Entrant, status = "ENTERED") {
  await tx.execute(sql`INSERT INTO career_event_entries(career_save_id,event_id,participant_key,npc_id,status,identity)
    VALUES(${saveId},${eventId},${who.key},${who.npcId},${status},${JSON.stringify(who)}::jsonb)
    ON CONFLICT(career_save_id,event_id,participant_key) DO UPDATE SET status=EXCLUDED.status,identity=EXCLUDED.identity`);
}
export async function conflicts(tx: CareerExecutor, saveId: string, event: EventSnapshot) {
  return (await tx.execute(sql`SELECT n.participant_key,e.id,e.start_day,e.end_day FROM career_event_entries n JOIN career_events e ON e.career_save_id=n.career_save_id AND e.id=n.event_id
    WHERE n.career_save_id=${saveId} AND e.season=${event.season} AND e.id<>${event.id} AND e.start_day<=${event.endDay} AND e.end_day>=${event.startDay}
    AND n.status NOT IN ('WITHDRAWN','MISSED') AND e.status<>'CANCELLED'`)).rows;
}
export async function entitlementKeys(tx: CareerExecutor, saveId: string, event: EventSnapshot) {
  const rows = (await tx.execute(sql`SELECT participant_key FROM career_event_entitlements WHERE career_save_id=${saveId} AND season=${event.season}
    AND status='EARNED' AND ((target_kind='EVENT' AND target_event_id=${event.id}) OR (target_kind IN ('FAMILY','STAGE') AND target_key=${event.definition.family}))`)).rows;
  return new Set(rows.map(r => String(r.participant_key)));
}
