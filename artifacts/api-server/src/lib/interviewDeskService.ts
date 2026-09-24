/**
 * Interview Desk — question selection + the actual conversation flow.
 *
 * Shared by the admin test-fire endpoint now, and by the real Story Engine
 * trigger hook once the user's approved the previewed experience and asks
 * for it to be "plugged in properly" (per the plan's Phase 1 list:
 * MAJOR_UPSET, WIN_STREAK, 180_MILESTONE). Keeping this logic here — rather
 * than inline in routes/interview-desk.ts — means that real hook-up is a
 * call into this same function, not a second implementation to keep in sync.
 *
 * The conversation shape (opener → reaction → follow-up → sign-off) mirrors
 * a real post-match interview rather than a single Q&A exchange — see
 * interviewDeskMigration.ts's header for why. Everything's still a fixed,
 * pre-written script (no AI call, no per-answer generation) — matching how
 * the rest of TKDL's content banks work — the "conversation" comes from
 * sequencing four kinds of pre-written line, not from generating new ones.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { InterviewAudience, InterviewQuestionKind } from "./interviewDeskMigration";

const GENERIC = "GENERIC";

type QuestionRow = { id: number; presenter: string; prompt_text: string };

async function pickQuestion(
  triggerType: string,
  audience: InterviewAudience,
  kind: InterviewQuestionKind,
  playerId: number,
  excludeTriggerScoped: boolean
): Promise<QuestionRow> {
  const pool = (
    await db.execute(sql`
      SELECT id, presenter, prompt_text FROM interview_questions
      WHERE trigger_type = ${triggerType} AND audience = ${audience} AND kind = ${kind}
    `)
  ).rows as QuestionRow[];

  if (pool.length === 0) {
    throw new Error(`No interview_questions seeded for trigger_type=${triggerType} audience=${audience} kind=${kind}`);
  }
  if (pool.length === 1 || !excludeTriggerScoped) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Anti-repeat: don't hand the same player the same line twice in a row
  // for the same trigger type + kind. Reactions/sign-offs use trigger_type
  // GENERIC, so this naturally also keeps those varied across a player's
  // last request of ANY trigger type, not just this one.
  const column = kind === "opener" ? "question_id" : kind === "followup" ? "followup_question_id" : null;
  let lastId: number | null = null;
  if (column) {
    const lastRow = (
      await db.execute(sql`
        SELECT ${sql.raw(column)} AS qid FROM interview_requests
        WHERE player_id = ${playerId} AND trigger_type = ${triggerType} AND ${sql.raw(column)} IS NOT NULL
        ORDER BY created_at DESC LIMIT 1
      `)
    ).rows[0] as { qid: number } | undefined;
    lastId = lastRow?.qid ?? null;
  }

  const candidates = lastId != null ? pool.filter((q) => q.id !== lastId) : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export type CreatedInterviewRequest = {
  requestId: number;
  triggerType: string;
  audience: InterviewAudience;
  opener: { presenter: string; promptText: string };
};

export async function createInterviewRequest(
  playerId: number,
  triggerType: string,
  audience: InterviewAudience = "participant",
  triggerContext: Record<string, unknown> = {},
  isTest = false
): Promise<CreatedInterviewRequest> {
  const opener = await pickQuestion(triggerType, audience, "opener", playerId, true);

  const inserted = (
    await db.execute(sql`
      INSERT INTO interview_requests (player_id, trigger_type, trigger_context, question_id, status, is_test)
      VALUES (${playerId}, ${triggerType}, ${JSON.stringify(triggerContext)}::jsonb, ${opener.id}, 'pending', ${isTest})
      RETURNING id
    `)
  ).rows[0] as { id: number };

  return {
    requestId: inserted.id,
    triggerType,
    audience,
    opener: { presenter: opener.presenter, promptText: opener.prompt_text },
  };
}

export type AdvanceResult =
  | { stage: "followup"; status: "pending"; reaction: { presenter: string; text: string }; followup: { presenter: string; promptText: string } }
  | { stage: "signoff"; status: "answered" | "declined"; reaction: { presenter: string; text: string } | null; signoff: { presenter: string; text: string } };

/**
 * Advances one request by one answered turn. `turn` must be derived
 * server-side from the request's own state (see routes/interview-desk.ts)
 * — never trust a client-supplied turn, since it decides which columns get
 * written.
 */
export async function advanceInterview(
  requestId: number,
  playerId: number,
  triggerType: string,
  audience: InterviewAudience,
  turn: "opener" | "followup",
  responseType: "comment" | "declined" | "not_involved",
  answerText: string | undefined
): Promise<AdvanceResult> {
  await db.execute(sql`
    INSERT INTO interview_answers (request_id, turn, response_type, answer_text)
    VALUES (${requestId}, ${turn}, ${responseType}, ${answerText ?? null})
  `);

  if (turn === "opener" && responseType === "comment") {
    const reaction = await pickQuestion(GENERIC, "participant", "reaction", playerId, true);
    const followup = await pickQuestion(triggerType, audience === "spectator" ? "participant" : audience, "followup", playerId, true);
    await db.execute(sql`
      UPDATE interview_requests
      SET followup_question_id = ${followup.id}, reaction_text = ${reaction.prompt_text}, reaction_presenter = ${reaction.presenter}
      WHERE id = ${requestId}
    `);
    return {
      stage: "followup",
      status: "pending",
      reaction: { presenter: reaction.presenter, text: reaction.prompt_text },
      followup: { presenter: followup.presenter, promptText: followup.prompt_text },
    };
  }

  // Either the opener was declined/skipped (straight to sign-off, no
  // follow-up), or this was the follow-up turn itself (comment or not) —
  // both cases end the interview.
  const signoff = await pickQuestion(GENERIC, "participant", "signoff", playerId, true);
  const status = turn === "followup" && responseType === "comment" ? "answered" : "declined";
  await db.execute(sql`
    UPDATE interview_requests
    SET signoff_text = ${signoff.prompt_text}, signoff_presenter = ${signoff.presenter}, status = ${status}
    WHERE id = ${requestId}
  `);
  return {
    stage: "signoff",
    status,
    reaction: null,
    signoff: { presenter: signoff.presenter, text: signoff.prompt_text },
  };
}
