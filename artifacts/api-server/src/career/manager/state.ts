import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { managerByKey } from "./model.ts";

/** Once the tables are known to exist they always will (the schema repair adds them at startup; some test databases skip it). */
let tablesSeen = false;
async function ready(tx: CareerExecutor) {
  if (tablesSeen) return true;
  tablesSeen = (await tx.execute(sql`SELECT to_regclass('career_manager_invites') IS NOT NULL AS ok`)).rows[0]?.ok === true;
  return tablesSeen;
}

/** The manager you have signed now (null when none). Cheap: read wherever money is paid. */
export async function activeManager(tx: CareerExecutor, saveId: string) {
  if (!await ready(tx)) return null;
  const row = (await tx.execute(sql`SELECT id, manager_key FROM career_manager_contracts WHERE career_save_id=${saveId} AND status='ACTIVE'`)).rows[0];
  const def = row ? managerByKey(String(row.manager_key)) : null;
  return row && def ? { contractId: String(row.id), ...def } : null;
}

/** The manager who got you into this event, if one did (their cut of its prize money is owed even after you part company). */
export async function managerInviteFor(tx: CareerExecutor, saveId: string, eventId: string) {
  if (!await ready(tx)) return null;
  const row = (await tx.execute(sql`SELECT manager_key, manager_contract_id FROM career_manager_invites WHERE career_save_id=${saveId} AND event_id=${eventId}`)).rows[0];
  const def = row ? managerByKey(String(row.manager_key)) : null;
  return row && def ? { contractId: String(row.manager_contract_id), ...def } : null;
}

/** Record that your manager got you into these events (the entry itself goes in as normal). */
export async function recordManagerInvites(tx: CareerExecutor, saveId: string, manager: { key: string; contractId: string }, eventIds: readonly string[]) {
  for (const id of eventIds) await tx.execute(sql`INSERT INTO career_manager_invites (career_save_id,event_id,manager_key,manager_contract_id)
    VALUES (${saveId},${id},${manager.key},${manager.contractId}) ON CONFLICT DO NOTHING`);
}
