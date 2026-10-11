import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";

type Executor = Parameters<Parameters<CareerDatabase["transaction"]>[0]>[0];

/**
 * True when the named CHECK constraint already admits `value`, i.e. a later Career
 * migration has widened it. Older migrations replayed after a newer one (the A9 upgrade
 * re-runs A4, or a startup without its migration ledger re-runs everything) must not
 * narrow such a constraint: rows written under the wider vocabulary would fail it.
 */
export async function constraintAlreadyAdmits(tx: Executor, constraint: string, value: string) {
  const row = (await tx.execute(sql`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = ${constraint}`)).rows[0] as { d?: string } | undefined;
  return typeof row?.d === "string" && row.d.includes(`'${value}'`);
}
