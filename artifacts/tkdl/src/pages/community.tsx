import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/auth";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Image as ImageIcon, Send, X, Heart, ChevronDown, ChevronUp, Clock, CheckCircle, AlertCircle } from "lucide-react";

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

async function uploadPhoto(file: File): Promise<string> {
  const compressed = await compressImage(file);
  const res = await fetch("/api/storage/uploads/file", {
    method: "POST",
    headers: {
      "Content-Type": "image/jpeg",
      "X-File-Type": "image/jpeg",
    },
    credentials: "include",
    body: compressed,
  });
  if (!res.ok) throw new Error("Upload failed");
  const { objectPath } = await res.json();
  return objectPath;
}

type Post = {
  id: number;
  player_id: number;
  player_name: string;
  player_tier: string;
  content: string;
  photo_path: string | null;
  post_type: string;
  auto_meta: Record<string, unknown>;
  status: string;
  created_at: string;
  reactions: Record<string, number>;
  comment_count: number;
  myReactions: string[];
};

type Comment = {
  id: number;
  player_id: number;
  player_name: string;
  player_tier: string;
  content: string;
  created_at: string;
};

function PlayerAvatar({ name, tier, size = 8 }: { name: string; tier: string; size?: number }) {
  const col = TIER_COLORS[tier] ?? "#9ca3af";
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center shrink-0 font-bold`}
      style={{ background: `${col}22`, border: `1.5px solid ${col}66`, color: col, fontFamily: "Oswald, sans-serif", fontSize: size <= 8 ? "0.75rem" : "1rem" }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function PostCard({ post, onReact, onComment, isAdmin, onApprove, onReject, onDelete, onRemovePhoto, onDeleteComment }: {
  post: Post;
  onReact: (id: number, emoji: string) => void;
  onComment: (id: number, content: string) => void;
  isAdmin: boolean;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  onDelete?: (id: number) => void;
  onRemovePhoto?: (id: number) => void;
  onDeleteComment?: (postId: number, commentId: number) => void;
}) {
  const { user } = useAuth();
  const [showComments, setShowComments]   = useState(false);
  const [comments, setComments]           = useState<Comment[] | null>(null);
  const [commentText, setCommentText]     = useState("");
  const [submittingComment, setSubmit]    = useState(false);
  const { toast } = useToast();

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

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: isPending ? "rgba(255,200,0,0.04)" : "rgba(255,255,255,0.03)", border: `1px solid ${isPending ? "rgba(255,200,0,0.2)" : "rgba(255,255,255,0.07)"}` }}>

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
          <PlayerAvatar name={post.player_name} tier={post.player_tier} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: tierCol, letterSpacing: "0.04em" }}>
                {post.player_name}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded-md font-bold" style={{ background: `${tierCol}18`, border: `1px solid ${tierCol}40`, color: tierCol, fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em", fontSize: "0.55rem" }}>
                {post.player_tier}
              </span>
              {post.post_type !== "manual" && (
                <span className="text-xs px-1.5 py-0.5 rounded-md font-bold" style={{ background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.3)", color: "#00e5a0", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em", fontSize: "0.55rem" }}>
                  AUTO
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
              {relativeTime(post.created_at)}
            </div>
          </div>
          {isAdmin && !isPending && (
            <button onClick={() => onDelete?.(post.id)}
              className="ml-auto p-1 rounded-lg opacity-30 hover:opacity-80 transition-opacity"
              style={{ color: "#ff005c" }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        {post.content && (
          <p className="text-sm mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
            {post.content}
          </p>
        )}

        {/* Photo */}
        {post.photo_path && (
          <div className="mb-3 rounded-xl overflow-hidden relative" style={{ maxHeight: 360 }}>
            <img src={`/api/storage${post.photo_path}`} alt="Post photo"
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
                    <span className="text-xs font-bold mr-2" style={{ fontFamily: "Oswald, sans-serif", color: TIER_COLORS[c.player_tier] ?? "#9ca3af" }}>
                      {c.player_name}
                    </span>
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
      let photoPath: string | undefined;
      if (photoFile) {
        setUploading(true);
        photoPath = await uploadPhoto(photoFile);
        setUploading(false);
      }
      const r = await fetch("/api/community/posts", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: createText, photoPath }),
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
      setPosts(prev => prev.map(p => p.id === id ? { ...p, photo_path: null } : p));
      setPending(prev => prev.map(p => p.id === id ? { ...p, photo_path: null } : p));
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
              onDelete={handleDelete} onRemovePhoto={handleRemovePhoto} onDeleteComment={handleDeleteComment} />
          ))}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
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
      ) : (
        <>
          <div className="space-y-3">
            {posts.map(post => (
              <PostCard key={post.id} post={post} onReact={handleReact} onComment={handleComment}
                isAdmin={!!user?.isAdmin} onDelete={handleDelete}
                onRemovePhoto={handleRemovePhoto} onDeleteComment={handleDeleteComment} />
            ))}
          </div>
          {hasMore && (
            <button onClick={() => void loadPosts()} disabled={loadingMore}
              className="w-full py-3 rounded-xl text-sm font-bold transition-opacity disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
              {loadingMore ? "Loading…" : "LOAD MORE"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
