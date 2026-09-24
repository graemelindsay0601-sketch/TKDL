/**
 * Interview Desk — question selection + request creation.
 *
 * Shared by the admin test-fire endpoint now, and by the real Story Engine
 * trigger hook once the user's approved the previewed experience and asks
 * for it to be "plugged in properly" (per the plan's Phase 1 list:
 * MAJOR_UPSET, WIN_STREAK, 180_MILESTONE). Keeping the selection logic here
 * — rather than inline in the test route — means that real hook-up is a
 * call into this same function, not a second implementation to keep in sync.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { InterviewAudience } from "./interviewDeskMigration";

export type CreatedInterviewRequest = {
  requestId: number;
  triggerType: string;
  audience: InterviewAudience;
  presenter: string;
  promptText: string;
};

/**
 * Picks a question for (playerId, triggerType, audience), excluding the
 * question this exact player was last asked for this exact trigger type
 * where possible (the plan's anti-repeat rule) — then inserts the request
 * row and returns everything the Interview Desk page needs to render.
 */
export async function createInterviewRequest(
  playerId: number,
  triggerType: string,
  audience: InterviewAudience = "participant",
  triggerContext: Record<string, unknown> = {},
  isTest = false
): Promise<CreatedInterviewRequest> {
  const pool = (
    await db.execute(sql`
      SELECT id, presenter, prompt_text FROM interview_questions
      WHERE trigger_type = ${triggerType} AND audience = ${audience}
    `)
  ).rows as Array<{ id: number; presenter: string; prompt_text: string }>;

  if (pool.length === 0) {
    throw new Error(`No interview_questions seeded for trigger_type=${triggerType} audience=${audience}`);
  }

  const lastRow = (
    await db.execute(sql`
      SELECT question_id FROM interview_requests
      WHERE player_id = ${playerId} AND trigger_type = ${triggerType}
      ORDER BY created_at DESC LIMIT 1
    `)
  ).rows[0] as { question_id: number | null } | undefined;

  const lastQuestionId = lastRow?.question_id ?? null;
  const candidates = pool.length > 1 && lastQuestionId != null
    ? pool.filter((q) => q.id !== lastQuestionId)
    : pool;

  const picked = candidates[Math.floor(Math.random() * candidates.length)];

  const inserted = (
    await db.execute(sql`
      INSERT INTO interview_requests (player_id, trigger_type, trigger_context, question_id, status, is_test)
      VALUES (${playerId}, ${triggerType}, ${JSON.stringify(triggerContext)}::jsonb, ${picked.id}, 'pending', ${isTest})
      RETURNING id
    `)
  ).rows[0] as { id: number };

  return {
    requestId: inserted.id,
    triggerType,
    audience,
    presenter: picked.presenter,
    promptText: picked.prompt_text,
  };
}
