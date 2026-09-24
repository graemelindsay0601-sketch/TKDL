/**
 * Interview Desk — live for Phase 1's three real trigger types.
 *
 * A real interview_requests row now gets created two ways: POST
 * /admin/interview-desk/test-fire (admin-only, always is_test=true, for
 * ongoing manual testing/demos — unchanged), and the real path —
 * routes/matches.ts calls interviewDeskService.ts's
 * checkMatchTriggersForInterview() right after a singles match is recorded,
 * which fires a real (is_test=false), real-push interview invite whenever
 * that match qualifies as MAJOR_UPSET, WIN_STREAK, or 180_MILESTONE — the
 * same thresholds the broadcast's own story engine uses for those story
 * types, so an interview only ever fires for something the show itself
 * would also call notable. Nothing about the test-fire route's isolation
 * changed; this file just also gets called from that real trigger now.
 *
 * The player-facing routes (GET/POST below) are real and permanent: a
 * player can only ever see or answer their own interview_requests row,
 * matching the "who's allowed to answer" decision in the plan (server-side
 * ownership check, not just hiding the button client-side).
 *
 * The conversation itself is now a real two-question exchange (opener →
 * reaction → follow-up → sign-off), not a single Q&A — see
 * interviewDeskService.ts's header. POST /answer never trusts a
 * client-supplied "which turn is this" — it derives the expected turn from
 * the request's own stored state, the same way ownership is enforced
 * server-side rather than by what the client sends.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { createInterviewRequest, advanceInterview } from "../lib/interviewDeskService";
import type { InterviewAudience } from "../lib/interviewDeskMigration";
import { logger } from "../lib/logger";

const router = Router();

function sessionPlayerId(req: any): number | null {
  return (req.session as any)?.playerId ?? null;
}
function requireAuth(req: any, res: any): number | false {
  const id = sessionPlayerId(req);
  if (!id) { res.status(401).json({ error: "Login required" }); return false; }
  return id;
}

// ── Admin: what trigger types/audiences are there to test-fire? ────────────
router.get("/admin/interview-desk/trigger-types", requireAdminSession, async (_req, res): Promise<void> => {
  const { rows } = await db.execute(sql`
    SELECT DISTINCT trigger_type, audience FROM interview_questions
    WHERE kind = 'opener'
    ORDER BY trigger_type, audience
  `);
  res.json({ options: rows });
});

// ── Admin: fire a test interview request at a chosen player ────────────────
const TestFireBody = z.object({
  playerId: z.number().int().positive().optional(),
  triggerType: z.string().min(1),
  audience: z.enum(["participant", "spectator"]).optional(),
});

router.post("/admin/interview-desk/test-fire", requireAdminSession, async (req, res): Promise<void> => {
  const adminPlayerId = (req.session as any)?.playerId as number | undefined;
  if (!adminPlayerId) { res.status(401).json({ error: "Login required" }); return; }

  const parsed = TestFireBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const targetId = parsed.data.playerId ?? adminPlayerId;
  const audience = parsed.data.audience ?? "participant";

  try {
    const target = (await db.execute(sql`SELECT id, name FROM players WHERE id = ${targetId}`)).rows[0] as any;
    if (!target) { res.status(404).json({ error: `No player with id ${targetId}` }); return; }

    const created = await createInterviewRequest(
      targetId,
      parsed.data.triggerType,
      audience,
      { source: "admin_test_fire", firedBy: adminPlayerId },
      true
    );

    res.json({ ok: true, target: { id: target.id, name: target.name }, request: created });
  } catch (err: any) {
    const detail = err?.cause?.message ?? err?.message ?? String(err);
    logger.error({ err }, "POST /admin/interview-desk/test-fire failed");
    res.status(400).json({ error: "Failed to create test interview request", detail });
  }
});

// ── Admin: send a real "the hosts want a word" push, with delivery confirmed ──
// Distinct from test-fire above: this awaits the actual push result (VAPID
// configured? player subscribed? did it deliver?) instead of firing and
// forgetting, so the panel can tell the admin exactly what happened — same
// diagnostic depth as the existing general "Send Test Notification" button,
// just for this notification's own content, and sendable to any player so
// it can be confirmed working on someone else's device too.
router.post("/admin/interview-desk/test-notification", requireAdminSession, async (req, res): Promise<void> => {
  const adminPlayerId = (req.session as any)?.playerId as number | undefined;
  if (!adminPlayerId) { res.status(401).json({ error: "Login required" }); return; }

  const parsed = TestFireBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const targetId = parsed.data.playerId ?? adminPlayerId;
  const audience = parsed.data.audience ?? "participant";

  try {
    const target = (await db.execute(sql`SELECT id, name FROM players WHERE id = ${targetId}`)).rows[0] as any;
    if (!target) { res.status(404).json({ error: `No player with id ${targetId}` }); return; }

    const created = await createInterviewRequest(
      targetId,
      parsed.data.triggerType,
      audience,
      { source: "admin_test_notification", firedBy: adminPlayerId },
      true,
      "diagnostic"
    );

    res.json({ ok: true, target: { id: target.id, name: target.name }, request: created });
  } catch (err: any) {
    const detail = err?.cause?.message ?? err?.message ?? String(err);
    logger.error({ err }, "POST /admin/interview-desk/test-notification failed");
    res.status(400).json({ error: "Failed to send test notification", detail });
  }
});

// ── Admin: recent test fires, so the panel can show a running history ──────
router.get("/admin/interview-desk/test-history", requireAdminSession, async (_req, res): Promise<void> => {
  const { rows } = await db.execute(sql`
    SELECT r.id, r.trigger_type, r.status, r.created_at, p.name AS player_name,
           q.audience, q.presenter, q.prompt_text
    FROM interview_requests r
    JOIN players p ON p.id = r.player_id
    LEFT JOIN interview_questions q ON q.id = r.question_id
    WHERE r.is_test = true
    ORDER BY r.created_at DESC
    LIMIT 20
  `);
  res.json({ history: rows });
});

type RequestRow = {
  id: number;
  player_id: number;
  trigger_type: string;
  status: string;
  expires_at: string | null;
  opener_audience: InterviewAudience;
  opener_presenter: string;
  opener_prompt: string;
  followup_question_id: number | null;
  followup_presenter: string | null;
  followup_prompt: string | null;
  reaction_text: string | null;
  reaction_presenter: string | null;
  signoff_text: string | null;
  signoff_presenter: string | null;
  opener_answer_type: string | null;
  opener_answer_text: string | null;
  followup_answer_type: string | null;
  followup_answer_text: string | null;
};

async function loadRequest(id: number): Promise<RequestRow | null> {
  const row = (
    await db.execute(sql`
      SELECT
        r.id, r.player_id, r.trigger_type, r.status, r.expires_at,
        oq.audience AS opener_audience, oq.presenter AS opener_presenter, oq.prompt_text AS opener_prompt,
        r.followup_question_id,
        fq.presenter AS followup_presenter, fq.prompt_text AS followup_prompt,
        r.reaction_text, r.reaction_presenter,
        r.signoff_text, r.signoff_presenter,
        oa.response_type AS opener_answer_type, oa.answer_text AS opener_answer_text,
        fa.response_type AS followup_answer_type, fa.answer_text AS followup_answer_text
      FROM interview_requests r
      LEFT JOIN interview_questions oq ON oq.id = r.question_id
      LEFT JOIN interview_questions fq ON fq.id = r.followup_question_id
      LEFT JOIN interview_answers oa ON oa.request_id = r.id AND oa.turn = 'opener'
      LEFT JOIN interview_answers fa ON fa.request_id = r.id AND fa.turn = 'followup'
      WHERE r.id = ${id}
    `)
  ).rows[0] as RequestRow | undefined;
  return row ?? null;
}

// A request that's still marked "pending" but has drifted past its
// expires_at (nobody polled it in time) gets flipped to 'expired' here
// rather than by a background job — cheap, and there's no other code path
// that needs to know about it until someone actually looks.
async function maybeExpire(row: RequestRow): Promise<RequestRow> {
  if (row.status !== "pending" || !row.expires_at || new Date(row.expires_at).getTime() > Date.now()) return row;
  await db.execute(sql`UPDATE interview_requests SET status = 'expired' WHERE id = ${row.id} AND status = 'pending'`);
  return { ...row, status: "expired" };
}

function serialize(row: RequestRow) {
  const awaitingTurn: "opener" | "followup" | null =
    row.status !== "pending" ? null : !row.opener_answer_type ? "opener" : row.followup_question_id && !row.followup_answer_type ? "followup" : null;

  return {
    id: row.id,
    triggerType: row.trigger_type,
    status: row.status,
    expiresAt: row.expires_at,
    awaitingTurn,
    opener: { presenter: row.opener_presenter, promptText: row.opener_prompt },
    openerAnswer: row.opener_answer_type ? { responseType: row.opener_answer_type, answerText: row.opener_answer_text } : null,
    reaction: row.reaction_text ? { presenter: row.reaction_presenter, text: row.reaction_text } : null,
    followup: row.followup_prompt ? { presenter: row.followup_presenter, promptText: row.followup_prompt } : null,
    followupAnswer: row.followup_answer_type ? { responseType: row.followup_answer_type, answerText: row.followup_answer_text } : null,
    signoff: row.signoff_text ? { presenter: row.signoff_presenter, text: row.signoff_text } : null,
  };
}

// ── Player: fetch one interview request (own only) ──────────────────────────
router.get("/interview-desk/:id", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  let row = await loadRequest(id);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.player_id !== playerId) { res.status(403).json({ error: "Not your interview request" }); return; }
  row = await maybeExpire(row);

  res.json(serialize(row));
});

// ── Player: answer (or decline) whichever turn is currently open ───────────
const AnswerBody = z.object({
  responseType: z.enum(["comment", "declined", "not_involved"]),
  answerText: z.string().max(2000).optional(),
});

router.post("/interview-desk/:id/answer", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = AnswerBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  let row = await loadRequest(id);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.player_id !== playerId) { res.status(403).json({ error: "Not your interview request" }); return; }
  row = await maybeExpire(row);
  if (row.status === "expired") { res.status(409).json({ error: "This one's window has closed" }); return; }
  if (row.status !== "pending") { res.status(409).json({ error: "This interview has already wrapped up" }); return; }

  const turn: "opener" | "followup" | null = !row.opener_answer_type
    ? "opener"
    : row.followup_question_id && !row.followup_answer_type
      ? "followup"
      : null;
  if (!turn) { res.status(409).json({ error: "Nothing left to answer on this interview" }); return; }

  try {
    const result = await advanceInterview(
      id, playerId, row.trigger_type, row.opener_audience, turn, parsed.data.responseType, parsed.data.answerText
    );
    if (result.stage === "expired") { res.status(409).json({ error: "This one's window has closed" }); return; }
    res.json({ ok: true, ...result });
  } catch (err: any) {
    const detail = err?.cause?.message ?? err?.message ?? String(err);
    logger.error({ err }, "POST /interview-desk/:id/answer failed");
    res.status(500).json({ error: "Failed to save answer", detail });
  }
});

export default router;
