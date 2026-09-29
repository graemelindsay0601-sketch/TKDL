import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { ProgrammeSegment } from "./director-math.ts";
import { buildInterviewSegment, buildSeasonLaunchSegment, type BroadcastInterviewRow, type SeasonLaunchVoice } from "./interview-feature-math.ts";

type InterviewQueryRow = {
  id: number;
  player_id: number;
  player_name: string;
  trigger_type: string;
  trigger_context: Record<string, unknown> | null;
  completed_at: Date | string;
  opener_presenter: string;
  opener_question: string;
  opener_answer: string;
  followup_presenter: string | null;
  followup_question: string | null;
  followup_answer: string | null;
};

/**
 * Completed, real player interviews that became ready inside this Edition's
 * immutable cutoff window. Test-fire rows and declined/incomplete answers
 * never reach the programme. Limiting the result keeps one interview from
 * overwhelming the sports rundown. The published-programme check also stops
 * a producer season sweep from replaying an interview that already aired.
 */
export async function collectInterviewSegments(
  cutoffStart: Date,
  cutoffEnd: Date,
  limit = 1,
): Promise<ProgrammeSegment[]> {
  const safeLimit = Math.max(1, Math.min(3, Math.trunc(limit)));
  const rows = (await db.execute(sql`
    SELECT
      r.id,
      r.player_id,
      p.name AS player_name,
      r.trigger_type,
      r.trigger_context,
      COALESCE(fa.answered_at, oa.answered_at) AS completed_at,
      oq.presenter AS opener_presenter,
      oq.prompt_text AS opener_question,
      oa.answer_text AS opener_answer,
      fq.presenter AS followup_presenter,
      fq.prompt_text AS followup_question,
      fa.answer_text AS followup_answer
    FROM interview_requests r
    JOIN players p ON p.id = r.player_id
    JOIN interview_questions oq ON oq.id = r.question_id
    JOIN interview_answers oa ON oa.request_id = r.id AND oa.turn = 'opener'
    LEFT JOIN interview_questions fq ON fq.id = r.followup_question_id
    LEFT JOIN interview_answers fa ON fa.request_id = r.id AND fa.turn = 'followup'
    WHERE r.status = 'answered'
      AND r.is_test = FALSE
      AND r.trigger_type <> 'SEASON_LAUNCH'
      AND oa.response_type = 'comment'
      AND oa.answer_text IS NOT NULL
      AND COALESCE(fa.answered_at, oa.answered_at) > ${cutoffStart}
      AND COALESCE(fa.answered_at, oa.answered_at) <= ${cutoffEnd}
      AND NOT EXISTS (
        SELECT 1
        FROM broadcast_editions e
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.programme->'segments', '[]'::jsonb)) AS aired(segment)
        WHERE e.status = 'PUBLISHED'
          AND aired.segment->'facts'->>'interviewId' = r.id::text
      )
    ORDER BY COALESCE(fa.answered_at, oa.answered_at) DESC, r.id DESC
    LIMIT ${safeLimit}
  `)).rows as InterviewQueryRow[];

  const postMatchSegments = rows.reverse().map(row => buildInterviewSegment({
    id: row.id,
    playerId: row.player_id,
    playerName: row.player_name,
    triggerType: row.trigger_type,
    triggerContext: row.trigger_context,
    completedAt: new Date(row.completed_at),
    openerPresenter: row.opener_presenter,
    openerQuestion: row.opener_question,
    openerAnswer: row.opener_answer,
    followupPresenter: row.followup_presenter,
    followupQuestion: row.followup_question,
    followupAnswer: row.followup_answer,
  } satisfies BroadcastInterviewRow));

  const launchRows = (await db.execute(sql`
    SELECT
      r.id, r.player_id, p.name AS player_name, r.trigger_type, r.trigger_context,
      COALESCE(fa.answered_at, oa.answered_at) AS completed_at,
      oq.presenter AS opener_presenter, oq.prompt_text AS opener_question, oa.answer_text AS opener_answer,
      fq.presenter AS followup_presenter, fq.prompt_text AS followup_question, fa.answer_text AS followup_answer
    FROM interview_requests r
    JOIN players p ON p.id = r.player_id
    JOIN seasons s ON s.id::text = r.trigger_context->>'currentSeasonId'
      AND s.league_type = 'singles' AND s.is_active = TRUE
    JOIN interview_questions oq ON oq.id = r.question_id
    JOIN interview_answers oa ON oa.request_id = r.id AND oa.turn = 'opener'
    LEFT JOIN interview_questions fq ON fq.id = r.followup_question_id
    LEFT JOIN interview_answers fa ON fa.request_id = r.id AND fa.turn = 'followup'
    WHERE r.status = 'answered'
      AND r.is_test = FALSE
      AND r.trigger_type = 'SEASON_LAUNCH'
      AND oa.response_type = 'comment'
      AND oa.answer_text IS NOT NULL
      AND COALESCE(fa.answered_at, oa.answered_at) <= ${cutoffEnd}
      AND NOT EXISTS (
        SELECT 1
        FROM broadcast_editions e
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.programme->'segments', '[]'::jsonb)) AS aired(segment)
        CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(aired.segment->'facts'->'interviewIds', '[]'::jsonb)) AS aired_id(id)
        WHERE e.status = 'PUBLISHED' AND aired_id.id = r.id::text
      )
    ORDER BY COALESCE(fa.answered_at, oa.answered_at) ASC, r.id ASC
    LIMIT 4
  `)).rows as InterviewQueryRow[];

  const launchSegment = launchRows.length > 0
    ? [buildSeasonLaunchSegment(launchRows.map(row => ({
        id: row.id,
        playerId: row.player_id,
        playerName: row.player_name,
        triggerType: row.trigger_type,
        triggerContext: row.trigger_context,
        completedAt: new Date(row.completed_at),
        openerPresenter: row.opener_presenter,
        openerQuestion: row.opener_question,
        openerAnswer: row.opener_answer,
        followupPresenter: row.followup_presenter,
        followupQuestion: row.followup_question,
        followupAnswer: row.followup_answer,
        currentSeasonId: Number(row.trigger_context?.currentSeasonId),
        currentSeasonName: String(row.trigger_context?.currentSeasonName ?? "the new season"),
        previousSeasonName: String(row.trigger_context?.previousSeasonName ?? "last season"),
      } satisfies SeasonLaunchVoice)))]
    : [];

  return [...launchSegment, ...postMatchSegments];
}
