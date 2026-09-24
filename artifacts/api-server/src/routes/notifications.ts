import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { sendTestNotification } from "../services/notificationService";
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

// ── GET /notifications ───────────────────────────────────────────────────────
router.get("/notifications", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const limit = Math.min(Number(req.query.limit) || 30, 50);

  try {
    const rows = await db.execute(sql`
      SELECT
        n.id, n.type, n.actor_id, n.entity_id, n.entity_type,
        n.message, n.read_at, n.created_at, n.data,
        COALESCE(n.title, n.message) AS title,
        COALESCE(n.body, n.message)  AS body,
        (n.read_at IS NOT NULL OR n."read") AS read,
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
// Optional ?types=a,b,c scopes the count to specific notification types —
// used by the sidebar's Community badge (post_approved/post_liked/
// post_commented/auto_post_fired) so it doesn't light up for DM or
// achievement notifications that have nothing to do with Community. Called
// with no `types` at all, it's the original unscoped count the account
// widget uses.
router.get("/notifications/unread-count", async (req, res): Promise<void> => {
  const playerId = sessionPlayerId(req);
  if (!playerId) { res.json({ count: 0 }); return; }

  const typesParam = typeof req.query.types === "string" ? req.query.types : "";
  const types = typesParam.split(",").map(t => t.trim()).filter(Boolean);

  try {
    const rows = types.length > 0
      ? await db.execute(sql`
          SELECT COUNT(*)::int AS count
          FROM notifications
          WHERE player_id = ${playerId} AND read_at IS NULL AND type = ANY(${types}::text[])
        `)
      : await db.execute(sql`
          SELECT COUNT(*)::int AS count
          FROM notifications
          WHERE player_id = ${playerId} AND read_at IS NULL
        `);
    res.json(rows.rows[0] ?? { count: 0 });
  } catch {
    res.json({ count: 0 });
  }
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

// ── POST /notifications/test — fire one real push at the caller's own
// device and report exactly what happened. Used by the "Send test
// notification" button in Account → Notifications so it's possible to
// actually tell whether the pipeline works instead of guessing. ───────────────
router.post("/notifications/test", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  try {
    const result = await sendTestNotification(playerId);
    res.json(result);
  } catch (err: any) {
    // Drizzle wraps the real driver error in a generic "Failed query: ..."
    // message and puts the actual Postgres error (missing table, missing
    // column, permission denied, whatever it really is) on err.cause —
    // this was only ever surfacing the useless wrapper text to whoever
    // clicked the button, not the reason.
    const detail = err?.cause?.message ?? err?.message ?? String(err);
    logger.error({ err }, "POST /notifications/test failed");
    res.status(500).json({ ok: false, reason: "server_error", detail });
  }
});

// ── POST /notifications/push-received — the service worker calls this the
// instant its own "push" event fires, before it even attempts
// showNotification(). Diagnostic only, no auth (a service worker's fetch()
// doesn't reliably carry session cookies, and this needs to work even when
// nobody's logged in in the tab the worker is attached to) — exists purely
// to answer one question definitively: does the push actually reach the
// device at all? If this never logs after a test send that Apple/Google
// accepted, the gap is between the push service and the device (OS-level
// suppression, a stale/wrong service worker registration, etc) — not
// anything this codebase controls. If it DOES log, the gap is narrower:
// the device got it, but iOS didn't turn it into a visible banner. ─────────
const PushReceivedBody = z.object({
  notificationId: z.union([z.number(), z.string()]).optional(),
  title: z.string().optional(),
  swScriptUrl: z.string().optional(),
  // zod's z.object() silently STRIPS any key not declared here before
  // .safeParse() ever returns — these two were added to the service worker's
  // ping payload (stage: "received"/"shown_ok"/"show_failed", plus error on
  // failure) but never added here, so every log line for weeks has been
  // showing the same 3 fields for every stage of every push, making it look
  // like nothing was distinguishable when the real data was being thrown
  // away before the logger ever saw it.
  stage: z.string().optional(),
  error: z.string().optional(),
});
router.post("/notifications/push-received", async (req, res): Promise<void> => {
  const parsed = PushReceivedBody.safeParse(req.body ?? {});
  logger.info(
    { body: parsed.success ? parsed.data : req.body, ua: req.headers["user-agent"] },
    "Service worker reported a push event received on-device"
  );
  res.json({ ok: true });
});

// ── GET /notifications/vapid-public-key ──────────────────────────────────────
router.get("/notifications/vapid-public-key", (_req, res): void => {
  const key = process.env.VAPID_PUBLIC_KEY ?? "";
  res.json({ publicKey: key, enabled: !!key });
});

// ── POST /notifications/subscribe — save push subscription ───────────────────
const SubscribeBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
});

router.post("/notifications/subscribe", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const parsed = SubscribeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid subscription" }); return; }
  const { endpoint, keys } = parsed.data;
  await db.execute(sql`
    INSERT INTO push_subscriptions (player_id, endpoint, p256dh, auth)
    VALUES (${playerId}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
    ON CONFLICT (endpoint) DO UPDATE SET player_id = ${playerId}, p256dh = ${keys.p256dh}, auth = ${keys.auth}
  `);
  res.json({ ok: true });
});

// ── DELETE /notifications/subscribe — remove push subscription ────────────────
router.delete("/notifications/subscribe", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  await db.execute(sql`DELETE FROM push_subscriptions WHERE player_id = ${playerId}`);
  res.json({ ok: true });
});

// ── DELETE /notifications/:id (used by notification-center.tsx) — registered
// after /notifications/subscribe so that literal path isn't shadowed by :id ──
router.delete("/notifications/:id", async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.execute(sql`
    DELETE FROM notifications WHERE id = ${id} AND player_id = ${playerId}
  `);
  res.json({ ok: true });
});

export default router;
