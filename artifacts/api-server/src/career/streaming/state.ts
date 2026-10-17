import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";

/** Once the table is known to exist it always will (the schema repair adds it at startup; some test databases skip it). */
let seen = false;
/** Your stream nights this season (absolute day to stream id): a stream night is booked like any other night. */
export async function streamNights(tx: CareerExecutor, saveId: string, season: number): Promise<Map<number, string>> {
  if (!seen) { seen = (await tx.execute(sql`SELECT to_regclass('career_streams') IS NOT NULL AS ok`)).rows[0]?.ok === true; if (!seen) return new Map(); }
  return new Map((await tx.execute(sql`SELECT day, id FROM career_streams WHERE career_save_id=${saveId} AND season=${season}`)).rows.map(r => [Number(r.day), String(r.id)]));
}
