import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { fixture } from "../src/lib/__tests__/career-events-fixture.ts";
import { calendarReport } from "../src/career/events/harness.ts";
const start = performance.now();
const f = await fixture();
try {
  const initMs = performance.now() - start;
  const result = await f.events.advance(f.actor, f.save.id, { operationKey: "harness-season-1", season: 1, expectedDay: 0, targetDay: 364 });
  const seasonMs = performance.now() - start - initMs;
  const history = () => f.db.execute(sql`SELECT id,status,draw,result FROM career_events WHERE career_save_id=${f.save.id} AND season=1 ORDER BY id`);
  const before = JSON.stringify((await history()).rows);
  const statuses = (await f.db.execute(sql`SELECT status,cancellation_reason,count(*)::int FROM career_events GROUP BY status,cancellation_reason`)).rows;
  const circuits = (await f.db.execute(sql`SELECT circuit,count(*)::int FROM career_events WHERE status='COMPLETED' GROUP BY circuit ORDER BY circuit`)).rows;
  const diversity = (await f.db.execute(sql`SELECT e.circuit,n.identity->>'country' AS country,count(*)::int FROM career_event_entries n JOIN career_events e ON e.career_save_id=n.career_save_id AND e.id=n.event_id GROUP BY e.circuit,n.identity->>'country' ORDER BY e.circuit,country`)).rows;
  const conflicts = (await f.db.execute(sql`SELECT count(*)::int AS count FROM career_event_entries a JOIN career_event_entries b ON a.career_save_id=b.career_save_id AND a.participant_key=b.participant_key AND a.event_id<b.event_id
    JOIN career_events x ON x.career_save_id=a.career_save_id AND x.id=a.event_id JOIN career_events y ON y.career_save_id=b.career_save_id AND y.id=b.event_id
    WHERE x.start_day<=y.end_day AND y.start_day<=x.end_day AND a.status NOT IN ('WITHDRAWN','MISSED') AND b.status NOT IN ('WITHDRAWN','MISSED')`)).rows[0];
  const entitlements = (await f.db.execute(sql`SELECT count(*)::int AS count FROM career_event_entitlements`)).rows[0];
  const matches = (await f.db.execute(sql`SELECT count(*)::int AS count FROM career_simulated_matches`)).rows[0];
  const entries = (await f.db.execute(sql`SELECT count(*)::int AS count FROM career_event_entries`)).rows[0];
  const crossRegion = (await f.db.execute(sql`SELECT count(*)::int AS count FROM career_event_entries n JOIN career_events e ON e.career_save_id=n.career_save_id AND e.id=n.event_id
    WHERE n.identity->>'country'<>e.snapshot->'venue'->>'country'`)).rows[0];
  const invalidFields = (await f.db.execute(sql`SELECT count(*)::int AS count FROM career_events WHERE status='COMPLETED' AND
    (jsonb_array_length(draw->'field') > (snapshot->'definition'->>'fieldSize')::int OR jsonb_array_length(draw->'field')<2 OR result->>'champion' IS NULL)`)).rows[0];
  const periods = (await f.db.execute(sql`SELECT count(*)::int AS count FROM career_world_periods WHERE kind='PERIOD'`)).rows[0];
  await f.events.closeSeason(f.actor, f.save.id, 1);
  await f.events.closeSeason(f.actor, f.save.id, 1);
  const historyStable = before === JSON.stringify((await history()).rows);
  const offSeasons = (await f.db.execute(sql`SELECT count(*)::int AS count FROM career_world_periods WHERE kind='OFF_SEASON'`)).rows[0];
  const seasons = (await f.db.execute(sql`SELECT season,count(*)::int FROM career_events GROUP BY season ORDER BY season`)).rows;
  if (Number(conflicts.count) || Number(invalidFields.count) || periods.count !== 52 || offSeasons.count !== 1 || !historyStable) throw new Error("Season invariant failed");
  console.log(JSON.stringify({ provider: "SYNTHETIC_A5_TEST_FIXTURE_NOT_PRODUCTION", calendar: calendarReport(), result, initMs, seasonMs, totalMs: performance.now() - start,
    statuses, completedByCircuit: circuits, diversity, scheduleConflicts: conflicts.count, entitlements: entitlements.count, matches: matches.count, entries: entries.count,
    crossCountryEntries: crossRegion.count, invalidFields: invalidFields.count,
    periods: periods.count, offSeasons: offSeasons.count, historyStable, historySha256: createHash("sha256").update(before).digest("hex"), seasons }, null, 2));
} finally { await f.pg.close(); }
