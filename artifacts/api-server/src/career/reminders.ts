import { sql } from "drizzle-orm";
import type { CareerExecutor } from "./database.ts";

/**
 * Career reminders. Career time only moves when the player plays, so nothing happens while they are away; what helps is
 * a nudge when they have left a Career for a few days with something waiting in it. One reminder per absence (the key
 * is the save's last activity), only for something real, and never for a Career left for more than a month.
 */
export const REMINDER = { afterDays: 3, giveUpAfterDays: 30 } as const;

export type CareerReminder = { playerId: number; saveId: string; title: string; body: string; url: string; dedupeKey: string };

export async function findCareerReminders(tx: CareerExecutor): Promise<CareerReminder[]> {
  // Each player's most recently played active Career, if it has been left long enough (and not too long).
  const saves = (await tx.execute(sql`SELECT DISTINCT ON (player_id) id, player_id, career_name, current_season, current_week, updated_at
    FROM career_saves WHERE status = 'ACTIVE'
      AND updated_at < NOW() - make_interval(days => ${REMINDER.afterDays}) AND updated_at > NOW() - make_interval(days => ${REMINDER.giveUpAfterDays})
    ORDER BY player_id, updated_at DESC`)).rows;
  const out: CareerReminder[] = [];
  for (const s of saves) {
    const id = String(s.id), season = Number(s.current_season), week = Number(s.current_week);
    const match = (await tx.execute(sql`SELECT i.name FROM career_tournament_matches m JOIN career_event_instances i ON i.career_save_id = m.career_save_id AND i.id = m.event_id
      WHERE m.career_save_id = ${id} AND m.status = 'AWAITING_HUMAN' AND (m.a_key = 'HUMAN' OR m.b_key = 'HUMAN') LIMIT 1`)).rows[0];
    const booked = match ? undefined : (await tx.execute(sql`SELECT i.name, i.start_week FROM career_event_entries e
      JOIN career_event_instances i ON i.career_save_id = e.career_save_id AND i.id = e.event_id
      WHERE e.career_save_id = ${id} AND e.participant_key = 'HUMAN' AND e.status IN ('ENTERED', 'CONFIRMED') AND i.season = ${season}
        AND i.status NOT IN ('COMPLETED', 'CANCELLED') ORDER BY i.start_day LIMIT 1`)).rows[0];
    const offer = match || booked ? undefined : (await tx.execute(sql`SELECT 1 FROM career_sponsor_offers WHERE career_save_id = ${id} AND status = 'AVAILABLE'
      AND (expires_season > ${season} OR (expires_season = ${season} AND expires_week >= ${week})) LIMIT 1`)).rows[0];
    const body = match ? `Your match at ${match.name} is waiting for you at the oche.`
      : booked ? `You're booked into ${booked.name} in week ${booked.start_week}. Play on when you're ready.`
      : offer ? "A sponsor's offer is waiting for your answer before it runs out." : null;
    if (!body) continue;
    out.push({ playerId: Number(s.player_id), saveId: id, title: s.career_name ? `${s.career_name}: your Career is waiting` : "Your Career is waiting", body,
      url: `/career/${id}/play`, dedupeKey: `career-reminder:${id}:${new Date(String(s.updated_at)).toISOString()}` });
  }
  return out;
}
