import { Router } from "express";
import { db, cosmeticDefinitionsTable, playerCosmeticsTable } from "@workspace/db";
import { sql, eq, and } from "drizzle-orm";
import { createNotification } from "../lib/communityNotify";
import { authedWriteRateLimit } from "../middleware/writeRateLimit";
import { isValidUploadedObjectPath } from "../lib/uploadPath";
import { currentLeagueId } from "../lib/currentLeague";
import { getSettingBool } from "../lib/settingsService";

const router = Router();

// A STICKER cosmetic attached to a message is validated the same way an
// equipped cosmetic is (routes/cosmetics.ts's equip route) — must exist,
// be the right category, and be owned by the sender. Returns true for
// stickerId === null/undefined (no sticker attached, always valid).
async function validSticker(senderId: number, stickerId: unknown): Promise<boolean> {
  if (stickerId == null) return true;
  if (typeof stickerId !== "string" || !stickerId) return false;
  const [def] = await db.select().from(cosmeticDefinitionsTable)
    .where(eq(cosmeticDefinitionsTable.id, stickerId));
  if (!def || def.category !== "STICKER") return false;
  const owned = await db.select().from(playerCosmeticsTable)
    .where(and(eq(playerCosmeticsTable.playerId, senderId), eq(playerCosmeticsTable.cosmeticId, stickerId)));
  return owned.length > 0;
}

function sessionPlayerId(req: any): number | null {
  return (req.session as any)?.playerId ?? null;
}
function requireAuth(req: any, res: any): number | false {
  const id = sessionPlayerId(req);
  if (!id) { res.status(401).json({ error: "Login required" }); return false; }
  return id;
}
async function messagingEnabled(req: any): Promise<boolean> {
  try {
    return await getSettingBool(await currentLeagueId(req), "messaging_enabled");
  } catch { return false; }
}

// ── GET /messages/conversations ──────────────────────────────────────────────
router.get("/messages/conversations", async (req, res): Promise<void> => {
  const myId = requireAuth(req, res);
  if (!myId) return;

  // Use sql.raw for the repeated player-id literal to avoid Drizzle emitting
  // 6 separate bind parameters ($1–$6) which confuses pg in CASE/GROUP BY.
  const me = sql.raw(String(myId));

  const rows = await db.execute(sql`
    SELECT
      CASE WHEN dm.sender_id = ${me} THEN dm.receiver_id ELSE dm.sender_id END AS partner_id,
      MAX(CASE WHEN dm.sender_id = ${me} THEN r.name ELSE s.name END)          AS partner_name,
      (array_agg(dm.content    ORDER BY dm.created_at DESC))[1]                AS last_content,
      (array_agg(dm.photo_path ORDER BY dm.created_at DESC))[1]                AS last_photo_path,
      MAX(dm.created_at)                                                        AS last_at,
      COUNT(*) FILTER (WHERE dm.receiver_id = ${me} AND dm.read_at IS NULL)::int AS unread_count
    FROM direct_messages dm
    JOIN players s ON s.id = dm.sender_id
    JOIN players r ON r.id = dm.receiver_id
    WHERE dm.sender_id = ${me} OR dm.receiver_id = ${me}
    GROUP BY CASE WHEN dm.sender_id = ${me} THEN dm.receiver_id ELSE dm.sender_id END
    ORDER BY MAX(dm.created_at) DESC
  `);
  res.json(rows.rows.map((r: any) => ({
    playerId:    r.partner_id,
    playerName:  r.partner_name,
    lastMessage: r.last_content,
    unreadCount: r.unread_count ?? 0,
  })));
});

// ── GET /messages/:partnerId ─────────────────────────────────────────────────
router.get("/messages/:partnerId", async (req, res): Promise<void> => {
  const myId = requireAuth(req, res);
  if (!myId) return;

  const partnerId = Number(req.params.partnerId);
  if (isNaN(partnerId)) { res.status(400).json({ error: "Invalid partnerId" }); return; }

  const sinceId = Number(req.query.sinceId) || 0;

  // Mark messages received from partner as read
  await db.execute(sql`
    UPDATE direct_messages SET read_at = NOW()
    WHERE sender_id = ${partnerId} AND receiver_id = ${myId} AND read_at IS NULL
  `);

  let rows;
  if (sinceId > 0) {
    rows = await db.execute(sql`
      SELECT dm.id, dm.sender_id, dm.receiver_id, dm.content, dm.photo_path, dm.sticker_id, dm.read_at, dm.created_at,
             pl.name AS sender_name
      FROM direct_messages dm
      JOIN players pl ON pl.id = dm.sender_id
      WHERE (
        (dm.sender_id = ${myId}      AND dm.receiver_id = ${partnerId}) OR
        (dm.sender_id = ${partnerId} AND dm.receiver_id = ${myId})
      ) AND dm.id > ${sinceId}
      ORDER BY dm.created_at ASC
      LIMIT 100
    `);
  } else {
    rows = await db.execute(sql`
      SELECT dm.id, dm.sender_id, dm.receiver_id, dm.content, dm.photo_path, dm.sticker_id, dm.read_at, dm.created_at,
             pl.name AS sender_name
      FROM direct_messages dm
      JOIN players pl ON pl.id = dm.sender_id
      WHERE (
        (dm.sender_id = ${myId}      AND dm.receiver_id = ${partnerId}) OR
        (dm.sender_id = ${partnerId} AND dm.receiver_id = ${myId})
      )
      ORDER BY dm.created_at ASC
      LIMIT 100
    `);
  }
  res.json(rows.rows);
});

// ── POST /messages/:partnerId ────────────────────────────────────────────────
// This and POST /messages below are authenticated but, like community posts/
// reactions/comments, have no per-action cost — a compromised session or a
// buggy client loop could otherwise flood another player with unlimited DMs
// (each one also fires a push notification), so the same rate limit applies.
router.post("/messages/:partnerId", authedWriteRateLimit, async (req, res): Promise<void> => {
  if (!await messagingEnabled(req)) {
    res.status(503).json({ error: "Messaging not yet enabled" }); return;
  }
  const myId = requireAuth(req, res);
  if (!myId) return;

  const partnerId = Number(req.params.partnerId);
  if (isNaN(partnerId)) { res.status(400).json({ error: "Invalid partnerId" }); return; }
  if (partnerId === myId) { res.status(400).json({ error: "Cannot message yourself" }); return; }

  const { content = "", photoPath, stickerId } = req.body as any;
  if (!String(content).trim() && !photoPath && !stickerId) {
    res.status(400).json({ error: "Message must have content, a photo, or a sticker" }); return;
  }
  if (String(content).length > 1000) { res.status(400).json({ error: "Message too long (max 1000 chars)" }); return; }
  if (photoPath != null && !isValidUploadedObjectPath(photoPath)) {
    res.status(400).json({ error: "Invalid photo" }); return;
  }
  if (!await validSticker(myId, stickerId)) { res.status(403).json({ error: "You don't own that sticker" }); return; }

  const result = await db.execute(sql`
    INSERT INTO direct_messages (sender_id, receiver_id, content, photo_path, sticker_id)
    VALUES (${myId}, ${partnerId}, ${String(content).trim() || null}, ${photoPath ?? null}, ${stickerId ?? null})
    RETURNING id, created_at
  `);
  const msgId = (result.rows[0] as any).id as number;

  const sender = (await db.execute(sql`SELECT name FROM players WHERE id = ${myId}`)).rows[0] as any;
  void createNotification({
    playerId: partnerId,
    type: "dm_received",
    actorId: myId,
    entityId: msgId,
    entityType: "message",
    message: `New message from ${sender?.name ?? "Someone"}`,
  });

  res.status(201).json(result.rows[0]);
});

// ── POST /messages — send with receiverId in body (used by account.tsx) ──────
router.post("/messages", authedWriteRateLimit, async (req, res): Promise<void> => {
  if (!await messagingEnabled(req)) {
    res.status(503).json({ error: "Messaging not yet enabled" }); return;
  }
  const myId = requireAuth(req, res);
  if (!myId) return;

  const { receiverId, content = "", photoPath, stickerId } = req.body as any;
  const partnerId = Number(receiverId);
  if (isNaN(partnerId)) { res.status(400).json({ error: "Invalid receiverId" }); return; }
  if (partnerId === myId) { res.status(400).json({ error: "Cannot message yourself" }); return; }
  if (!String(content).trim() && !photoPath && !stickerId) {
    res.status(400).json({ error: "Message must have content, a photo, or a sticker" }); return;
  }
  if (String(content).length > 1000) { res.status(400).json({ error: "Message too long (max 1000 chars)" }); return; }
  if (photoPath != null && !isValidUploadedObjectPath(photoPath)) {
    res.status(400).json({ error: "Invalid photo" }); return;
  }
  if (!await validSticker(myId, stickerId)) { res.status(403).json({ error: "You don't own that sticker" }); return; }

  const result = await db.execute(sql`
    INSERT INTO direct_messages (sender_id, receiver_id, content, photo_path, sticker_id)
    VALUES (${myId}, ${partnerId}, ${String(content).trim() || null}, ${photoPath ?? null}, ${stickerId ?? null})
    RETURNING id, created_at
  `);
  const msgId = (result.rows[0] as any).id as number;

  const sender = (await db.execute(sql`SELECT name FROM players WHERE id = ${myId}`)).rows[0] as any;
  void createNotification({
    playerId: partnerId,
    type: "dm_received",
    actorId: myId,
    entityId: msgId,
    entityType: "message",
    message: `New message from ${sender?.name ?? "Someone"}`,
  });

  res.status(201).json(result.rows[0]);
});

export default router;
