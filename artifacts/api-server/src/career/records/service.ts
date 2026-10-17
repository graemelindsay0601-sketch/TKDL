import { sql } from "drizzle-orm";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { post } from "../finance/ledger.ts";
import { candidatesFrom, mergeRecords, RECORDS, RECORD_KEYS, type RecordEntry, type RecordKey, type RecordMatch, type RecordSource } from "./model.ts";

type Row = Record<string, unknown>;
const matchFrom = (r: Row): RecordMatch => ({
  id: String(r.id), eventId: String(r.event_id), aKey: r.a_key ? String(r.a_key) : null, bKey: r.b_key ? String(r.b_key) : null,
  legsA: Number(r.legs_a ?? 0), legsB: Number(r.legs_b ?? 0), day: Number(r.scheduled_day), season: Number(r.season),
  resultSource: r.result_source ? String(r.result_source) : null, summary: r.summary && typeof r.summary === "object" ? r.summary as Record<string, unknown> : null,
  tier: String(r.presentation_tier), pairs: Number(r.side_size ?? 1) === 2,
});
const entryFrom = (r: Row): RecordEntry => ({ key: String(r.record_key) as RecordKey, participantKey: String(r.participant_key), matchId: String(r.match_id),
  eventId: String(r.event_id), value: Number(r.value), season: Number(r.season), day: Number(r.day), source: String(r.source) as RecordSource });
/** Steel-tip only: soft-tip (master out, fat bull) statistics are not comparable (a treble finish allows a 180 checkout). */
const STEEL_TIP = sql`COALESCE(i.snapshot->'format'->>'outRule','DOUBLE')<>'MASTER'`;
const MATCH_COLUMNS = sql`m.id,m.event_id,m.a_key,m.b_key,m.legs_a,m.legs_b,m.scheduled_day,m.result_source,m.summary,i.season,i.presentation_tier,
  COALESCE((i.snapshot->'format'->>'sideSize')::int,1) AS side_size`;

async function replaceRecords(tx: CareerExecutor, saveId: string, candidates: RecordEntry[]) {
  if (!candidates.length) return;
  const existing = (await tx.execute(sql`SELECT * FROM career_world_records WHERE career_save_id=${saveId}`)).rows.map(entryFrom);
  const kept = mergeRecords(existing, candidates);
  const before = new Set(existing.map(e => `${e.key}|${e.matchId}|${e.participantKey}`)), after = new Set(kept.map(e => `${e.key}|${e.matchId}|${e.participantKey}`));
  if (before.size === after.size && [...after].every(k => before.has(k))) return;
  await tx.execute(sql`DELETE FROM career_world_records WHERE career_save_id=${saveId}`);
  await tx.execute(sql`INSERT INTO career_world_records (career_save_id,record_key,participant_key,match_id,event_id,value,season,day,source)
    SELECT ${saveId}::uuid,r.record_key,r.participant_key,r.match_id,r.event_id,r.value,r.season,r.day,r.source
    FROM jsonb_to_recordset(${JSON.stringify(kept.map(e => ({ record_key: e.key, participant_key: e.participantKey, match_id: e.matchId, event_id: e.eventId,
      value: e.value, season: e.season, day: e.day, source: e.source })))}::jsonb)
    AS r(record_key text,participant_key text,match_id uuid,event_id uuid,value numeric,season integer,day integer,source text)`);
}

/** Called as events finish: their matches are the only new evidence, so the book never rescans the save. */
export async function updateWorldRecords(tx: CareerExecutor, saveId: string, events: readonly { id: string }[]) {
  if (!events.length) return;
  await ensureBook(tx, saveId, events.map(e => e.id));
  const ids = sql.join(events.map(e => sql`${e.id}::uuid`), sql`,`);
  // Both sides limited to these events: without i.id the planner reads every instance in the save (its JSON included) each week.
  const rows = (await tx.execute(sql`SELECT ${MATCH_COLUMNS} FROM career_tournament_matches m
    JOIN career_event_instances i ON i.career_save_id=m.career_save_id AND i.id=m.event_id
    WHERE m.career_save_id=${saveId} AND m.status='COMPLETED' AND ${STEEL_TIP} AND m.event_id IN (${ids}) AND i.id IN (${ids})`)).rows;
  const matches = rows.map(matchFrom), candidates = candidatesFrom(matches);
  await replaceRecords(tx, saveId, candidates);
  await payNineDartBonuses(tx, saveId, candidates, matches);
}

/** The nine-dart bonus for the human at televised events (real tours pay one); the ledger key makes it once per match. */
export const NINE_DART_BONUS_PENCE = { TELEVISED: 2_500_000, MAJOR: 5_000_000, WORLD: 5_000_000 } as const;
async function payNineDartBonuses(tx: CareerExecutor, saveId: string, candidates: readonly RecordEntry[], matches: readonly RecordMatch[]) {
  const mine = candidates.filter(e => e.key === "nine-darter" && e.participantKey === "HUMAN");
  if (!mine.length) return;
  const root = (await tx.execute(sql`SELECT id,world_seed,current_season,current_week FROM career_saves WHERE id=${saveId}`)).rows[0];
  for (const e of mine) {
    const tier = matches.find(m => m.id === e.matchId)?.tier as keyof typeof NINE_DART_BONUS_PENCE | undefined;
    const amount = tier ? NINE_DART_BONUS_PENCE[tier] : undefined;
    if (!amount || !root) continue;
    const event = (await tx.execute(sql`SELECT name FROM career_event_instances WHERE career_save_id=${saveId} AND id=${e.eventId}`)).rows[0];
    await post(tx, { id: saveId, world_seed: String(root.world_seed) }, { operationKey: `nine-dart-bonus:${e.matchId}`, category: "ADJUSTMENT", headline: "EARNINGS",
      amountPence: amount * e.value, reason: `Nine-dart bonus — ${String(event?.name ?? "televised event")}`, season: Number(root.current_season), week: Number(root.current_week),
      eventId: e.eventId, detail: { matchId: e.matchId, nineDarters: e.value, source: e.source } });
  }
}

/**
 * Once per save, the first time the book is touched (an event finishing or a read): a save that already had
 * finished matches is filled from its recorded statistics (the best few per statistic, ORDER BY ... LIMIT in SQL).
 * Nine-darters were not recorded before the book, so for such a save they count from then. Returns had_history.
 */
async function ensureBook(tx: CareerExecutor, saveId: string, batch: readonly string[] = []): Promise<boolean> {
  const state = (await tx.execute(sql`SELECT had_history FROM career_world_records_state WHERE career_save_id=${saveId}`)).rows[0];
  if (state) return state.had_history === true;
  // History = an event that finished before the book existed (the events finishing now are this first batch).
  const outside = batch.length ? sql`AND id NOT IN (${sql.join(batch.map(id => sql`${id}::uuid`), sql`,`)})` : sql``;
  const hadHistory = (await tx.execute(sql`SELECT 1 FROM career_event_instances WHERE career_save_id=${saveId} AND status='COMPLETED' ${outside} LIMIT 1`)).rows.length > 0;
  const claimed = (await tx.execute(sql`INSERT INTO career_world_records_state (career_save_id,had_history) VALUES (${saveId},${hadHistory})
    ON CONFLICT DO NOTHING RETURNING career_save_id`)).rows.length > 0;
  if (!claimed || !hadHistory) return hadHistory;
  // One pass over the recorded statistics, keeping the best few per statistic (each row's JSON is read once).
  const value = (field: string) => sql`GREATEST((m.summary->${field}->>0)::numeric,(m.summary->${field}->>1)::numeric)`;
  const rows = (await tx.execute(sql`WITH scored AS (
      SELECT ${MATCH_COLUMNS},${value("averages")} AS avg,${value("maximums")} AS max180,${value("highestCheckouts")} AS co,
        m.legs_a+m.legs_b>=6 AS long,i.presentation_tier IN ('TELEVISED','MAJOR','WORLD') AS tv
      FROM career_tournament_matches m JOIN career_event_instances i ON i.career_save_id=m.career_save_id AND i.id=m.event_id
      WHERE m.career_save_id=${saveId} AND m.status='COMPLETED' AND m.summary ? 'averages' AND COALESCE(m.result_source,'') NOT IN ('BYE','WALKOVER')
        AND COALESCE((i.snapshot->'format'->>'sideSize')::int,1)=1 AND ${STEEL_TIP})
    SELECT * FROM (SELECT * FROM scored WHERE long ORDER BY avg DESC LIMIT 20) a
    UNION SELECT * FROM (SELECT * FROM scored WHERE long AND tv ORDER BY avg DESC LIMIT 20) t
    UNION SELECT * FROM (SELECT * FROM scored ORDER BY max180 DESC LIMIT 20) x
    UNION SELECT * FROM (SELECT * FROM scored ORDER BY co DESC LIMIT 20) c`)).rows;
  // Live matches keep their statistics under summary.live.facts (not summary.averages): the human's few are read directly.
  const live = (await tx.execute(sql`SELECT ${MATCH_COLUMNS} FROM career_tournament_matches m JOIN career_event_instances i ON i.career_save_id=m.career_save_id AND i.id=m.event_id
    WHERE m.career_save_id=${saveId} AND (m.a_key='HUMAN' OR m.b_key='HUMAN') AND m.status='COMPLETED' AND m.summary ? 'live' AND ${STEEL_TIP}`)).rows;
  const unique = new Map([...rows, ...live].map(r => [String(r.id), r]));
  await replaceRecords(tx, saveId, candidatesFrom([...unique.values()].map(matchFrom)));
  return true;
}

export type WorldRecordsView = {
  records: { key: RecordKey; label: string; unit: string; entries: (RecordEntry & { name: string; eventName: string; you: boolean })[] }[];
  /** Records from saves that existed before the book: nine-darters count from when it was added. */
  nineDartersSince: "START" | "BOOK_ADDED";
};

export function createCareerRecordsService(database: CareerDatabase) {
  return {
    async read(actor: CareerActor, saveId: string): Promise<WorldRecordsView> {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false);
        const hadHistory = await ensureBook(tx, root.id);
        const rows = (await tx.execute(sql`SELECT w.*,i.name AS event_name,
            CASE WHEN w.participant_key='HUMAN' THEN COALESCE(p.display_name,s.career_name,'You') ELSE concat(n.first_name,' ',n.surname) END AS name
          FROM career_world_records w JOIN career_event_instances i ON i.career_save_id=w.career_save_id AND i.id=w.event_id
          JOIN career_saves s ON s.id=w.career_save_id LEFT JOIN career_profiles p ON p.career_save_id=w.career_save_id
          LEFT JOIN career_world_players n ON n.career_save_id=w.career_save_id AND n.id::text=w.participant_key
          WHERE w.career_save_id=${root.id}`)).rows;
        const entries = rows.map(r => ({ ...entryFrom(r), name: String(r.name), eventName: String(r.event_name), you: r.participant_key === "HUMAN" }));
        const ordered = mergeRecords(entries, []).map(e => entries.find(x => x.key === e.key && x.matchId === e.matchId && x.participantKey === e.participantKey)!);
        return {
          records: RECORD_KEYS.map(key => ({ key, label: RECORDS[key].label, unit: RECORDS[key].unit, entries: ordered.filter(e => e.key === key) })),
          nineDartersSince: hadHistory ? "BOOK_ADDED" : "START",
        };
      });
    },
  };
}
