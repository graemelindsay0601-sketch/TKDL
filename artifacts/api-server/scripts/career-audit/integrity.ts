/**
 * DEV-ONLY integrity probes on an isolated save: advance retry idempotence, stale clock
 * rejection, entry retry, and that sporting/finance reads are stable across a retried advance.
 *   node scripts/career-audit/integrity.ts
 */
import { sql } from "drizzle-orm";
import { auditDatabase } from "./db.ts";
const a = await auditDatabase();
const { saves, career, rows, actor } = a;
const s = await saves.create(1, { slot: 1, careerName: "Integrity", dateOfBirth: "2000-06-15", homeLocality: "ayrshire" });
const id = s.id as string;
await career.initialize(actor, id);
const out: Record<string, unknown> = {};
const tryIt = async (f: () => Promise<unknown>) => { try { return { ok: await f() }; } catch (e: any) { return { status: e.status ?? null, message: String(e.message).slice(0, 140) }; } };
const counts = async () => (await rows(sql`SELECT (SELECT COUNT(*)::int FROM career_finance_entries WHERE career_save_id=${id}) fin,
  (SELECT COUNT(*)::int FROM career_event_results WHERE career_save_id=${id}) res, (SELECT COUNT(*)::int FROM career_ranking_contributions WHERE career_save_id=${id}) contrib`))[0];
const body = { operationKey: "integrity-advance-1", expectedSeason: 1, expectedWeek: 1, target: { kind: "WEEKS", weeks: 1 } };
const first = await career.calendar.advance(actor, id, body) as any;
const c1 = await counts();
const retry = await tryIt(() => career.calendar.advance(actor, id, body));
const c2 = await counts();
out.retrySameKey = { firstTo: first.advancedTo ?? first.now ?? null, retry: (retry as any).ok ? "returned" : retry, countsStable: JSON.stringify(c1) === JSON.stringify(c2), c1, c2 };
out.staleClock = await tryIt(() => career.calendar.advance(actor, id, { ...body, operationKey: "integrity-advance-2" }));
out.reusedKeyDifferentInput = await tryIt(() => career.calendar.advance(actor, id, { ...body, expectedWeek: 2, target: { kind: "WEEKS", weeks: 2 } }));
const r = await saves.read(1, id);
out.clock = { season: r.currentSeason, week: r.currentWeek };
// entry retry: pick an enterable cheap event
const cal = await career.calendar.calendar(actor, id, { scope: "WORLD", fromWeek: r.currentWeek, toWeek: r.currentWeek + 3 }) as any;
const e = cal.events.find((x: any) => x.human?.canEnter);
if (e) {
  const e1 = await tryIt(() => career.calendar.enter(actor, id, { eventId: e.id }));
  const before = await counts();
  const e2 = await tryIt(() => career.calendar.enter(actor, id, { eventId: e.id }));
  const after = await counts();
  out.entryRetry = { event: e.name, first: (e1 as any).ok?.entered ?? e1, second: (e2 as any).ok ?? e2, feeChargedOnce: before.fin === after.fin };
}
console.log(JSON.stringify(out, null, 1));
await a.pg.close();
