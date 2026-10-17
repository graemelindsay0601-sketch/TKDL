import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { managerByKey } from "./model.ts";

/** Once the table is known to exist it always will (the schema repair adds it at startup; some test databases skip it). */
let tableSeen = false;

/** The manager you have signed now (null when none). Cheap: read wherever money is paid. */
export async function activeManager(tx: CareerExecutor, saveId: string) {
  if (!tableSeen) {
    if (!(await tx.execute(sql`SELECT to_regclass('career_manager_contracts') IS NOT NULL AS ok`)).rows[0]?.ok) return null;
    tableSeen = true;
  }
  const row = (await tx.execute(sql`SELECT id, manager_key FROM career_manager_contracts WHERE career_save_id=${saveId} AND status='ACTIVE'`)).rows[0];
  const def = row ? managerByKey(String(row.manager_key)) : null;
  return row && def ? { contractId: String(row.id), ...def } : null;
}
