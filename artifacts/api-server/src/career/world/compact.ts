import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../database.ts";
import { ensureCareerMaintenance } from "../../db/migrations/create_career_world.ts";

/** Recorded once every simulated match stored in the old, full form has been slimmed down. */
const DONE_KEY = "compact-simulated-matches-v1";

/**
 * Simulated matches used to keep the whole simulation input (both players in full) and each side's performance draw,
 * about 5KB a match and most of a long save's database. New matches keep only who played (and their tier) and the
 * result (see storedMatch). This slims the matches stored before that, a batch at a time in short transactions so
 * play carries on meanwhile, then records that it is done so later starts skip it. The space is reused by new rows.
 */
export async function compactSimulatedMatches(database: CareerDatabase, options: { batch?: number; pauseMs?: number } = {}): Promise<number> {
  const batch = options.batch ?? 1000, pauseMs = options.pauseMs ?? 50;
  await database.transaction(ensureCareerMaintenance);
  if ((await database.execute(sql`SELECT 1 FROM career_maintenance WHERE key = ${DONE_KEY}`)).rows.length) return 0;
  let after = { save: "00000000-0000-0000-0000-000000000000", id: "00000000-0000-0000-0000-000000000000" }, compacted = 0;
  for (;;) {
    const page = await database.transaction(async tx => {
      const keys = (await tx.execute(sql`SELECT career_save_id, id FROM career_simulated_matches
        WHERE (career_save_id, id) > (${after.save}::uuid, ${after.id}::uuid) ORDER BY career_save_id, id LIMIT ${batch}`)).rows;
      if (!keys.length) return { keys, updated: 0 };
      const last = keys[keys.length - 1];
      // Full inputs carry the simulation seed; slimmed ones never do.
      const updated = (await tx.execute(sql`UPDATE career_simulated_matches m SET
          input_snapshot = jsonb_build_object('players', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p->>'id', 'tier', p->>'tier'))
            FROM jsonb_array_elements(m.input_snapshot->'players') p), '[]'::jsonb)),
          result = m.result - 'performance' - 'format' - 'context'
        WHERE (m.career_save_id, m.id) >= (${after.save}::uuid, ${after.id}::uuid) AND (m.career_save_id, m.id) <= (${String(last.career_save_id)}::uuid, ${String(last.id)}::uuid)
          AND m.input_snapshot ? 'seed' RETURNING 1`)).rows.length;
      return { keys, updated };
    });
    compacted += page.updated;
    if (page.keys.length < batch) break;
    const last = page.keys[page.keys.length - 1];
    after = { save: String(last.career_save_id), id: String(last.id) };
    if (pauseMs) await new Promise(resolve => setTimeout(resolve, pauseMs));
  }
  await database.execute(sql`INSERT INTO career_maintenance (key) VALUES (${DONE_KEY}) ON CONFLICT DO NOTHING`);
  return compacted;
}
