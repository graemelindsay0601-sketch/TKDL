import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { createNotification } from "../lib/communityNotify";

const router = Router();
const ADMIN_PIN = process.env.ADMIN_PIN ?? "0601";

function sessionPlayerId(req: any): number | null {
  return (req.session as any)?.playerId ?? null;
}
function sessionIsAdmin(req: any): boolean {
  if (req.headers["x-admin-pin"] === ADMIN_PIN) return true;
  return (req.session as any)?.isAdmin === true;
}
function requireAuth(req: any, res: any): number | false {
  const id = sessionPlayerId(req);
  if (!id) { res.status(401).json({ error: "Login required" }); return false; }
  return id;
}
async function featureEnabled(key: string): Promise<boolean> {
  try {
    const r = await db.execute(sql`SELECT value FROM settings WHERE key = ${key}`);
    return (r.rows[0] as any)?.value === "true";
  } catch { return false; }
}

// ── GET /community/posts ─────────────────────────────────────────────────────
router.get("/community/posts", async (req, res): Promise<void> => {
  const limit        = Math.min(Number(req.query.limit)  || 20, 100);
  const offset       = Math.max(Number(req.query.offset) || 0,  0);
  const myPlayerId   = sessionPlayerId(req);
  const filterPlayer = req.query.player_id ? Number(req.query.player_id) : null;
  const photoOnly    = req.query.photo_only === "true";

  const playerFilter = filterPlayer ? sql`AND cp.player_id = ${filterPlayer}` : sql``;
  const photoFilter  = photoOnly    ? sql`AND cp.photo_path IS NOT NULL`       : sql``;

  const rows = await db.execute(sql`
    SELECT
      cp.id,
      cp.player_id,
      pl.name  AS player_name,
      CASE WHEN pl.elo >= 1400 THEN 'Diamond'
           WHEN pl.elo >= 1250 THEN 'Platinum'
           WHEN pl.elo >= 1100 THEN 'Gold'
           WHEN pl.elo >= 950  THEN 'Silver'
           ELSE 'Bronze' END AS player_tier,
      cp.content,
      cp.photo_path,
      cp.post_type,
      cp.auto_meta,
      cp.status,
      cp.created_at,
      COALESCE(
        (SELECT jsonb_object_agg(emoji, cnt)
         FROM (SELECT emoji, COUNT(*) AS cnt FROM post_reactions WHERE post_id = cp.id GROUP BY emoji) sub),
        '{}'::jsonb
      ) AS reactions,
      (SELECT COUNT(*)::int FROM post_comments WHERE post_id = cp.id) AS comment_count
    FROM community_posts cp
    JOIN players pl ON pl.id = cp.player_id
    WHERE cp.status = 'approved'
    ${playerFilter}
    ${photoFilter}
    ORDER BY cp.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const posts = rows.rows as any[];
  let myReactions: Record<number, string[]> = {};

  if (myPlayerId && posts.length > 0) {
    const ids = posts.map(p => p.id as number);
    const idList = sql.raw(ids.join(","));
    const mr = await db.execute(sql`
      SELECT post_id, emoji FROM post_reactions
      WHERE player_id = ${myPlayerId} AND post_id IN (${idList})
    `);
    for (const row of mr.rows as any[]) {
      (myReactions[row.post_id] ??= []).push(row.emoji);
    }
  }

  res.json(posts.map(p => ({ ...p, myReactions: myReactions[p.id] ?? [] })));
});

// ── GET /community/posts/pending — admin ─────────────────────────────────────
router.get("/community/posts/pending", async (req, res): Promise<void> => {
  if (!sessionIsAdmin(req)) { res.status(403).json({ error: "Admin required" }); return; }
  const rows = await db.execute(sql`
    SELECT cp.id, cp.player_id, pl.name AS player_name,
           CASE WHEN pl.elo >= 1400 THEN 'Diamond'
                WHEN pl.elo >= 1250 THEN 'Platinum'
                WHEN pl.elo >= 1100 THEN 'Gold'
                WHEN pl.elo >= 950  THEN 'Silver'
                ELSE 'Bronze' END AS player_tier,
           cp.content, cp.photo_path, cp.post_type, cp.auto_meta, cp.status, cp.created_at
    FROM community_posts cp
    JOIN players pl ON pl.id = cp.player_id
    WHERE cp.status = 'pending'
    ORDER BY cp.created_at ASC
  `);
  res.json(rows.rows);
});

// ── POST /community/posts ────────────────────────────────────────────────────
router.post("/community/posts", async (req, res): Promise<void> => {
  if (!await featureEnabled("community_enabled") && !sessionIsAdmin(req)) {
    res.status(503).json({ error: "Community feature not yet enabled" }); return;
  }
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const { content = "", photoPath } = req.body as any;
  if (!String(content).trim() && !photoPath) {
    res.status(400).json({ error: "Post must have content or a photo" }); return;
  }
  if (String(content).length > 1000) {
    res.status(400).json({ error: "Content too long (max 1000 chars)" }); return;
  }

  const result = await db.execute(sql`
    INSERT INTO community_posts (player_id, content, photo_path, post_type, status)
    VALUES (${playerId}, ${String(content).trim()}, ${photoPath ?? null}, 'manual', 'pending')
    RETURNING id
  `);
  res.status(201).json({ id: (result.rows[0] as any).id, status: "pending" });
});

// ── POST /community/auto-post — system trigger ────────────────────────────────
router.post("/community/auto-post", async (req, res): Promise<void> => {
  if (!await featureEnabled("community_enabled")) {
    res.json({ ok: false, reason: "community disabled" }); return;
  }
  const { playerId, type, meta = {} } = req.body as any;
  if (!playerId || !["auto_180", "auto_checkout"].includes(type)) {
    res.status(400).json({ error: "playerId and valid type required" }); return;
  }

  const content = type === "auto_180"
    ? "🎯 MAXIMUM! 180!"
    : `🏆 High checkout — ${(meta as any).checkout ?? ""}!`;

  const result = await db.execute(sql`
    INSERT INTO community_posts (player_id, content, post_type, auto_meta, status)
    VALUES (${playerId}, ${content}, ${type}, ${JSON.stringify(meta)}, 'approved')
    RETURNING id
  `);
  const postId = (result.rows[0] as any).id as number;

  void createNotification({
    playerId,
    type: "auto_post_fired",
    entityId: postId,
    entityType: "post",
    message: content,
  });

  res.status(201).json({ id: postId });
});

// ── POST /community/posts/:id/approve — admin ────────────────────────────────
router.post("/community/posts/:id/approve", async (req, res): Promise<void> => {
  if (!sessionIsAdmin(req)) { res.status(403).json({ error: "Admin required" }); return; }
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const result = await db.execute(sql`
    UPDATE community_posts SET status = 'approved', approved_at = NOW()
    WHERE id = ${id} AND status = 'pending'
    RETURNING player_id
  `);
  if (!result.rows.length) { res.status(404).json({ error: "Post not found or already approved" }); return; }

  const authorId = (result.rows[0] as any).player_id as number;
  void createNotification({
    playerId: authorId,
    type: "post_approved",
    entityId: id,
    entityType: "post",
    message: "Your post was approved! 🎉",
  });
  res.json({ ok: true });
});

// ── POST /community/posts/:id/reject — admin ─────────────────────────────────
router.post("/community/posts/:id/reject", async (req, res): Promise<void> => {
  if (!sessionIsAdmin(req)) { res.status(403).json({ error: "Admin required" }); return; }
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.execute(sql`UPDATE community_posts SET status = 'rejected' WHERE id = ${id}`);
  res.json({ ok: true });
});

// ── DELETE /community/posts/:id — admin ──────────────────────────────────────
router.delete("/community/posts/:id", async (req, res): Promise<void> => {
  if (!sessionIsAdmin(req)) { res.status(403).json({ error: "Admin required" }); return; }
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.execute(sql`DELETE FROM community_posts WHERE id = ${id}`);
  res.json({ ok: true });
});

// ── POST /community/posts/:id/react ──────────────────────────────────────────
const ALLOWED_EMOJI = ["👍", "❤️", "😂", "🎯", "🏆"];

router.post("/community/posts/:id/react", async (req, res): Promise<void> => {
  if (!await featureEnabled("community_enabled") && !sessionIsAdmin(req)) {
    res.status(503).json({ error: "Community feature not yet enabled" }); return;
  }
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const postId = Number(req.params.id);
  if (isNaN(postId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { emoji } = req.body as any;
  if (!ALLOWED_EMOJI.includes(emoji)) {
    res.status(400).json({ error: "Invalid emoji", allowed: ALLOWED_EMOJI }); return;
  }

  const existing = await db.execute(sql`
    SELECT id FROM post_reactions
    WHERE post_id = ${postId} AND player_id = ${playerId} AND emoji = ${emoji}
  `);

  if (existing.rows.length > 0) {
    await db.execute(sql`
      DELETE FROM post_reactions
      WHERE post_id = ${postId} AND player_id = ${playerId} AND emoji = ${emoji}
    `);
    res.json({ toggled: false });
  } else {
    await db.execute(sql`
      INSERT INTO post_reactions (post_id, player_id, emoji)
      VALUES (${postId}, ${playerId}, ${emoji})
      ON CONFLICT DO NOTHING
    `);
    const postRow = (await db.execute(sql`
      SELECT player_id FROM community_posts WHERE id = ${postId}
    `)).rows[0] as any;
    if (postRow && postRow.player_id !== playerId) {
      const actor = (await db.execute(sql`SELECT name FROM players WHERE id = ${playerId}`)).rows[0] as any;
      void createNotification({
        playerId: postRow.player_id,
        type: "post_liked",
        actorId: playerId,
        entityId: postId,
        entityType: "post",
        message: `${actor?.name ?? "Someone"} reacted ${emoji} to your post`,
      });
    }
    res.json({ toggled: true });
  }
});

// ── GET /community/posts/:id/comments ────────────────────────────────────────
router.get("/community/posts/:id/comments", async (req, res): Promise<void> => {
  const postId = Number(req.params.id);
  if (isNaN(postId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.execute(sql`
    SELECT pc.id, pc.player_id, pl.name AS player_name,
           CASE WHEN pl.elo >= 1400 THEN 'Diamond'
                WHEN pl.elo >= 1250 THEN 'Platinum'
                WHEN pl.elo >= 1100 THEN 'Gold'
                WHEN pl.elo >= 950  THEN 'Silver'
                ELSE 'Bronze' END AS player_tier,
           pc.content, pc.created_at
    FROM post_comments pc
    JOIN players pl ON pl.id = pc.player_id
    WHERE pc.post_id = ${postId}
    ORDER BY pc.created_at ASC
  `);
  res.json(rows.rows);
});

// ── PATCH /community/posts/:id/remove-photo — admin ──────────────────────────
router.patch("/community/posts/:id/remove-photo", async (req, res): Promise<void> => {
  if (!sessionIsAdmin(req)) { res.status(403).json({ error: "Admin required" }); return; }
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await db.execute(sql`
    UPDATE community_posts SET photo_path = NULL
    WHERE id = ${id}
    RETURNING id
  `);
  if (!result.rows.length) { res.status(404).json({ error: "Post not found" }); return; }
  res.json({ ok: true });
});

// ── DELETE /community/posts/:id/comments/:commentId — admin or own comment ───
router.delete("/community/posts/:id/comments/:commentId", async (req, res): Promise<void> => {
  const isAdmin = sessionIsAdmin(req);
  const playerId = sessionPlayerId(req);
  if (!isAdmin && !playerId) { res.status(401).json({ error: "Login required" }); return; }

  const commentId = Number(req.params.commentId);
  if (isNaN(commentId)) { res.status(400).json({ error: "Invalid commentId" }); return; }

  // Admin can delete any comment; players can only delete their own
  const result = isAdmin
    ? await db.execute(sql`DELETE FROM post_comments WHERE id = ${commentId} RETURNING id`)
    : await db.execute(sql`DELETE FROM post_comments WHERE id = ${commentId} AND player_id = ${playerId!} RETURNING id`);

  if (!result.rows.length) { res.status(404).json({ error: "Comment not found or not yours" }); return; }
  res.json({ ok: true });
});

// ── POST /community/posts/:id/comments ──────────────────────────────────────
router.post("/community/posts/:id/comments", async (req, res): Promise<void> => {
  if (!await featureEnabled("community_enabled") && !sessionIsAdmin(req)) {
    res.status(503).json({ error: "Community feature not yet enabled" }); return;
  }
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const postId = Number(req.params.id);
  if (isNaN(postId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { content = "" } = req.body as any;
  if (!String(content).trim()) { res.status(400).json({ error: "Comment cannot be empty" }); return; }
  if (String(content).length > 500) { res.status(400).json({ error: "Comment too long (max 500 chars)" }); return; }

  const result = await db.execute(sql`
    INSERT INTO post_comments (post_id, player_id, content)
    VALUES (${postId}, ${playerId}, ${String(content).trim()})
    RETURNING id, created_at
  `);

  const commentId = (result.rows[0] as any).id as number;
  const postRow = (await db.execute(sql`SELECT player_id FROM community_posts WHERE id = ${postId}`)).rows[0] as any;
  if (postRow && postRow.player_id !== playerId) {
    const actor = (await db.execute(sql`SELECT name FROM players WHERE id = ${playerId}`)).rows[0] as any;
    void createNotification({
      playerId: postRow.player_id,
      type: "post_commented",
      actorId: playerId,
      entityId: commentId,
      entityType: "comment",
      message: `${actor?.name ?? "Someone"} commented on your post`,
    });
  }
  res.status(201).json(result.rows[0]);
});

export default router;
