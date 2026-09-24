import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { createNotification } from "../lib/communityNotify";
import { authedWriteRateLimit } from "../middleware/writeRateLimit";
import { currentLeagueId } from "../lib/currentLeague";
import { getSettingBool } from "../lib/settingsService";

const router = Router();

// ── Post photo ────────────────────────────────────────────────────────────
// Stored as raw bytes directly on the community_posts row, same reasoning
// and pattern as players.ts's avatar photo and messages.ts's DM photo (see
// db/migrations/add_community_post_photo_image.ts) — not through
// lib/objectStorage.ts, which depends on Replit-only infrastructure this
// app no longer runs on. The client compresses to a JPEG before ever
// sending it — MAX_COMMUNITY_PHOTO_BYTES below is a real backstop, not the
// expected size.
const ALLOWED_COMMUNITY_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_COMMUNITY_PHOTO_BYTES = 1_500_000;

function decodeCommunityPhoto(
  photoBase64: unknown,
  photoContentType: unknown,
): { buffer: Buffer; contentType: string } | "invalid" | "none" {
  if (photoBase64 == null && photoContentType == null) return "none";
  if (typeof photoBase64 !== "string" || !photoBase64) return "invalid";
  if (typeof photoContentType !== "string" || !ALLOWED_COMMUNITY_PHOTO_TYPES.has(photoContentType)) return "invalid";
  let buffer: Buffer;
  try {
    const raw = photoBase64.includes(",") ? photoBase64.split(",", 2)[1] : photoBase64;
    buffer = Buffer.from(raw, "base64");
  } catch {
    return "invalid";
  }
  if (buffer.length === 0 || buffer.length > MAX_COMMUNITY_PHOTO_BYTES) return "invalid";
  return { buffer, contentType: photoContentType };
}

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
async function featureEnabled(req: any, key: string): Promise<boolean> {
  try {
    return await getSettingBool(await currentLeagueId(req), key);
  } catch { return false; }
}

// ── @mentions ─────────────────────────────────────────────────────────────
// Deliberately conservative: a "@token" resolves only when it matches
// exactly one player's full name with spaces/underscores stripped and both
// sides lowercased ("@JohnSmith" / "@john_smith" both match "John Smith").
// A token matching nobody, or matching more than one player because two
// names collide once stripped, is left as plain "@text" rather than guessed
// at — better to under-mention than to link or notify the wrong person.
const MENTION_TOKEN = /@([A-Za-z0-9_]{2,40})/g;
function normalizeMentionKey(s: string): string {
  return s.toLowerCase().replace(/[_\s]/g, "");
}
async function resolveMentions(content: string): Promise<{ id: number; name: string }[]> {
  const tokens = Array.from(new Set(Array.from(content.matchAll(MENTION_TOKEN)).map(m => m[1])));
  if (tokens.length === 0) return [];

  // Small league, small player table — fine to pull every name into JS and
  // match there rather than build a fuzzy SQL match, same reasoning as the
  // who-reacted grouping above.
  const players = (await db.execute(sql`SELECT id, name FROM players`)).rows as { id: number; name: string }[];
  const byKey = new Map<string, { id: number; name: string }[]>();
  for (const p of players) {
    const key = normalizeMentionKey(p.name);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(p); else byKey.set(key, [p]);
  }

  const resolved = new Map<number, { id: number; name: string }>();
  for (const token of tokens) {
    const matches = byKey.get(normalizeMentionKey(token));
    if (matches && matches.length === 1) resolved.set(matches[0].id, matches[0]);
  }
  return Array.from(resolved.values());
}

// Notifies newly-mentioned players that a post they're mentioned in is now
// actually visible — called once a post becomes 'approved' (first approval,
// or a re-approval after an edit), and separately for the isAdmin-edit path
// where an already-approved post's mentions change without a fresh
// approval. Never notifies the author mentioning themself.
async function notifyMentions(mentionedIds: number[], postId: number, authorId: number): Promise<void> {
  const targets = mentionedIds.filter(id => id !== authorId);
  if (targets.length === 0) return;
  const actor = (await db.execute(sql`SELECT name FROM players WHERE id = ${authorId}`)).rows[0] as any;
  for (const targetId of targets) {
    void createNotification({
      playerId: targetId,
      type: "post_mentioned",
      actorId: authorId,
      entityId: postId,
      entityType: "post",
      message: `${actor?.name ?? "Someone"} mentioned you in a post`,
    });
  }
}

// ── GET /community/posts ─────────────────────────────────────────────────────
// post_type = 'manual' only, as of 2026-09-24 — this feed used to show every
// approved post, auto-generated ones included (routine match results, tier
// changes, eliminations, doubles/team/shift-wars results — all fired by
// createAutoPost() in lib/communityNotify.ts). That made a page meant to be
// a social space read as a spam log of match results with no real signal.
// Auto-posts are still written to this same table exactly as before — this
// only changes what the standalone Community page reads. The Hub's own
// "League Pulse" feed (GET /hub/pulse) deliberately still reads every
// approved post regardless of type, so nothing is lost: this app's
// auto-generated activity now surfaces only on the Hub, and this page is
// purely what real people actually posted.
router.get("/community/posts", async (req, res): Promise<void> => {
  try {
    const limit         = Math.min(Number(req.query.limit)  || 20, 100);
    const offset        = Math.max(Number(req.query.offset) || 0,  0);
    const myPlayerId    = sessionPlayerId(req);
    const filterPlayer  = req.query.player_id ? Number(req.query.player_id) : null;
    const photoOnly     = req.query.photo_only === "true";
    const search        = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const bookmarkedOnly = req.query.bookmarked_only === "true";

    // "Saved" tab — a bookmarked-only view of the feed. Signed out (or
    // somehow no player id) can't have bookmarks, so there's nothing to
    // show rather than an error.
    if (bookmarkedOnly && !myPlayerId) { res.json([]); return; }

    const playerFilter = filterPlayer ? sql`AND cp.player_id = ${filterPlayer}` : sql``;
    const bookmarkFilter = bookmarkedOnly
      ? sql`AND cp.id IN (SELECT post_id FROM post_bookmarks WHERE player_id = ${myPlayerId})`
      : sql``;
    const photoFilter  = photoOnly    ? sql`AND cp.photo_content_type IS NOT NULL` : sql``;
    // Simple ILIKE over post content and the author's name — no full-text
    // index, just enough to find "did someone post about X" in a feed this
    // size. Revisit with a real search index if the feed ever gets big
    // enough for ILIKE to show up in query time.
    const searchFilter = search
      ? sql`AND (cp.content ILIKE ${"%" + search + "%"} OR pl.name ILIKE ${"%" + search + "%"})`
      : sql``;

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
        pl.equipped_name_style_id AS player_name_style_id,
        pl.equipped_post_accent_id AS player_post_accent_id,
        pl.current_win_streak AS player_win_streak,
        pl.tagline AS player_tagline,
        pl.equipped_tagline_style_id AS player_tagline_style_id,
        cp.content,
        cp.photo_content_type,
        cp.post_type,
        cp.auto_meta,
        cp.status,
        cp.pinned,
        cp.created_at,
        COALESCE(
          (SELECT jsonb_object_agg(emoji, cnt)
           FROM (SELECT emoji, COUNT(*) AS cnt FROM post_reactions WHERE post_id = cp.id GROUP BY emoji) sub),
          '{}'::jsonb
        ) AS reactions,
        COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name))
           FROM players m WHERE m.id = ANY(cp.mentioned_player_ids)),
          '[]'::jsonb
        ) AS mentions,
        (SELECT COUNT(*)::int FROM post_comments WHERE post_id = cp.id) AS comment_count,
        (SELECT COUNT(*)::int FROM post_rsvps WHERE post_id = cp.id) AS rsvp_count,
        -- Poll posts (post_type = 'poll') carry their options + live vote
        -- counts and the requesting player's own vote right on the feed row
        -- rather than a separate per-post fetch — the whole point of a
        -- lightweight poll is that it renders inline in the feed with no
        -- extra round trip.
        CASE WHEN cp.post_type = 'poll' THEN (
          SELECT jsonb_agg(jsonb_build_object(
            'id', po.id, 'label', po.label,
            'vote_count', (SELECT COUNT(*)::int FROM community_poll_votes pv WHERE pv.option_id = po.id)
          ) ORDER BY po.sort_order)
          FROM community_poll_options po WHERE po.post_id = cp.id
        ) ELSE NULL END AS poll_options,
        CASE WHEN cp.post_type = 'poll' THEN (
          SELECT option_id FROM community_poll_votes WHERE post_id = cp.id AND player_id = ${myPlayerId}
        ) ELSE NULL END AS poll_my_vote
      FROM community_posts cp
      JOIN players pl ON pl.id = cp.player_id
      WHERE cp.status = 'approved' AND cp.post_type IN ('manual', 'poll')
      ${playerFilter}
      ${photoFilter}
      ${searchFilter}
      ${bookmarkFilter}
      ORDER BY cp.pinned DESC, cp.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const posts = rows.rows as any[];
    let myReactions: Record<number, string[]> = {};
    let myBookmarks: Set<number> = new Set();

    if (myPlayerId && posts.length > 0) {
      const ids = posts.map(p => p.id as number);
      const idsArray = sql`ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::int[]`;
      const mr = await db.execute(sql`
        SELECT post_id, emoji FROM post_reactions
        WHERE player_id = ${myPlayerId} AND post_id = ANY(${idsArray})
      `);
      for (const row of mr.rows as any[]) {
        (myReactions[row.post_id] ??= []).push(row.emoji);
      }
      const bm = await db.execute(sql`
        SELECT post_id FROM post_bookmarks
        WHERE player_id = ${myPlayerId} AND post_id = ANY(${idsArray})
      `);
      myBookmarks = new Set((bm.rows as any[]).map(r => r.post_id as number));
    }

    res.json(posts.map(p => ({ ...p, myReactions: myReactions[p.id] ?? [], myBookmarked: myBookmarks.has(p.id) })));
  } catch (err: any) {
    res.status(500).json({
      error: "community/posts failed",
      message: err?.message ?? String(err),
      cause: err?.cause?.message ?? String(err?.cause ?? ""),
      code: err?.code,
    });
  }
});

// ── GET /community/wall-of-fame ──────────────────────────────────────────────
// The all-time best of the feed — not a separate scoring system, the same
// reaction-count + comment-count score the "Top of the board" client-side
// sort already uses, just computed in SQL across every approved manual post
// ever made instead of only whatever's currently paged into the client.
// Posts alias scores can't be referenced in a WHERE clause in the same
// SELECT that defines them (Postgres evaluates WHERE before the SELECT
// list), hence the `scored` CTE below.
router.get("/community/wall-of-fame", async (req, res): Promise<void> => {
  try {
    const rows = await db.execute(sql`
      WITH scored AS (
        SELECT cp.id, cp.player_id, cp.content, cp.photo_content_type, cp.created_at,
               COALESCE(r.reaction_count, 0)::int AS reaction_count,
               COALESCE(c.comment_count, 0)::int  AS comment_count
        FROM community_posts cp
        LEFT JOIN (SELECT post_id, COUNT(*) AS reaction_count FROM post_reactions GROUP BY post_id) r ON r.post_id = cp.id
        LEFT JOIN (SELECT post_id, COUNT(*) AS comment_count  FROM post_comments  GROUP BY post_id) c ON c.post_id = cp.id
        WHERE cp.status = 'approved' AND cp.post_type = 'manual'
      )
      SELECT s.id, s.player_id, pl.name AS player_name,
             CASE WHEN pl.elo >= 1400 THEN 'Diamond'
                  WHEN pl.elo >= 1250 THEN 'Platinum'
                  WHEN pl.elo >= 1100 THEN 'Gold'
                  WHEN pl.elo >= 950  THEN 'Silver'
                  ELSE 'Bronze' END AS player_tier,
             pl.equipped_name_style_id AS player_name_style_id,
             pl.current_win_streak AS player_win_streak,
             s.content, s.photo_content_type, s.created_at,
             s.reaction_count, s.comment_count,
             (s.reaction_count + s.comment_count) AS score
      FROM scored s
      JOIN players pl ON pl.id = s.player_id
      WHERE (s.reaction_count + s.comment_count) > 0
      ORDER BY (s.reaction_count + s.comment_count) DESC, s.created_at DESC
      LIMIT 8
    `);
    res.json(rows.rows);
  } catch (err: any) {
    res.status(500).json({ error: "wall-of-fame failed", message: err?.message ?? String(err) });
  }
});

// ── GET /community/throwback — "this day last year" ─────────────────────────
// A fuzzy ±3 day window around exactly 365 days ago rather than an exact
// date match — a league this size won't reliably have a post on the literal
// calendar day, but something from "around this time last year" still lands
// as a throwback. Picks whichever approved manual post in that window sits
// closest to the 365-day mark; returns null (not a 404) when nothing's
// there, since "no throwback today" is a perfectly normal, expected answer,
// not an error.
router.get("/community/throwback", async (req, res): Promise<void> => {
  try {
    const rows = await db.execute(sql`
      SELECT cp.id, cp.player_id, pl.name AS player_name,
             CASE WHEN pl.elo >= 1400 THEN 'Diamond'
                  WHEN pl.elo >= 1250 THEN 'Platinum'
                  WHEN pl.elo >= 1100 THEN 'Gold'
                  WHEN pl.elo >= 950  THEN 'Silver'
                  ELSE 'Bronze' END AS player_tier,
             pl.equipped_name_style_id AS player_name_style_id,
             pl.current_win_streak AS player_win_streak,
             cp.content, cp.photo_content_type, cp.created_at
      FROM community_posts cp
      JOIN players pl ON pl.id = cp.player_id
      WHERE cp.status = 'approved' AND cp.post_type = 'manual'
        AND cp.created_at BETWEEN (NOW() - INTERVAL '368 days') AND (NOW() - INTERVAL '362 days')
      ORDER BY ABS(EXTRACT(EPOCH FROM (cp.created_at - (NOW() - INTERVAL '365 days')))) ASC
      LIMIT 1
    `);
    res.json(rows.rows[0] ?? null);
  } catch (err: any) {
    res.status(500).json({ error: "throwback failed", message: err?.message ?? String(err) });
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
           pl.equipped_name_style_id AS player_name_style_id,
           pl.current_win_streak AS player_win_streak,
           cp.content, cp.photo_content_type, cp.post_type, cp.auto_meta, cp.status, cp.created_at
    FROM community_posts cp
    JOIN players pl ON pl.id = cp.player_id
    WHERE cp.status = 'pending'
    ORDER BY cp.created_at ASC
  `);
  res.json(rows.rows);
});

// ── POST /community/posts ────────────────────────────────────────────────────
router.post("/community/posts", authedWriteRateLimit, async (req, res): Promise<void> => {
  if (!await featureEnabled(req, "community_enabled") && !sessionIsAdmin(req)) {
    res.status(503).json({ error: "Community feature not yet enabled" }); return;
  }
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const { content = "", photoBase64, photoContentType } = req.body as any;
  const photo = decodeCommunityPhoto(photoBase64, photoContentType);
  if (photo === "invalid") { res.status(400).json({ error: "Invalid photo" }); return; }
  if (!String(content).trim() && photo === "none") {
    res.status(400).json({ error: "Post must have content or a photo" }); return;
  }
  if (String(content).length > 1000) {
    res.status(400).json({ error: "Content too long (max 1000 chars)" }); return;
  }

  const trimmedContent = String(content).trim();
  const result = await db.execute(sql`
    INSERT INTO community_posts (player_id, content, photo_image, photo_content_type, post_type, status)
    VALUES (
      ${playerId}, ${trimmedContent},
      ${photo === "none" ? null : photo.buffer}, ${photo === "none" ? null : photo.contentType},
      'manual', 'pending'
    )
    RETURNING id
  `);
  const postId = (result.rows[0] as any).id as number;

  // Resolved and stored now so it's ready the moment the post is approved
  // (see the /approve route below, which is where mentioned players are
  // actually notified — a still-pending post might yet be rejected, and a
  // mention notification for content nobody will ever see would be
  // confusing).
  const mentions = await resolveMentions(trimmedContent);
  if (mentions.length > 0) {
    await db.execute(sql`
      UPDATE community_posts SET mentioned_player_ids = ARRAY[${sql.join(mentions.map(m => sql`${m.id}`), sql`, `)}]::int[]
      WHERE id = ${postId}
    `);
  }

  res.status(201).json({ id: postId, status: "pending" });
});

// ── POST /community/polls — admin ─────────────────────────────────────────────
// Creates a poll as a community_posts row with post_type = 'poll' — see
// add_community_polls.ts's header for why it piggybacks on the normal post
// machinery instead of being a separate feed. Admin-only and auto-approved
// (like /community/auto-post below), since this is an organizer tool
// ("next friendly night?") rather than something every player posts.
// Options are fixed at creation — no add/remove-option endpoint, keeping
// this genuinely lightweight.
router.post("/community/polls", async (req, res): Promise<void> => {
  if (!sessionIsAdmin(req)) { res.status(403).json({ error: "Admin required" }); return; }
  const playerId = sessionPlayerId(req);
  if (!playerId) { res.status(401).json({ error: "Login required" }); return; }

  const { question, options } = req.body as { question?: string; options?: string[] };
  const trimmedQuestion = String(question ?? "").trim();
  if (!trimmedQuestion) { res.status(400).json({ error: "Question required" }); return; }
  if (trimmedQuestion.length > 300) { res.status(400).json({ error: "Question too long (max 300 chars)" }); return; }

  const cleanOptions = (Array.isArray(options) ? options : [])
    .map(o => String(o).trim())
    .filter(o => o.length > 0 && o.length <= 100);
  if (cleanOptions.length < 2 || cleanOptions.length > 6) {
    res.status(400).json({ error: "Provide between 2 and 6 options" }); return;
  }

  const result = await db.execute(sql`
    INSERT INTO community_posts (player_id, content, post_type, status, approved_at)
    VALUES (${playerId}, ${trimmedQuestion}, 'poll', 'approved', NOW())
    RETURNING id
  `);
  const postId = (result.rows[0] as any).id as number;

  for (let i = 0; i < cleanOptions.length; i++) {
    await db.execute(sql`
      INSERT INTO community_poll_options (post_id, label, sort_order)
      VALUES (${postId}, ${cleanOptions[i]}, ${i})
    `);
  }

  res.status(201).json({ id: postId });
});

// ── POST /community/posts/:id/vote — poll voting ──────────────────────────────
// One vote per player per poll — re-voting changes the existing vote rather
// than adding a second one (the ON CONFLICT upsert below), same "you can
// change your mind" posture as toggling a reaction, just single-choice
// instead of multi-toggle.
router.post("/community/posts/:id/vote", authedWriteRateLimit, async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const postId = Number(req.params.id);
  if (isNaN(postId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { optionId } = req.body as { optionId?: number };
  if (!optionId || isNaN(Number(optionId))) { res.status(400).json({ error: "optionId required" }); return; }

  const post = (await db.execute(sql`SELECT post_type, status FROM community_posts WHERE id = ${postId}`)).rows[0] as any;
  if (!post || post.post_type !== "poll" || post.status !== "approved") {
    res.status(400).json({ error: "Not a votable poll" }); return;
  }
  const option = (await db.execute(sql`
    SELECT id FROM community_poll_options WHERE id = ${Number(optionId)} AND post_id = ${postId}
  `)).rows[0];
  if (!option) { res.status(400).json({ error: "Option does not belong to this poll" }); return; }

  await db.execute(sql`
    INSERT INTO community_poll_votes (post_id, option_id, player_id)
    VALUES (${postId}, ${Number(optionId)}, ${playerId})
    ON CONFLICT (post_id, player_id) DO UPDATE SET option_id = ${Number(optionId)}, created_at = NOW()
  `);

  const optionRows = await db.execute(sql`
    SELECT po.id, po.label,
           (SELECT COUNT(*)::int FROM community_poll_votes pv WHERE pv.option_id = po.id) AS vote_count
    FROM community_poll_options po WHERE po.post_id = ${postId} ORDER BY po.sort_order
  `);
  res.json({ poll_options: optionRows.rows, poll_my_vote: Number(optionId) });
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
  if (!await featureEnabled(req, "community_enabled")) {
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
    RETURNING player_id, mentioned_player_ids
  `);
  if (!result.rows.length) { res.status(404).json({ error: "Post not found or already approved" }); return; }

  const row = result.rows[0] as any;
  const authorId = row.player_id as number;
  void createNotification({
    playerId: authorId,
    type: "post_approved",
    entityId: id,
    entityType: "post",
    message: "Your post was approved! 🎉",
  });
  void notifyMentions((row.mentioned_player_ids ?? []) as number[], id, authorId);
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

// ── POST /community/posts/:id/pin — admin ────────────────────────────────────
// A separate mechanic from the "Top of the board" highlights (which is just
// a client-side sort of whatever's already loaded, by real reaction/comment
// counts). Pinning is a deliberate admin action — a committee announcement,
// a signup sheet — that stays at the top of the feed regardless of
// engagement, until an admin unpins it. Only approved manual or poll posts
// can be pinned; pinning something still awaiting moderation would surface
// unreviewed content at the top of the feed. Polls are eligible here
// specifically so "next friendly night?" can be pinned the same way a
// signup-sheet announcement can — it's the same kind of thing.
router.post("/community/posts/:id/pin", async (req, res): Promise<void> => {
  if (!sessionIsAdmin(req)) { res.status(403).json({ error: "Admin required" }); return; }
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await db.execute(sql`
    UPDATE community_posts SET pinned = TRUE, pinned_at = NOW()
    WHERE id = ${id} AND status = 'approved' AND post_type IN ('manual', 'poll')
    RETURNING id
  `);
  if (!result.rows.length) { res.status(404).json({ error: "Post not found or not eligible to pin" }); return; }
  res.json({ ok: true });
});

// ── POST /community/posts/:id/unpin — admin ──────────────────────────────────
router.post("/community/posts/:id/unpin", async (req, res): Promise<void> => {
  if (!sessionIsAdmin(req)) { res.status(403).json({ error: "Admin required" }); return; }
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const result = await db.execute(sql`
    UPDATE community_posts SET pinned = FALSE, pinned_at = NULL
    WHERE id = ${id}
    RETURNING id
  `);
  if (!result.rows.length) { res.status(404).json({ error: "Post not found" }); return; }
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

  const post = (await db.execute(sql`SELECT player_id, post_type, status, mentioned_player_ids FROM community_posts WHERE id = ${id}`)).rows[0] as any;
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  if (!isAdmin && post.player_id !== playerId) { res.status(403).json({ error: "Not your post" }); return; }
  if (!isAdmin && post.post_type !== "manual") {
    res.status(403).json({ error: "Auto-generated posts can't be edited" }); return;
  }

  const trimmed = content.trim();
  const newMentions = await resolveMentions(trimmed);
  const newMentionIds = newMentions.map(m => m.id);
  const mentionsArraySql = newMentionIds.length > 0
    ? sql`ARRAY[${sql.join(newMentionIds.map(mid => sql`${mid}`), sql`, `)}]::int[]`
    : sql`ARRAY[]::int[]`;

  if (!isAdmin && post.status === "approved") {
    await db.execute(sql`
      UPDATE community_posts
      SET content = ${trimmed}, status = 'pending', approved_at = NULL, mentioned_player_ids = ${mentionsArraySql}
      WHERE id = ${id}
    `);
    // Mentions notify when this comes back out of pending via /approve, not
    // here — same reasoning as a brand-new post.
    res.json({ ok: true, status: "pending" });
    return;
  }

  await db.execute(sql`
    UPDATE community_posts SET content = ${trimmed}, mentioned_player_ids = ${mentionsArraySql} WHERE id = ${id}
  `);

  // This path (admin editing any post, including one that's already live)
  // never goes through /approve again, so it's the one place a newly-added
  // mention on an already-approved post needs to notify directly. Diffed
  // against what was mentioned before so a routine typo-fix edit doesn't
  // re-notify everyone who was already mentioned.
  if (post.status === "approved") {
    const priorIds = new Set<number>((post.mentioned_player_ids ?? []) as number[]);
    const freshIds = newMentionIds.filter(mid => !priorIds.has(mid));
    void notifyMentions(freshIds, id, post.player_id);
  }

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
// Reuses the same free-text post_reactions.emoji TEXT column for a second,
// visually-distinct row of darts-themed "sticker" reactions — deliberately
// NOT gated behind the purchasable STICKER cosmetics/ownership system (see
// lib/cosmetics.ts), which would need an extra ownership check on every
// react call. This is a flat, free set anyone can use; a cosmetic-gated
// version is a possible future enhancement, not this one. Grouping/counting
// in GET /community/posts already works generically off whatever string is
// in this column, so no other backend change is needed to support these.
const BASE_EMOJI    = ["👍", "❤️", "😂", "🎯", "🏆"];
const STICKER_EMOJI = ["🎯 BULLSEYE", "🔥 ON FIRE", "💥 180!", "🍀 LUCKY", "🤝 GG"];
const ALLOWED_EMOJI = [...BASE_EMOJI, ...STICKER_EMOJI];

router.post("/community/posts/:id/react", authedWriteRateLimit, async (req, res): Promise<void> => {
  if (!await featureEnabled(req, "community_enabled") && !sessionIsAdmin(req)) {
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

// ── POST /community/posts/:id/bookmark — toggle, private per-player ──────────
// Same race-free single-statement toggle as /react above. Bookmarks are
// never shown to anyone but the player who made them (no notification, no
// "who saved this" — unlike reactions, which are public), so this doesn't
// need to check post ownership or fire any notification.
router.post("/community/posts/:id/bookmark", authedWriteRateLimit, async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const postId = Number(req.params.id);
  if (isNaN(postId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const toggled = await db.execute(sql`
    WITH del AS (
      DELETE FROM post_bookmarks
      WHERE post_id = ${postId} AND player_id = ${playerId}
      RETURNING id
    ), ins AS (
      INSERT INTO post_bookmarks (post_id, player_id)
      SELECT ${postId}, ${playerId}
      WHERE NOT EXISTS (SELECT 1 FROM del)
      RETURNING id
    )
    SELECT (SELECT COUNT(*) FROM ins)::int AS inserted_count
  `);
  res.json({ bookmarked: (toggled.rows[0] as any).inserted_count > 0 });
});

// ── POST /community/posts/:id/rsvp — toggle "I'm in" ─────────────────────────
// Restricted to pinned posts, same reasoning as the pin eligibility check
// above — RSVPing only makes sense on something an admin has deliberately
// flagged as a real announcement/signup, not on an arbitrary post. Same
// race-free single-statement toggle as /react and /bookmark.
router.post("/community/posts/:id/rsvp", authedWriteRateLimit, async (req, res): Promise<void> => {
  const playerId = requireAuth(req, res);
  if (!playerId) return;

  const postId = Number(req.params.id);
  if (isNaN(postId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const eligible = (await db.execute(sql`SELECT pinned FROM community_posts WHERE id = ${postId}`)).rows[0] as any;
  if (!eligible?.pinned) { res.status(400).json({ error: "Only pinned posts accept RSVPs" }); return; }

  const toggled = await db.execute(sql`
    WITH del AS (
      DELETE FROM post_rsvps
      WHERE post_id = ${postId} AND player_id = ${playerId}
      RETURNING id
    ), ins AS (
      INSERT INTO post_rsvps (post_id, player_id)
      SELECT ${postId}, ${playerId}
      WHERE NOT EXISTS (SELECT 1 FROM del)
      RETURNING id
    )
    SELECT (SELECT COUNT(*) FROM ins)::int AS inserted_count
  `);
  const rsvpCount = (await db.execute(sql`SELECT COUNT(*)::int AS c FROM post_rsvps WHERE post_id = ${postId}`)).rows[0] as any;
  res.json({ rsvped: (toggled.rows[0] as any).inserted_count > 0, rsvp_count: rsvpCount.c as number });
});

// ── GET /community/posts/:id/rsvps — who's in ─────────────────────────────────
router.get("/community/posts/:id/rsvps", async (req, res): Promise<void> => {
  const postId = Number(req.params.id);
  if (isNaN(postId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.execute(sql`
    SELECT pl.id AS player_id, pl.name AS player_name
    FROM post_rsvps pr
    JOIN players pl ON pl.id = pr.player_id
    WHERE pr.post_id = ${postId}
    ORDER BY pr.id ASC
  `);
  res.json(rows.rows);
});

// ── GET /community/posts/:id/reactions — who reacted ─────────────────────────
// Returns every reaction on the post grouped by emoji, each with the names of
// who reacted — backs the "tap a reaction to see who" feature. Small feed,
// small reaction counts per post, so one query grouped in JS is simpler than
// pushing the grouping into SQL and fine at this scale.
router.get("/community/posts/:id/reactions", async (req, res): Promise<void> => {
  const postId = Number(req.params.id);
  if (isNaN(postId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.execute(sql`
    SELECT pr.emoji, pr.player_id, pl.name AS player_name
    FROM post_reactions pr
    JOIN players pl ON pl.id = pr.player_id
    WHERE pr.post_id = ${postId}
    ORDER BY pr.id ASC
  `);
  const byEmoji: Record<string, { player_id: number; player_name: string }[]> = {};
  for (const row of rows.rows as any[]) {
    (byEmoji[row.emoji] ??= []).push({ player_id: row.player_id, player_name: row.player_name });
  }
  res.json(byEmoji);
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
           pl.equipped_name_style_id AS player_name_style_id,
           pl.current_win_streak AS player_win_streak,
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
    UPDATE community_posts SET photo_path = NULL, photo_image = NULL, photo_content_type = NULL
    WHERE id = ${id}
    RETURNING id
  `);
  if (!result.rows.length) { res.status(404).json({ error: "Post not found" }); return; }
  res.json({ ok: true });
});

// ── GET /community/posts/:id/photo — public ──────────────────────────────────
// No auth — community posts are a public feed, same visibility as the post's
// own content and reactions, so the photo behind it is public too (unlike
// DM photos, which are private between the two people in the conversation).
router.get("/community/posts/:id/photo", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const rows = (
      await db.execute(sql`
        SELECT photo_image, photo_content_type FROM community_posts WHERE id = ${id}
      `)
    ).rows as { photo_image: Buffer | null; photo_content_type: string | null }[];
    const row = rows[0];
    if (!row || !row.photo_image || !row.photo_content_type) {
      res.status(404).json({ error: "No photo" });
      return;
    }
    res.setHeader("Content-Type", row.photo_content_type);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(row.photo_image);
  } catch (err) {
    req.log.error({ err }, "GET /community/posts/:id/photo failed");
    res.status(500).json({ error: "Failed to load photo" });
  }
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
  if (!await featureEnabled(req, "community_enabled") && !sessionIsAdmin(req)) {
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
