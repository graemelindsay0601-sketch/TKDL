/**
 * DEV-ONLY: one NPC-only season on a fresh save, then report cancelled events by definition and
 * the pro-world ranking depth at the weeks where ranking-gated majors draw their fields.
 *   node scripts/career-audit/season1-check.ts
 */
import { sql } from "drizzle-orm";
import { auditDatabase } from "./db.ts";
const a = await auditDatabase();
const { saves, career, rows, actor } = a;
const s = await saves.create(1, { slot: 1, careerName: "S1 check", dateOfBirth: "2000-06-15", homeLocality: "ayrshire" });
const id = s.id as string;
await career.initialize(actor, id);
const depth: Record<number, number> = {};
let op = 0;
for (let w = 1; w <= 52; w++) {
  const r = await saves.read(1, id);
  if (r.currentSeason > 1) break;
  depth[r.currentWeek] = Number((await rows(sql`SELECT COUNT(*)::int n FROM career_ranking_participants WHERE career_save_id=${id} AND list_key='pro-world' AND current_position IS NOT NULL`))[0].n);
  await career.calendar.advance(actor, id, { operationKey: `s1check-advance-${op++}`, expectedSeason: r.currentSeason, expectedWeek: r.currentWeek, target: { kind: "WEEKS", weeks: 1 } });
}
const cancelled = await rows(sql`SELECT definition_key, circuit, status_reason, COUNT(*)::int n, MIN(start_week)::int first_week FROM career_event_instances
  WHERE career_save_id=${id} AND season=1 AND status='CANCELLED' GROUP BY 1,2,3 ORDER BY 2,1`);
const gated = await rows(sql`SELECT definition_key, start_week, status, (SELECT COUNT(*)::int FROM career_event_results r WHERE r.career_save_id=i.career_save_id AND r.event_id=i.id) entrants
  FROM career_event_instances i WHERE career_save_id=${id} AND season=1 AND circuit IN ('MAJOR','WORLD_CHAMPIONSHIP') AND classification='RANKING' ORDER BY start_week`);
console.log(JSON.stringify({ proWorldDepthByWeek: depth, cancelled, majors: gated }, null, 1));
await a.pg.close();
