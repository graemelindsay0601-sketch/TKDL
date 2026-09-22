import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { createNotification } from "../lib/communityNotify";
import { authedWriteRateLimit } from "../middleware/writeRateLimit";
import { isValidUploadedObjectPath } from "../lib/uploadPath";

const router = Router();

function sessionPlayerId(req: any): number | null {
  return (req.session as any)?.playerId ?? null;
}
function sessionIsAdmin(req: any): boolean {
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
  try {
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
      const mr = await db.execute(sql`
        SELECT post_id, emoji FROM post_reactions
        WHERE player_id = ${myPlayerId}
          AND post_id = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::int[])
      `);
      for (const row of mr.rows as any[]) {
        (myReactions[row.post_id] ??= []).push(row.emoji);
      }
    }

    res.json(posts.map(p => ({ ...p, myReactions: myReactions[p.id] ?? [] })));
  } catch (err: any) {
    res.status(500).json({
      error: "community/posts failed",
      message: err?.message ?? String(err),
      cause: err?.cause?.message ?? String(err?.cause ?? ""),
      code: err?.code,
    });
  }
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
router.post("/community/posts", authedWriteRateLimit, async (req, res): Promise<void> => {
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
  if (photoPath != null && !isValidUploadedObjectPath(photoPath)) {
    res.status(400).json({ error: "Invalid photo" }); return;
  }

  const result = await db.execute(sql`
    INSERT INTO community_posts (player_id, content, photo_path, post_type, status)
    VALUES (${playerId}, ${String(content).trim()}, ${photoPath ?? null}, 'manual', 'pending')
    RETURNING id
  `);
  res.status(201).json({ id: (result.rows[0] as any).id, status: "pending" });
});

// ── POST /community/auto-post — system trigger ────────────────────────────────
// Despite the name, this was reachable by anyone: no auth, and playerId came
// straight from the request body, so any anonymous request could post a fake
// "🎯 MAXIMUM! 180!" (or high-checkout) announcement attributed to any player
// and fire a real push notification to them — pure spam/impersonation. No
// frontend page calls this HTTP route at all (real match-triggered posts go
// through the createAutoPost() function directly, in-process, from
// matches.ts) — it's admin-gated rather than removed in case it's meant for
// a future manual/admin trigger.
router.post("/community/auto-post", async (req, res): Promise<void> => {
  if (!sessionIsAdmin(req)) { res.status(403).json({ error: "Admin required" }); return; }
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

// ── PATCH /community/posts/:id — owner or admin can edit content ─────────────
// Auto-generated posts (post_type !== 'manual' — 180s, checkouts, elimination
// announcements, doubles/team/shift-wars match posts, etc.) are records of
// something that actually happened in a game; the "owner" is just whoever the
// event happened to, not an author who wrote the content, so they should
// never be able to rewrite one into arbitrary text. Only admins may touch
// those. And when a player edits their own already-approved manual post, the
// new content hasn't been moderated yet, so it goes back to 'pending' rather
// than silently staying 'approved' with unreviewed text — same as a fresh
// post, minus losing the comments/reactions already on it.
router.patch("/community/posts/:id", async (req, res): Promise<void> => {
  const playerId = sessionPlayerId(req);
  const isAdmin  = sessionIsAdmin(req);
  if (!playerId && !isAdmin) { res.status(401).json({ error: "Auth required" }); return; }

  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { content } = req.body as { content?: string };
  if (!content?.trim()) { res.status(400).json({ error: "Content required" }); return; }

  const post = (await db.execute(sql`SELECT player_id, post_type, status FROM community_posts WHERE id = ${id}`)).rows[0] as any;
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  if (!isAdmin && post.player_id !== playerId) { res.status(403).json({ error: "Not your post" }); return; }
  if (!isAdmin && post.post_type !== "manual") {
    res.status(403).json({ error: "Auto-generated posts can't be edited" }); return;
  }

  if (!isAdmin && post.status === "approved") {
    await db.execute(sql`
      UPDATE community_posts
      SET content = ${content.trim()}, status = 'pending', approved_at = NULL
      WHERE id = ${id}
    `);
    res.json({ ok: true, status: "pending" });
    return;
  }

  await db.execute(sql`UPDATE community_posts SET content = ${content.trim()} WHERE id = ${id}`);
  res.json({ ok: true });
});

// ── DELETE /community/posts/:id — admin or own post ──────────────────────────
router.delete("/community/posts/:id", async (req, res): Promise<void> => {
  const isAdmin = sessionIsAdmin(req);
  const playerId = sessionPlayerId(req);
  if (!isAdmin && !playerId) { res.status(401).json({ error: "Login required" }); return; }

  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Admin can delete any post; players can only delete their own manual
  // posts — deleting an auto-generated post (a record of something that
  // actually happened, e.g. a 180 or a completed match) is left to admins,
  // same reasoning as the PATCH endpoint above.
  const result = isAdmin
    ? await db.execute(sql`DELETE FROM community_posts WHERE id = ${id} RETURNING id`)
    : await db.execute(sql`
        DELETE FROM community_posts
        WHERE id = ${id} AND player_id = ${playerId!} AND post_type = 'manual'
        RETURNING id
      `);

  if (!result.rows.length) { res.status(404).json({ error: "Post not found or not yours" }); return; }
  res.json({ ok: true });
});

// ── POST /community/posts/:id/react ──────────────────────────────────────────
const ALLOWED_EMOJI = ["👍", "❤️", "😂", "🎯", "🏆"];

router.post("/community/posts/:id/react", authedWriteRateLimit, async (req, res): Promise<void> => {
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

  // Single statement toggle: the old code read (SELECT), then decided
  // INSERT vs DELETE in JS — two concurrent taps (a double-tap, or two
  // devices) could both see "not reacted yet" and both INSERT (harmless
  // thanks to ON CONFLICT DO NOTHING, but then both think they "added" it),
  // or both see "reacted" and both DELETE. Folding the whole toggle into one
  // CTE means Postgres evaluates del/ins against a single consistent
  // snapshot, so it's race-free without needing a transaction wrapper.
  const toggled = await db.execute(sql`
    WITH del AS (
      DELETE FROM post_reactions
      WHERE post_id = ${postId} AND player_id = ${playerId} AND emoji = ${emoji}
      RETURNING id
    ), ins AS (
      INSERT INTO post_reactions (post_id, player_id, emoji)
      SELECT ${postId}, ${playerId}, ${emoji}
      WHERE NOT EXISTS (SELECT 1 FROM del)
      RETURNING id
    )
    SELECT
      (SELECT COUNT(*) FROM del)::int AS deleted_count,
      (SELECT COUNT(*) FROM ins)::int AS inserted_count
  `);
  const { inserted_count } = toggled.rows[0] as any;
  const wasAdded = inserted_count > 0;

  if (wasAdded) {
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
  }
  res.json({ toggled: wasAdded });
});

// ── GET /community/posts/:id/comments ────────────────────────────────────────
router.get("/community/posts/:id/comments", async (req, res): Promise<void> => {
  const postId = Number(req.params.id);
  if (isNaN(postId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const limit  = Math.min(Number(req.query.limit)  || 20, 100);
  const offset = Math.max(Number(req.query.offset) || 0,  0);
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
    LIMIT ${limit} OFFSET ${offset}
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
router.post("/community/posts/:id/comments", authedWriteRateLimit, async (req, res): Promise<void> => {
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
