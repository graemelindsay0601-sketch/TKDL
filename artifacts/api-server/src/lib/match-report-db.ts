/** Loads what writeMatchReport needs for singles league matches, in one query. */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { writeMatchReport, type MatchReport } from "./match-report";
import { ensureMatchDartLogs } from "../routes/match-darts";
import { ensureRecordLog } from "./league-records-db";
import { RECORD_LABELS, type RecordKey } from "./league-records";

export async function matchReports(ids: number[]): Promise<Map<number, MatchReport>> {
  const out = new Map<number, MatchReport>();
  const list = [...new Set(ids.filter(i => Number.isInteger(i) && i > 0))];
  if (!list.length) return out;
  await Promise.all([ensureMatchDartLogs(), ensureRecordLog()]);
  const recs = (await db.execute(sql`SELECT * FROM league_records_broken WHERE match_id IN (${sql.join(list.map(i => sql`${i}`), sql`, `)}) ORDER BY id`)).rows as any[];
  const rows = (await db.execute(sql`
    SELECT m.*, l.winner_darts AS w_log, l.loser_darts AS l_log, h.prior, h.ww, h.lw
    FROM matches m
    LEFT JOIN match_dart_logs l ON l.match_id = m.id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int prior, COUNT(*) FILTER (WHERE p.winner_id = m.winner_id)::int ww, COUNT(*) FILTER (WHERE p.winner_id = m.loser_id)::int lw
      FROM matches p WHERE p.played_at < m.played_at AND p.game_type NOT LIKE 'team_%' AND p.game_type <> 'multi_killer'
        AND ((p.winner_id = m.winner_id AND p.loser_id = m.loser_id) OR (p.winner_id = m.loser_id AND p.loser_id = m.winner_id))
    ) h ON TRUE
    WHERE m.id IN (${sql.join(list.map(i => sql`${i}`), sql`, `)}) AND m.game_type NOT LIKE 'team_%' AND m.game_type <> 'multi_killer'`)).rows as any[];
  for (const r of rows) out.set(Number(r.id), writeMatchReport({
    matchId: Number(r.id), gameType: r.game_type, stake: Number(r.stake), upset: !!r.was_upset_win,
    winner: { name: r.winner_name, darts: r.winner_darts, s100: r.winner_100s, s140: r.winner_140s, s170: r.winner_170s, s180: r.winner_180s, coAttempts: r.winner_checkout_attempts, coHits: r.winner_checkout_hits, log: r.w_log },
    loser: { name: r.loser_name, darts: r.loser_darts, s100: r.loser_100s, s140: r.loser_140s, s170: r.loser_170s, s180: r.loser_180s, coAttempts: r.loser_checkout_attempts, coHits: r.loser_checkout_hits, log: r.l_log },
    records: recs.filter(x => Number(x.match_id) === Number(r.id)).map(x => ({ title: RECORD_LABELS[x.record_key as RecordKey]?.title ?? x.record_key, unit: RECORD_LABELS[x.record_key as RecordKey]?.unit ?? "", playerName: x.player_name, value: Number(x.value), previous: Number(x.previous_value), previousHolder: x.previous_holder })),
    meetingNumber: Number(r.prior) + 1, winnerWinsBefore: Number(r.ww), loserWinsBefore: Number(r.lw),
  }));
  return out;
}
