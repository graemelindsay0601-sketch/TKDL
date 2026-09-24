/**
 * Interview Desk — TEST/PREVIEW ONLY for now.
 *
 * Nothing here is called from a real game event yet. The only way an
 * interview_requests row gets created right now is POST
 * /admin/interview-desk/test-fire, which an admin fires manually from the
 * admin panel — there is deliberately no Story Engine hook, no push
 * notification, and no touch of any existing notification code path in
 * this file. That's the whole point of it: the user asked to be able to
 * preview and approve how the Interview Desk actually looks and feels
 * before it's "plugged in properly" to real triggers, specifically so nothing
 * about the now-working push notification pipeline is put at risk while
 * this gets evaluated. When the user signs off, wiring this into the real
 * Story Engine (Phase 1: MAJOR_UPSET, WIN_STREAK, 180_MILESTONE) means
 * calling createInterviewRequest() from that detection code and — as a
 * separate, deliberate step — sending a real push through the existing
 * notificationService, not rebuilding any of this.
 *
 * The player-facing routes (GET/POST below) are real and permanent: a
 * player can only ever see or answer their own interview_requests row,
 * matching the "who's allowed to answer" decision in the plan (server-side
 * ownership check, not just hiding the button client-side).
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { createInterviewRequest } from "../lib/interviewDeskService";
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

// ── Player: fetch one interview request (own only) ──────────────────────────
router.get("/interview-desk/:id", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const row = (
    await db.execute(sql`
      SELECT r.id, r.player_id, r.trigger_type, r.trigger_context, r.status, r.created_at,
             q.presenter, q.prompt_text,
             a.response_type, a.answer_text
      FROM interview_requests r
      LEFT JOIN interview_questions q ON q.id = r.question_id
      LEFT JOIN interview_answers a ON a.request_id = r.id
      WHERE r.id = ${id}
    `)
  ).rows[0] as any;

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.player_id !== playerId) { res.status(403).json({ error: "Not your interview request" }); return; }

  res.json({
    id: row.id,
    triggerType: row.trigger_type,
    triggerContext: row.trigger_context,
    status: row.status,
    presenter: row.presenter,
    promptText: row.prompt_text,
    createdAt: row.created_at,
    answer: row.response_type ? { responseType: row.response_type, answerText: row.answer_text } : null,
  });
});

// ── Player: answer (or decline) their own interview request ────────────────
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

  const existing = (
    await db.execute(sql`SELECT id, player_id, status FROM interview_requests WHERE id = ${id}`)
  ).rows[0] as any;
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.player_id !== playerId) { res.status(403).json({ error: "Not your interview request" }); return; }
  if (existing.status !== "pending") { res.status(409).json({ error: "This request has already been answered" }); return; }

  const newStatus = parsed.data.responseType === "comment" ? "answered" : "declined";

  try {
    await db.execute(sql`
      INSERT INTO interview_answers (request_id, response_type, answer_text)
      VALUES (${id}, ${parsed.data.responseType}, ${parsed.data.answerText ?? null})
    `);
    await db.execute(sql`UPDATE interview_requests SET status = ${newStatus} WHERE id = ${id}`);
    res.json({ ok: true, status: newStatus });
  } catch (err: any) {
    const detail = err?.cause?.message ?? err?.message ?? String(err);
    logger.error({ err }, "POST /interview-desk/:id/answer failed");
    res.status(500).json({ error: "Failed to save answer", detail });
  }
});

export default router;
