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
const detailKey = process.argv.find(x => x.startsWith("--detail="))?.slice(9);
const detail = detailKey ? await rows(sql`SELECT start_week, start_day, status, status_reason, (SELECT COUNT(*)::int FROM career_event_entries e WHERE e.career_save_id=i.career_save_id AND e.event_id=i.id AND e.status<>'WITHDRAWN') entrants
  FROM career_event_instances i WHERE career_save_id=${id} AND season=1 AND definition_key=${detailKey} ORDER BY start_day`) : [];
const byStatus = await rows(sql`SELECT definition_key, status, COUNT(*)::int n, ROUND(AVG((SELECT COUNT(*) FROM career_event_entries e WHERE e.career_save_id=i.career_save_id AND e.event_id=i.id AND e.status<>'WITHDRAWN')))::int avg_entrants
  FROM career_event_instances i WHERE career_save_id=${id} AND season=1 AND definition_key IN (${sql.join((process.argv.find(x => x.startsWith("--keys="))?.slice(7) ?? "-").split(",").map(k => sql`${k}`), sql`, `)}) GROUP BY 1,2 ORDER BY 1,2`);
const lists = await rows(sql`SELECT list_key, COUNT(*)::int n FROM career_ranking_participants WHERE career_save_id=${id} AND current_position IS NOT NULL GROUP BY 1 ORDER BY 1`);
const byCountry = await rows(sql`SELECT definition_key, country, locality_key, field_size, minimum_entrants, COUNT(*) FILTER (WHERE status='CANCELLED' AND status_reason='INSUFFICIENT_ENTRANTS')::int cancelled,
  COUNT(*)::int total, ROUND(AVG((SELECT COUNT(*) FROM career_event_entries e WHERE e.career_save_id=i.career_save_id AND e.event_id=i.id AND e.status<>'WITHDRAWN')) FILTER (WHERE status='COMPLETED'))::int avg_completed_field
  FROM career_event_instances i WHERE career_save_id=${id} AND season=1 AND circuit IN ('GRASSROOTS','COUNTY') GROUP BY 1,2,3,4,5 HAVING COUNT(*) FILTER (WHERE status='CANCELLED' AND status_reason='INSUFFICIENT_ENTRANTS') > 0 ORDER BY 6 DESC`);
console.log(JSON.stringify({ proWorldDepthByWeek: depth, byCountry, cancelled, majors: gated, detail, byStatus, lists }, null, 1));
await a.pg.close();
