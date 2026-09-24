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
 *
 * Also sends a real notification when a request is created (type
 * "interview_invite", through the same notificationService every other
 * notification in the app uses — nothing new or separately-tested) so the
 * player is actually alerted rather than having to stumble onto it.
 *
 * ── The expiry window ──────────────────────────────────────────────────
 * A request's expires_at is NOT a fixed countdown — it's tied to TKDL
 * LIVE's own broadcast schedule, so the interview genuinely closes "just
 * before it starts to generate" the next episode, per the user's own
 * framing. How that schedule actually works (found in broadcast/
 * edition-slots.ts + broadcast/config.ts, already built for the broadcast
 * feature — nothing new here):
 *   - TKDL LIVE builds a new episode at up to three configurable times a
 *     day (broadcast_midday_time / _evening_time / _night_time, defaults
 *     11:30 / 19:00 / 00:00, Europe/London) — but broadcast_single_daily_
 *     episode defaults ON, which collapses that to just ONE build a day,
 *     at the night time (00:00).
 *   - A background scheduler (index.ts) checks every 60s whether the next
 *     of those instants has arrived and, if so, kicks off the build.
 *   - resolveNextLogicalSlot() (edition-slots.ts) is the pure function
 *     that answers "what's the next one of those instants, from now?" —
 *     getNextBroadcastGenerationTime() below is just that, wired to the
 *     live settings.
 * Practically: with the default single-daily-episode setting, an interview
 * fired at, say, 3pm won't expire until that night's build at midnight —
 * a several-hour window, not minutes. That's a real reflection of how
 * infrequently this app currently generates episodes, not a bug in the
 * timer. If a tighter "must answer within X minutes" window turns out to
 * feel better once this is live, that's a product call to make later —
 * this just makes the window accurate to the real schedule rather than an
 * arbitrary guess.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { InterviewAudience, InterviewQuestionKind } from "./interviewDeskMigration";
import { createNotification, sendTestInterviewInviteNotification } from "../services/notificationService";
import { getBroadcastConfig } from "../broadcast/config";
import { resolveNextLogicalSlot } from "../broadcast/edition-slots";
import { logger } from "./logger";

const GENERIC = "GENERIC";

export async function getNextBroadcastGenerationTime(): Promise<Date> {
  const config = await getBroadcastConfig();
  return resolveNextLogicalSlot(new Date(), config).scheduledFor;
}

type QuestionRow = { id: number; presenter: string; prompt_text: string };

async function pickQuestion(
  triggerType: string,
  audience: InterviewAudience,
  kind: InterviewQuestionKind,
  playerId: number,
  excludeLastUsed: boolean
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
  if (pool.length === 1 || !excludeLastUsed) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Anti-repeat: don't hand the same player the same line twice in a row.
  // Openers/follow-ups are scoped to this trigger type (a player might get
  // MAJOR_UPSET openers on separate nights and shouldn't hear the same
  // one back to back). Reactions/sign-offs are GENERIC — they're not about
  // any one trigger — so they're scoped to the player's last interview of
  // ANY kind instead, otherwise a small reaction pool would repeat within
  // the very same conversation's neighbours.
  const columnByKind: Record<InterviewQuestionKind, string> = {
    opener: "question_id",
    followup: "followup_question_id",
    reaction: "reaction_question_id",
    signoff: "signoff_question_id",
  };
  const column = columnByKind[kind];
  const scopedByTrigger = kind === "opener" || kind === "followup";

  const lastRow = (
    scopedByTrigger
      ? await db.execute(sql`
          SELECT ${sql.raw(column)} AS qid FROM interview_requests
          WHERE player_id = ${playerId} AND trigger_type = ${triggerType} AND ${sql.raw(column)} IS NOT NULL
          ORDER BY created_at DESC LIMIT 1
        `)
      : await db.execute(sql`
          SELECT ${sql.raw(column)} AS qid FROM interview_requests
          WHERE player_id = ${playerId} AND ${sql.raw(column)} IS NOT NULL
          ORDER BY created_at DESC LIMIT 1
        `)
  ).rows[0] as { qid: number } | undefined;

  const lastId = lastRow?.qid ?? null;
  const candidates = lastId != null ? pool.filter((q) => q.id !== lastId) : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export type CreatedInterviewRequest = {
  requestId: number;
  triggerType: string;
  audience: InterviewAudience;
  opener: { presenter: string; promptText: string };
  expiresAt: string;
  /** Only populated when notifyMode is "diagnostic" — the real delivery
   *  result (VAPID configured? subscribed? actually delivered?), same shape
   *  sendTestNotification already returns for the general Test Comms button. */
  notification?: { ok: boolean; reason?: string; detail?: string; sentTo?: number };
};

export async function createInterviewRequest(
  playerId: number,
  triggerType: string,
  audience: InterviewAudience = "participant",
  triggerContext: Record<string, unknown> = {},
  isTest = false,
  // "fire-and-forget" (default) is what a real Story Engine trigger will
  // use later — don't block the caller on a push send. "diagnostic" is for
  // the admin panel's own "Send Test Notification" button, which needs to
  // await the real ok/reason/sentTo result to actually confirm delivery
  // (see sendTestInterviewInviteNotification) rather than assume success.
  notifyMode: "fire-and-forget" | "diagnostic" = "fire-and-forget"
): Promise<CreatedInterviewRequest> {
  const opener = await pickQuestion(triggerType, audience, "opener", playerId, true);
  const expiresAt = await getNextBroadcastGenerationTime();

  const inserted = (
    await db.execute(sql`
      INSERT INTO interview_requests (player_id, trigger_type, trigger_context, question_id, status, is_test, expires_at)
      VALUES (${playerId}, ${triggerType}, ${JSON.stringify(triggerContext)}::jsonb, ${opener.id}, 'pending', ${isTest}, ${expiresAt.toISOString()}::timestamptz)
      RETURNING id, expires_at
    `)
  ).rows[0] as { id: number; expires_at: string };

  // data.url is what lets both the in-app notification list and the push
  // banner's click take the player straight to this specific interview
  // rather than just opening the app and leaving them to go find it.
  const notifTitle = "🎙️ The hosts want a word";
  const notifBody = opener.prompt_text;
  const notifData = { url: `/interview-desk/${inserted.id}`, triggerType, expiresAt: inserted.expires_at };

  let notification: CreatedInterviewRequest["notification"];
  if (notifyMode === "diagnostic") {
    notification = await sendTestInterviewInviteNotification(playerId, notifTitle, notifBody, notifData);
  } else {
    // Same createNotification every other notification type in the app
    // already goes through (match results, achievements, DMs...) — not a
    // new push path.
    void createNotification({ playerId, type: "interview_invite", title: notifTitle, body: notifBody, data: notifData })
      .catch((err) => logger.error({ err, requestId: inserted.id }, "Failed to send interview_invite notification"));
  }

  return {
    requestId: inserted.id,
    triggerType,
    audience,
    opener: { presenter: opener.presenter, promptText: opener.prompt_text },
    expiresAt: inserted.expires_at,
    notification,
  };
}

export type AdvanceResult =
  | { stage: "followup"; status: "pending"; reaction: { presenter: string; text: string }; followup: { presenter: string; promptText: string } }
  | { stage: "signoff"; status: "answered" | "declined"; reaction: { presenter: string; text: string } | null; signoff: { presenter: string; text: string } }
  | { stage: "expired" };

/**
 * Advances one request by one answered turn. `turn` must be derived
 * server-side from the request's own state (see routes/interview-desk.ts)
 * — never trust a client-supplied turn, since it decides which columns get
 * written. Returns { stage: "expired" } without writing an answer if the
 * request's window has already closed — the caller should treat that the
 * same as any other "can't answer this any more" case.
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
  const stillOpen = (
    await db.execute(sql`SELECT 1 FROM interview_requests WHERE id = ${requestId} AND (expires_at IS NULL OR expires_at > NOW())`)
  ).rows[0];
  if (!stillOpen) {
    await db.execute(sql`UPDATE interview_requests SET status = 'expired' WHERE id = ${requestId} AND status = 'pending'`);
    return { stage: "expired" };
  }

  await db.execute(sql`
    INSERT INTO interview_answers (request_id, turn, response_type, answer_text)
    VALUES (${requestId}, ${turn}, ${responseType}, ${answerText ?? null})
  `);

  if (turn === "opener" && responseType === "comment") {
    const reaction = await pickQuestion(GENERIC, "participant", "reaction", playerId, true);
    const followup = await pickQuestion(triggerType, audience === "spectator" ? "participant" : audience, "followup", playerId, true);
    await db.execute(sql`
      UPDATE interview_requests
      SET followup_question_id = ${followup.id},
          reaction_question_id = ${reaction.id}, reaction_text = ${reaction.prompt_text}, reaction_presenter = ${reaction.presenter}
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
    SET signoff_question_id = ${signoff.id}, signoff_text = ${signoff.prompt_text}, signoff_presenter = ${signoff.presenter}, status = ${status}
    WHERE id = ${requestId}
  `);
  return {
    stage: "signoff",
    status,
    reaction: null,
    signoff: { presenter: signoff.presenter, text: signoff.prompt_text },
  };
}
