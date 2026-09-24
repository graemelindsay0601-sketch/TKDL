import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/context/auth";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Image as ImageIcon, Send, X, Heart, ChevronDown, ChevronUp, Clock, CheckCircle, AlertCircle, Pencil, Flame, Trophy, Users, ArrowUpDown } from "lucide-react";
import { useCosmeticsCatalog, nameStyleCSS, nameStyleClassName, postAccentStyle } from "@/lib/cosmetics";

const TIER_COLORS: Record<string, string> = {
  Diamond: "#00e5ff", Platinum: "#e5e4e2", Gold: "#ffd24a", Silver: "#9ca3af", Bronze: "#cd7f32",
};

const EMOJIS = ["👍", "❤️", "😂", "🎯", "🏆"] as const;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

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

type Post = {
  id: number;
  player_id: number;
  player_name: string;
  player_tier: string;
  content: string;
  photo_content_type: string | null;
  post_type: string;
  auto_meta: Record<string, unknown>;
  status: string;
  created_at: string;
  reactions: Record<string, number>;
  comment_count: number;
  myReactions: string[];
  player_name_style_id: string | null;
  player_post_accent_id: string | null;
  player_win_streak: number;
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

// ── Auto-post event coloring ────────────────────────────────────────────────
// Every system-generated post (post_type "auto") used to render identically
// to every other one — same grey card, same green "AUTO" pill — whether it
// was a routine match result or an elimination. The real event type already
// lives in auto_meta.type (set in api-server/src/routes/matches.ts: "match",
// "tier_up", "tier_drop", with loserEliminated flagged inside a "match"
// post) — this just surfaces it visually instead of adding new event types.
const AUTO_EVENT_STYLES: Record<string, { color: string; icon: string; label: string }> = {
  elimination:      { color: "#ff005c", icon: "💀", label: "Elimination" },
  match:             { color: "#22c55e", icon: "🎯", label: "Match" },
  tier_up:           { color: "#ffd24a", icon: "🏆", label: "Tier Up" },
  tier_drop:         { color: "#f97316", icon: "📉", label: "Tier Down" },
  // Doubles/Team Matches/Shift Wars results didn't post to the feed at all
  // until routes/doubles.ts, team-matches.ts and shift-wars.ts each started
  // calling createAutoPost — without their own entries here they still fell
  // through to the generic "⚡ Auto" style below, indistinguishable from
  // each other and from a singles match.
  doubles_match:     { color: "#0066ff", icon: "🎯", label: "Doubles" },
  team_match:        { color: "#38bdf8", icon: "👥", label: "Team Match" },
  shift_wars_match:  { color: "#22c55e", icon: "🏬", label: "Shift Wars" },
};

function autoEventStyle(post: Post): { color: string; icon: string; label: string } | null {
  if (post.post_type !== "auto") return null;
  const meta = (post.auto_meta ?? {}) as { type?: string; loserEliminated?: boolean; eliminatedIds?: number[] };
  if (meta.type === "match" && meta.loserEliminated) return AUTO_EVENT_STYLES.elimination;
  if (meta.type === "doubles_match" && meta.loserEliminated) return AUTO_EVENT_STYLES.elimination;
  if (meta.type === "team_match" && Array.isArray(meta.eliminatedIds) && meta.eliminatedIds.length > 0) return AUTO_EVENT_STYLES.elimination;
  if (meta.type && AUTO_EVENT_STYLES[meta.type]) return AUTO_EVENT_STYLES[meta.type];
  return { color: "#00e5a0", icon: "⚡", label: "Auto" };
}

function PostCard({ post, onReact, onComment, isAdmin, onApprove, onReject, onDelete, onRemovePhoto, onDeleteComment, onEdit }: {
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
}) {
  const { user } = useAuth();
  const [showComments, setShowComments]   = useState(false);
  const [comments, setComments]           = useState<Comment[] | null>(null);
  const [commentText, setCommentText]     = useState("");
  const [submittingComment, setSubmit]    = useState(false);
  const [editing, setEditing]             = useState(false);
  const [editText, setEditText]           = useState(post.content);
  const [saving, setSaving]               = useState(false);
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

  const toggleComments = () => {
    if (!showComments && !comments) void loadComments();
    setShowComments(v => !v);
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

  const tierCol = TIER_COLORS[post.player_tier] ?? "#9ca3af";
  const isPending = post.status === "pending";
  const eventStyle = autoEventStyle(post);
  // POST_ACCENT cosmetic — a personal border/background tint on the
  // author's own manual posts. Pending/auto-event posts already have their
  // own colour treatment above (isPending / eventStyle), which takes
  // precedence — a purchased accent never masks "awaiting approval" or an
  // elimination/tier-change highlight.
  const catalog = useCosmeticsCatalog();
  const postAccent = !isPending && !eventStyle
    ? postAccentStyle(catalog.find(c => c.id === post.player_post_accent_id))
    : {};

  return (
    <div id={`post-${post.id}`} className="rounded-2xl overflow-hidden scroll-mt-4"
      style={{
        background: isPending ? "rgba(255,200,0,0.04)" : eventStyle ? `${eventStyle.color}0d` : "rgba(255,255,255,0.03)",
        border: `1px solid ${isPending ? "rgba(255,200,0,0.2)" : eventStyle ? `${eventStyle.color}33` : "rgba(255,255,255,0.07)"}`,
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

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          {eventStyle ? (
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm"
              style={{ background: `${eventStyle.color}22`, border: `1.5px solid ${eventStyle.color}66` }}>
              {eventStyle.icon}
            </div>
          ) : (
            <PlayerAvatar name={post.player_name} tier={post.player_tier} />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {eventStyle ? (
                <Link href={`/players/${post.player_id}`} className="font-bold text-sm hover:underline decoration-dotted underline-offset-2"
                  style={{ fontFamily: "Oswald, sans-serif", color: eventStyle.color, letterSpacing: "0.04em" }}>
                  {post.player_name}
                </Link>
              ) : (
                <PlayerName id={post.player_id} name={post.player_name} tier={post.player_tier}
                  nameStyleId={post.player_name_style_id} winStreak={post.player_win_streak}
                  className="text-sm" />
              )}
              <span className="text-xs px-1.5 py-0.5 rounded-md font-bold" style={{ background: `${tierCol}18`, border: `1px solid ${tierCol}40`, color: tierCol, fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em", fontSize: "0.55rem" }}>
                {post.player_tier}
              </span>
              {eventStyle && (
                <span className="text-xs px-1.5 py-0.5 rounded-md font-bold uppercase" style={{ background: `${eventStyle.color}1a`, border: `1px solid ${eventStyle.color}4d`, color: eventStyle.color, fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em", fontSize: "0.55rem" }}>
                  {eventStyle.label}
                </span>
              )}
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
            {post.content}
          </p>
        ) : null}

        {/* Photo */}
        {post.photo_content_type && (
          <div className="mb-3 rounded-xl overflow-hidden relative" style={{ maxHeight: 360 }}>
            <img src={`/api/community/posts/${post.id}/photo`} alt="Post photo"
              loading="lazy"
              decoding="async"
              className="w-full object-cover rounded-xl"
              style={{ maxHeight: 360 }} />
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

            {/* Comment toggle */}
            <button onClick={toggleComments}
              className="ml-auto flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: showComments ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)" }}>
              <MessageSquare className="w-3.5 h-3.5" />
              <span style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
                {post.comment_count} {showComments ? <ChevronUp className="inline w-3 h-3" /> : <ChevronDown className="inline w-3 h-3" />}
              </span>
            </button>
          </div>
        )}

        {/* Comments section */}
        {showComments && (
          <div className="mt-3 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.75rem" }}>
            {comments === null ? (
              <div className="text-xs text-center py-2" style={{ color: "rgba(255,255,255,0.3)" }}>Loading…</div>
            ) : comments.length === 0 ? (
              <div className="text-xs text-center py-2" style={{ color: "rgba(255,255,255,0.3)" }}>No comments yet</div>
            ) : (
              comments.map(c => (
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
              ))
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

export default function CommunityPage() {
  const { user } = useAuth();
  const { toast } = useToast();

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

  // Feed tab / sort — filters and reorders whatever's already loaded in
  // `posts`; it doesn't hit the network again, so "Photos" or "Mine" on a
  // feed that hasn't loaded far enough just looks thin rather than wrong,
  // same tradeoff LOAD MORE already makes.
  const [tab,  setTab]  = useState<"all" | "celebrations" | "photos" | "mine">("all");
  const [sort, setSort] = useState<"new" | "top">("new");
  const [expandedPhotoId, setExpandedPhotoId] = useState<number | null>(null);

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
      setPosts(prev => reset ? data : [...prev, ...data]);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (tab === "celebrations") list = list.filter(p => p.post_type === "auto");
    else if (tab === "photos")  list = list.filter(p => p.photo_content_type);
    else if (tab === "mine")    list = list.filter(p => p.player_id === user?.playerId);
    if (sort === "top") list = [...list].sort((a, b) => engagementScore(b) - engagementScore(a));
    return list;
  }, [posts, tab, sort, user?.playerId]);

  const photoTiles = useMemo(() => visiblePosts.filter(p => p.photo_content_type), [visiblePosts]);

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
        <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", color: "#fff" }}>COMMUNITY</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>Coming soon — the community feed is being set up.</p>
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
          ADMIN PREVIEW — Community is hidden from players. Enable it in Admin → Feature Flags.
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>COMMUNITY</h1>
        {user ? (
          <button onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={{ background: showCreate ? "rgba(255,0,92,0.25)" : "rgba(255,0,92,0.15)", border: "1px solid rgba(255,0,92,0.4)", color: "#ff005c", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
            {showCreate ? <X className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
            {showCreate ? "CANCEL" : "NEW POST"}
          </button>
        ) : (
          <Link href="/login"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
            Sign in to post
          </Link>
        )}
      </div>

      {/* Active this week — distinct posters from the loaded feed */}
      {activeMembers.length > 1 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2 px-0.5">
            <Users className="w-3 h-3" style={{ color: "rgba(255,255,255,0.3)" }} />
            <span className="text-xs font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", fontSize: "0.6rem" }}>
              Active this week
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
              Best of the week
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

      {/* Create post form */}
      {showCreate && (
        <form onSubmit={handleCreatePost}
          className="rounded-2xl p-4 space-y-3"
          style={{ background: "rgba(255,0,92,0.04)", border: "1px solid rgba(255,0,92,0.18)" }}>
          <textarea value={createText} onChange={e => setCreateText(e.target.value)}
            placeholder="What's happening in the darts room…"
            rows={3} maxLength={1000}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontFamily: "inherit" }} />
          <div className="flex justify-end">
            <span className="text-xs tabular-nums" style={{ color: createText.length > 900 ? "#ff005c" : "rgba(255,255,255,0.2)" }}>
              {createText.length}/1000
            </span>
          </div>

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

      {/* Tabs + sort — filters/reorders the feed already loaded above */}
      {!loading && posts.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {([
              ["all", "All", null],
              ["celebrations", "Celebrations", "🎯"],
              ["photos", "Photos", "📸"],
              ["mine", "Mine", "👤"],
            ] as const).map(([key, label, icon]) => (
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
      {loading ? (
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
      ) : visiblePosts.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">{tab === "photos" ? "📸" : tab === "mine" ? "👤" : "🎯"}</div>
          <p className="text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em" }}>
            {tab === "photos" ? "NO PHOTOS YET" : tab === "mine" ? "YOU HAVEN'T POSTED" : "NOTHING HERE YET"}
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
                isAdmin={!!user?.isAdmin} onDelete={handleDelete}
                onRemovePhoto={handleRemovePhoto} onDeleteComment={handleDeleteComment} onEdit={handleEdit} />
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {visiblePosts.map(post => (
            <PostCard key={post.id} post={post} onReact={handleReact} onComment={handleComment}
              isAdmin={!!user?.isAdmin} onDelete={handleDelete}
              onRemovePhoto={handleRemovePhoto} onDeleteComment={handleDeleteComment} onEdit={handleEdit} />
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
