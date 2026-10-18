import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../database.ts";
import { ensureCareerMaintenance } from "../../db/migrations/create_career_world.ts";

/** Recorded once every stored copy of a tournament match's simulation has been removed. */
const DONE_KEY = "remove-tournament-match-copies-v1";

/**
 * Tournament matches used to store a second copy of each simulation (career_simulated_matches, keys "a3:…"): a few KB a
 * match, most of a long save's database, and never read (the tournament match is the record). New matches no longer
 * write one. This removes the copies stored before, a batch at a time in short transactions so play carries on
 * meanwhile, then records that it is done so later starts skip it. Other recorded simulations are kept.
 */
export async function removeTournamentMatchCopies(database: CareerDatabase, options: { batch?: number; pauseMs?: number } = {}): Promise<number> {
  const batch = options.batch ?? 2000, pauseMs = options.pauseMs ?? 50;
  await database.transaction(ensureCareerMaintenance);
  if ((await database.execute(sql`SELECT 1 FROM career_maintenance WHERE key = ${DONE_KEY}`)).rows.length) return 0;
  let after = { save: "00000000-0000-0000-0000-000000000000", id: "00000000-0000-0000-0000-000000000000" }, removed = 0;
  for (;;) {
    const page = await database.transaction(async tx => {
      const keys = (await tx.execute(sql`SELECT career_save_id, id FROM career_simulated_matches
        WHERE (career_save_id, id) > (${after.save}::uuid, ${after.id}::uuid) ORDER BY career_save_id, id LIMIT ${batch}`)).rows;
      if (!keys.length) return { keys, removed: 0 };
      const last = keys[keys.length - 1];
      const removed = (await tx.execute(sql`DELETE FROM career_simulated_matches
        WHERE (career_save_id, id) > (${after.save}::uuid, ${after.id}::uuid) AND (career_save_id, id) <= (${String(last.career_save_id)}::uuid, ${String(last.id)}::uuid)
          AND match_key LIKE 'a3:%' RETURNING 1`)).rows.length;
      return { keys, removed };
    });
    removed += page.removed;
    if (page.keys.length < batch) break;
    const last = page.keys[page.keys.length - 1];
    after = { save: String(last.career_save_id), id: String(last.id) };
    if (pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs));
  }
  // The table is now (nearly) empty: rewriting it is instant and gives the space back, which plain vacuuming would not.
  if (Number((await database.execute(sql`SELECT COUNT(*)::int AS n FROM career_simulated_matches`)).rows[0]?.n ?? 0) < 10_000)
    await database.execute(sql`VACUUM FULL career_simulated_matches`);
  await database.execute(sql`INSERT INTO career_maintenance (key) VALUES (${DONE_KEY}) ON CONFLICT DO NOTHING`);
  return removed;
}
