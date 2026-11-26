/** Spots league records broken by a newly saved singles result and keeps a log of them (Hub banner, TKDL LIVE). */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { RECORD_LABELS, beats, dartsRecordKey, winRuns, type RecordKey } from "./league-records";

let ready: Promise<unknown> | null = null;
export const ensureRecordLog = () => (ready ??= db.execute(sql`CREATE TABLE IF NOT EXISTS league_records_broken (
  id SERIAL PRIMARY KEY, record_key TEXT NOT NULL, match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL, player_name TEXT NOT NULL, value INTEGER NOT NULL,
  previous_value INTEGER NOT NULL, previous_holder TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, record_key))`).catch(e => { ready = null; throw e; }));

const SINGLES = sql`game_type NOT LIKE 'team_%' AND game_type <> 'multi_killer'`;
type Broken = { key: RecordKey; playerId: number; playerName: string; value: number; previous: number; previousHolder: string | null };

export async function detectRecords(matchId: number): Promise<Broken[]> {
  const m: any = (await db.execute(sql`SELECT * FROM matches WHERE id = ${matchId} AND ${SINGLES}`)).rows[0];
  if (!m) return [];
  const out: Broken[] = [];
  const earlier = sql`(played_at < ${m.played_at} OR (played_at = ${m.played_at} AND id < ${m.id})) AND ${SINGLES}`;

  const dk = dartsRecordKey(String(m.game_type));
  if (dk && m.winner_darts != null) {
    const re = dk === "fewest_darts_501" ? "^501(_double_out)?$" : "^301(_double_out)?$";
    const prev: any = (await db.execute(sql`SELECT winner_darts v, winner_name who FROM matches WHERE ${earlier} AND game_type ~* ${re} AND winner_darts > 0 ORDER BY winner_darts, played_at LIMIT 1`)).rows[0];
    if (prev && beats(dk, Number(m.winner_darts), Number(prev.v))) out.push({ key: dk, playerId: m.winner_id, playerName: m.winner_name, value: Number(m.winner_darts), previous: Number(prev.v), previousHolder: prev.who });
  }

  const w180 = Number(m.winner_180s ?? 0), l180 = Number(m.loser_180s ?? 0);
  if (w180 || l180) {
    const prev: any = (await db.execute(sql`SELECT GREATEST(COALESCE(winner_180s,0), COALESCE(loser_180s,0)) v,
      CASE WHEN COALESCE(winner_180s,0) >= COALESCE(loser_180s,0) THEN winner_name ELSE loser_name END who
      FROM matches WHERE ${earlier} ORDER BY 1 DESC, played_at LIMIT 1`)).rows[0];
    const best = Math.max(w180, l180), isW = w180 >= l180;
    if (prev && beats("most_180s", best, Number(prev.v))) out.push({ key: "most_180s", playerId: isW ? m.winner_id : m.loser_id, playerName: isW ? m.winner_name : m.loser_name, value: best, previous: Number(prev.v), previousHolder: prev.who });
  }

  const results = (await db.execute(sql`SELECT winner_id, loser_id FROM matches WHERE (${earlier}) OR id = ${m.id} ORDER BY played_at, id`)).rows as any[];
  const before = winRuns(results.slice(0, -1).map(r => ({ winnerId: Number(r.winner_id), loserId: Number(r.loser_id) })));
  const after = winRuns(results.map(r => ({ winnerId: Number(r.winner_id), loserId: Number(r.loser_id) })));
  const run = after.current.get(Number(m.winner_id)) ?? 0;
  let recordRun = 0, holderId: number | null = null;
  for (const [id, v] of before.longest) if (v > recordRun) { recordRun = v; holderId = id; }
  // Only fire on the win that first takes the record, not every win after it.
  if (beats("win_streak", run, recordRun) && run === recordRun + 1) {
    const holder: any = holderId ? (await db.execute(sql`SELECT name FROM players WHERE id = ${holderId}`)).rows[0] : null;
    out.push({ key: "win_streak", playerId: m.winner_id, playerName: m.winner_name, value: run, previous: recordRun, previousHolder: holderId === Number(m.winner_id) ? null : holder?.name ?? null });
  }

  if (out.length) {
    await ensureRecordLog();
    for (const b of out) await db.execute(sql`INSERT INTO league_records_broken (record_key, match_id, player_id, player_name, value, previous_value, previous_holder)
      VALUES (${b.key}, ${m.id}, ${b.playerId}, ${b.playerName}, ${b.value}, ${b.previous}, ${b.previousHolder}) ON CONFLICT DO NOTHING`);
  }
  return out;
}

export async function recentRecords(days = 7) {
  await ensureRecordLog();
  const rows = (await db.execute(sql`SELECT * FROM league_records_broken WHERE created_at >= NOW() - (${days} || ' days')::interval ORDER BY created_at DESC LIMIT 10`)).rows as any[];
  return rows.map(r => ({ id: r.id, key: r.record_key as RecordKey, title: RECORD_LABELS[r.record_key as RecordKey]?.title ?? r.record_key, unit: RECORD_LABELS[r.record_key as RecordKey]?.unit ?? "",
    matchId: r.match_id, playerId: r.player_id, playerName: r.player_name, value: r.value, previous: r.previous_value, previousHolder: r.previous_holder, at: r.created_at }));
}

/** Which of these matches broke a league record (for the TKDL LIVE ticker). */
export async function recordMatchIds(ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  await ensureRecordLog();
  const rows = (await db.execute(sql`SELECT DISTINCT match_id FROM league_records_broken WHERE match_id IN (${sql.join(ids.map(i => sql`${i}`), sql`, `)})`)).rows as any[];
  return new Set(rows.map(r => Number(r.match_id)));
}
