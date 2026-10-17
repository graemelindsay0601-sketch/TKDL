import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { replay } from "../../shared/darts-rules/x01.ts";
import { CAREER_SIMULATION_CONFIG as S, CAREER_WORLD_CONFIG as W, CAREER_DIFFICULTY_CONFIG } from "../world/config.ts";
import { stableUuid } from "../world/random.ts";
import type { Npc } from "../world/types.ts";

/**
 * The human's form and confidence, from what they have actually done:
 *  - live Career matches (every dart is stored, so each match average is exact),
 *  - recent results (live, quick-simmed or walkover wins and losses),
 *  - real-world practice in the last week (Practice tab sessions).
 * Form compares the latest live averages with the player's own longer run and adds recent results;
 * confidence follows streaks and recent results. Neither changes a live match (you throw your own darts):
 * quick-sim plays at this level, and screens use it to tell the story.
 */
export type HumanForm = {
  /** Three-dart average quick-sim plays at (recent live matches weighted over the longer run). */
  skillAverage: number; estimated: boolean;
  /** -1 (struggling) … +1 (on fire). */
  form: number; formLabel: "On fire" | "In form" | "Steady" | "Out of form" | "Struggling";
  /** 0 … 100. */
  confidence: number; confidenceLabel: "Brimming" | "Assured" | "Settled" | "Shaky" | "Fragile";
  recentAverages: number[]; longRunAverage: number | null; recentResults: ("W" | "L")[];
  practice: { sessions: number; darts: number; average: number | null };
};

export const DEFAULT_SKILL_AVERAGE = 45;
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Pure model (oldest first in every list). */
export function formFrom(input: { liveAverages: readonly number[]; results: readonly boolean[]; practice: { sessions: number; darts: number; average: number | null } }): HumanForm {
  const live = input.liveAverages.slice(-30), recent = live.slice(-5), latest = live.slice(-3);
  const longRun = live.length ? mean(live) : null;
  const practiceAvg = input.practice.darts >= 90 ? input.practice.average : null;
  const estimated = !live.length;
  const skill = live.length ? 0.6 * mean(recent) + 0.4 * longRun! : practiceAvg ?? DEFAULT_SKILL_AVERAGE;
  const results = input.results.slice(-10);
  const winRate = results.length ? results.filter(Boolean).length / results.length : 0.5;
  let streak = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === results[results.length - 1]; i--) streak++;
  const signedStreak = results.length ? (results[results.length - 1] ? streak : -streak) : 0;
  // Practice: a real week of throwing keeps you sharp (more so when it is at or above your level).
  const practiceBoost = input.practice.sessions === 0 ? 0
    : clamp(Math.min(input.practice.darts, 900) / 900 * 0.15 + (practiceAvg !== null && longRun !== null ? clamp((practiceAvg - longRun) / 20, -0.05, 0.1) : 0), 0, 0.25);
  const trend = latest.length >= 2 && longRun !== null ? clamp((mean(latest) - longRun) / 8, -1, 1) : 0;
  // Results count for more as they build up (one win is not a hot streak).
  const evidence = Math.min(1, results.length / 6);
  const form = round2(clamp(trend * 0.55 + (winRate - 0.5) * 0.9 * evidence + practiceBoost, -1, 1));
  const confidence = Math.round(clamp(50 + clamp(signedStreak, -5, 5) * 5 + (winRate - 0.5) * 50 * evidence + form * 10, 5, 95));
  return {
    skillAverage: round1(skill), estimated, form,
    formLabel: form >= 0.5 ? "On fire" : form >= 0.2 ? "In form" : form > -0.2 ? "Steady" : form > -0.5 ? "Out of form" : "Struggling",
    confidence, confidenceLabel: confidence >= 80 ? "Brimming" : confidence >= 62 ? "Assured" : confidence >= 40 ? "Settled" : confidence >= 22 ? "Shaky" : "Fragile",
    recentAverages: live.slice(-8).map(round1), longRunAverage: longRun === null ? null : round1(longRun),
    recentResults: results.map(w => w ? "W" : "L"), practice: { ...input.practice, average: practiceAvg === null ? null : round1(practiceAvg) },
  };
}
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Attribute level whose expected average (the simulator's own calibration) matches a three-dart average. */
export const attributeForAverage = (average: number) =>
  clamp((average - S.form.averageBaseline) / (S.form.scoringWeight + S.form.finishingWeight), W.attributeMin, W.attributeMax);

export async function loadHumanForm(tx: CareerExecutor, root: { id: string; player_id?: number | string | null }): Promise<HumanForm> {
  const sessions = (await tx.execute(sql`SELECT s.format, s.first_thrower, s.darts FROM career_match_sessions s
    JOIN career_tournament_matches m ON m.career_save_id = s.career_save_id AND m.id = s.match_id
    WHERE s.career_save_id = ${root.id} AND s.status = 'COMPLETED' AND m.status = 'COMPLETED' AND s.team IS NULL
    ORDER BY s.completed_at DESC LIMIT 30`)).rows.reverse();
  const liveAverages: number[] = [];
  for (const s of sessions) {
    try {
      const state = replay(s.format as never, Number(s.first_thrower) as 0 | 1, s.darts as never);
      const mine = state.visits.filter(v => v.thrower === 0), darts = mine.reduce((n, v) => n + v.darts.length, 0);
      if (state.complete && darts >= 9) liveAverages.push(mine.reduce((n, v) => n + v.points, 0) * 3 / darts);
    } catch { /* evidence from an incompatible format is not measured */ }
  }
  const results = (await tx.execute(sql`SELECT m.winner_key = 'HUMAN' AS won FROM career_tournament_matches m
    JOIN career_event_instances i ON i.career_save_id = m.career_save_id AND i.id = m.event_id
    WHERE m.career_save_id = ${root.id} AND m.status IN ('COMPLETED','WALKOVER') AND (m.a_key = 'HUMAN' OR m.b_key = 'HUMAN')
    ORDER BY i.season DESC, m.scheduled_day DESC, m.round DESC, m.id DESC LIMIT 10`)).rows.map(r => r.won === true).reverse();
  let practice = { sessions: 0, darts: 0, average: null as number | null };
  const playerId = Number(root.player_id ?? (await tx.execute(sql`SELECT player_id FROM career_saves WHERE id = ${root.id}`)).rows[0]?.player_id);
  if (Number.isSafeInteger(playerId)) {
    // The Practice tab lives outside the Career schema (absent in Career-only test databases).
    const exists = (await tx.execute(sql`SELECT to_regclass('public.practice_sessions') IS NOT NULL AS ok`)).rows[0]?.ok === true;
    if (exists) {
      const row = (await tx.execute(sql`SELECT COUNT(*)::int AS sessions,
          COALESCE(SUM(CASE WHEN player1_id = ${playerId} THEN p1_darts ELSE p2_darts END), 0)::int AS darts,
          COALESCE(SUM(CASE WHEN player1_id = ${playerId} THEN p1_score ELSE p2_score END), 0)::int AS score
        FROM practice_sessions WHERE (player1_id = ${playerId} OR player2_id = ${playerId}) AND created_at > NOW() - INTERVAL '7 days'`)).rows[0];
      const darts = Number(row?.darts ?? 0), score = Number(row?.score ?? 0);
      practice = { sessions: Number(row?.sessions ?? 0), darts, average: darts > 0 && score > 0 ? score * 3 / darts : null };
    }
  }
  return formFrom({ liveAverages, results, practice });
}

/** The human as a simulation player: their live level (difficulty-neutral), form and confidence on the opponent's frame. */
export function humanSimulationPlayer(root: { id: string; world_seed: string; difficulty: string }, frame: Npc, form: HumanForm): Npc {
  const level = attributeForAverage(form.skillAverage) - CAREER_DIFFICULTY_CONFIG[root.difficulty as keyof typeof CAREER_DIFFICULTY_CONFIG].abilityOffset;
  const nerve = (form.confidence - 50) / 5;
  const at = (n: number) => Math.min(100, Math.max(1, Math.round(n * 10) / 10));
  return { ...structuredClone(frame), id: stableUuid(root.world_seed, 1, "quick-sim-human", root.id), worldKey: "human:quick-sim", firstName: "You", surname: "Player",
    nickname: null, templateKey: null, status: "ACTIVE", retiredSeason: null, stage: "PRIME",
    ability: { scoring: at(level), finishing: at(level), consistency: at(level), powerScoring: at(level), pressure: at(level + nerve), clutch: at(level + nerve) },
    form: Math.max(-1, Math.min(1, form.form)), tendencies: { local: 0, floor: 0, stage: 0, qualifier: 0, major: 0 } };
}
