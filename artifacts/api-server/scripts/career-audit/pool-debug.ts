/** DEV-ONLY: why an event cannot fill — advance a fresh save to a week, then report the eligible NPC pool. */
import { sql } from "drizzle-orm";
import { auditDatabase } from "./db.ts";
const key = process.argv[2] ?? "north-american-tour", week = Number(process.argv[3] ?? 24), countries = (process.argv[4] ?? "USA,CAN").split(",");
const a = await auditDatabase();
const s = await a.saves.create(1, { slot: 1, careerName: "Pool", dateOfBirth: "2000-06-15", homeLocality: "ayrshire" });
await a.career.initialize(a.actor, s.id);
let op = 0;
for (;;) { const r = await a.saves.read(1, s.id); if (r.currentWeek >= week) break;
  await a.career.calendar.advance(a.actor, s.id, { operationKey: `pool-debug-${op++}`, expectedSeason: 1, expectedWeek: r.currentWeek, target: { kind: "WEEKS", weeks: 1 } }); }
const ev = (await a.rows(sql`SELECT id, start_day, end_day, status FROM career_event_instances WHERE career_save_id=${s.id} AND definition_key=${key} AND start_week=${week} ORDER BY start_day LIMIT 1`))[0];
const npcs = await a.rows(sql`SELECT p.id, p.nationality, p.status, p.tier, p.professional_status, p.age,
  EXISTS(SELECT 1 FROM career_tour_cards c WHERE c.career_save_id=p.career_save_id AND c.participant_key=p.id::text AND c.status='ACTIVE') card,
  (SELECT string_agg(i.definition_key, ',') FROM career_participant_bookings b JOIN career_event_instances i ON i.career_save_id=b.career_save_id AND i.id=b.event_id
    WHERE b.career_save_id=p.career_save_id AND b.participant_key=p.id::text AND b.day BETWEEN ${ev.start_day} AND ${ev.end_day}) booked
  FROM career_world_players p WHERE p.career_save_id=${s.id} AND p.nationality IN (${sql.join(countries.map(c => sql`${c}`), sql`, `)})`);
console.log("event", JSON.stringify(ev));
const tally: Record<string, number> = {};
for (const n of npcs) { const k = n.status !== "ACTIVE" ? "inactive" : n.card ? "card" : n.booked ? `booked:${n.booked}` : "free"; tally[k] = (tally[k] ?? 0) + 1; }
console.log(JSON.stringify(tally, null, 1));
// Play the week, then show where those players were booked on the event's days.
await a.career.calendar.advance(a.actor, s.id, { operationKey: `pool-debug-${op++}`, expectedSeason: 1, expectedWeek: week, target: { kind: "WEEKS", weeks: 1 } });
const after = await a.rows(sql`SELECT i.definition_key, i.country, i.calendar_priority, COUNT(*)::int n FROM career_participant_bookings b JOIN career_event_instances i ON i.career_save_id=b.career_save_id AND i.id=b.event_id
  JOIN career_world_players p ON p.career_save_id=b.career_save_id AND p.id::text=b.participant_key
  WHERE b.career_save_id=${s.id} AND b.day BETWEEN ${ev.start_day} AND ${ev.end_day} AND p.nationality IN (${sql.join(countries.map(c => sql`${c}`), sql`, `)}) GROUP BY 1,2,3 ORDER BY 4 DESC`);
console.log("after the week:", JSON.stringify(after), "event status", JSON.stringify((await a.rows(sql`SELECT status, status_reason FROM career_event_instances WHERE career_save_id=${s.id} AND id=${ev.id}`))[0]));
await a.pg.close();
