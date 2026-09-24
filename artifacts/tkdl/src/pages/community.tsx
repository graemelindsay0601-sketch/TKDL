import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/context/auth";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Image as ImageIcon, Send, X, Clock, CheckCircle, AlertCircle, Pencil, Flame, Trophy, Users, ArrowUpDown, Pin, Search, Eye, Bookmark } from "lucide-react";
import { useCosmeticsCatalog, nameStyleCSS, nameStyleClassName, postAccentStyle, taglineStyleCSS } from "@/lib/cosmetics";

const TIER_COLORS: Record<string, string> = {
  Diamond: "#00e5ff", Platinum: "#e5e4e2", Gold: "#ffd24a", Silver: "#9ca3af", Bronze: "#cd7f32",
};

const EMOJIS = ["👍", "❤️", "😂", "🎯", "🏆"] as const;
// Darts-themed "sticker" reactions — a second, visually distinct row next
// to the plain emoji pills. Must match ALLOWED_EMOJI's STICKER_EMOJI in
// routes/community.ts exactly (case-sensitive string match server-side).
const STICKERS = ["🎯 BULLSEYE", "🔥 ON FIRE", "💥 180!", "🍀 LUCKY", "🤝 GG"] as const;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

// Quick-post templates — chip buttons in the expanded composer that just
// prefill createText with a starting line; never posts anything on their
// own. Purely a typing head-start for the common shapes of post this feed
// actually sees.
const QUICK_POST_TEMPLATES = [
  { label: "Match result",  text: "🏆 Match result: " },
  { label: "Session recap", text: "🎯 Tonight's session: " },
  { label: "Funny moment",  text: "😅 Story of the night: " },
  { label: "Looking for a game", text: "📅 Who's up for a practice night? " },
  { label: "Shoutout",      text: "🙌 Shoutout to " },
] as const;

// Mirrors the backend's resolveMentions() in routes/community.ts — same
// token shape and same normalize-then-compare rule — so a mention the
// server resolved (returned in post.mentions) reliably matches back up
// with the literal "@token" substring that produced it, letting the
// frontend turn only the resolved ones into profile links.
const MENTION_TOKEN = /@([A-Za-z0-9_]{2,40})/g;
function normalizeMentionKey(s: string): string {
  return s.toLowerCase().replace(/[_\s]/g, "");
}

// Splits a post's content into plain text and profile-linked "@token"
// pieces, using the (small) list of players the backend actually resolved
// for this post — never guesses at a mention the backend didn't resolve.
function renderPostContent(content: string, mentions: { id: number; name: string }[] | undefined): (string | JSX.Element)[] {
  if (!mentions || mentions.length === 0) return [content];
  const byKey = new Map(mentions.map(m => [normalizeMentionKey(m.name), m]));
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let key = 0;
  MENTION_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MENTION_TOKEN.exec(content))) {
    const target = byKey.get(normalizeMentionKey(match[1]));
    if (target) {
      if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));
      parts.push(
        <Link key={`mention-${key++}`} href={`/players/${target.id}`}
          className="font-semibold hover:underline" style={{ color: "#0066ff" }}>
          @{match[1]}
        </Link>
      );
      lastIndex = MENTION_TOKEN.lastIndex;
    }
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return parts;
}

function relativeTime(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const MAX_WIDTH  = 1080;
const MAX_HEIGHT = 1080;
const JPEG_QUALITY = 0.82;

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error("Compression failed")),
        "image/jpeg",
        JPEG_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

// Compresses, then base64-encodes so it can travel as plain JSON in the
// create-post body — same pattern as the profile photo and DM photo
// uploads (account.tsx's resizeImageToJpegDataUrl), since the object-
// storage endpoint this used to hit doesn't work on this app's Render
// hosting (see db/migrations/add_community_post_photo_image.ts).
async function encodePhoto(file: File): Promise<{ photoBase64: string; photoContentType: string }> {
  const compressed = await compressImage(file);
  const photoBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read photo"));
    reader.readAsDataURL(compressed);
  });
  return { photoBase64, photoContentType: "image/jpeg" };
}

type PollOption = { id: number; label: string; vote_count: number };

type Post = {
  id: number;
  player_id: number;
  player_name: string;
  player_tier: string;
  content: string;
  photo_content_type: string | null;
  post_type: string;
  status: string;
  pinned: boolean;
  created_at: string;
  reactions: Record<string, number>;
  mentions?: { id: number; name: string }[];
  comment_count: number;
  myReactions: string[];
  myBookmarked?: boolean;
  rsvp_count?: number;
  myRsvped?: boolean;
  poll_options?: PollOption[] | null;
  poll_my_vote?: number | null;
  player_name_style_id: string | null;
  player_post_accent_id: string | null;
  player_win_streak: number;
  player_tagline?: string | null;
  player_tagline_style_id?: string | null;
};

// Shape returned by GET /community/wall-of-fame and GET /community/throwback
// — a lighter-weight read-only post: no status/pinned/reactions-by-emoji/
// myReactions, since neither view supports reacting/commenting/pinning
// inline, just a static look back.
type LookbackPost = {
  id: number;
  player_id: number;
  player_name: string;
  player_tier: string;
  content: string;
  photo_content_type: string | null;
  created_at: string;
  player_name_style_id: string | null;
  player_win_streak: number;
  reaction_count?: number;
  comment_count?: number;
};

type Comment = {
  id: number;
  player_id: number;
  player_name: string;
  player_tier: string;
  content: string;
  created_at: string;
  player_name_style_id: string | null;
  player_win_streak: number;
};

function engagementScore(p: Post): number {
  return Object.values(p.reactions).reduce((a, b) => a + b, 0) + p.comment_count;
}

// Shared name treatment: links to the player's profile, applies their
// equipped NAME_STYLE cosmetic (same lib/cosmetics.ts used on player-detail
// and the dashboard — nothing new invented here), and shows a streak flame
// once currentWinStreak reaches the same >=3 threshold players.tsx uses.
function PlayerName({ id, name, tier, nameStyleId, winStreak, className = "" }: {
  id: number; name: string; tier: string; nameStyleId: string | null; winStreak: number; className?: string;
}) {
  const catalog = useCosmeticsCatalog();
  const cosmetic = catalog.find(c => c.id === nameStyleId);
  const tierCol = TIER_COLORS[tier] ?? "#9ca3af";
  return (
    <Link href={`/players/${id}`}
      className={`font-bold hover:underline decoration-dotted underline-offset-2 ${nameStyleClassName(cosmetic)} ${className}`}
      style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em", ...(cosmetic ? nameStyleCSS(cosmetic) : { color: tierCol }) }}>
      {name}
      {winStreak >= 3 && (
        <span className="inline-flex items-center gap-0.5 ml-1 align-middle" style={{ color: "#ff005c" }}>
          <Flame className="w-3 h-3 streak-fire inline" style={{ color: "#ff005c" }} />
          <span className="text-xs" style={{ fontFamily: "Oswald, sans-serif" }}>{winStreak}</span>
        </span>
      )}
    </Link>
  );
}

function PlayerAvatar({ name, tier, size = 8 }: { name: string; tier: string; size?: number }) {
  const col = TIER_COLORS[tier] ?? "#9ca3af";
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center shrink-0 font-bold`}
      style={{ background: `${col}22`, border: `1.5px solid ${col}66`, color: col, fontFamily: "Oswald, sans-serif", fontSize: size <= 8 ? "0.75rem" : "1rem" }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function PostCard({ post, onReact, onComment, isAdmin, onApprove, onReject, onDelete, onRemovePhoto, onDeleteComment, onEdit, onPin, onUnpin, onBookmark, onVote, onRsvp }: {
  post: Post;
  onReact: (id: number, emoji: string) => void;
  onComment: (id: number, content: string) => void;
  isAdmin: boolean;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  onDelete?: (id: number) => void;
  onRemovePhoto?: (id: number) => void;
  onDeleteComment?: (postId: number, commentId: number) => void;
  onEdit?: (id: number, content: string) => void;
  onPin?: (id: number) => void;
  onUnpin?: (id: number) => void;
  onBookmark?: (id: number) => void;
  onVote?: (id: number, pollOptions: PollOption[], myVote: number) => void;
  onRsvp?: (id: number, rsvped: boolean, rsvpCount: number) => void;
}) {
  const { user } = useAuth();
  // Comments show inline — the first couple visible under the post by
  // default, "View all" reveals the rest — instead of being hidden behind a
  // click-to-expand toggle. Loaded once on mount rather than lazily, which
  // is fine at this feed's scale (a club's worth of posts, not a firehose).
  const [comments, setComments]           = useState<Comment[] | null>(null);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const [commentText, setCommentText]     = useState("");
  const [submittingComment, setSubmit]    = useState(false);
  const [editing, setEditing]             = useState(false);
  const [editText, setEditText]           = useState(post.content);
  const [saving, setSaving]               = useState(false);
  const [reactors, setReactors]           = useState<Record<string, { player_id: number; player_name: string }[]> | null>(null);
  const [showReactors, setShowReactors]   = useState(false);
  const [pinning, setPinning]             = useState(false);
  const [voting, setVoting]               = useState(false);
  const [rsvping, setRsvping]             = useState(false);
  const [rsvpers, setRsvpers]             = useState<{ player_id: number; player_name: string }[] | null>(null);
  const [showRsvpers, setShowRsvpers]     = useState(false);
  const { toast } = useToast();

  const isOwner = !!user?.playerId && user.playerId === post.player_id;
  const canEdit = isOwner || isAdmin;

  const saveEdit = async () => {
    if (!editText.trim() || editText.trim() === post.content) { setEditing(false); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/community/posts/${post.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editText.trim() }),
      });
      if (r.ok) {
        onEdit?.(post.id, editText.trim());
        setEditing(false);
        toast({ title: "Post updated" });
      } else {
        const d = await r.json();
        toast({ title: d.error ?? "Failed to save", variant: "destructive" });
      }
    } finally { setSaving(false); }
  };

  const loadComments = useCallback(async () => {
    const r = await fetch(`/api/community/posts/${post.id}/comments`);
    if (r.ok) setComments(await r.json());
  }, [post.id]);

  useEffect(() => {
    if (post.status !== "pending" && post.comment_count > 0) void loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const loadReactors = async () => {
    if (reactors) { setShowReactors(v => !v); return; }
    const r = await fetch(`/api/community/posts/${post.id}/reactions`);
    if (r.ok) { setReactors(await r.json()); setShowReactors(true); }
  };

  const togglePin = async () => {
    setPinning(true);
    try {
      const r = await fetch(`/api/community/posts/${post.id}/${post.pinned ? "unpin" : "pin"}`, {
        method: "POST", credentials: "include",
      });
      if (r.ok) {
        (post.pinned ? onUnpin : onPin)?.(post.id);
      } else {
        const d = await r.json();
        toast({ title: d.error ?? "Failed to update pin", variant: "destructive" });
      }
    } finally { setPinning(false); }
  };

  const submitVote = async (optionId: number) => {
    setVoting(true);
    try {
      const r = await fetch(`/api/community/posts/${post.id}/vote`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      if (r.ok) {
        const d = await r.json();
        onVote?.(post.id, d.poll_options, d.poll_my_vote);
      } else {
        const d = await r.json();
        toast({ title: d.error ?? "Failed to vote", variant: "destructive" });
      }
    } finally { setVoting(false); }
  };

  const toggleRsvp = async () => {
    setRsvping(true);
    try {
      const r = await fetch(`/api/community/posts/${post.id}/rsvp`, { method: "POST", credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        onRsvp?.(post.id, d.rsvped, d.rsvp_count);
      } else {
        const d = await r.json();
        toast({ title: d.error ?? "Failed to RSVP", variant: "destructive" });
      }
    } finally { setRsvping(false); }
  };

  const loadRsvpers = async () => {
    if (rsvpers) { setShowRsvpers(v => !v); return; }
    const r = await fetch(`/api/community/posts/${post.id}/rsvps`);
    if (r.ok) { setRsvpers(await r.json()); setShowRsvpers(true); }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmit(true);
    try {
      const r = await fetch(`/api/community/posts/${post.id}/comments`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText }),
      });
      if (r.ok) {
        setCommentText("");
        void loadComments();
        onComment(post.id, commentText);
      } else {
        const d = await r.json();
        toast({ title: d.error ?? "Failed to comment", variant: "destructive" });
      }
    } finally { setSubmit(false); }
  };

  const isPending = post.status === "pending";
  // POST_ACCENT cosmetic — a personal border/background tint on the
  // author's own post. Pending posts keep their own "awaiting approval"
  // colour treatment above, which takes precedence — a purchased accent
  // never masks that a post hasn't been moderated yet.
  const catalog = useCosmeticsCatalog();
  const postAccent = !isPending
    ? postAccentStyle(catalog.find(c => c.id === post.player_post_accent_id))
    : {};

  return (
    <div id={`post-${post.id}`} className="rounded-2xl overflow-hidden scroll-mt-4"
      style={{
        background: isPending ? "rgba(255,200,0,0.04)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${isPending ? "rgba(255,200,0,0.2)" : post.pinned ? "rgba(255,210,74,0.35)" : "rgba(255,255,255,0.07)"}`,
        ...postAccent,
      }}>

      {/* Pending badge */}
      {isPending && (
        <div className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold"
          style={{ background: "rgba(255,200,0,0.08)", borderBottom: "1px solid rgba(255,200,0,0.15)", color: "#ffd24a", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
          <Clock className="w-3.5 h-3.5" />AWAITING APPROVAL
          {isAdmin && (
            <div className="ml-auto flex gap-2">
              <button onClick={() => onApprove?.(post.id)}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold transition-opacity hover:opacity-80"
                style={{ background: "rgba(0,229,160,0.15)", border: "1px solid rgba(0,229,160,0.4)", color: "#00e5a0" }}>
                <CheckCircle className="w-3 h-3" />Approve
              </button>
              <button onClick={() => onReject?.(post.id)}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold transition-opacity hover:opacity-80"
                style={{ background: "rgba(255,0,92,0.12)", border: "1px solid rgba(255,0,92,0.35)", color: "#ff005c" }}>
                <X className="w-3 h-3" />Reject
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pinned badge — a deliberate admin action, separate from the
          algorithmic "Top of the board" highlights above the feed */}
      {!isPending && post.pinned && (
        <div className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold"
          style={{ background: "rgba(255,210,74,0.06)", borderBottom: "1px solid rgba(255,210,74,0.15)", color: "#ffd24a", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
          <Pin className="w-3.5 h-3.5" />PINNED
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <PlayerAvatar name={post.player_name} tier={post.player_tier} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <PlayerName id={post.player_id} name={post.player_name} tier={post.player_tier}
                nameStyleId={post.player_name_style_id} winStreak={post.player_win_streak}
                className="text-sm" />
            </div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
              {relativeTime(post.created_at)}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {canEdit && !isPending && (
              <button onClick={() => { setEditing(v => !v); setEditText(post.content); }}
                className="p-1 rounded-lg opacity-30 hover:opacity-80 transition-opacity"
                style={{ color: editing ? "#ffd24a" : "rgba(255,255,255,0.6)" }}
                title="Edit post">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {isAdmin && !isPending && (
              <button onClick={togglePin} disabled={pinning}
                className="p-1 rounded-lg opacity-30 hover:opacity-80 transition-opacity disabled:opacity-20"
                style={{ color: post.pinned ? "#ffd24a" : "rgba(255,255,255,0.6)" }}
                title={post.pinned ? "Unpin post" : "Pin post"}>
                <Pin className="w-3.5 h-3.5" fill={post.pinned ? "#ffd24a" : "none"} />
              </button>
            )}
            {isAdmin && !isPending && (
              <button onClick={() => onDelete?.(post.id)}
                className="p-1 rounded-lg opacity-30 hover:opacity-80 transition-opacity"
                style={{ color: "#ff005c" }}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content / inline edit */}
        {editing ? (
          <div className="mb-3">
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={3}
              maxLength={1000}
              autoFocus
              className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,200,0,0.4)", color: "#fff" }}
            />
            <div className="flex gap-2 mt-1.5">
              <button onClick={saveEdit} disabled={saving || !editText.trim()}
                className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-opacity disabled:opacity-40"
                style={{ background: "rgba(0,229,160,0.15)", border: "1px solid rgba(0,229,160,0.4)", color: "#00e5a0", fontFamily: "Oswald, sans-serif" }}>
                <CheckCircle className="w-3 h-3" />{saving ? "SAVING…" : "SAVE"}
              </button>
              <button onClick={() => setEditing(false)}
                className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-opacity"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", fontFamily: "Oswald, sans-serif" }}>
                <X className="w-3 h-3" />CANCEL
              </button>
            </div>
          </div>
        ) : post.content ? (
          <p className="text-sm mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
            {renderPostContent(post.content, post.mentions)}
          </p>
        ) : null}

        {/* Poll — post.content above is the question; these are its options.
            Voting (and re-voting) hits POST /community/posts/:id/vote,
            single-choice, one vote per player. Bars fill by share of total
            votes so the result reads at a glance without extra labels. */}
        {post.post_type === "poll" && post.poll_options && (
          <div className="mb-3 space-y-1.5">
            {(() => {
              const total = post.poll_options.reduce((a, o) => a + o.vote_count, 0);
              return post.poll_options.map(opt => {
                const pct = total > 0 ? Math.round((opt.vote_count / total) * 100) : 0;
                const mine = post.poll_my_vote === opt.id;
                return (
                  <button key={opt.id} type="button" disabled={!user || voting}
                    onClick={() => submitVote(opt.id)}
                    className="w-full text-left rounded-xl overflow-hidden relative transition-opacity disabled:opacity-70"
                    style={{ border: `1px solid ${mine ? "rgba(0,102,255,0.5)" : "rgba(255,255,255,0.1)"}` }}>
                    <div className="absolute inset-y-0 left-0 transition-all"
                      style={{ width: `${pct}%`, background: mine ? "rgba(0,102,255,0.18)" : "rgba(255,255,255,0.06)" }} />
                    <div className="relative flex items-center justify-between px-3 py-2 text-xs">
                      <span style={{ color: mine ? "#4d94ff" : "rgba(255,255,255,0.75)", fontWeight: mine ? 700 : 400 }}>
                        {mine && "✓ "}{opt.label}
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Share Tech Mono, monospace" }}>
                        {opt.vote_count} · {pct}%
                      </span>
                    </div>
                  </button>
                );
              });
            })()}
            {!user && (
              <p className="text-xs italic" style={{ color: "rgba(255,255,255,0.3)" }}>Sign in to vote</p>
            )}
          </div>
        )}

        {/* Photo */}
        {post.photo_content_type && (
          <div className="mb-3 rounded-xl overflow-hidden relative" style={{ maxHeight: 440 }}>
            <img src={`/api/community/posts/${post.id}/photo`} alt="Post photo"
              loading="lazy"
              decoding="async"
              className="w-full object-cover rounded-xl"
              style={{ maxHeight: 440 }} />
            {isAdmin && (
              <button onClick={() => onRemovePhoto?.(post.id)}
                className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-opacity hover:opacity-90"
                style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,0,92,0.5)", color: "#ff005c", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>
                <X className="w-3 h-3" />REMOVE PHOTO
              </button>
            )}
          </div>
        )}

        {/* Reaction bar */}
        {!isPending && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            {EMOJIS.map(emoji => {
              const count  = post.reactions[emoji] ?? 0;
              const active = post.myReactions.includes(emoji);
              return (
                <button key={emoji} onClick={() => user ? onReact(post.id, emoji) : void 0}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all duration-150 select-none"
                  style={{
                    background: active ? "rgba(255,0,92,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${active ? "rgba(255,0,92,0.35)" : "rgba(255,255,255,0.08)"}`,
                    color: active ? "#ff005c" : count > 0 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)",
                    cursor: user ? "pointer" : "default",
                  }}>
                  <span>{emoji}</span>
                  {count > 0 && <span className="font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>{count}</span>}
                </button>
              );
            })}

            {/* Sticker reactions — same toggle mechanics as the plain emoji
                pills above (same onReact/myReactions), styled distinctly
                (mono type, gold-tinted) so they read as a separate,
                collectible-feeling row rather than more of the same five
                emoji. */}
            {STICKERS.map(sticker => {
              const count  = post.reactions[sticker] ?? 0;
              const active = post.myReactions.includes(sticker);
              return (
                <button key={sticker} onClick={() => user ? onReact(post.id, sticker) : void 0}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all duration-150 select-none"
                  style={{
                    fontFamily: "Share Tech Mono, monospace",
                    background: active ? "rgba(255,210,74,0.15)" : "rgba(255,210,74,0.04)",
                    border: `1px solid ${active ? "rgba(255,210,74,0.5)" : "rgba(255,210,74,0.18)"}`,
                    color: active ? "#ffd24a" : count > 0 ? "rgba(255,210,74,0.7)" : "rgba(255,210,74,0.35)",
                    cursor: user ? "pointer" : "default",
                  }}>
                  <span>{sticker}</span>
                  {count > 0 && <span className="font-bold">{count}</span>}
                </button>
              );
            })}

            {/* RSVP — "I'm in", pinned posts only (an admin has to have
                deliberately flagged this as a real announcement/signup
                first — see the eligibility check in the /rsvp route). */}
            {post.pinned && (
              <button onClick={() => user && !rsvping && toggleRsvp()} disabled={!user || rsvping}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all duration-150 select-none disabled:opacity-60"
                style={{
                  background: post.myRsvped ? "rgba(0,229,160,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${post.myRsvped ? "rgba(0,229,160,0.4)" : "rgba(255,255,255,0.08)"}`,
                  color: post.myRsvped ? "#00e5a0" : "rgba(255,255,255,0.5)",
                  cursor: user ? "pointer" : "default",
                }}>
                <CheckCircle className="w-3 h-3" />
                <span style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
                  {post.myRsvped ? "I'M IN" : "I'M IN?"}
                </span>
                {(post.rsvp_count ?? 0) > 0 && <span className="font-bold">{post.rsvp_count}</span>}
              </button>
            )}
            {post.pinned && (post.rsvp_count ?? 0) > 0 && (
              <button onClick={loadRsvpers}
                className="flex items-center gap-1 text-xs transition-colors"
                style={{ color: showRsvpers ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.22)" }}
                title="See who's in">
                <Users className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Who reacted — a separate tap target from the reaction pills
                above, so tapping an emoji still just toggles your own
                reaction. Only shown once there's something to see. */}
            {Object.values(post.reactions).some(c => c > 0) && (
              <button onClick={loadReactors}
                className="flex items-center gap-1 text-xs transition-colors"
                style={{ color: showReactors ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.22)" }}
                title="See who reacted">
                <Eye className="w-3.5 h-3.5" />
              </button>
            )}

            <span className="ml-auto flex items-center gap-1.5 text-xs"
              style={{ color: "rgba(255,255,255,0.25)" }}>
              <MessageSquare className="w-3.5 h-3.5" />
              <span style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
                {post.comment_count}
              </span>
            </span>

            {user && (
              <button onClick={() => onBookmark?.(post.id)}
                className="transition-colors"
                style={{ color: post.myBookmarked ? "#ffd24a" : "rgba(255,255,255,0.22)" }}
                title={post.myBookmarked ? "Saved" : "Save post"}>
                <Bookmark className="w-3.5 h-3.5" fill={post.myBookmarked ? "#ffd24a" : "none"} />
              </button>
            )}
          </div>
        )}

        {/* Who reacted panel */}
        {!isPending && showReactors && reactors && (
          <div className="mt-2 flex flex-col gap-1 rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {Object.entries(reactors).map(([emoji, people]) => (
              <div key={emoji} className="text-xs flex items-start gap-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                <span>{emoji}</span>
                <span>{people.map(p => p.player_name).join(", ")}</span>
              </div>
            ))}
          </div>
        )}

        {/* Who's in panel */}
        {showRsvpers && rsvpers && (
          <div className="mt-2 rounded-xl p-2.5 text-xs" style={{ background: "rgba(0,229,160,0.05)", border: "1px solid rgba(0,229,160,0.15)", color: "rgba(255,255,255,0.6)" }}>
            {rsvpers.length === 0 ? "No one yet" : rsvpers.map(p => p.player_name).join(", ")}
          </div>
        )}

        {/* Comments — inline preview, not gated behind a click to expand */}
        {!isPending && (post.comment_count > 0 || user) && (
          <div className="mt-3 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.75rem" }}>
            {comments === null ? (
              post.comment_count > 0 && <div className="text-xs text-center py-2" style={{ color: "rgba(255,255,255,0.3)" }}>Loading…</div>
            ) : comments.length === 0 ? null : (
              <>
                {(commentsExpanded ? comments : comments.slice(0, 2)).map(c => (
                  <div key={c.id} className="flex gap-2 group">
                    <PlayerAvatar name={c.player_name} tier={c.player_tier} size={6} />
                    <div className="flex-1 min-w-0">
                      <PlayerName id={c.player_id} name={c.player_name} tier={c.player_tier}
                        nameStyleId={c.player_name_style_id} winStreak={c.player_win_streak}
                        className="text-xs mr-2" />
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{c.content}</span>
                      <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>{relativeTime(c.created_at)}</div>
                    </div>
                    {(isAdmin || c.player_id === user?.playerId) && (
                      <button onClick={() => onDeleteComment?.(post.id, c.id)}
                        className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                        style={{ color: "#ff005c" }} title="Delete comment">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                {!commentsExpanded && comments.length > 2 && (
                  <button onClick={() => setCommentsExpanded(true)}
                    className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>
                    View all {comments.length} comments
                  </button>
                )}
              </>
            )}

            {user && (
              <form onSubmit={submitComment} className="flex gap-2 mt-2">
                <input value={commentText} onChange={e => setCommentText(e.target.value)}
                  placeholder="Add a comment…"
                  className="flex-1 px-3 py-1.5 rounded-xl text-xs outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
                  maxLength={500} />
                <button type="submit" disabled={submittingComment || !commentText.trim()}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-opacity disabled:opacity-40"
                  style={{ background: "rgba(255,0,92,0.2)", border: "1px solid rgba(255,0,92,0.4)", color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                  <Send className="w-3 h-3" />
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// A collapsed run of same-player, same-day bare-photo posts (see
// groupedFeed in CommunityPage). Shows a compact thumbnail grid; tapping a
// thumbnail expands that one underlying post into a full, completely
// normal PostCard right below — same react/comment/edit/delete/pin
// behavior it always had, just reached through one extra tap.
function PhotoGroupCard({ group, expandedId, onExpand, onReact, onComment, isAdmin, onDelete, onRemovePhoto, onDeleteComment, onEdit, onPin, onUnpin, onBookmark, onVote, onRsvp }: {
  group: Post[];
  expandedId: number | null;
  onExpand: (id: number | null) => void;
  onReact: (id: number, emoji: string) => void;
  onComment: (id: number, content: string) => void;
  isAdmin: boolean;
  onDelete?: (id: number) => void;
  onRemovePhoto?: (id: number) => void;
  onDeleteComment?: (postId: number, commentId: number) => void;
  onEdit?: (id: number, content: string) => void;
  onPin?: (id: number) => void;
  onUnpin?: (id: number) => void;
  onBookmark?: (id: number) => void;
  onVote?: (id: number, pollOptions: PollOption[], myVote: number) => void;
  onRsvp?: (id: number, rsvped: boolean, rsvpCount: number) => void;
}) {
  const first = group[0];
  const expandedPost = group.find(p => p.id === expandedId) ?? null;
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(20,20,26,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center gap-2.5 mb-3">
        <PlayerAvatar name={first.player_name} tier={first.player_tier} />
        <div className="min-w-0">
          <PlayerName id={first.player_id} name={first.player_name} tier={first.player_tier}
            nameStyleId={first.player_name_style_id} winStreak={first.player_win_streak} className="text-sm" />
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            {relativeTime(first.created_at)} · {group.length} photos
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {group.map(p => (
          <button key={p.id} onClick={() => onExpand(expandedId === p.id ? null : p.id)}
            className="relative rounded-lg overflow-hidden aspect-square">
            <img src={`/api/community/posts/${p.id}/photo`} alt="" loading="lazy" decoding="async"
              className="w-full h-full object-cover" />
            <div className="absolute inset-0 transition-colors" style={{ background: expandedId === p.id ? "rgba(255,0,92,0.2)" : "transparent" }} />
          </button>
        ))}
      </div>
      {expandedPost && (
        <div className="pt-3">
          <PostCard post={expandedPost} onReact={onReact} onComment={onComment} isAdmin={isAdmin}
            onDelete={onDelete} onRemovePhoto={onRemovePhoto} onDeleteComment={onDeleteComment}
            onEdit={onEdit} onPin={onPin} onUnpin={onUnpin} onBookmark={onBookmark} onVote={onVote} onRsvp={onRsvp} />
        </div>
      )}
    </div>
  );
}

export default function CommunityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const catalog = useCosmeticsCatalog();

  const [communityEnabled, setCommunityEnabled] = useState<boolean | null>(null);
  const [posts,     setPosts]     = useState<Post[]>([]);
  const [pending,   setPending]   = useState<Post[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadingMore, setLoadMore] = useState(false);
  const [hasMore,   setHasMore]   = useState(true);
  const [offset,    setOffset]    = useState(0);

  // Create post state
  const [showCreate,   setShowCreate]   = useState(false);
  const [createText,   setCreateText]   = useState("");
  const [photoFile,    setPhotoFile]    = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading,    setUploading]    = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Create poll state — admin-only (see POST /community/polls). A separate
  // small form rather than folding into the main composer above, since a
  // poll isn't "text + optional photo", it's a question + a fixed set of
  // options.
  const [showPollCreate, setShowPollCreate] = useState(false);
  const [pollQuestion,   setPollQuestion]   = useState("");
  const [pollOptions,    setPollOptions]    = useState<string[]>(["", ""]);
  const [creatingPoll,   setCreatingPoll]   = useState(false);

  // Feed tab / sort. "All" just filters/reorders whatever's already loaded
  // in `posts`. "Photos" and "Mine" used to do the same thing — which meant
  // a feed that hadn't been paginated far enough yet showed "you haven't
  // posted" even for someone who had, just because their post wasn't in the
  // loaded window. Those two tabs now merge in a dedicated server-filtered
  // fetch the first time they're opened (see the effect below), so the tab
  // reflects everything that actually matches, not just what happened to be
  // paged in already.
  const [tab,  setTab]  = useState<"all" | "photos" | "mine" | "saved">("all");
  const [sort, setSort] = useState<"new" | "top">("new");
  const [expandedPhotoId, setExpandedPhotoId] = useState<number | null>(null);
  const [groupExpandedId, setGroupExpandedId] = useState<number | null>(null);
  const [tabFetchLoading, setTabFetchLoading] = useState(false);
  const fetchedTabsRef = useRef<Set<string>>(new Set());

  // Search — a separate server query rather than filtering what's already
  // loaded, so it can find posts that haven't been paged into `posts` yet.
  // Debounced so typing doesn't fire a request per keystroke.
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState<Post[] | null>(null);
  const [searching, setSearching]         = useState(false);

  // Wall of Fame — collapsed by default (this page is already dense), and
  // only fetched the first time it's actually opened, same lazy pattern as
  // the Photos/Mine/Saved tabs above.
  const [showWallOfFame, setShowWallOfFame]   = useState(false);
  const [wallOfFame, setWallOfFame]           = useState<LookbackPost[] | null>(null);
  const [wallOfFameLoading, setWallOfFameLoading] = useState(false);

  // Throwback — fetched once on mount (it's cheap, and it's the kind of
  // "oh hey" moment that only lands if it's already there when the page
  // opens). `undefined` = not fetched yet, `null` = fetched, nothing found.
  const [throwback, setThrowback] = useState<LookbackPost | null | undefined>(undefined);
  const [throwbackDismissed, setThrowbackDismissed] = useState(false);

  const LIMIT = 20;

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.ok ? r.json() : {})
      .then((s: Record<string, unknown>) => setCommunityEnabled(s.community_enabled === true))
      .catch(() => setCommunityEnabled(false));
  }, []);

  const loadPosts = useCallback(async (reset = false) => {
    const off = reset ? 0 : offset;
    if (!reset) setLoadMore(true); else setLoading(true);
    try {
      const r = await fetch(`/api/community/posts?limit=${LIMIT}&offset=${off}`);
      if (!r.ok) return;
      const data: Post[] = await r.json();
      // Deduped by id — a post already merged in by the Photos/Mine tab
      // fetch below (or already present after a reset) would otherwise show
      // up twice, and React duplicate-key warnings, once regular pagination
      // reaches the same row.
      setPosts(prev => {
        if (reset) return data;
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...data.filter(p => !seen.has(p.id))];
      });
      setHasMore(data.length === LIMIT);
      setOffset(off + data.length);
    } finally { setLoading(false); setLoadMore(false); }
  }, [offset]);

  const loadPending = useCallback(async () => {
    if (!user?.isAdmin) return;
    const r = await fetch("/api/community/posts/pending", { credentials: "include" });
    if (r.ok) setPending(await r.json());
  }, [user?.isAdmin]);

  useEffect(() => {
    void loadPosts(true);
    void loadPending();
    fetch("/api/community/throwback")
      .then(r => r.ok ? r.json() : null)
      .then((data: LookbackPost | null) => setThrowback(data))
      .catch(() => setThrowback(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleWallOfFame = () => {
    const opening = !showWallOfFame;
    setShowWallOfFame(opening);
    if (opening && wallOfFame === null) {
      setWallOfFameLoading(true);
      fetch("/api/community/wall-of-fame")
        .then(r => r.ok ? r.json() : [])
        .then((data: LookbackPost[]) => setWallOfFame(data))
        .catch(() => setWallOfFame([]))
        .finally(() => setWallOfFameLoading(false));
    }
  };

  // Backs the "Photos" and "Mine" tabs with a real server query the first
  // time each is opened, merging any posts the general feed hasn't paged in
  // yet into `posts` (deduped by id) rather than replacing it — so switching
  // back to "All" still has everything it had before, and LOAD MORE's
  // pagination cursor is untouched.
  useEffect(() => {
    if (tab === "all") return;
    const cacheKey = tab === "mine" ? `mine:${user?.playerId ?? "anon"}`
                    : tab === "saved" ? `saved:${user?.playerId ?? "anon"}`
                    : "photos";
    if ((tab === "mine" || tab === "saved") && !user?.playerId) return;
    if (fetchedTabsRef.current.has(cacheKey)) return;
    fetchedTabsRef.current.add(cacheKey);

    const params = tab === "mine" ? `player_id=${user!.playerId}`
                  : tab === "saved" ? `bookmarked_only=true`
                  : `photo_only=true`;
    setTabFetchLoading(true);
    fetch(`/api/community/posts?limit=100&${params}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Post[]) => {
        setPosts(prev => {
          const seen = new Set(prev.map(p => p.id));
          const fresh = data.filter(p => !seen.has(p.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
      })
      .catch(() => { fetchedTabsRef.current.delete(cacheKey); })
      .finally(() => setTabFetchLoading(false));
  }, [tab, user?.playerId]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    const handle = setTimeout(() => {
      fetch(`/api/community/posts?limit=50&q=${encodeURIComponent(q)}`)
        .then(r => r.ok ? r.json() : [])
        .then((data: Post[]) => setSearchResults(data))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  // "Best of the week" — the top posts among what's loaded, ranked by real
  // reaction + comment counts already on each post. Not a separate scoring
  // system, just a sort of fields the page already fetches.
  const highlights = useMemo(() => {
    return [...posts]
      .filter(p => engagementScore(p) > 0)
      .sort((a, b) => engagementScore(b) - engagementScore(a))
      .slice(0, 3);
  }, [posts]);

  // "Active this week" — the distinct posters among what's loaded, most
  // recent first. Derived client-side from the same feed, not a new
  // presence/online-status feature.
  const activeMembers = useMemo(() => {
    const seen = new Map<number, Post>();
    for (const p of posts) if (!seen.has(p.player_id)) seen.set(p.player_id, p);
    return [...seen.values()].slice(0, 12);
  }, [posts]);

  const visiblePosts = useMemo(() => {
    let list = posts;
    if (tab === "photos")      list = list.filter(p => p.photo_content_type);
    else if (tab === "mine")   list = list.filter(p => p.player_id === user?.playerId);
    else if (tab === "saved")  list = list.filter(p => p.myBookmarked);
    if (sort === "top") list = [...list].sort((a, b) => engagementScore(b) - engagementScore(a));
    // Pinned posts float to the top regardless of sort — a stable partition
    // that otherwise preserves whatever order the sort above (or the
    // server's own pinned-first ordering) already produced.
    list = [...list].sort((a, b) => (a.pinned === b.pinned) ? 0 : a.pinned ? -1 : 1);
    return list;
  }, [posts, tab, sort, user?.playerId]);

  const photoTiles = useMemo(() => visiblePosts.filter(p => p.photo_content_type), [visiblePosts]);

  // Grouped photo galleries — a run of 3+ consecutive posts (in whatever
  // order visiblePosts already presents, pinned-first included) by the same
  // player, same calendar day, each a bare photo with no real caption and
  // not pinned, reads as a photo dump cluttering the feed with near-
  // identical cards. Purely a display grouping: the underlying posts are
  // untouched, and every interaction (react/comment/edit/delete/pin) still
  // happens on one specific post via the same expand-a-tile pattern the
  // Photos tab already uses, so nothing about how those actions work
  // changes — a grouped post is exactly as reactable/commentable/editable
  // as it always was, just via one extra click to reveal it.
  const groupedFeed = useMemo(() => {
    const items: (Post | Post[])[] = [];
    let run: Post[] = [];
    const flushRun = () => {
      if (run.length >= 3) items.push(run);
      else items.push(...run);
      run = [];
    };
    for (const p of visiblePosts) {
      const isBarePhoto = !!p.photo_content_type && !p.content.trim() && p.post_type === "manual" && !p.pinned;
      const last = run[run.length - 1];
      const continuesRun = last != null
        && last.player_id === p.player_id
        && new Date(last.created_at).toDateString() === new Date(p.created_at).toDateString();
      if (isBarePhoto && (run.length === 0 || continuesRun)) {
        run.push(p);
      } else {
        flushRun();
        if (isBarePhoto) run.push(p); else items.push(p);
      }
    }
    flushRun();
    return items;
  }, [visiblePosts]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Images only", variant: "destructive" }); return; }
    if (file.size > MAX_PHOTO_BYTES) { toast({ title: "Max photo size is 5 MB", variant: "destructive" }); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createText.trim() && !photoFile) { toast({ title: "Add some text or a photo", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      let photoBase64: string | undefined;
      let photoContentType: string | undefined;
      if (photoFile) {
        setUploading(true);
        ({ photoBase64, photoContentType } = await encodePhoto(photoFile));
        setUploading(false);
      }
      const r = await fetch("/api/community/posts", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: createText, photoBase64, photoContentType }),
      });
      if (r.ok) {
        toast({ title: "Post submitted!", description: "Waiting for approval before it goes live." });
        setCreateText(""); clearPhoto(); setShowCreate(false);
        void loadPending();
      } else {
        const d = await r.json();
        toast({ title: d.error ?? "Failed to post", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally { setSubmitting(false); setUploading(false); }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOptions = pollOptions.map(o => o.trim()).filter(Boolean);
    if (!pollQuestion.trim()) { toast({ title: "Add a question", variant: "destructive" }); return; }
    if (cleanOptions.length < 2) { toast({ title: "Add at least 2 options", variant: "destructive" }); return; }
    setCreatingPoll(true);
    try {
      const r = await fetch("/api/community/polls", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: pollQuestion.trim(), options: cleanOptions }),
      });
      if (r.ok) {
        toast({ title: "Poll posted!" });
        setPollQuestion(""); setPollOptions(["", ""]); setShowPollCreate(false);
        // Polls are auto-approved and go straight into the feed — a real
        // reload (rather than hand-building a Post object here) so the new
        // row comes back with every field the feed query computes, exactly
        // as the server sees it.
        void loadPosts(true);
      } else {
        const d = await r.json();
        toast({ title: d.error ?? "Failed to create poll", variant: "destructive" });
      }
    } finally { setCreatingPoll(false); }
  };

  const handleReact = async (postId: number, emoji: string) => {
    if (!user) return;
    const r = await fetch(`/api/community/posts/${postId}/react`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (!r.ok) return;
    const { toggled } = await r.json();
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const reactions = { ...p.reactions };
      const myReactions = [...p.myReactions];
      if (toggled) {
        reactions[emoji] = (reactions[emoji] ?? 0) + 1;
        if (!myReactions.includes(emoji)) myReactions.push(emoji);
      } else {
        reactions[emoji] = Math.max(0, (reactions[emoji] ?? 1) - 1);
        if (reactions[emoji] === 0) delete reactions[emoji];
        const idx = myReactions.indexOf(emoji);
        if (idx !== -1) myReactions.splice(idx, 1);
      }
      return { ...p, reactions, myReactions };
    }));
  };

  const handleComment = (postId: number, _content: string) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p));
  };

  const handleApprove = async (id: number) => {
    const r = await fetch(`/api/community/posts/${id}/approve`, { method: "POST", credentials: "include" });
    if (r.ok) {
      toast({ title: "Post approved" });
      setPending(prev => prev.filter(p => p.id !== id));
      void loadPosts(true);
    }
  };

  const handleReject = async (id: number) => {
    const r = await fetch(`/api/community/posts/${id}/reject`, { method: "POST", credentials: "include" });
    if (r.ok) {
      toast({ title: "Post rejected" });
      setPending(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleDelete = async (id: number) => {
    const r = await fetch(`/api/community/posts/${id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) {
      toast({ title: "Post deleted" });
      setPosts(prev => prev.filter(p => p.id !== id));
      setPending(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleRemovePhoto = async (id: number) => {
    const r = await fetch(`/api/community/posts/${id}/remove-photo`, { method: "PATCH", credentials: "include" });
    if (r.ok) {
      toast({ title: "Photo removed" });
      setPosts(prev => prev.map(p => p.id === id ? { ...p, photo_content_type: null } : p));
      setPending(prev => prev.map(p => p.id === id ? { ...p, photo_content_type: null } : p));
    } else {
      toast({ title: "Failed to remove photo", variant: "destructive" });
    }
  };

  // The pin/unpin request itself already happened inside PostCard (it needs
  // its own loading state on the button) — these just reconcile local state
  // once it succeeds.
  const handlePin = (id: number) => {
    toast({ title: "Post pinned" });
    setPosts(prev => prev.map(p => p.id === id ? { ...p, pinned: true } : p));
    setSearchResults(prev => prev ? prev.map(p => p.id === id ? { ...p, pinned: true } : p) : prev);
  };

  const handleUnpin = (id: number) => {
    toast({ title: "Post unpinned" });
    setPosts(prev => prev.map(p => p.id === id ? { ...p, pinned: false } : p));
    setSearchResults(prev => prev ? prev.map(p => p.id === id ? { ...p, pinned: false } : p) : prev);
  };

  const handleBookmark = async (id: number) => {
    const r = await fetch(`/api/community/posts/${id}/bookmark`, { method: "POST", credentials: "include" });
    if (!r.ok) { toast({ title: "Failed to update saved posts", variant: "destructive" }); return; }
    const { bookmarked } = await r.json();
    setPosts(prev => prev.map(p => p.id === id ? { ...p, myBookmarked: bookmarked } : p));
    setSearchResults(prev => prev ? prev.map(p => p.id === id ? { ...p, myBookmarked: bookmarked } : p) : prev);
  };

  // The vote/RSVP requests themselves already happened inside PostCard (each
  // needs its own button-level loading state) — these just reconcile local
  // state with the result once they succeed.
  const handleVote = (id: number, pollOptions: PollOption[], myVote: number) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, poll_options: pollOptions, poll_my_vote: myVote } : p));
    setSearchResults(prev => prev ? prev.map(p => p.id === id ? { ...p, poll_options: pollOptions, poll_my_vote: myVote } : p) : prev);
  };

  const handleRsvp = (id: number, rsvped: boolean, rsvpCount: number) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, myRsvped: rsvped, rsvp_count: rsvpCount } : p));
    setSearchResults(prev => prev ? prev.map(p => p.id === id ? { ...p, myRsvped: rsvped, rsvp_count: rsvpCount } : p) : prev);
  };

  const handleDeleteComment = async (postId: number, commentId: number) => {
    const r = await fetch(`/api/community/posts/${postId}/comments/${commentId}`, { method: "DELETE", credentials: "include" });
    if (r.ok) {
      toast({ title: "Comment deleted" });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p));
    } else {
      toast({ title: "Failed to delete comment", variant: "destructive" });
    }
  };

  const handleEdit = (id: number, content: string) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, content } : p));
    setPending(prev => prev.map(p => p.id === id ? { ...p, content } : p));
  };

  // Feature disabled for non-admin
  if (communityEnabled === false && !user?.isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🎯</div>
        <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", color: "#fff" }}>OFF THE OCHE</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>Coming soon — the clubhouse is being set up.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">

      {/* Admin preview banner */}
      {communityEnabled === false && user?.isAdmin && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold"
          style={{ background: "rgba(255,200,0,0.06)", border: "1px solid rgba(255,200,0,0.25)", color: "#ffd24a", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
          <AlertCircle className="w-4 h-4" />
          ADMIN PREVIEW — Off the Oche is hidden from players. Enable it in Admin → Feature Flags.
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>OFF THE OCHE</h1>
        <p className="text-xs italic mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
          Whatever's on your mind — on or off the oche.
        </p>
      </div>

      {/* This day last year — a dismissible throwback, shown only when one
          actually exists (see GET /community/throwback's fuzzy ±3 day
          window). Dismissal is session-only, not saved anywhere. */}
      {throwback && !throwbackDismissed && (
        <div className="rounded-2xl p-3.5 relative" style={{ background: "linear-gradient(160deg, rgba(0,102,255,0.1), rgba(20,20,26,0.6) 70%)", border: "1px solid rgba(0,102,255,0.3)" }}>
          <button onClick={() => setThrowbackDismissed(true)}
            className="absolute top-2.5 right-2.5 p-0.5 rounded" style={{ color: "rgba(255,255,255,0.3)" }}>
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1.5 mb-1.5 pr-6">
            <Clock className="w-3.5 h-3.5" style={{ color: "#0066ff" }} />
            <span className="text-xs font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", color: "#0066ff", fontSize: "0.62rem" }}>
              This day last year
            </span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <PlayerAvatar name={throwback.player_name} tier={throwback.player_tier} size={6} />
            <PlayerName id={throwback.player_id} name={throwback.player_name} tier={throwback.player_tier}
              nameStyleId={throwback.player_name_style_id} winStreak={throwback.player_win_streak} className="text-xs" />
          </div>
          <p className="text-sm leading-snug" style={{ color: "rgba(255,255,255,0.7)" }}>
            {throwback.content || (throwback.photo_content_type ? "📷 Photo post" : "")}
          </p>
        </div>
      )}

      {/* Active this week — distinct posters from the loaded feed */}
      {activeMembers.length > 1 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2 px-0.5">
            <Users className="w-3 h-3" style={{ color: "rgba(255,255,255,0.3)" }} />
            <span className="text-xs font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", fontSize: "0.6rem" }}>
              Who's about
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {activeMembers.map(m => {
              const tierCol = TIER_COLORS[m.player_tier] ?? "#9ca3af";
              return (
                <Link key={m.player_id} href={`/players/${m.player_id}`}
                  className="flex flex-col items-center gap-1 shrink-0" style={{ width: 52 }}>
                  <div className="relative">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold"
                      style={{ background: `${tierCol}22`, border: `1.5px solid ${tierCol}77`, color: tierCol, fontFamily: "Oswald, sans-serif", fontSize: "0.8rem" }}>
                      {m.player_name.charAt(0).toUpperCase()}
                    </div>
                    {m.player_win_streak >= 3 && (
                      <Flame className="w-3.5 h-3.5 streak-fire absolute -bottom-0.5 -right-0.5" style={{ color: "#ff005c", filter: "drop-shadow(0 0 3px rgba(255,0,92,0.7))" }} />
                    )}
                  </div>
                  <span className="text-xs truncate w-full text-center" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {m.player_name.split(" ")[0]}
                  </span>
                  {/* Status line — the player's own free-text tagline
                      (account.tsx), styled by their equipped TAGLINE_STYLE
                      cosmetic when they have one. Nothing new stored here;
                      just surfaced in a spot the tab didn't have before. */}
                  {m.player_tagline && (
                    <span className="text-xs truncate w-full text-center leading-tight"
                      title={m.player_tagline}
                      style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", ...taglineStyleCSS(catalog.find(c => c.id === m.player_tagline_style_id)) }}>
                      {m.player_tagline}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Best of the week — top posts by real reaction + comment count */}
      {highlights.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2 px-0.5">
            <Trophy className="w-3 h-3" style={{ color: "#ffd24a" }} />
            <span className="text-xs font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em", color: "#ffd24a", fontSize: "0.6rem" }}>
              Top of the board
            </span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {highlights.map((p, i) => {
              const tierCol = TIER_COLORS[p.player_tier] ?? "#9ca3af";
              return (
                <button key={p.id} onClick={() => document.getElementById(`post-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  className="text-left rounded-2xl p-3 shrink-0 transition-transform hover:-translate-y-0.5"
                  style={{ width: 200, background: "linear-gradient(160deg, rgba(255,210,74,0.1), rgba(20,20,26,0.6) 70%)", border: "1px solid rgba(255,210,74,0.3)", boxShadow: "0 10px 24px rgba(0,0,0,0.35)" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0"
                        style={{ background: `${tierCol}22`, border: `1px solid ${tierCol}66`, color: tierCol, fontFamily: "Oswald, sans-serif", fontSize: "0.62rem" }}>
                        {p.player_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-bold truncate" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>{p.player_name}</span>
                    </div>
                    <span className="text-xs font-black shrink-0" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>#{i + 1}</span>
                  </div>
                  <p className="text-xs leading-snug mb-2" style={{ color: "rgba(255,255,255,0.65)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {p.content || (p.photo_content_type ? "📷 Photo post" : "")}
                  </p>
                  <div className="flex items-center gap-3 text-xs" style={{ color: "#ffd24a", fontFamily: "monospace" }}>
                    <span>❤ {Object.values(p.reactions).reduce((a, b) => a + b, 0)}</span>
                    <span>💬 {p.comment_count}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Wall of Fame — the all-time version of "Top of the board" above,
          collapsed by default (this page is already dense) and only fetched
          the first time it's actually opened. */}
      <div>
        <button onClick={toggleWallOfFame}
          className="flex items-center gap-1.5 px-0.5 w-full text-left">
          <Trophy className="w-3 h-3" style={{ color: "#ffd24a" }} />
          <span className="text-xs font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em", color: "#ffd24a", fontSize: "0.6rem" }}>
            Wall of Fame
          </span>
          <span className="text-xs" style={{ color: "rgba(255,210,74,0.5)" }}>{showWallOfFame ? "▲" : "▼"}</span>
        </button>
        {showWallOfFame && (
          wallOfFameLoading ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 rounded-full animate-spin" style={{ border: "2px solid rgba(255,210,74,0.3)", borderTopColor: "#ffd24a" }} />
            </div>
          ) : !wallOfFame || wallOfFame.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "rgba(255,255,255,0.25)" }}>
              Nothing's earned its place here yet.
            </p>
          ) : (
            <div className="flex gap-2.5 overflow-x-auto pb-1 mt-2" style={{ scrollbarWidth: "none" }}>
              {wallOfFame.map((p, i) => {
                const tierCol = TIER_COLORS[p.player_tier] ?? "#9ca3af";
                return (
                  <div key={p.id}
                    className="text-left rounded-2xl p-3 shrink-0"
                    style={{ width: 200, background: "linear-gradient(160deg, rgba(255,210,74,0.14), rgba(20,20,26,0.6) 70%)", border: "1px solid rgba(255,210,74,0.4)", boxShadow: "0 10px 24px rgba(0,0,0,0.35)" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0"
                          style={{ background: `${tierCol}22`, border: `1px solid ${tierCol}66`, color: tierCol, fontFamily: "Oswald, sans-serif", fontSize: "0.62rem" }}>
                          {p.player_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold truncate" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>{p.player_name}</span>
                      </div>
                      <span className="text-xs shrink-0" style={{ color: "#ffd24a" }}>🏅{i + 1}</span>
                    </div>
                    <p className="text-xs leading-snug mb-2" style={{ color: "rgba(255,255,255,0.65)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {p.content || (p.photo_content_type ? "📷 Photo post" : "")}
                    </p>
                    <div className="flex items-center gap-3 text-xs" style={{ color: "#ffd24a", fontFamily: "monospace" }}>
                      <span>❤ {p.reaction_count ?? 0}</span>
                      <span>💬 {p.comment_count ?? 0}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Composer — always present in the flow rather than gated behind a
          header button. Collapsed, it's just an inviting one-line bar (the
          "chalk it up" affordance); clicking it expands the real form in
          place. Signed-out visitors see the same shape pointing at login. */}
      {user ? (
        showCreate ? (
          <form onSubmit={handleCreatePost}
            className="rounded-2xl p-4 space-y-3"
            style={{ background: "rgba(255,0,92,0.04)", border: "1px solid rgba(255,0,92,0.18)" }}>
            <textarea value={createText} onChange={e => setCreateText(e.target.value)}
              placeholder="What's happening in the darts room…"
              rows={3} maxLength={1000}
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontFamily: "inherit" }} />
            <div className="flex justify-end">
              <span className="text-xs tabular-nums" style={{ color: createText.length > 900 ? "#ff005c" : "rgba(255,255,255,0.2)" }}>
                {createText.length}/1000
              </span>
            </div>

            {/* Quick-post templates — a typing head-start, nothing more.
                Hidden once the composer already has text so it doesn't
                clutter an in-progress post. */}
            {!createText && (
              <div className="flex flex-wrap gap-1.5">
                {QUICK_POST_TEMPLATES.map(t => (
                  <button key={t.label} type="button" onClick={() => setCreateText(t.text)}
                    className="px-2.5 py-1 rounded-full text-xs transition-colors hover:opacity-80"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.03em" }}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {photoPreview && (
              <div className="relative rounded-xl overflow-hidden" style={{ maxHeight: 240 }}>
                <img src={photoPreview} alt="preview" className="w-full object-cover rounded-xl" style={{ maxHeight: 240 }} />
                <button type="button" onClick={clearPhoto}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff" }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-opacity hover:opacity-75"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
                <ImageIcon className="w-3.5 h-3.5" />PHOTO
              </button>
              <button type="button" onClick={() => { setShowCreate(false); setCreateText(""); clearPhoto(); }}
                className="px-3 py-2 rounded-xl text-xs font-bold transition-opacity hover:opacity-75"
                style={{ background: "transparent", color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
                CANCEL
              </button>
              <div className="flex-1 text-right text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
                {createText.length}/1000
              </div>
              <button type="submit" disabled={submitting || (!createText.trim() && !photoFile)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
                style={{ background: "rgba(255,0,92,0.2)", border: "1px solid rgba(255,0,92,0.4)", color: "#ff005c", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
                {uploading ? "UPLOADING…" : submitting ? "POSTING…" : "POST"}
              </button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowCreate(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-colors hover:bg-white/[0.02]"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.15)" }}>
            <span className="flex-1 text-sm italic" style={{ color: "rgba(255,255,255,0.3)" }}>
              Chalk something up…
            </span>
            <ImageIcon className="w-4 h-4 shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
            <span className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: "rgba(255,0,92,0.18)", border: "1px solid rgba(255,0,92,0.4)", color: "#ff005c", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
              POST
            </span>
          </button>
        )
      ) : (
        <Link href="/login"
          className="w-full flex items-center gap-2 px-4 py-3 rounded-2xl text-sm"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>
          Sign in to post
        </Link>
      )}

      {/* Create poll — admin-only organizer tool (see POST /community/polls'
          header comment for why). Collapsed behind a small text trigger
          rather than living in the main composer, since a poll isn't the
          same shape as a normal post. */}
      {user?.isAdmin && (
        showPollCreate ? (
          <form onSubmit={handleCreatePoll}
            className="rounded-2xl p-4 space-y-2.5"
            style={{ background: "rgba(0,102,255,0.04)", border: "1px solid rgba(0,102,255,0.18)" }}>
            <input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)}
              placeholder="Ask a question… (e.g. Next friendly night?)"
              maxLength={300}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input value={opt} maxLength={100}
                  onChange={e => setPollOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
                {pollOptions.length > 2 && (
                  <button type="button" onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))}
                    className="p-1 rounded" style={{ color: "rgba(255,255,255,0.35)" }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between">
              {pollOptions.length < 6 ? (
                <button type="button" onClick={() => setPollOptions(prev => [...prev, ""])}
                  className="text-xs font-bold" style={{ color: "#4d94ff", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>
                  + ADD OPTION
                </button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setShowPollCreate(false); setPollQuestion(""); setPollOptions(["", ""]); }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: "transparent", color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
                  CANCEL
                </button>
                <button type="submit" disabled={creatingPoll}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold disabled:opacity-40"
                  style={{ background: "rgba(0,102,255,0.2)", border: "1px solid rgba(0,102,255,0.4)", color: "#4d94ff", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
                  {creatingPoll ? "POSTING…" : "POST POLL"}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowPollCreate(true)}
            className="text-xs font-bold self-start" style={{ color: "rgba(77,148,255,0.6)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>
            📊 Create a poll
          </button>
        )
      )}

      {/* Admin pending queue */}
      {user?.isAdmin && pending.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>
              Pending Approval ({pending.length})
            </span>
          </div>
          {pending.map(post => (
            <PostCard key={post.id} post={post} onReact={handleReact} onComment={handleComment}
              isAdmin={!!user?.isAdmin} onApprove={handleApprove} onReject={handleReject}
              onDelete={handleDelete} onRemovePhoto={handleRemovePhoto} onDeleteComment={handleDeleteComment} onEdit={handleEdit} />
          ))}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
        </div>
      )}

      {/* Search — a real server query (see the effect above), not a filter
          over what's already loaded, so it can find posts further back than
          the current page. */}
      {!loading && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute pointer-events-none" style={{ left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.25)" }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search posts or players…"
            className="w-full pl-9 pr-8 py-2 rounded-xl text-xs outline-none"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
              className="absolute p-0.5 rounded"
              style={{ right: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.35)" }}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Tabs + sort — filters/reorders the feed already loaded above */}
      {!loading && posts.length > 0 && !searchQuery.trim() && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {([
              ["all", "All", null],
              ["photos", "Photos", "📸"],
              ["mine", "Mine", "👤"],
              ["saved", "Saved", "🔖"],
            ] as const).filter(([key]) => key !== "saved" || !!user).map(([key, label, icon]) => (
              <button key={key} onClick={() => { setTab(key); setExpandedPhotoId(null); }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{
                  fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em", textTransform: "uppercase",
                  background: tab === key ? "rgba(255,0,92,0.22)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${tab === key ? "rgba(255,0,92,0.45)" : "rgba(255,255,255,0.08)"}`,
                  color: tab === key ? "#ff6b9c" : "rgba(255,255,255,0.4)",
                }}>
                {icon && <span>{icon}</span>}{label}
              </button>
            ))}
          </div>
          <div className="flex gap-0.5 p-0.5 rounded-lg shrink-0" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {(["new", "top"] as const).map(key => (
              <button key={key} onClick={() => setSort(key)}
                className="px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1"
                style={{
                  fontFamily: "Oswald, sans-serif", textTransform: "uppercase", fontSize: "0.6rem", letterSpacing: "0.04em",
                  background: sort === key ? "rgba(255,210,74,0.16)" : "transparent",
                  color: sort === key ? "#ffd24a" : "rgba(255,255,255,0.3)",
                }}>
                {key === "top" && <ArrowUpDown className="w-2.5 h-2.5" />}{key === "new" ? "Newest" : "Top"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feed */}
      {searchQuery.trim() ? (
        searching ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 rounded-full animate-spin" style={{ border: "2px solid rgba(255,0,92,0.3)", borderTopColor: "#ff005c" }} />
          </div>
        ) : !searchResults || searchResults.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em" }}>
              NO RESULTS
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {searchResults.map(post => (
              <PostCard key={post.id} post={post} onReact={handleReact} onComment={handleComment}
                isAdmin={!!user?.isAdmin} onDelete={handleDelete} onPin={handlePin} onUnpin={handleUnpin}
                onRemovePhoto={handleRemovePhoto} onDeleteComment={handleDeleteComment} onEdit={handleEdit} onBookmark={handleBookmark} onVote={handleVote} onRsvp={handleRsvp} />
            ))}
          </div>
        )
      ) : loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "2px solid rgba(255,0,92,0.3)", borderTopColor: "#ff005c" }} />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em" }}>
            NO POSTS YET
          </p>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
            {user ? "Be the first to post!" : "Sign in to post."}
          </p>
        </div>
      ) : tabFetchLoading && tab !== "all" ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full animate-spin" style={{ border: "2px solid rgba(255,0,92,0.3)", borderTopColor: "#ff005c" }} />
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">{tab === "photos" ? "📸" : tab === "mine" ? "👤" : tab === "saved" ? "🔖" : "🎯"}</div>
          <p className="text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em" }}>
            {tab === "photos" ? "NO PHOTOS YET" : tab === "mine" ? "YOU HAVEN'T POSTED" : tab === "saved" ? "NOTHING SAVED YET" : "NOTHING HERE YET"}
          </p>
        </div>
      ) : tab === "photos" ? (
        <>
          {/* Photos get a real grid — a structurally different view, not the
              same cards with a filter applied — since it's the one post type
              that's genuinely about the image. */}
          <div className="grid grid-cols-2 gap-2">
            {photoTiles.map(p => (
              <button key={p.id} onClick={() => setExpandedPhotoId(v => v === p.id ? null : p.id)}
                className="relative rounded-xl overflow-hidden aspect-square group"
                style={{ border: `1px solid ${expandedPhotoId === p.id ? "rgba(255,0,92,0.5)" : "rgba(255,255,255,0.08)"}` }}>
                <img src={`/api/community/posts/${p.id}/photo`} alt="" loading="lazy" decoding="async"
                  className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 p-2 flex items-center justify-between text-xs"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)", color: "#fff", fontFamily: "Oswald, sans-serif" }}>
                  <span className="truncate">{p.player_name.split(" ")[0]}</span>
                  {engagementScore(p) > 0 && <span className="shrink-0 ml-1">❤ {engagementScore(p)}</span>}
                </div>
              </button>
            ))}
          </div>
          {expandedPhotoId != null && (
            <div className="pt-1">
              <PostCard post={photoTiles.find(p => p.id === expandedPhotoId)!} onReact={handleReact} onComment={handleComment}
                isAdmin={!!user?.isAdmin} onDelete={handleDelete} onPin={handlePin} onUnpin={handleUnpin}
                onRemovePhoto={handleRemovePhoto} onDeleteComment={handleDeleteComment} onEdit={handleEdit} onBookmark={handleBookmark} onVote={handleVote} onRsvp={handleRsvp} />
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {groupedFeed.map(item => Array.isArray(item) ? (
            <PhotoGroupCard key={`group-${item[0].id}`} group={item}
              expandedId={groupExpandedId} onExpand={setGroupExpandedId}
              onReact={handleReact} onComment={handleComment}
              isAdmin={!!user?.isAdmin} onDelete={handleDelete} onPin={handlePin} onUnpin={handleUnpin}
              onRemovePhoto={handleRemovePhoto} onDeleteComment={handleDeleteComment} onEdit={handleEdit} onBookmark={handleBookmark} onVote={handleVote} onRsvp={handleRsvp} />
          ) : (
            <PostCard key={item.id} post={item} onReact={handleReact} onComment={handleComment}
              isAdmin={!!user?.isAdmin} onDelete={handleDelete} onPin={handlePin} onUnpin={handleUnpin}
              onRemovePhoto={handleRemovePhoto} onDeleteComment={handleDeleteComment} onEdit={handleEdit} onBookmark={handleBookmark} onVote={handleVote} onRsvp={handleRsvp} />
          ))}
        </div>
      )}

      {!loading && posts.length > 0 && (
        <>
          <div className="text-xs text-center pb-1" style={{ color: "rgba(255,255,255,0.18)" }}>
            {visiblePosts.length} post{visiblePosts.length !== 1 ? "s" : ""}{tab !== "all" ? ` in ${tab}` : ""}
          </div>
          {hasMore ? (
            <button onClick={() => void loadPosts()} disabled={loadingMore}
              className="w-full py-3 rounded-xl text-sm font-bold transition-opacity disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
              {loadingMore ? "Loading…" : "LOAD MORE"}
            </button>
          ) : (
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.18)", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.18em" }}>
                You're all caught up
              </span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
