import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function sessionPlayerId(req: any): number | null {
  return (req.session as any)?.playerId ?? null;
}
function requireAuth(req: any, res: any): number | false {
  const id = sessionPlayerId(req);
  if (!id) { res.status(401).json({ error: "Login required" }); return false; }
  return id;
}

// ── GET /notifications ───────────────────────────────────────────────────────
router.get("/notifications", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const limit = Math.min(Number(req.query.limit) || 30, 50);

  try {
    const rows = await db.execute(sql`
      SELECT
        n.id, n.type, n.actor_id, n.entity_id, n.entity_type,
        n.message, n.read_at, n.created_at,
        pl.name AS actor_name
      FROM notifications n
      LEFT JOIN players pl ON pl.id = n.actor_id
      WHERE n.player_id = ${playerId}
      ORDER BY n.created_at DESC
      LIMIT ${limit}
    `);
    res.json(rows.rows);
  } catch (err: any) {
    res.status(500).json({ error: "notifications failed", detail: err?.message ?? String(err) });
  }
});

// ── GET /notifications/unread-count (must come before /:id) ──────────────────
router.get("/notifications/unread-count", async (req, res): Promise<void> => {
  const playerId = sessionPlayerId(req);
  if (!playerId) { res.json({ count: 0 }); return; }

  const rows = await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM notifications
    WHERE player_id = ${playerId} AND read_at IS NULL
  `);
  res.json(rows.rows[0] ?? { count: 0 });
});

// ── POST /notifications/mark-all-read (alias used by account.tsx) ────────────
router.post("/notifications/mark-all-read", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;
  await db.execute(sql`
    UPDATE notifications SET read_at = NOW()
    WHERE player_id = ${playerId} AND read_at IS NULL
  `);
  res.json({ ok: true });
});

// ── PATCH /notifications/read-all ────────────────────────────────────────────
router.patch("/notifications/read-all", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;
  await db.execute(sql`
    UPDATE notifications SET read_at = NOW()
    WHERE player_id = ${playerId} AND read_at IS NULL
  `);
  res.json({ ok: true });
});

// ── POST /notifications/:id/read (used by account.tsx) ───────────────────────
router.post("/notifications/:id/read", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.execute(sql`
    UPDATE notifications SET read_at = NOW()
    WHERE id = ${id} AND player_id = ${playerId}
  `);
  res.json({ ok: true });
});

// ── PATCH /notifications/:id/read ────────────────────────────────────────────
router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.execute(sql`
    UPDATE notifications SET read_at = NOW()
    WHERE id = ${id} AND player_id = ${playerId}
  `);
  res.json({ ok: true });
});

export default router;
