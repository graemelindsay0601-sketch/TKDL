import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Target, LogOut, Lock, User, TrendingUp, TrendingDown,
  Zap, Trophy, Dumbbell, CircuitBoard, Star, ChevronDown, ChevronRight,
  Award, Flame, CheckCircle, Clock, Brain, BarChart3,
  MessageSquare, Bell, BellRing, BellOff, Send, X, Image, ArrowLeft, MailOpen, Images, Camera, Sparkles,
} from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { NotificationCenter } from "@/components/notification-center";
import { CoinBalance } from "@/components/CoinBalance";
import { CardCollectionBook } from "@/components/CardCollectionBook";
import { CardTrading } from "@/components/CardTrading";
import { PlayerChallenges } from "@/components/PlayerChallenges";
import { OverallStats, ByGameType, Trends, DartAnalysis, SessionHistory, CategoryStats, CategoryStatsEnhanced, AdvancedAnalyticsDashboard } from "@/components/stats";

const TIER_COLORS: Record<string, string> = {
  Diamond: "#00e5ff", Platinum: "#e5e4e2", Gold: "#ffd24a", Silver: "#9ca3af", Bronze: "#cd7f32",
};

function EloSparkline({ history }: { history: { elo: number }[] }) {
  if (history.length < 2) return null;
  const elos = history.map(h => h.elo);
  const min  = Math.min(...elos) - 5;
  const max  = Math.max(...elos) + 5;
  const W = 100, H = 28;
  const pts = elos.map((e, i) => ({
    x: (i / (elos.length - 1)) * W,
    y: H - ((e - min) / (max - min || 1)) * H,
  }));
  const d     = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const trend = elos[elos.length - 1] - elos[0];
  const col   = trend >= 0 ? "#00e5a0" : "#ff005c";
  const last  = pts[pts.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      <path d={d} stroke={col} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
      <circle cx={last.x} cy={last.y} r={2.5} fill={col} />
    </svg>
  );
}

const RARITY_GS: Record<string, number> = { Common: 10, Rare: 25, Epic: 50, Legendary: 100, Mythic: 200 };
function gamerscoreForRarity(rarity?: string): number { return RARITY_GS[rarity ?? ""] ?? 10; }
const RARITY_COL: Record<string, string> = {
  Common: "#9ca3af", Rare: "#3b82f6", Epic: "#a855f7", Legendary: "#ffd24a", Mythic: "#ff005c",
};
const CATEGORY_CFG: Record<string, { label: string; accent: string; emoji: string }> = {
  Career:   { label: "Career",   accent: "#ff005c", emoji: "🏆" },
  Tier:     { label: "Tier",     accent: "#ffd24a", emoji: "🎖"  },
  Rank:     { label: "Rank",     accent: "#a855f7", emoji: "👑"  },
  Seasonal: { label: "Seasonal", accent: "#00e5a0", emoji: "⭐"  },
};

const SHADOW_CAT: Record<string, { label: string; accent: string; emoji: string }> = {
  "Darts Thrown":   { label: "Darts Thrown",   accent: "#4d94ff", emoji: "🎯" },
  "Sessions":       { label: "Sessions",        accent: "#00e5a0", emoji: "🏋️" },
  "Bot Level":      { label: "Bot Level",       accent: "#a855f7", emoji: "🤖" },
  "Performance":    { label: "Performance",     accent: "#ffd24a", emoji: "📊" },
  "Matches":        { label: "Matches",         accent: "#ff005c", emoji: "⚔️" },
};
function shadowCategory(ct: string): string {
  if (ct === "TOTAL_DARTS")                                                   return "Darts Thrown";
  if (ct === "TOTAL_SESSIONS" || ct === "GAME_MODES")                        return "Sessions";
  if (ct === "BOT_LEVEL")                                                     return "Bot Level";
  if (ct.includes("180") || ct.includes("CHECKOUT") || ct.includes("SCORE") || ct.includes("AVERAGE")) return "Performance";
  return "Matches";
}

const TOUR_CAT: Record<string, { label: string; accent: string; emoji: string }> = {
  career:        { label: "Career",        accent: "#ff005c", emoji: "🏆" },
  trophy:        { label: "Trophies",      accent: "#ffd24a", emoji: "🏅" },
  difficulty:    { label: "Difficulty",    accent: "#a855f7", emoji: "⚡" },
  format:        { label: "Format",        accent: "#3b82f6", emoji: "🎮" },
  completionist: { label: "Completionist", accent: "#00e5a0", emoji: "💯" },
  specific:      { label: "Specific",      accent: "#f59e0b", emoji: "🎯" },
};

type AchCat = { category: string; achievements: any[] };
type CfgMap = Record<string, { label: string; accent: string; emoji: string }>;

function AchievementPortal({
  categories, cfgMap, defaultOpen = [],
  unlockedField = "isUnlocked",
  progressField = "currentProgress",
  valueField    = "criteriaValue",
  gsField       = "rarity" as "rarity" | "gamerscore",
}: {
  categories:    AchCat[];
  cfgMap:        CfgMap;
  defaultOpen?:  string[];
  unlockedField?: string;
  progressField?: string;
  valueField?:    string;
  gsField?:       "rarity" | "gamerscore";
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(defaultOpen));
  const toggle = (cat: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    return next;
  });

  return (
    <div className="space-y-1.5">
      {categories.map(({ category, achievements }) => {
        const cfg    = cfgMap[category] ?? { label: category, accent: "#9ca3af", emoji: "🎯" };
        const unlocked = achievements.filter(a => !!a[unlockedField]).length;
        const total    = achievements.length;
        const gs       = achievements.filter(a => !!a[unlockedField]).reduce((s, a) =>
          s + (gsField === "gamerscore" ? (a.gamerscore ?? 0) : gamerscoreForRarity(a.rarity)), 0);
        const open     = expanded.has(category);
        const sorted   = [...achievements].sort((a, b) => {
          const au = !!a[unlockedField], bu = !!b[unlockedField];
          if (au !== bu) return au ? -1 : 1;
          const av = a[valueField] ?? 1, bv = b[valueField] ?? 1;
          const ap = (a[progressField] ?? a.currentValue ?? 0) / av;
          const bp = (b[progressField] ?? b.currentValue ?? 0) / bv;
          return bp - ap;
        });

        return (
          <div key={category} className="rounded-xl overflow-hidden"
            style={{ border: `1px solid ${open ? cfg.accent + "30" : "rgba(255,255,255,0.06)"}`,
              background: open ? `${cfg.accent}08` : "rgba(255,255,255,0.02)", transition: "border-color 0.2s" }}>

            <button onClick={() => toggle(category)} className="w-full flex items-center gap-2.5 px-3 py-2.5"
              style={{ borderBottom: open ? `1px solid ${cfg.accent}18` : undefined }}>
              <span style={{ fontSize: "0.9rem" }}>{cfg.emoji}</span>
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", fontWeight: 700,
                letterSpacing: "0.08em", color: open ? "#fff" : "rgba(255,255,255,0.55)", flex: 1, textAlign: "left" }}>
                {cfg.label}
              </span>
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", color: "rgba(255,255,255,0.3)", marginRight: "6px" }}>
                {unlocked}/{total}
              </span>
              {gs > 0 && (
                <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", fontWeight: 800,
                  color: cfg.accent, marginRight: "6px" }}>{gs}G</span>
              )}
              {open
                ? <ChevronDown  className="w-3.5 h-3.5 shrink-0" style={{ color: cfg.accent }} />
                : <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.2)" }} />}
            </button>

            {open && (
              <div className="p-2 space-y-1">
                {sorted.map((a: any) => {
                  const isUnlocked = !!a[unlockedField];
                  const rawProg    = a[progressField] ?? a.currentValue ?? 0;
                  const rawMax     = a[valueField]    ?? 1;
                  const pct        = rawMax > 0 ? Math.min(100, Math.round((rawProg / rawMax) * 100)) : 0;
                  const hasProgress = !isUnlocked && rawProg > 0 && rawMax > 0;
                  const isClose     = !isUnlocked && pct >= 60;
                  const gs          = gsField === "gamerscore" ? (a.gamerscore ?? 0) : gamerscoreForRarity(a.rarity);
                  const rCol        = RARITY_COL[a.rarity] ?? "#9ca3af";
                  return (
                    <div key={a.key ?? a.id}
                      className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg"
                      style={{
                        background: isUnlocked ? `${cfg.accent}0a` : isClose ? "rgba(245,158,11,0.05)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${isUnlocked ? cfg.accent + "25" : isClose ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)"}`,
                      }}>
                      <span style={{ fontSize: "0.95rem", marginTop: "1px",
                        filter: isUnlocked ? "none" : "grayscale(1) opacity(0.35)", flexShrink: 0 }}>{a.icon ?? "🏆"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", letterSpacing: "0.04em",
                            color: isUnlocked ? "#fff" : isClose ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.32)" }}>
                            {a.name}
                          </span>
                          {a.rarity && (
                            <span style={{ fontSize: "0.44rem", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em",
                              color: rCol, border: `1px solid ${rCol}55`, borderRadius: 4, padding: "1px 4px",
                              opacity: isUnlocked ? 1 : 0.5, flexShrink: 0 }}>
                              {a.rarity?.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.55rem", color: isUnlocked ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.2)",
                          lineHeight: 1.3, marginBottom: hasProgress ? "5px" : 0 }}>
                          {a.description}
                        </div>
                        {hasProgress && (
                          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 2, transition: "width 0.6s ease",
                              width: `${pct}%`,
                              background: pct >= 80 ? "linear-gradient(90deg,#22c55e,rgba(34,197,94,0.5))"
                                : isClose  ? "linear-gradient(90deg,#f59e0b,rgba(245,158,11,0.45))"
                                :             "linear-gradient(90deg,rgba(255,255,255,0.25),rgba(255,255,255,0.1))" }} />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0" style={{ minWidth: "36px" }}>
                        {isUnlocked ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" style={{ color: cfg.accent }} />
                            <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", color: "#ffd24a", fontWeight: 700 }}>{gs}G</span>
                          </>
                        ) : hasProgress ? (
                          <>
                            <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem",
                              color: isClose ? "#f59e0b" : "rgba(255,255,255,0.2)", fontWeight: 700 }}>
                              {rawProg}/{rawMax}
                            </span>
                            <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", color: "rgba(255,255,255,0.15)" }}>{gs}G</span>
                          </>
                        ) : (
                          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", color: "rgba(255,255,255,0.12)" }}>{gs}G</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormDot({ result }: { result: "W" | "L" }) {
  return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center"
      style={{
        background: result === "W" ? "rgba(0,229,160,0.15)" : "rgba(255,0,92,0.12)",
        border: `1px solid ${result === "W" ? "rgba(0,229,160,0.4)" : "rgba(255,0,92,0.3)"}`,
      }}>
      <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", fontWeight: 800,
        color: result === "W" ? "#00e5a0" : "#ff005c" }}>{result}</span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, accent = "#ff005c", children, collapsible = false }: {
  title: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent?: string; children: React.ReactNode; collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(8,6,18,0.9)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <button
        className="w-full flex items-center gap-2.5 px-5 py-3.5"
        style={{ borderBottom: open ? "1px solid rgba(255,255,255,0.05)" : undefined, cursor: collapsible ? "pointer" : "default" }}
        onClick={() => collapsible && setOpen(v => !v)}
        disabled={!collapsible}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent }} />
        <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.35)", textTransform: "uppercase", flex: 1, textAlign: "left" }}>
          {title}
        </span>
        {collapsible && (open
          ? <ChevronDown className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.2)" }} />
          : <ChevronRight className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.2)" }} />
        )}
      </button>
      {open && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

export default function AccountPage() {
  const { user, logout } = useAuth();
  const [, navigate]     = useLocation();
  const { toast }        = useToast();

  const [curPwd, setCurPwd]      = useState("");
  const [newPwd, setNewPwd]      = useState("");
  const [confirmPwd, setConfirm] = useState("");
  const [pwdLoading, setPwdLoad] = useState(false);

  const [stats,        setStats]        = useState<any>(null);
  const [gamerscore,   setGamerscore]   = useState<any>(null);
  const [practiceStats, setPractice]   = useState<any>(null);
  const [m501,          setM501]        = useState<any>(null);
  const [tourTrophies,  setTrophies]    = useState<any[]>([]);
  const [tourRuns,      setTourRuns]    = useState<any[]>([]);
  const [shadowStats,   setShadow]      = useState<any>(null);
  const [shadowAchs,    setShadowAchs]  = useState<any[]>([]);
  const [tourAchs,      setTourAchs]    = useState<any[]>([]);
  const [achProgress,   setAchProgress] = useState<any[]>([]);
  const [eloHistory,    setEloHistory]  = useState<any[]>([]);
  const [titleList,    setTitleList]    = useState<any[]>([]);
  const [titleSaving,  setTitleSaving]  = useState(false);
  const [titleFilter,  setTitleFilter]  = useState<string>("earned");
  const [expandedCats,    setExpandedCats]    = useState<Set<string>>(new Set(["Career"]));

  // ── Tab + Community state ────────────────────────────────────────────
  const [activeTab,        setActiveTab]       = useState<"overview" | "activity" | "achievements" | "coach" | "social" | "stats" | "analytics" | "cards" | "challenges">("overview");
  const [socialTab,        setSocialTab]       = useState<"dms" | "notifications" | "photos">("dms");
  const [achSource,        setAchSource]       = useState<"league" | "bot" | "tour" | "m501">("league");
  const [coachDrills,      setCoachDrills]     = useState<any[]>([]);
  const [coachStats,       setCoachStats]      = useState<any>(null);
  const [coachLoading,     setCoachLoading]    = useState(false);
  const [openDrills,       setOpenDrills]      = useState<Record<string, boolean>>({});
  const [conversations,    setConversations]   = useState<any[]>([]);
  const [activeConvId,     setActiveConvId]    = useState<number | null>(null);
  const [threadMessages,   setThreadMessages]  = useState<any[]>([]);
  const [msgText,          setMsgText]         = useState("");
  const [msgPhotoFile,     setMsgPhotoFile]    = useState<File | null>(null);
  const [msgPhotoPreview,  setMsgPhotoPreview] = useState<string | null>(null);
  const [sendingMsg,       setSendingMsg]      = useState(false);
  const [notifs,           setNotifs]          = useState<any[]>([]);
  const [notifsLoading,    setNotifsLoading]   = useState(false);
  const [messagingEnabled, setMessagingEnabled] = useState(false);
  const [notifsEnabled,    setNotifsEnabled]   = useState(false);
  const [myPhotoPosts,     setMyPhotoPosts]    = useState<any[] | null>(null);
  const [photosLoading,    setPhotosLoading]   = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [allPlayers,       setAllPlayers]      = useState<any[]>([]);
  const [showNewMsg,       setShowNewMsg]      = useState(false);
  const msgFileRef = useRef<HTMLInputElement>(null);
  const threadRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.playerId) return;
    const id = user.playerId;
    void Promise.all([
      fetch(`/api/players/${id}/stats`).then(r => r.ok ? r.json() : null).then(setStats),
      fetch(`/api/players/${id}/gamerscore`).then(r => r.ok ? r.json() : null).then(setGamerscore),
      fetch(`/api/players/${id}/practice-stats`).then(r => r.ok ? r.json() : null).then(setPractice),
      fetch(`/api/master501/progress/${id}`).then(r => r.ok ? r.json() : null).then(setM501),
      fetch(`/api/tour/trophies/${id}`).then(r => r.ok ? r.json() : []).then(setTrophies),
      fetch(`/api/tour/runs/${id}`).then(r => r.ok ? r.json() : []).then(setTourRuns),
      fetch(`/api/players/${id}/shadow-bot-stats`).then(r => r.ok ? r.json() : null).then(setShadow),
      fetch(`/api/players/${id}/shadow-achievements`).then(r => r.ok ? r.json() : []).then(setShadowAchs),
      fetch(`/api/tour/achievements/${id}`).then(r => r.ok ? r.json() : []).then(setTourAchs),
      fetch(`/api/players/${id}/achievement-progress`).then(r => r.ok ? r.json() : []).then(setAchProgress),
      fetch(`/api/players/${id}/elo-history`).then(r => r.ok ? r.json() : {}).then((d: any) => setEloHistory(d.history ?? [])),
      fetch(`/api/players/${id}/titles`).then(r => r.ok ? r.json() : []).then(setTitleList),
    ]);
  }, [user?.playerId]);

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.ok ? r.json() : {})
      .then((s: Record<string, unknown>) => {
        setMessagingEnabled(s.messaging_enabled === true);
        setNotifsEnabled(s.notifications_enabled === true);
      })
      .catch(() => {});
  }, []);

  const loadConversations = useCallback(async () => {
    if (!user?.playerId) return;
    const r = await fetch("/api/messages/conversations", { credentials: "include" });
    if (r.ok) setConversations(await r.json());
  }, [user?.playerId]);

  const loadThread = useCallback(async (partnerId: number) => {
    const r = await fetch(`/api/messages/${partnerId}`, { credentials: "include" });
    if (r.ok) setThreadMessages(await r.json());
  }, []);

  // ── Open DM from ?dm=<playerId> URL param ────────────────────────────────
  useEffect(() => {
    if (!user?.playerId) return;
    const dmParam = new URLSearchParams(window.location.search).get("dm");
    if (dmParam) {
      const dmId = Number(dmParam);
      if (!isNaN(dmId) && dmId > 0 && dmId !== user.playerId) {
        setActiveTab("social"); setSocialTab("dms");
        setActiveConvId(dmId);
        void loadThread(dmId);
        void loadConversations();
        // Pre-fetch players so the thread header can show the name
        fetch("/api/players").then(r => r.ok ? r.json() : []).then(setAllPlayers).catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.playerId]);

  useEffect(() => {
    if (activeTab !== "social") return;
    if (socialTab === "dms") {
      void loadConversations();
      setActiveConvId(null);
      setThreadMessages([]);
      setShowNewMsg(false);
      if (allPlayers.length === 0) {
        fetch("/api/players").then(r => r.ok ? r.json() : []).then(setAllPlayers).catch(() => {});
      }
    } else if (socialTab === "notifications") {
      setNotifsLoading(true);
      fetch("/api/notifications", { credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .then(data => { setNotifs(data); setUnreadNotifCount(0); })
        .finally(() => setNotifsLoading(false));
    } else if (socialTab === "photos" && myPhotoPosts === null) {
      if (!user?.playerId) return;
      setPhotosLoading(true);
      fetch(`/api/community/posts?player_id=${user.playerId}&photo_only=true&limit=100`)
        .then(r => r.ok ? r.json() : [])
        .then(setMyPhotoPosts)
        .finally(() => setPhotosLoading(false));
    }
  }, [activeTab, socialTab, loadConversations, user?.playerId, myPhotoPosts]);

  useEffect(() => {
    if (!user?.playerId) return;
    fetch("/api/notifications", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => setUnreadNotifCount(data.filter((n: any) => !n.read_at).length))
      .catch(() => {});
  }, [user?.playerId]);

  useEffect(() => {
    if (!user?.playerId || activeTab !== "coach") return;
    if (coachDrills.length > 0 || coachLoading) return;
    setCoachLoading(true);
    fetch(`/api/players/${user.playerId}/practice-routine`)
      .then(r => r.ok ? r.json() : {})
      .then((d: any) => { setCoachDrills(Array.isArray(d.drills) ? d.drills : []); setCoachStats(d.stats ?? null); })
      .catch(() => {})
      .finally(() => setCoachLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.playerId]);

  useEffect(() => {
    if (activeConvId === null) return;
    void loadThread(activeConvId);
    const id = setInterval(() => void loadThread(activeConvId), 5_000);
    return () => clearInterval(id);
  }, [activeConvId, loadThread]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [threadMessages]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    if (newPwd.length < 6)     { toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return; }
    setPwdLoad(true);
    try {
      const res  = await fetch("/api/auth/password", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: curPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: "Password updated ✓", description: "Your new password is active." });
        setCurPwd(""); setNewPwd(""); setConfirm("");
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch { toast({ title: "Network error", variant: "destructive" }); }
    setPwdLoad(false);
  };

  const handleSetTitle = async (titleKey: string | null) => {
    if (!user?.playerId || titleSaving) return;
    setTitleSaving(true);
    try {
      const res = await fetch(`/api/players/${user.playerId}/active-title`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titleKey }),
      });
      if (res.ok) {
        setTitleList(prev => prev.map(t => ({ ...t, isActive: t.key === titleKey })));
        toast({ title: titleKey ? "Title equipped ✓" : "Title cleared" });
      }
    } catch { toast({ title: "Failed to update title", variant: "destructive" }); }
    setTitleSaving(false);
  };

  const push = usePushNotifications(user?.playerId);

  const player     = stats?.player as any;
  const tier       = player?.tier ?? "Bronze";
  const tCol       = TIER_COLORS[tier] ?? "#aaa";
  const games      = (player?.seasonWins ?? 0) + (player?.seasonLosses ?? 0);
  const winRate    = games > 0 ? Math.round((player?.seasonWins ?? 0) / games * 100) : null;

  const recentForm: ("W" | "L")[] = useMemo(() => {
    if (!stats?.recentMatches || !user?.playerId) return [];
    return (stats.recentMatches as any[]).slice(0, 8).map((m: any) => {
      const wid = m.winnerId ?? m.winner_id;
      return wid === user.playerId ? "W" : "L";
    });
  }, [stats, user]);

  const eloTrend = useMemo(() => {
    if (eloHistory.length < 2) return 0;
    const last = eloHistory[eloHistory.length - 1]?.elo ?? 0;
    const first = eloHistory[0]?.elo ?? 0;
    return last - first;
  }, [eloHistory]);

  const unlockedAchievements = useMemo(() =>
    (stats?.achievements ?? []).slice(0, 4).map((a: any) => ({
      ...(a.achievement ?? a),
      unlockedAt: a.unlockedAt,
    })) as any[], [stats]);

  const nearMissAchievements = useMemo(() =>
    (achProgress as any[])
      .filter(a => !a.isUnlocked && a.currentProgress != null && a.criteriaValue != null && a.currentProgress > 0 && a.currentProgress < a.criteriaValue && a.currentProgress / a.criteriaValue >= 0.45)
      .sort((a: any, b: any) => (b.currentProgress / b.criteriaValue) - (a.currentProgress / a.criteriaValue))
      .slice(0, 6),
  [achProgress]);

  const m501Achievements = useMemo(() =>
    (achProgress as any[])
      .filter(a => (a.key ?? "").startsWith("M501_"))
      .sort((a: any, b: any) => {
        if (a.isUnlocked !== b.isUnlocked) return a.isUnlocked ? -1 : 1;
        const ap = a.currentProgress ?? 0, av = a.criteriaValue ?? 1;
        const bp = b.currentProgress ?? 0, bv = b.criteriaValue ?? 1;
        return (bp / bv) - (ap / av);
      }),
  [achProgress]);

  const achTotals = useMemo(() => ({
    total:    (achProgress as any[]).filter(a => !(a.key ?? "").startsWith("M501_")).length,
    unlocked: (achProgress as any[]).filter(a => !(a.key ?? "").startsWith("M501_") && a.isUnlocked).length,
  }), [achProgress]);

  const achProgressMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of achProgress) if (a.key) m.set(a.key, a);
    return m;
  }, [achProgress]);

  const achByCategory = useMemo(() => {
    const cats = new Map<string, any[]>();
    for (const a of achProgress) {
      if ((a.key ?? "").startsWith("M501_")) continue;
      const cat = a.category ?? "Career";
      if (!cats.has(cat)) cats.set(cat, []);
      cats.get(cat)!.push(a);
    }
    const ORDER = ["Career", "Tier", "Rank", "Seasonal"];
    const result: { category: string; achievements: any[] }[] = [];
    for (const cat of ORDER) if (cats.has(cat)) result.push({ category: cat, achievements: cats.get(cat)! });
    for (const [cat, achs] of cats) if (!ORDER.includes(cat)) result.push({ category: cat, achievements: achs });
    return result;
  }, [achProgress]);

  const m501AchCategories = useMemo((): AchCat[] => {
    const m501 = (achProgress as any[]).filter(a => (a.key ?? "").startsWith("M501_"));
    if (m501.length === 0) return [];
    return [{ category: "Master-501", achievements: m501 }];
  }, [achProgress]);

  const shadowAchsByCategory = useMemo((): AchCat[] => {
    const cats = new Map<string, any[]>();
    for (const a of shadowAchs) {
      const cat = shadowCategory(a.criteriaType ?? "");
      if (!cats.has(cat)) cats.set(cat, []);
      cats.get(cat)!.push(a);
    }
    const ORDER = ["Darts Thrown", "Sessions", "Bot Level", "Performance", "Matches"];
    const result: AchCat[] = [];
    for (const cat of ORDER) if (cats.has(cat)) result.push({ category: cat, achievements: cats.get(cat)! });
    for (const [cat, achs] of cats) if (!ORDER.includes(cat)) result.push({ category: cat, achievements: achs });
    return result;
  }, [shadowAchs]);

  const tourAchsByCategory = useMemo((): AchCat[] => {
    const cats = new Map<string, any[]>();
    for (const a of tourAchs) {
      const cat = a.category ?? "career";
      if (!cats.has(cat)) cats.set(cat, []);
      cats.get(cat)!.push(a);
    }
    const ORDER = ["career", "trophy", "difficulty", "format", "completionist", "specific"];
    const result: AchCat[] = [];
    for (const cat of ORDER) if (cats.has(cat)) result.push({ category: cat, achievements: cats.get(cat)! });
    for (const [cat, achs] of cats) if (!ORDER.includes(cat)) result.push({ category: cat, achievements: achs });
    return result;
  }, [tourAchs]);

  const activeRuns = useMemo(() => (tourRuns as any[]).filter(r => r.status === "active"), [tourRuns]);

  const insights = useMemo(() => {
    const strengths: string[] = [];
    const focuses:   string[] = [];

    if (winRate !== null && games >= 3) {
      if (winRate >= 65) strengths.push(`${winRate}% win rate this season`);
      else if (winRate < 40) focuses.push(`Win rate at ${winRate}% — pick your spots carefully`);
    }
    if (eloTrend > 25)  strengths.push(`Elo up ${eloTrend} across your last ${eloHistory.length} matches`);
    if (eloTrend < -25) focuses.push(`Elo down ${Math.abs(eloTrend)} — watch the wager sizes`);

    const ws = player?.currentWinStreak ?? player?.win_streak ?? 0;
    const ls = player?.currentLossStreak ?? player?.loss_streak ?? 0;
    if (ws >= 3) strengths.push(`${ws}-match winning streak 🔥`);
    if (ls >= 3) focuses.push(`${ls} straight losses — reset, regroup, recalibrate`);

    const total = practiceStats?.total_sessions ?? 0;
    if (total === 0) focuses.push("No practice sessions yet — solo time sharpens your game");
    else if (total >= 10) strengths.push(`${total} practice sessions — real dedication`);

    if (shadowStats?.locked) {
      const rem = (shadowStats.dartsNeeded ?? 250) - (shadowStats.totalDarts ?? 0);
      if (rem > 0) focuses.push(`${rem} more practice darts to unlock your Shadow Bot`);
    } else if (shadowStats && (shadowStats.matchWinRate ?? 0) >= 60) {
      strengths.push(`${shadowStats.matchWinRate}% win rate vs the Shadow Bot`);
    }

    if ((m501?.currentTier ?? 1) > 1) strengths.push(`Master 501 ${m501.config?.name} tier reached`);

    if (tourTrophies.length > 0) strengths.push(`${tourTrophies.length} tour ${tourTrophies.length === 1 ? "trophy" : "trophies"} in the cabinet`);

    if (nearMissAchievements.length > 0) {
      const a = nearMissAchievements[0];
      focuses.push(`Close to "${a.name}" — ${a.currentProgress}/${a.criteriaValue}`);
    }

    if (tier === "Diamond") strengths.push("Diamond tier — top of the food chain");
    else if (tier === "Platinum") strengths.push("Platinum tier — one big run from Diamond");

    if ((player?.points ?? 0) >= 60) strengths.push(`${player.points} pts on the board — dominant season`);
    else if ((player?.points ?? 0) === 0 && games >= 3) focuses.push("Points eliminated — no bankroll to lose, maximum aggression mode");

    return { strengths, focuses };
  }, [player, games, winRate, eloTrend, eloHistory, practiceStats, shadowStats, m501, tourTrophies, nearMissAchievements, tier]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-5">
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.2rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em" }}>
          You're not signed in
        </div>
        <button onClick={() => navigate("/login")}
          className="px-6 py-3 rounded-xl flex items-center gap-2 font-bold"
          style={{ background: "linear-gradient(135deg, #ff005c, rgba(255,0,92,0.7))", color: "#fff",
            fontFamily: "Oswald, sans-serif", letterSpacing: "0.15em", fontSize: "0.85rem", border: "none" }}>
          Sign In
        </button>
      </div>
    );
  }

  const gsTotal  = gamerscore?.total ?? 0;
  const gsLeague = gamerscore?.league ?? 0;
  const gsBot    = gamerscore?.shadowBot ?? 0;
  const gsTour   = (gamerscore?.tourTrophies ?? 0) + (gamerscore?.tourAchievements ?? 0);
  const gsM501   = gamerscore?.master501 ?? 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-8">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="rounded-2xl relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${tCol}1e 0%, rgba(8,6,20,0.98) 55%)`, border: `1px solid ${tCol}35`, boxShadow: `0 0 60px ${tCol}14` }}>
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${tCol} 0%, ${tCol}55 40%, transparent 100%)` }} />

        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 relative"
              style={{ background: `linear-gradient(135deg, ${tCol}28, ${tCol}0a)`, border: `1px solid ${tCol}55` }}>
              <div className="absolute inset-0 rounded-2xl" style={{ background: `${tCol}1c`, filter: "blur(10px)" }} />
              <Target className="w-8 h-8 relative z-10" style={{ color: tCol, filter: `drop-shadow(0 0 10px ${tCol})` }} />
            </div>

            <div className="flex-1 min-w-0">
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "2rem", fontWeight: 900,
                color: "#fff", letterSpacing: "0.04em", lineHeight: 1, textShadow: "0 2px 20px rgba(0,0,0,0.9)" }} className="truncate">
                {user.playerName}
              </div>
              {player?.tagline && (
                <div className="mt-1" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.68rem",
                  color: tCol, letterSpacing: "0.08em", fontStyle: "italic", opacity: 0.9 }}>
                  "{player.tagline}"
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="px-2 py-0.5 rounded-md" style={{ background: `${tCol}22`, fontFamily: "Oswald, sans-serif",
                  fontSize: "0.58rem", color: tCol, letterSpacing: "0.14em", fontWeight: 800, border: `1px solid ${tCol}44` }}>
                  {tier}
                </span>
                {(() => {
                  const at = titleList.find(t => t.isActive);
                  if (!at) return null;
                  const RC: Record<string,string> = { Common:"#9ca3af", Rare:"#3b82f6", Epic:"#a855f7", Legendary:"#ffd24a" };
                  const c = RC[at.rarity as string] ?? "#9ca3af";
                  return (
                    <span className="px-2 py-0.5 rounded-md" style={{
                      background: `${c}18`, fontFamily: "Oswald, sans-serif",
                      fontSize: "0.55rem", color: c, letterSpacing: "0.1em",
                      fontWeight: 700, border: `1px solid ${c}38`,
                    }}>
                      {at.icon} {at.title}
                    </span>
                  );
                })()}
                <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>
                  ELO {player?.elo ?? "–"}
                </span>
                {player?.seasonWins !== undefined && (
                  <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>
                    {player.seasonWins}W–{player.seasonLosses}L
                  </span>
                )}
                {user.isAdmin && (
                  <span className="flex items-center gap-0.5">
                    <Shield className="w-3 h-3" style={{ color: "#ffd24a" }} />
                    <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", color: "#ffd24a", letterSpacing: "0.1em" }}>ADMIN</span>
                  </span>
                )}
              </div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.48rem", color: "rgba(255,255,255,0.18)", letterSpacing: "0.1em", marginTop: "0.25rem" }}>
                @{user.username}
              </div>
            </div>

            <div className="text-right shrink-0">
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "3rem", fontWeight: 900,
                color: "#ff005c", lineHeight: 0.85, textShadow: "0 0 28px rgba(255,0,92,0.9)" }}>
                {player?.points ?? "–"}
              </div>
              <div style={{ fontSize: "0.44rem", color: "rgba(255,255,255,0.18)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.2em", marginTop: "2px" }}>PTS</div>
              {(player?.currentWinStreak ?? player?.win_streak ?? 0) >= 3 && (
                <div className="mt-1.5 flex items-center justify-end gap-1">
                  <Flame className="w-3.5 h-3.5" style={{ color: "#ff8c00", filter: "drop-shadow(0 0 5px #ff8c00)" }} />
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", color: "#ff8c00", fontWeight: 900, letterSpacing: "0.06em" }}>
                    {player?.currentWinStreak ?? player?.win_streak} STREAK
                  </span>
                </div>
              )}
              {(player?.currentLossStreak ?? player?.loss_streak ?? 0) >= 3 && (
                <div className="mt-1.5 text-right">
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", color: "rgba(255,0,92,0.7)", fontWeight: 700, letterSpacing: "0.08em" }}>
                    {player?.currentLossStreak ?? player?.loss_streak}L RUN
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* View Profile + Sign Out */}
          <div className="flex items-center gap-2 mt-4">
            <Link href={`/players/${user.playerId}`}
              className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.45)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", fontSize: "0.7rem" }}>
              <User className="w-3 h-3" />
              Full Profile
            </Link>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl transition-opacity hover:opacity-70"
              style={{ background: "rgba(255,0,92,0.07)", border: "1px solid rgba(255,0,92,0.18)",
                color: "#ff005c", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", fontSize: "0.7rem" }}>
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* ── Quick Actions strip ──────────────────────────────── */}
        {(() => {
          const actions = [
            { href: "/practice",                    icon: Dumbbell,     label: "Practice", col: "#4d94ff" },
            { href: `/shadow-bot/${user.playerId}`, icon: CircuitBoard, label: "My Bot",   col: "#00e5a0" },
            { href: "/master501",                   icon: Target,       label: "M·501",    col: "#00e5a0" },
            { href: "/tour",                        icon: Star,         label: "Tour",     col: "#a855f7" },
            ...(user.isAdmin ? [{ href: "/admin",   icon: Shield,       label: "Admin",    col: "#ffd24a" }] : []),
          ];
          return (
            <div className={`grid gap-2 px-4 pb-4`} style={{ gridTemplateColumns: `repeat(${actions.length}, 1fr)` }}>
              {actions.map(({ href, icon: Icon, label, col }) => (
                <Link key={href} href={href}
                  className="rounded-xl py-3 flex flex-col items-center gap-1.5 transition-all hover:opacity-85 active:scale-95"
                  style={{ background: `${col}10`, border: `1px solid ${col}28` }}>
                  <Icon className="w-4 h-4" style={{ color: col }} />
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.12em",
                    color: col, textTransform: "uppercase", fontWeight: 700 }}>{label}</span>
                </Link>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ── Account Tabs ────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {([
          { id: "overview"      as const, label: "Overview",  Icon: User                               },
          { id: "activity"      as const, label: "Activity",  Icon: Zap                              },
          { id: "achievements"  as const, label: "Earned",    Icon: Award                            },
          { id: "coach"         as const, label: "Coach",     Icon: Brain                            },
          { id: "cards"         as const, label: "Cards",     Icon: Sparkles                         },
          { id: "challenges"    as const, label: "Challenges", Icon: Trophy                          },
          { id: "social"        as const, label: "Social",    Icon: MessageSquare, badge: unreadNotifCount },
          { id: "stats"         as const, label: "Stats",     Icon: TrendingUp                             },
          { id: "analytics"     as const, label: "Analytics", Icon: BarChart3                        },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex-1 relative flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold transition-all"
            style={{
              background: activeTab === tab.id ? "rgba(255,0,92,0.18)" : "transparent",
              border:     activeTab === tab.id ? "1px solid rgba(255,0,92,0.35)" : "1px solid transparent",
              color:      activeTab === tab.id ? "#ff005c" : "rgba(255,255,255,0.35)",
              fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em",
            }}>
            <tab.Icon className="w-3.5 h-3.5 shrink-0" />
            <span style={{ fontSize: "0.55rem", lineHeight: 1 }}>{tab.label.toUpperCase()}</span>
            {"badge" in tab && (tab as any).badge > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white"
                style={{ background: "#ff005c", fontSize: "0.45rem", fontFamily: "Oswald, sans-serif", fontWeight: 900 }}>
                {(tab as any).badge > 9 ? "9+" : (tab as any).badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (<>

      {/* ── Gamerscore ─────────────────────────────────────────── */}
      <div className="rounded-2xl p-4"
        style={{ background: "rgba(8,6,18,0.9)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between mb-3">
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>
            Gamerscore
          </div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "2rem", fontWeight: 900, color: "#ffd24a", lineHeight: 1, textShadow: "0 0 12px rgba(255,210,74,0.5)" }}>
            {gsTotal.toLocaleString()}<span style={{ fontSize: "0.8rem", color: "rgba(255,210,74,0.5)", marginLeft: "2px" }}>G</span>
          </div>
        </div>
        <div className="flex gap-2">
          {[
            { label: "League",     val: gsLeague, col: "#ff005c" },
            { label: "Shadow Bot", val: gsBot,    col: "#00e5a0" },
            { label: "Tour",       val: gsTour,   col: "#a855f7" },
            { label: "M·501",      val: gsM501,   col: "#00c8a0" },
          ].map(({ label, val, col }) => (
            <div key={label} className="flex-1 rounded-xl p-2.5 text-center"
              style={{ background: `${col}0c`, border: `1px solid ${col}22` }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", fontWeight: 800, color: col, lineHeight: 1 }}>
                {val}G
              </div>
              <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", marginTop: "2px" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Titles ───────────────────────────────────────────── */}
      {user?.playerId && (
        <SectionCard title="Titles" icon={Award} accent="#a855f7" collapsible>
          {(() => {
            const RC: Record<string,string> = { Common:"#9ca3af", Rare:"#3b82f6", Epic:"#a855f7", Legendary:"#ffd24a" };
            const earnedCount = titleList.filter((t: any) => t.earned).length;
            const FILTERS = [
              { key:"earned", label:"Earned" },
              { key:"all",    label:"All" },
              { key:"league", label:"League" },
              { key:"practice", label:"Practice" },
              { key:"game",   label:"Games" },
              { key:"master501", label:"M501" },
              { key:"bot",    label:"Shadow Bot" },
            ];
            const visible = titleList.filter((t: any) =>
              titleFilter === "earned" ? t.earned :
              titleFilter === "all"    ? true :
              t.category === titleFilter
            );
            return (
              <div className="space-y-3">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
                    {earnedCount > 0
                      ? `${earnedCount} earned · tap to equip`
                      : "Earn titles through league matches, M501, Practice & Shadow Bot"}
                  </div>
                  {earnedCount > 0 && (
                    <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", color: "#a855f7", fontWeight: 800, letterSpacing: "0.06em" }}>
                      {earnedCount}/{titleList.length}
                    </div>
                  )}
                </div>

                {/* Filter tabs */}
                <div className="flex flex-wrap gap-1.5">
                  {FILTERS.map(f => (
                    <button key={f.key} onClick={() => setTitleFilter(f.key)}
                      style={{
                        fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", fontWeight: 700,
                        letterSpacing: "0.1em", padding: "3px 8px", borderRadius: "6px",
                        background: titleFilter === f.key ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${titleFilter === f.key ? "#a855f780" : "rgba(255,255,255,0.08)"}`,
                        color: titleFilter === f.key ? "#a855f7" : "rgba(255,255,255,0.35)",
                        cursor: "pointer",
                      }}>
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Grid */}
                {visible.length === 0 ? (
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.2)", textAlign: "center", padding: "16px 0" }}>
                    No titles here yet
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {visible.map((t: any) => {
                      const c = t.earned ? (RC[t.rarity as string] ?? "#9ca3af") : "rgba(255,255,255,0.12)";
                      return (
                        <button key={t.key}
                          disabled={!t.earned || titleSaving}
                          onClick={() => t.earned && handleSetTitle(t.isActive ? null : t.key)}
                          className="text-left rounded-xl p-3 transition-all"
                          style={{
                            background: t.isActive ? `${RC[t.rarity]}18` : t.earned ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
                            border: `1px solid ${t.isActive ? (RC[t.rarity] + "55") : t.earned ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)"}`,
                            boxShadow: t.isActive ? `0 0 14px ${RC[t.rarity]}22` : undefined,
                            cursor: t.earned ? "pointer" : "default",
                            opacity: t.earned ? 1 : 0.4,
                          }}>
                          <div style={{ fontSize: "1rem", lineHeight: 1, marginBottom: "4px", filter: t.earned ? undefined : "grayscale(1)" }}>
                            {t.earned ? t.icon : "🔒"}
                          </div>
                          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.68rem", color: c, fontWeight: 800, letterSpacing: "0.06em", lineHeight: 1.2 }}>
                            {t.title}
                          </div>
                          <div style={{ fontSize: "0.5rem", color: t.earned ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.12)", marginTop: "3px", letterSpacing: "0.08em", fontFamily: "Oswald, sans-serif" }}>
                            {t.earned ? t.rarity : t.description}
                          </div>
                          {t.isActive && (
                            <div style={{ fontSize: "0.45rem", color: RC[t.rarity], marginTop: "3px", letterSpacing: "0.12em", fontFamily: "Oswald, sans-serif", fontWeight: 700 }}>
                              ✓ ACTIVE
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </SectionCard>
      )}

      {/* ── Card Clash Info ────────────────────────────────────────── */}
      {user?.playerId && (
        <div className="space-y-4">
          <CoinBalance playerId={user.playerId} />
        </div>
      )}

      {/* ── Coach's Corner ────────────────────────────────────── */}
      {(insights.strengths.length > 0 || insights.focuses.length > 0) && (
        <SectionCard title="Coach's Corner" icon={Zap} accent="#ffd24a">
          <div className="grid grid-cols-2 gap-3">
            {insights.strengths.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3 h-3" style={{ color: "#00e5a0" }} />
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.18em", color: "#00e5a0", textTransform: "uppercase" }}>
                    Strengths
                  </span>
                </div>
                <div className="space-y-1.5">
                  {insights.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: "#00e5a0" }} />
                      <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {insights.focuses.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown className="w-3 h-3" style={{ color: "#f59e0b" }} />
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.18em", color: "#f59e0b", textTransform: "uppercase" }}>
                    Focus On
                  </span>
                </div>
                <div className="space-y-1.5">
                  {insights.focuses.map((f, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <Flame className="w-3 h-3 shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
                      <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* ── League / Season ──────────────────────────────────── */}
      <SectionCard title="This Season" icon={Trophy} accent="#ffd24a">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Points", val: player?.points ?? "–", big: true },
            { label: "Wins",   val: player?.seasonWins ?? "–" },
            { label: "Losses", val: player?.seasonLosses ?? "–" },
          ].map(({ label, val, big }) => (
            <div key={label} className="rounded-xl p-3 text-center"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: big ? "1.8rem" : "1.5rem", fontWeight: 900,
                color: big ? "#ff005c" : "#fff", lineHeight: 1, textShadow: big ? "0 0 12px rgba(255,0,92,0.5)" : undefined }}>
                {val}
              </div>
              <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif",
                letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "3px" }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Win rate + form row */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.15em",
              color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: "0.3rem" }}>
              Recent Form
            </div>
            <div className="flex items-center gap-1">
              {recentForm.length > 0
                ? recentForm.map((r, i) => <FormDot key={i} result={r} />)
                : <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.2)" }}>No matches yet</span>}
            </div>
          </div>
          <div className="text-right">
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.15em",
              color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: "0.3rem" }}>
              Elo Trend
            </div>
            <div className="flex items-center gap-2">
              {eloHistory.length >= 2 && (
                <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", fontWeight: 700,
                  color: eloTrend >= 0 ? "#00e5a0" : "#ff005c" }}>
                  {eloTrend >= 0 ? "+" : ""}{eloTrend}
                </span>
              )}
              <EloSparkline history={eloHistory.slice(-12)} />
            </div>
          </div>
        </div>

        {winRate !== null && games >= 3 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>Win Rate</span>
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", fontWeight: 700,
                color: winRate >= 50 ? "#00e5a0" : "#f59e0b" }}>{winRate}%</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${winRate}%`, borderRadius: 2, transition: "width 0.8s ease",
                background: winRate >= 65 ? "#00e5a0" : winRate >= 45 ? "#ffd24a" : "#ff005c" }} />
            </div>
          </div>
        )}
      </SectionCard>

      </>)}

      {/* ── Activity Tab ─────────────────────────────────────────── */}
      {activeTab === "activity" && (
        <div className="space-y-3">

      {/* ── Master 501 ───────────────────────────────────────── */}
      <SectionCard title="Master 501" icon={Target} accent="#00e5a0">
        {m501 ? (
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${m501.config?.color ?? "#94a3b8"}18`, border: `1px solid ${m501.config?.color ?? "#94a3b8"}33` }}>
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.4rem", fontWeight: 900, color: m501.config?.color ?? "#94a3b8" }}>
                T{m501.currentTier}
              </span>
            </div>
            <div className="flex-1">
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", fontWeight: 800, color: "#fff", letterSpacing: "0.04em" }}>
                {m501.config?.name ?? "Challenger"}
              </div>
              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
                Round {m501.currentRound} · {m501.config?.label ?? "Best of 5"}
              </div>
              {m501.history && m501.history.length > 0 && (
                <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.25)", marginTop: "3px" }}>
                  {m501.history.length} run{m501.history.length !== 1 ? "s" : ""} completed
                </div>
              )}
            </div>
            <Link href="/master501"
              className="px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70"
              style={{ background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.2)",
                color: "#00e5a0", fontFamily: "Oswald, sans-serif", fontSize: "0.62rem", letterSpacing: "0.1em" }}>
              Play
            </Link>
          </div>
        ) : (
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>Loading…</div>
        )}
      </SectionCard>

      {/* ── Tour ─────────────────────────────────────────────── */}
      <SectionCard title="Tour Mode" icon={Star} accent="#a855f7">
        {tourTrophies.length > 0 || activeRuns.length > 0 ? (
          <div className="space-y-3">
            {tourTrophies.length > 0 && (
              <div>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.15em",
                  color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                  Trophy Cabinet · {tourTrophies.length}
                </div>
                <div className="flex flex-wrap gap-2">
                  {tourTrophies.slice(0, 6).map((t: any) => (
                    <div key={t.id} className="px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"
                      style={{ background: "rgba(255,210,74,0.07)", border: "1px solid rgba(255,210,74,0.18)" }}>
                      <Trophy className="w-3 h-3" style={{ color: "#ffd24a" }} />
                      <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.6)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
                        {t.tourName ?? t.tour_name ?? "Tour Win"}
                      </span>
                    </div>
                  ))}
                  {tourTrophies.length > 6 && (
                    <div className="px-2.5 py-1.5 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)" }}>+{tourTrophies.length - 6} more</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeRuns.length > 0 && (
              <div>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.15em",
                  color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                  Active Runs · {activeRuns.length}
                </div>
                {activeRuns.slice(0, 2).map((r: any) => (
                  <Link key={r.id} href={`/tour/${r.id}`}
                    className="flex items-center justify-between px-3 py-2 rounded-xl transition-opacity hover:opacity-80 mb-1.5 block"
                    style={{ background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.2)" }}>
                    <div>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.75rem", color: "#fff", letterSpacing: "0.04em" }}>
                        {r.tourName ?? r.tour_name ?? "Tour Run"}
                      </div>
                      <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>
                        {r.difficulty} · In progress
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4" style={{ color: "#a855f7" }} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
              No trophies yet — enter a tour to start your career
            </span>
            <Link href="/tour"
              className="px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70 shrink-0"
              style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)",
                color: "#a855f7", fontFamily: "Oswald, sans-serif", fontSize: "0.62rem", letterSpacing: "0.1em" }}>
              Browse Tours
            </Link>
          </div>
        )}
      </SectionCard>

      {/* ── Shadow Bot ───────────────────────────────────────── */}
      <SectionCard title="Shadow Bot" icon={CircuitBoard} accent="#00e5a0">
        {shadowStats ? (
          shadowStats.locked ? (
            <div>
              <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.45)", marginBottom: "0.75rem" }}>
                Log <strong style={{ color: "#00e5a0" }}>{(shadowStats.dartsNeeded ?? 250) - (shadowStats.totalDarts ?? 0)}</strong> more practice darts to unlock your digital clone
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.12em",
                  color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>
                  Practice Darts
                </span>
                <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", color: "#00e5a0" }}>
                  {shadowStats.totalDarts ?? 0} / {shadowStats.dartsNeeded ?? 250}
                </span>
              </div>
              <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, transition: "width 0.8s ease", background: "linear-gradient(90deg, #00e5a0, #00c885)",
                  width: `${Math.min(100, ((shadowStats.totalDarts ?? 0) / (shadowStats.dartsNeeded ?? 250)) * 100)}%` }} />
              </div>
              <Link href="/practice"
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl transition-opacity hover:opacity-75"
                style={{ background: "rgba(0,229,160,0.07)", border: "1px solid rgba(0,229,160,0.2)",
                  color: "#00e5a0", fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", letterSpacing: "0.12em" }}>
                <Dumbbell className="w-3.5 h-3.5" />
                Practise Now to Unlock
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Matches",  val: shadowStats.totalMatches ?? 0 },
                  { label: "Win Rate", val: `${shadowStats.matchWinRate ?? 0}%` },
                  { label: "Level",    val: shadowStats.accuracyLevel ?? shadowStats.nextLevel ?? "–" },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded-xl p-2.5 text-center"
                    style={{ background: "rgba(0,229,160,0.05)", border: "1px solid rgba(0,229,160,0.12)" }}>
                    <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", fontWeight: 800, color: "#00e5a0", lineHeight: 1 }}>
                      {val}
                    </div>
                    <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif",
                      letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "3px" }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
              <Link href={`/shadow-bot/${user.playerId}`}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: "linear-gradient(135deg, rgba(0,229,160,0.16), rgba(0,229,160,0.07))",
                  border: "1px solid rgba(0,229,160,0.35)", color: "#00e5a0",
                  fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", letterSpacing: "0.14em", fontWeight: 800 }}>
                <CircuitBoard className="w-3.5 h-3.5" />
                CHALLENGE YOUR CLONE ⚔️
              </Link>
            </div>
          )
        ) : (
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)" }}>Loading…</div>
        )}
      </SectionCard>

      {/* ── Practice ─────────────────────────────────────────── */}
      <SectionCard title="Practice" icon={Dumbbell} accent="#0066ff">
        {practiceStats ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 grid grid-cols-3 gap-2">
              {[
                { label: "Sessions",  val: practiceStats.total_sessions ?? 0 },
                { label: "180s",      val: practiceStats.total_180s ?? 0 },
                { label: "Best Avg",  val: practiceStats.best_session_avg ? Number(practiceStats.best_session_avg).toFixed(1) : "–" },
              ].map(({ label, val }) => (
                <div key={label} className="rounded-xl p-2.5 text-center"
                  style={{ background: "rgba(0,102,255,0.06)", border: "1px solid rgba(0,102,255,0.14)" }}>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", fontWeight: 800, color: "#4d94ff", lineHeight: 1 }}>
                    {val}
                  </div>
                  <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif",
                    letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "3px" }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
            {practiceStats.avg_three_dart && (
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.14em",
                    color: "rgba(255,255,255,0.2)", textTransform: "uppercase" }}>Avg 3-Dart Score</span>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "#4d94ff" }}>
                    {Number(practiceStats.avg_three_dart).toFixed(1)}
                  </span>
                </div>
              </div>
            )}
            <div className="col-span-2">
              <Link href="/practice"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-opacity hover:opacity-80"
                style={{ background: "linear-gradient(135deg, rgba(77,148,255,0.14), rgba(77,148,255,0.07))",
                  border: "1px solid rgba(77,148,255,0.3)", color: "#4d94ff",
                  fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", letterSpacing: "0.14em", fontWeight: 800 }}>
                <Dumbbell className="w-3.5 h-3.5" />
                {practiceStats.total_sessions === 0 ? "START PRACTISING" : "PRACTICE NOW"} →
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)" }}>Loading…</div>
        )}
      </SectionCard>

        </div>
      )}

      {/* ── Achievements Tab ─────────────────────────────────────── */}
      {activeTab === "achievements" && (
        <div className="space-y-3">

        {/* Source selector */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {([
            { key: "league" as const, label: "League", accent: "#ff005c",
              unlocked: achTotals.unlocked, total: achTotals.total },
            { key: "bot"    as const, label: "Bot",    accent: "#00e5a0",
              unlocked: shadowAchs.filter((a: any) => a.unlocked).length, total: shadowAchs.length },
            { key: "tour"   as const, label: "Tour",   accent: "#a855f7",
              unlocked: tourAchs.filter((a: any) => a.unlocked).length, total: tourAchs.length },
            { key: "m501"   as const, label: "M·501",  accent: "#00c8a0",
              unlocked: m501AchCategories.flatMap(c => c.achievements).filter((a: any) => a.isUnlocked).length,
              total:    m501AchCategories.flatMap(c => c.achievements).length },
          ]).map(({ key, label, accent, unlocked, total }) => (
            <button key={key} onClick={() => setAchSource(key)}
              className="flex-1 flex flex-col items-center py-2 rounded-lg transition-all"
              style={{
                background: achSource === key ? `${accent}18` : "transparent",
                border: achSource === key ? `1px solid ${accent}40` : "1px solid transparent",
                color: achSource === key ? accent : "rgba(255,255,255,0.35)",
              }}>
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.08em" }}>{label}</span>
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", color: achSource === key ? `${accent}cc` : "rgba(255,255,255,0.2)", marginTop: "1px" }}>
                {unlocked}/{total}
              </span>
            </button>
          ))}
        </div>

        {/* Near-miss */}
        {achSource === "league" && nearMissAchievements.length > 0 && (
          <div className="rounded-xl p-3 space-y-1.5" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)" }}>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.52rem", letterSpacing: "0.14em", color: "#f59e0b", marginBottom: "0.5rem" }}>
              ⚡ WITHIN REACH
            </div>
            {nearMissAchievements.slice(0, 3).map((a: any) => {
              const pct = Math.round((a.currentProgress / a.criteriaValue) * 100);
              return (
                <div key={a.key} className="flex items-center gap-2">
                  <span style={{ fontSize: "0.75rem" }}>{a.icon ?? "🏆"}</span>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.62rem", color: "rgba(255,255,255,0.75)", letterSpacing: "0.04em" }}>{a.name}</div>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden", marginTop: 2 }}>
                      <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#f59e0b,rgba(245,158,11,0.4))", width: `${pct}%` }} />
                    </div>
                  </div>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", color: "#f59e0b", fontWeight: 700 }}>{pct}%</span>
                </div>
              );
            })}
          </div>
        )}

        {achSource === "league" && (
          achByCategory.length > 0 ? (
            <AchievementPortal categories={achByCategory} cfgMap={CATEGORY_CFG} defaultOpen={["Career"]} />
          ) : (
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", textAlign: "center", padding: "24px 0" }}>
              No achievements yet — play some matches to get started
            </div>
          )
        )}

        {achSource === "bot" && (
          shadowAchsByCategory.length > 0 ? (
            <AchievementPortal categories={shadowAchsByCategory} cfgMap={SHADOW_CAT} defaultOpen={["Darts Thrown"]}
              unlockedField="unlocked" progressField="currentValue" valueField="criteriaValue" gsField="gamerscore" />
          ) : (
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", textAlign: "center", padding: "24px 0" }}>
              No Shadow Bot achievements yet
            </div>
          )
        )}

        {achSource === "tour" && (
          tourAchsByCategory.length > 0 ? (
            <AchievementPortal categories={tourAchsByCategory} cfgMap={TOUR_CAT} defaultOpen={["career"]}
              unlockedField="unlocked" progressField="_noProgress" valueField="criteriaValue" gsField="gamerscore" />
          ) : (
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", textAlign: "center", padding: "24px 0" }}>
              No Tour achievements yet — enter a tour to get started
            </div>
          )
        )}

        {achSource === "m501" && (
          m501AchCategories.length > 0 ? (
            <AchievementPortal categories={m501AchCategories}
              cfgMap={{ "Master-501": { label: "Master 501", accent: "#00e5a0", emoji: "🎯" } }}
              defaultOpen={["Master-501"]} />
          ) : (
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", textAlign: "center", padding: "24px 0" }}>
              No M·501 achievements yet — start playing to unlock them
            </div>
          )
        )}

        <Link href="/achievements"
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl transition-opacity hover:opacity-70"
          style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.15)",
            color: "rgba(168,85,247,0.6)", fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", letterSpacing: "0.1em" }}>
          View Full Achievement List
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>

        </div>
      )}

      {/* ── Coach Tab ─────────────────────────────────────────────── */}
      {activeTab === "coach" && (
        <div className="space-y-3">
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(8,6,18,0.9)", border: "1px solid rgba(0,200,160,0.2)" }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,200,160,0.1)" }}>
              <div className="flex items-center gap-2">
                <Brain className="w-3.5 h-3.5" style={{ color: "#00c8a0" }} />
                <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.18em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
                  Your Personalised Improvement Plan
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full"
                style={{ background: "rgba(0,200,160,0.1)", color: "#00c8a0", border: "1px solid rgba(0,200,160,0.25)", fontSize: "0.55rem", fontFamily: "Oswald, sans-serif", fontWeight: 700 }}>
                Based on your actual game
              </span>
            </div>

            {coachLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-7 h-7 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#00c8a0" }} />
              </div>
            ) : coachDrills.length === 0 ? (
              <div className="py-10 text-center px-5">
                <Brain className="w-8 h-8 mx-auto mb-3 opacity-10" style={{ color: "#00c8a0" }} />
                <p style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", letterSpacing: "0.08em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: "6px" }}>
                  No routine yet
                </p>
                <p style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.18)", lineHeight: 1.5 }}>
                  Log some practice sessions to unlock your personalised drill plan.
                </p>
                <Link href="/practice"
                  className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl transition-opacity hover:opacity-75"
                  style={{ background: "rgba(0,200,160,0.08)", border: "1px solid rgba(0,200,160,0.22)",
                    color: "#00c8a0", fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", letterSpacing: "0.1em" }}>
                  <Dumbbell className="w-3.5 h-3.5" />
                  Start Practising
                </Link>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {coachStats && (
                  <div className="flex flex-wrap gap-2 pb-3 mb-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {coachStats.avg !== undefined && (
                      <div className="px-3 py-1.5 rounded-lg text-center min-w-[68px]"
                        style={{ background: "rgba(0,200,160,0.08)", border: "1px solid rgba(0,200,160,0.2)" }}>
                        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", fontWeight: 900, color: "#00c8a0", lineHeight: 1 }}>{coachStats.avg}</div>
                        <div style={{ fontSize: "0.48rem", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", marginTop: "2px", textTransform: "uppercase" }}>Avg</div>
                      </div>
                    )}
                    {coachStats.checkoutPct !== undefined && (
                      <div className="px-3 py-1.5 rounded-lg text-center min-w-[68px]"
                        style={{ background: "rgba(255,210,74,0.07)", border: "1px solid rgba(255,210,74,0.18)" }}>
                        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", fontWeight: 900, color: "#ffd24a", lineHeight: 1 }}>{coachStats.checkoutPct}%</div>
                        <div style={{ fontSize: "0.48rem", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", marginTop: "2px", textTransform: "uppercase" }}>Checkout</div>
                      </div>
                    )}
                    {coachStats.treblePct !== undefined && (
                      <div className="px-3 py-1.5 rounded-lg text-center min-w-[68px]"
                        style={{ background: "rgba(0,102,255,0.08)", border: "1px solid rgba(0,102,255,0.2)" }}>
                        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", fontWeight: 900, color: "#0066ff", lineHeight: 1 }}>{coachStats.treblePct}%</div>
                        <div style={{ fontSize: "0.48rem", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", marginTop: "2px", textTransform: "uppercase" }}>Treble</div>
                      </div>
                    )}
                  </div>
                )}
                {coachDrills.map((drill: any, i: number) => {
                  const isOpen = openDrills[drill.id] ?? false;
                  const DIFF_COLOR: Record<string, string> = { easy: "#22c55e", medium: "#ffd24a", hard: "#ff005c", critical: "#ff005c" };
                  const diffColor = DIFF_COLOR[drill.priority?.toLowerCase()] ?? "#9ca3af";
                  const priorityLabel: Record<string, string> = { critical: "🔴 Critical", high: "🟠 High", normal: "🟢 Normal", advanced: "⭐ Advanced" };
                  
                  return (
                    <div key={i} className="rounded-xl overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <button className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
                        onClick={() => setOpenDrills(prev => ({ ...prev, [drill.id]: !prev[drill.id] }))}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-1.5 h-6 rounded-full shrink-0" style={{ background: diffColor }} />
                          <div className="min-w-0">
                            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.75rem", fontWeight: 800,
                              color: "rgba(255,255,255,0.9)", letterSpacing: "0.04em", lineHeight: 1.2 }}>
                              {drill.title || drill.name}
                            </div>
                            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", color: "rgba(255,255,255,0.3)",
                              letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "2px" }}>
                              {priorityLabel[drill.priority] || drill.priority} • {drill.focus}
                            </div>
                          </div>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
                          style={{ color: "rgba(255,255,255,0.25)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          {drill.description && (
                            <p style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: "12px 0 0 0" }}>
                              {drill.description}
                            </p>
                          )}
                          {drill.drill && (
                            <div>
                              <div style={{ fontSize: "0.5rem", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                                The Drill
                              </div>
                              <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: 0 }}>
                                {drill.drill}
                              </p>
                            </div>
                          )}
                          {drill.target && (
                            <div>
                              <div style={{ fontSize: "0.5rem", fontWeight: 700, color: "#00c8a0", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                                Your Target for This Session
                              </div>
                              <p style={{ fontSize: "0.6rem", color: "#00c8a0", lineHeight: 1.6, margin: 0 }}>
                                {drill.target}
                              </p>
                            </div>
                          )}
                          {drill.duration && (
                            <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: "4px" }}>
                              <Clock className="w-3 h-3" />
                              {drill.duration}
                            </div>
                          )}
                          <Link href={`/practice?drill=${encodeURIComponent(drill.title || drill.name)}`}
                            className="inline-flex items-center gap-2 mt-3 px-3 py-2 rounded-lg transition-opacity hover:opacity-75"
                            style={{ background: "rgba(0,200,160,0.1)", border: "1px solid rgba(0,200,160,0.25)",
                              color: "#00c8a0", fontFamily: "Oswald, sans-serif", fontSize: "0.62rem", letterSpacing: "0.08em", fontWeight: 700 }}>
                            <Dumbbell className="w-3 h-3" />
                            Start This Drill
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Change Password ──────────────────────────────────── */}
          <SectionCard title="Change Password" icon={Lock} accent="rgba(255,255,255,0.2)" collapsible>
            <form onSubmit={handleChangePassword} className="space-y-3">
              {[
                { label: "Current password", val: curPwd,     set: setCurPwd,   id: "cur",  auto: "current-password" },
                { label: "New password",      val: newPwd,     set: setNewPwd,   id: "new",  auto: "new-password" },
                { label: "Confirm new",       val: confirmPwd, set: setConfirm,  id: "conf", auto: "new-password" },
              ].map(({ label, val, set, id, auto }) => (
                <div key={id}>
                  <label className="block mb-1" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.54rem",
                    letterSpacing: "0.14em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase" }}>
                    {label}
                  </label>
                  <input type="password" autoComplete={auto} value={val} onChange={e => set(e.target.value)}
                    className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      color: "#fff", fontFamily: "inherit" }}
                    onFocus={e => (e.target.style.borderColor = "rgba(255,0,92,0.4)")}
                    onBlur={e =>  (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                    required />
                </div>
              ))}
              <button type="submit" disabled={pwdLoading}
                className="w-full py-2.5 rounded-xl font-bold transition-opacity disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.7)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em", fontSize: "0.78rem" }}>
                {pwdLoading ? "Saving…" : "Update Password"}
              </button>
            </form>
          </SectionCard>

          {/* ── Admin Panel ──────────────────────────────────────── */}
          {user.isAdmin && (
            <SectionCard title="Admin Panel" icon={Shield} accent="#ffd24a">
              <div className="space-y-3">
                <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)" }}>
                  Season management, player accounts, game types, achievement sweeps, Elo overrides, and more.
                </p>
                <Link href="/admin"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-opacity hover:opacity-80"
                  style={{ background: "linear-gradient(135deg, rgba(255,210,74,0.18), rgba(255,210,74,0.07))",
                    border: "1px solid rgba(255,210,74,0.35)", color: "#ffd24a",
                    fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", letterSpacing: "0.14em", fontWeight: 800 }}>
                  <Shield className="w-3.5 h-3.5" />
                  OPEN ADMIN PANEL ⚡
                </Link>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ── Social Tab ──────────────────────────────────────────── */}
      {activeTab === "social" && (
        <div className="space-y-3">

        {/* Social sub-nav */}
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {([
            { id: "dms"           as const, label: "Messages", Icon: MessageSquare                      },
            { id: "notifications" as const, label: "Notifs",   Icon: Bell, badge: unreadNotifCount      },
            { id: "photos"        as const, label: "Photos",   Icon: Images                             },
          ]).map(stab => (
            <button key={stab.id} onClick={() => setSocialTab(stab.id)}
              className="flex-1 relative flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: socialTab === stab.id ? "rgba(255,0,92,0.12)" : "transparent",
                border:     socialTab === stab.id ? "1px solid rgba(255,0,92,0.25)" : "1px solid transparent",
                color:      socialTab === stab.id ? "#ff005c" : "rgba(255,255,255,0.35)",
                fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em",
              }}>
              <stab.Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{stab.label.toUpperCase()}</span>
              {"badge" in stab && (stab as any).badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white"
                  style={{ background: "#ff005c", fontSize: "0.45rem", fontFamily: "Oswald, sans-serif", fontWeight: 900 }}>
                  {(stab as any).badge > 9 ? "9+" : (stab as any).badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {socialTab === "dms" && (
        <div className="space-y-3">
          {!messagingEnabled ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <MessageSquare className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.12)" }} />
              <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>MESSAGES COMING SOON</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.15)" }}>Direct messaging between players isn't live yet.</p>
            </div>
          ) : activeConvId === null ? (
            <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" style={{ color: "rgba(255,0,92,0.7)" }} />
                  <span className="text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", color: "#fff" }}>MESSAGES</span>
                </div>
                <button onClick={() => setShowNewMsg(v => !v)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-opacity hover:opacity-75"
                  style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.28)", color: "#ff005c", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>
                  <Send className="w-3 h-3" /> New
                </button>
              </div>
              {showNewMsg && (
                <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,0,92,0.03)" }}>
                  <div className="px-4 py-2 text-xs font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em" }}>
                    START NEW CONVERSATION
                  </div>
                  {allPlayers
                    .filter((p: any) => p.isActive && p.id !== user?.playerId)
                    .map((p: any) => (
                      <button key={p.id}
                        onClick={() => { setActiveConvId(p.id); void loadThread(p.id); setShowNewMsg(false); }}
                        className="w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors hover:bg-white/5"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                          style={{ background: "rgba(0,102,255,0.15)", border: "1px solid rgba(0,102,255,0.3)", color: "#0066ff", fontFamily: "Oswald, sans-serif" }}>
                          {p.name?.charAt(0)}
                        </div>
                        <span className="text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>{p.name}</span>
                      </button>
                    ))}
                </div>
              )}
              {conversations.length === 0 && !showNewMsg ? (
                <div className="flex flex-col items-center py-10 gap-3">
                  <MessageSquare className="w-8 h-8" style={{ color: "rgba(255,255,255,0.08)" }} />
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No conversations yet</p>
                  <button onClick={() => setShowNewMsg(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold transition-opacity hover:opacity-75"
                    style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.28)", color: "#ff005c", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
                    Start a Conversation
                  </button>
                </div>
              ) : (
                conversations.map((conv: any) => (
                  <button key={conv.playerId}
                    onClick={() => { setActiveConvId(conv.playerId); void loadThread(conv.playerId); setShowNewMsg(false); }}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors hover:bg-white/5"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                      style={{ background: "rgba(255,0,92,0.15)", border: "1px solid rgba(255,0,92,0.3)", color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                      {(conv.playerName as string)?.charAt(0) ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold truncate" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>{conv.playerName}</span>
                        {(conv.unreadCount as number) > 0 && (
                          <span className="ml-auto text-xs font-black shrink-0 px-1.5 rounded-full"
                            style={{ background: "#ff005c", color: "#fff", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem" }}>
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs truncate mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{conv.lastMessage ?? "Photo"}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", height: "60vh" }}>
              <div className="px-4 py-3 flex items-center gap-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <button onClick={() => { setActiveConvId(null); void loadConversations(); }}
                  className="p-1 rounded-lg" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>
                  {conversations.find((c: any) => c.playerId === activeConvId)?.playerName ?? ""}
                </span>
              </div>
              <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {threadMessages.map((msg: any) => {
                  const mine = msg.sender_id === user?.playerId;
                  return (
                    <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[75%]">
                        {msg.content && (
                          <div className="px-3 py-2 rounded-2xl text-sm"
                            style={{
                              background: mine ? "rgba(255,0,92,0.2)"   : "rgba(255,255,255,0.06)",
                              border:     mine ? "1px solid rgba(255,0,92,0.35)" : "1px solid rgba(255,255,255,0.08)",
                              color: "#fff",
                            }}>
                            {msg.content}
                          </div>
                        )}
                        {msg.photo_path && (
                          <img src={`/api/storage${msg.photo_path}`} alt="photo"
                            className="mt-1 rounded-xl max-w-full" style={{ maxHeight: 200 }} />
                        )}
                        <div className={`text-xs mt-0.5 ${mine ? "text-right" : ""}`}
                          style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", fontSize: "0.5rem" }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="shrink-0 px-3 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {msgPhotoPreview && (
                  <div className="relative mb-2 rounded-xl overflow-hidden" style={{ maxHeight: 120 }}>
                    <img src={msgPhotoPreview} alt="preview" className="rounded-xl object-cover" style={{ maxHeight: 120 }} />
                    <button type="button"
                      onClick={() => { setMsgPhotoFile(null); if (msgPhotoPreview) URL.revokeObjectURL(msgPhotoPreview); setMsgPhotoPreview(null); if (msgFileRef.current) msgFileRef.current.value = ""; }}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <form className="flex gap-2" onSubmit={async e => {
                  e.preventDefault();
                  if ((!msgText.trim() && !msgPhotoFile) || sendingMsg) return;
                  setSendingMsg(true);
                  try {
                    let photoPath: string | undefined;
                    if (msgPhotoFile) {
                      const pur = await fetch("/api/storage/uploads/request-url", {
                        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
                        body: JSON.stringify({ name: msgPhotoFile.name, size: msgPhotoFile.size, contentType: msgPhotoFile.type }),
                      });
                      if (pur.ok) {
                        const { uploadURL, objectPath } = await pur.json() as { uploadURL: string; objectPath: string };
                        await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": msgPhotoFile.type }, body: msgPhotoFile });
                        photoPath = objectPath;
                      }
                    }
                    const r = await fetch("/api/messages", {
                      method: "POST", credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ receiverId: activeConvId, content: msgText || undefined, photoPath }),
                    });
                    if (r.ok) {
                      setMsgText(""); setMsgPhotoFile(null);
                      if (msgPhotoPreview) URL.revokeObjectURL(msgPhotoPreview);
                      setMsgPhotoPreview(null);
                      if (msgFileRef.current) msgFileRef.current.value = "";
                      void loadThread(activeConvId!);
                    }
                  } finally { setSendingMsg(false); }
                }}>
                  <input ref={msgFileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      setMsgPhotoFile(f); setMsgPhotoPreview(URL.createObjectURL(f));
                    }} />
                  <button type="button" onClick={() => msgFileRef.current?.click()}
                    className="p-2 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                    <Image className="w-4 h-4" />
                  </button>
                  <input value={msgText} onChange={e => setMsgText(e.target.value)}
                    placeholder="Message…" maxLength={500}
                    className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
                  <button type="submit" disabled={sendingMsg || (!msgText.trim() && !msgPhotoFile)}
                    className="px-3 py-2 rounded-xl font-bold disabled:opacity-40"
                    style={{ background: "rgba(255,0,92,0.2)", border: "1px solid rgba(255,0,92,0.4)", color: "#ff005c" }}>
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

        {socialTab === "notifications" && (
        <div className="space-y-3">

          {/* ── Push notification opt-in card ── */}
          {push.supported && (
            <div className="rounded-2xl px-5 py-4"
              style={{ background: "rgba(8,6,18,0.9)", border: `1px solid ${push.state === "subscribed" ? "rgba(0,229,160,0.25)" : "rgba(255,255,255,0.07)"}` }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: push.state === "subscribed" ? "rgba(0,229,160,0.12)" : push.state === "denied" ? "rgba(255,0,92,0.08)" : "rgba(255,0,92,0.08)", border: `1px solid ${push.state === "subscribed" ? "rgba(0,229,160,0.3)" : "rgba(255,0,92,0.2)"}` }}>
                  {push.state === "subscribed"
                    ? <BellRing className="w-4 h-4" style={{ color: "#00e5a0" }} />
                    : push.state === "denied"
                    ? <BellOff className="w-4 h-4" style={{ color: "#ff005c" }} />
                    : <Bell className="w-4 h-4" style={{ color: "#ff005c" }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", color: "#fff" }}>
                    PUSH NOTIFICATIONS
                  </div>
                  <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>
                    {push.state === "subscribed" && "Active — you'll get OS notifications for new alerts"}
                    {push.state === "denied"     && "Blocked — allow notifications in your browser settings to enable"}
                    {push.state === "default"    && "Get notified on your phone when something happens in the league"}
                    {push.state === "granted"    && "Permission granted — tap Subscribe to finish setup"}
                    {push.state === "unsupported" && "Not supported by this browser"}
                  </div>
                </div>
                {push.state === "subscribed" ? (
                  <button
                    onClick={push.unsubscribe}
                    disabled={push.loading}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
                    style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)", fontSize: "0.6rem" }}>
                    {push.loading ? "…" : "Turn Off"}
                  </button>
                ) : push.state !== "denied" && push.state !== "unsupported" ? (
                  <button
                    onClick={push.subscribe}
                    disabled={push.loading}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90"
                    style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em", background: "#ff005c", color: "#fff", fontSize: "0.6rem" }}>
                    {push.loading ? "…" : "Enable"}
                  </button>
                ) : null}
              </div>
            </div>
          )}

          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <NotificationCenter playerId={parseInt(user.playerId)} />
          </div>
        </div>
      )}

        {socialTab === "photos" && (
        <div className="space-y-4">
          {/* Header */}
          <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
            style={{ background: "rgba(8,6,18,0.9)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.2em",
                color: "rgba(255,255,255,0.2)", textTransform: "uppercase", marginBottom: "4px" }}>
                My Photo Album
              </div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.4rem", fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                {myPhotoPosts === null ? "–" : myPhotoPosts.length}
                <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", marginLeft: "6px", fontWeight: 400 }}>
                  photo{myPhotoPosts?.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <Link href="/community"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-opacity hover:opacity-75"
              style={{ background: "rgba(255,0,92,0.08)", border: "1px solid rgba(255,0,92,0.22)",
                color: "#ff005c", fontFamily: "Oswald, sans-serif", fontSize: "0.62rem", letterSpacing: "0.1em" }}>
              <Camera className="w-3.5 h-3.5" />
              Post Photo
            </Link>
          </div>

          {/* Grid */}
          {photosLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin"
                style={{ borderTopColor: "#ff005c" }} />
            </div>
          ) : myPhotoPosts && myPhotoPosts.length === 0 ? (
            <div className="rounded-2xl flex flex-col items-center justify-center py-16 gap-3"
              style={{ background: "rgba(8,6,18,0.9)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <Camera className="w-10 h-10" style={{ color: "rgba(255,255,255,0.1)" }} />
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>
                No Photos Yet
              </div>
              <p style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.18)", textAlign: "center", maxWidth: "220px" }}>
                Share a photo on the community feed and it'll appear here
              </p>
              <Link href="/community"
                className="mt-1 px-5 py-2 rounded-xl transition-opacity hover:opacity-75"
                style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.28)",
                  color: "#ff005c", fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", letterSpacing: "0.12em" }}>
                Go to Community
              </Link>
            </div>
          ) : myPhotoPosts && myPhotoPosts.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {myPhotoPosts.map((post: any) => {
                const totalReactions = Object.values(post.reactions as Record<string, number> ?? {}).reduce((s, c) => s + Number(c), 0);
                const diff = (Date.now() - new Date(post.created_at).getTime()) / 1000;
                const age  = diff < 86400 ? `${Math.floor(diff / 3600)}h` : `${Math.floor(diff / 86400)}d`;
                return (
                  <Link key={post.id} href="/community"
                    className="relative block rounded-xl overflow-hidden group transition-transform active:scale-95"
                    style={{ aspectRatio: "1/1" }}>
                    <img
                      src={`/api/storage${post.photo_path}`}
                      alt={post.content ?? "Community photo"}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "rgba(0,0,0,0.6)" }}>
                      {totalReactions > 0 && (
                        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", color: "#fff", fontWeight: 900 }}>
                          {Object.entries(post.reactions ?? {}).map(([emoji]) => emoji).join("")} {totalReactions}
                        </div>
                      )}
                      {post.comment_count > 0 && (
                        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", color: "rgba(255,255,255,0.7)" }}>
                          {post.comment_count} comment{post.comment_count !== 1 ? "s" : ""}
                        </div>
                      )}
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>
                        {age} ago
                      </div>
                    </div>
                    {/* Always-visible reaction dot */}
                    {totalReactions > 0 && (
                      <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-full"
                        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}>
                        <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", color: "#fff", fontWeight: 700 }}>
                          {totalReactions}
                        </span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
        </div>
      )}

      {/* ── Stats Tab ─────────────────────────────────────────────── */}
      {activeTab === "stats" && user?.playerId && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <CategoryStatsEnhanced playerId={parseInt(user.playerId)} />
        </div>
      )}

      {activeTab === "analytics" && user?.playerId && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <AdvancedAnalyticsDashboard playerId={parseInt(user.playerId)} />
        </div>
      )}

      {activeTab === "cards" && user?.playerId && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <CoinBalance playerId={user.playerId} />
          <div style={{
            padding: "16px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "12px",
          }}>
            <CardCollectionBook playerId={user.playerId} />
          </div>
        </div>
      )}

      {activeTab === "challenges" && user?.playerId && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <SectionCard title="Daily & Weekly Challenges" icon={Trophy} accent="#ffd24a">
            <PlayerChallenges playerId={user.playerId} />
          </SectionCard>
        </div>
      )}

    </div>
  );
}

