import { sql } from "drizzle-orm";
import type { CareerExecutor } from "./database.ts";
import { absoluteDay } from "./calendar/generation.ts";

/**
 * Your own nights that aren't events: a stream, a road trip, a webcam league match, a Pro-Am night. Each is booked like an
 * off-board commitment: no event that night, no team night, no tournament of your own, nothing else of these.
 * Keys are "<kind>:<id>" so the calendar can say what the night is.
 */
const SOURCES = [
  { kind: "stream", table: "career_streams", label: "Streaming night", where: sql`AND format <> 'MATCH'` },
  { kind: "trip", table: "career_road_trips", label: "Road trip", where: sql`` },
  { kind: "league", table: "career_cam_fixtures", label: "Webcam league match", where: sql`AND day IS NOT NULL` },
  { kind: "proam", table: "career_proam_nights", label: "Pro-Am night", where: sql`AND status <> 'CANCELLED'` },
] as const;
export type NightKind = typeof SOURCES[number]["kind"];

/** Once a table is known to exist it always will (the schema repair adds them at startup; some test databases skip it). */
const seen = new Set<string>();
async function exists(tx: CareerExecutor, table: string) {
  if (seen.has(table)) return true;
  if ((await tx.execute(sql`SELECT to_regclass(${table}) IS NOT NULL AS ok`)).rows[0]?.ok === true) seen.add(table);
  return seen.has(table);
}

/** Your own nights this season (absolute day to "<kind>:<id>"). */
export async function offBoardNights(tx: CareerExecutor, saveId: string, season: number): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (const s of SOURCES) {
    if (!await exists(tx, s.table)) continue;
    for (const r of (await tx.execute(sql`SELECT day, id FROM ${sql.raw(s.table)} WHERE career_save_id=${saveId} AND season=${season} ${s.where}`)).rows)
      if (!out.has(Number(r.day))) out.set(Number(r.day), `${s.kind}:${r.id}`);
  }
  return out;
}

/** What one of these nights is called ("Road trip"), or null for anything else (an event, a life commitment). */
export const nightLabel = (key: string) => SOURCES.find(s => key.startsWith(`${s.kind}:`))?.label ?? null;

/** Nights this week you're free (1 = Monday … 7 = Sunday): no event, commitment or night of your own booked. */
export async function freeNightsInWeek(tx: CareerExecutor, saveId: string, season: number, week: number) {
  const taken = new Set((await tx.execute(sql`SELECT day FROM career_participant_bookings WHERE career_save_id=${saveId} AND season=${season} AND participant_key='HUMAN'
      AND day BETWEEN ${absoluteDay(week, 1)} AND ${absoluteDay(week, 7)}
    UNION SELECT day FROM career_life_commitments WHERE career_save_id=${saveId} AND season=${season} AND status='ACCEPTED' AND day BETWEEN ${absoluteDay(week, 1)} AND ${absoluteDay(week, 7)}`))
    .rows.map(r => Number(r.day)));
  for (const day of (await offBoardNights(tx, saveId, season)).keys()) taken.add(day);
  return [1, 2, 3, 4, 5, 6, 7].filter(d => !taken.has(absoluteDay(week, d)));
}

/** Is the human free on this day? */
export async function freeOn(tx: CareerExecutor, saveId: string, season: number, day: number) {
  const booked = (await tx.execute(sql`SELECT 1 FROM career_participant_bookings WHERE career_save_id=${saveId} AND season=${season} AND day=${day} AND participant_key='HUMAN'
    UNION ALL SELECT 1 FROM career_life_commitments WHERE career_save_id=${saveId} AND season=${season} AND day=${day} AND status='ACCEPTED' LIMIT 1`)).rows;
  return booked.length === 0 && !(await offBoardNights(tx, saveId, season)).has(day);
}

export type WeekNight = { dayOfWeek: number; items: { kind: "EVENT" | "LIFE" | NightKind; label: string; id: string }[] };
/** What each night of a week holds: events you're entered in, off-board commitments, and your own nights. */
export async function weekPlan(tx: CareerExecutor, saveId: string, season: number, week: number): Promise<WeekNight[]> {
  const from = absoluteDay(week, 1), to = absoluteDay(week, 7);
  const days: WeekNight[] = [1, 2, 3, 4, 5, 6, 7].map(d => ({ dayOfWeek: d, items: [] }));
  const at = (day: number) => days[day - from];
  for (const r of (await tx.execute(sql`SELECT DISTINCT b.day, i.id, i.name FROM career_participant_bookings b JOIN career_event_instances i ON i.career_save_id=b.career_save_id AND i.id=b.event_id
      WHERE b.career_save_id=${saveId} AND b.season=${season} AND b.participant_key='HUMAN' AND b.day BETWEEN ${from} AND ${to} ORDER BY b.day`)).rows)
    at(Number(r.day)).items.push({ kind: "EVENT", label: String(r.name), id: String(r.id) });
  for (const r of (await tx.execute(sql`SELECT day, id, title FROM career_life_commitments WHERE career_save_id=${saveId} AND season=${season} AND status='ACCEPTED'
      AND day BETWEEN ${from} AND ${to}`)).rows)
    at(Number(r.day)).items.push({ kind: "LIFE", label: String(r.title), id: String(r.id) });
  for (const [day, key] of await offBoardNights(tx, saveId, season)) if (day >= from && day <= to) {
    const [kind, id] = key.split(":") as [NightKind, string];
    at(day).items.push({ kind, label: nightLabel(key)!, id });
  }
  return days;
}
