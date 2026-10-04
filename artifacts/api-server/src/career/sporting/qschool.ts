import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import type { InstanceRow, RootRow } from "../calendar/engine.ts";
import type { SportingResult } from "../calendar/providers.ts";
import type { QSchoolPathway } from "../calendar/eligibility.ts";
import { stableUuid } from "../world/random.ts";
import { Q_SCHOOL_RULES_V1, TOUR_CARD_RULES_V1, qSchoolPoints } from "./config.ts";
import { awardCard } from "./cards.ts";

export const PATHWAYS: readonly QSchoolPathway[] = ["UK_IRELAND", "EUROPE"];

/** Persist Q-School results (points only from the Final Stage) from immutable A3 results. Idempotent. */
export async function recordQSchoolResults(tx: CareerExecutor, root: RootRow, rulesVersion: number, event: InstanceRow, results: readonly SportingResult[]) {
  const q = event.snapshot.qSchool;
  if (!q || !results.length) return 0;
  const rows = results.map(r => ({ participant_key: r.participant_key, participant_kind: r.participant_kind, npc_id: r.npc_id, finishing_position: r.finishing_position,
    points: q.stage === "FINAL" ? qSchoolPoints(r.finishing_position) : 0, legs_for: r.legs_for, legs_against: r.legs_against }));
  await tx.execute(sql`INSERT INTO career_qschool_results (career_save_id, event_id, participant_key, participant_kind, npc_id, season, pathway, stage, series_day,
      finishing_position, points, legs_for, legs_against, q_school_rules_version)
    SELECT ${root.id}::uuid, ${event.id}::uuid, r.participant_key, r.participant_kind, r.npc_id, ${event.season}, ${q.pathway}, ${q.stage}, ${q.day},
      r.finishing_position, r.points, r.legs_for, r.legs_against, ${rulesVersion}
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS r(participant_key text, participant_kind text, npc_id uuid, finishing_position integer, points integer,
      legs_for integer, legs_against integer)
    ON CONFLICT (career_save_id, event_id, participant_key) DO NOTHING`);
  return rows.length;
}

export type OomEntry = { participantKey: string; participantKind: string; npcId: string | null; points: number; bestDayFinish: number; scoringDays: number;
  latestDayPoints: number; legDifference: number; legsWon: number; daysPlayed: number; tieKey: string; position: number };

/** Q-School Order of Merit for (season, pathway), derived only from persisted Final Stage results. */
export async function orderOfMerit(tx: CareerExecutor, root: RootRow, rulesVersion: number, season: number, pathway: QSchoolPathway): Promise<{ entries: OomEntry[]; latestDay: number }> {
  const rows = (await tx.execute(sql`SELECT participant_key, participant_kind, npc_id, series_day, finishing_position, points, legs_for, legs_against FROM career_qschool_results
    WHERE career_save_id = ${root.id} AND season = ${season} AND pathway = ${pathway} AND stage = 'FINAL'`)).rows;
  const latestDay = rows.reduce((m, r) => Math.max(m, Number(r.series_day)), 0);
  const by = new Map<string, OomEntry>();
  for (const r of rows) {
    const key = String(r.participant_key);
    const e = by.get(key) ?? { participantKey: key, participantKind: String(r.participant_kind), npcId: r.npc_id ? String(r.npc_id) : null, points: 0, bestDayFinish: Number.MAX_SAFE_INTEGER,
      scoringDays: 0, latestDayPoints: 0, legDifference: 0, legsWon: 0, daysPlayed: 0, tieKey: stableUuid(root.world_seed, rulesVersion, "q-school-tiebreak", season, pathway, key), position: 0 };
    const pts = Number(r.points);
    e.points += pts; e.bestDayFinish = Math.min(e.bestDayFinish, Number(r.finishing_position)); e.scoringDays += pts > 0 ? 1 : 0; e.daysPlayed++;
    if (Number(r.series_day) === latestDay) e.latestDayPoints = pts;
    e.legDifference += Number(r.legs_for) - Number(r.legs_against); e.legsWon += Number(r.legs_for);
    by.set(key, e);
  }
  const entries = [...by.values()].sort(compareOom);
  entries.forEach((e, i) => { e.position = i + 1; });
  return { entries, latestDay };
}
/** Documented OoM tie-break hierarchy (config Q_SCHOOL_RULES_V1.tieBreaks). */
export function compareOom(a: OomEntry, b: OomEntry) {
  return b.points - a.points || a.bestDayFinish - b.bestDayFinish || b.scoringDays - a.scoringDays || b.latestDayPoints - a.latestDayPoints
    || b.legDifference - a.legDifference || b.legsWon - a.legsWon || (a.tieKey < b.tieKey ? -1 : a.tieKey > b.tieKey ? 1 : 0);
}

export async function finalStageDays(tx: CareerExecutor, saveId: string, season: number, pathway: QSchoolPathway) {
  return (await tx.execute(sql`SELECT id, series_day, status, champion_participant_key, champion_npc_id, start_week FROM career_event_instances WHERE career_save_id = ${saveId} AND season = ${season}
    AND snapshot->'qSchool'->>'pathway' = ${pathway} AND snapshot->'qSchool'->>'stage' = 'FINAL' ORDER BY series_day`)).rows;
}

/**
 * Card allocation once every Final Stage day of a pathway is finished:
 *  1. each day's winner earns a card directly (in day order); a repeat winner or a
 *     cancelled day leaves that direct card unused and it rolls into the OoM;
 *  2. remaining cards go down the Order of Merit (excluding direct winners and anyone
 *     already holding a live card), minimum points apply.
 * Persisted once per (season, pathway); retries return the stored allocation.
 */
export async function allocateQSchool(tx: CareerExecutor, root: RootRow, rulesVersion: number, tourCardVersion: number, season: number, week: number, pathway: QSchoolPathway) {
  const stored = (await tx.execute(sql`SELECT * FROM career_qschool_allocations WHERE career_save_id = ${root.id} AND season = ${season} AND pathway = ${pathway}`)).rows[0];
  if (stored) return { created: false, allocation: stored };
  const days = await finalStageDays(tx, root.id, season, pathway);
  if (!days.length || days.some(d => d.status !== "COMPLETED" && d.status !== "CANCELLED")) return null;
  const rules = Q_SCHOOL_RULES_V1;
  const holders = new Set((await tx.execute(sql`SELECT participant_key FROM career_tour_cards WHERE career_save_id = ${root.id} AND status = 'ACTIVE'`)).rows.map(r => String(r.participant_key)));
  const { entries } = await orderOfMerit(tx, root, rulesVersion, season, pathway);
  const byKey = new Map(entries.map(e => [e.participantKey, e]));
  const awards: { participant: OomEntry; route: "DIRECT" | "ORDER_OF_MERIT"; day: number | null; oomPosition: number | null; eventId: string | null }[] = [];
  const carded = new Set<string>();
  let unused = 0;
  for (const d of days) {
    const winner = d.status === "COMPLETED" ? String(d.champion_participant_key) : null;
    const entry = winner ? byKey.get(winner) : undefined;
    if (!winner || !entry || carded.has(winner) || holders.has(winner)) { unused++; continue; }
    carded.add(winner);
    awards.push({ participant: entry, route: "DIRECT", day: Number(d.series_day), oomPosition: null, eventId: String(d.id) });
  }
  const oomCards = rules.pathways[pathway].orderOfMeritCards + unused;
  for (const e of entries) {
    if (awards.filter(a => a.route === "ORDER_OF_MERIT").length >= oomCards) break;
    if (carded.has(e.participantKey) || holders.has(e.participantKey) || e.points < rules.minimumPointsForCard) continue;
    carded.add(e.participantKey);
    awards.push({ participant: e, route: "ORDER_OF_MERIT", day: null, oomPosition: e.position, eventId: null });
  }
  const standings = entries.slice(0, 64).map(e => ({ position: e.position, participantKey: e.participantKey, points: e.points, bestDayFinish: e.bestDayFinish, scoringDays: e.scoringDays,
    latestDayPoints: e.latestDayPoints, legDifference: e.legDifference, legsWon: e.legsWon, tieKey: e.tieKey, carded: carded.has(e.participantKey) }));
  await tx.execute(sql`INSERT INTO career_qschool_allocations (career_save_id, season, pathway, allocated_week, final_days, completed_days, direct_cards, unused_direct_cards,
      order_of_merit_cards, standings, q_school_rules_version)
    VALUES (${root.id}, ${season}, ${pathway}, ${week}, ${days.length}, ${days.filter(d => d.status === "COMPLETED").length}, ${awards.filter(a => a.route === "DIRECT").length}, ${unused},
      ${awards.filter(a => a.route === "ORDER_OF_MERIT").length}, ${JSON.stringify(standings)}::jsonb, ${rulesVersion})`);
  for (const a of awards) {
    const p = a.participant;
    const result = await awardCard(tx, root, tourCardVersion, { operationKey: `q-school:${season}:${pathway}:${p.participantKey}`, participantKey: p.participantKey,
      participantKind: p.participantKind, npcId: p.npcId, source: a.route === "DIRECT" ? "Q_SCHOOL_DIRECT" : "Q_SCHOOL_ORDER_OF_MERIT",
      detail: { pathway, seriesDay: a.day, orderOfMeritPosition: a.oomPosition, points: p.points }, sourceEventId: a.eventId, season, week,
      startSeason: season, endSeason: season + TOUR_CARD_RULES_V1.termSeasons - 1 });
    if (!result) throw new Error("Q-School allocation would create an overlapping Tour Card");
    await tx.execute(sql`INSERT INTO career_qschool_card_awards (career_save_id, season, pathway, participant_key, route, series_day, order_of_merit_position, points, card_id)
      VALUES (${root.id}, ${season}, ${pathway}, ${p.participantKey}, ${a.route}, ${a.day}, ${a.oomPosition}, ${p.points}, ${result.card.id})`);
  }
  return { created: true, allocation: { season, pathway, direct: awards.filter(a => a.route === "DIRECT").length, orderOfMerit: awards.filter(a => a.route === "ORDER_OF_MERIT").length, unused } };
}
