import { Link, useLocation } from "wouter";
import { Trophy, Users, History, Medal, Shield, Plus, Target, LayoutDashboard, BookOpen, Menu, X, Swords, Dumbbell, CircuitBoard, Star, Award, UserCircle, LogIn, MessageSquare, Bell, Skull, Flame, Tv, Sparkles, ChevronLeft } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { useGetStatsSummary, useGetLeaderboard } from "@workspace/api-client-react";
import { useAuth } from "@/context/auth";
import { useSettings } from "@/hooks/use-settings";
import { NotificationOptInPrompt } from "@/components/NotificationOptInPrompt";

const hubNav = [
  { href: "/",             label: "Hub",          icon: LayoutDashboard },
];
const communityNav = [
  { href: "/community",    label: "Community",    icon: MessageSquare   },
];
const playNav = [
  { href: "/submit",       label: "Submit Match", icon: Plus            },
];
const practiceNav = [
  { href: "/practice",     label: "Practice",     icon: Dumbbell        },
];
const tourModeNav = [
  { href: "/tour",         label: "Tour Mode",    icon: Star            },
];
const master501Nav = [
  { href: "/master501",    label: "Master-501",   icon: Target          },
];
const botNav = [
  { href: "/shadow-bot",   label: "Shadow Bot",   icon: CircuitBoard    },
  { href: "/shadow-league", label: "Shadow League", icon: Trophy        },
];
const cardClashNav = [
  { href: "/card-clash",   label: "Card Clash",   icon: Medal           },
];
const bossBattleNav = [
  { href: "/boss-battle",  label: "Boss Battle",  icon: Skull           },
];
const boardCurseNav = [
  { href: "/board-curse",  label: "Board Curse",  icon: Flame           },
];
// Beta — gated behind the tkdl_live feature flag (see routes/broadcast.ts).
// Shown in the nav once an admin flips it live for everyone, or always to
// an admin session so they can reach the preview before that.
const tkdlLiveNav = [
  { href: "/tkdl-live",   label: "TKDL LIVE",    icon: Sparkles        },
];
const leagueNav = [
  { href: "/leaderboard",  label: "Standings",    icon: Trophy          },
  { href: "/players",      label: "Players",      icon: Users           },
  // Full head-to-head comparison view (see pages/head-to-head.tsx, routed at
  // /h2h in App.tsx — not /head-to-head, which this link pointed at until
  // now and which 404'd since no such route is registered). Same situation
  // /broadcast was in below: a fully working route reachable only via a
  // buried link on a player's match-history row, with no way to find it
  // from the nav.
  { href: "/h2h",           label: "Head to Head", icon: Swords          },
  { href: "/seasons",      label: "Seasons",      icon: History         },
  { href: "/hall-of-fame", label: "Hall of Fame", icon: Award           },
  { href: "/rules",        label: "Rules",        icon: BookOpen        },
  // Full-screen spectator/TV view (see pages/broadcast.tsx) — was a fully
  // working route with no link anywhere in the app, so nobody could find it
  // outside of typing the URL directly.
  { href: "/broadcast",    label: "Broadcast",    icon: Tv              },
];

const achievementsNav = [
  { href: "/achievements", label: "Achievements", icon: Medal           },
];
const configNav = [
  { href: "/admin",        label: "Admin",        icon: Shield          },
];

const mobileNavItems = [
  { href: "/",             label: "Hub",        icon: LayoutDashboard, color: "#0066ff"  },
  { href: "/leaderboard",  label: "Standings",  icon: Trophy,          color: "#ffd24a"  },
  { href: "/achievements", label: "Achievements", icon: Medal,          color: "#a855f7"  },
  { href: "/practice",     label: "Practice",   icon: Dumbbell,        color: "#00e5a0"  },
  { href: "/tour",         label: "Tour",       icon: Star,            color: "#a855f7"  },
];

type TickerEntry = { text: string; cls?: string };

const ACCENT_CLS: Record<string, string> = {
  red:    "accent-red",
  gold:   "accent-gold",
  purple: "accent-purple",
  blue:   "accent-blue",
  green:  "accent-green",
};

function LiveTicker() {
  const { data: summary }     = useGetStatsSummary();
  const { data: leaderboard } = useGetLeaderboard();
  const [items, setItems]     = useState<TickerEntry[]>([]);
  const [feed, setFeed]       = useState<{ text: string; accent: string }[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch("/api/stats/live-feed")
        .then(r => r.ok ? r.json() : [])
        .then((data: { text: string; accent: string }[]) => { if (alive) setFeed(data); })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    const entries: TickerEntry[] = [];

    if (summary?.currentSeasonName) {
      entries.push({ text: `⚡ ${summary.currentSeasonName.toUpperCase()}`, cls: "accent-red" });
    }
    const top3 = leaderboard?.filter(e => e.status !== "ELIMINATED").slice(0, 3) ?? [];
    const medals = ["🥇", "🥈", "🥉"];
    top3.forEach((p, i) => {
      entries.push({ text: `${medals[i]} ${p.playerName.toUpperCase()} · ${p.points}pts`, cls: i === 0 ? "accent-gold" : undefined });
    });

    for (const item of feed) {
      entries.push({ text: item.text, cls: ACCENT_CLS[item.accent] });
    }

    if (entries.length > 0) setItems(entries);
  }, [summary, leaderboard, feed]);

  if (items.length === 0) return null;
  const doubled  = [...items, ...items];
  const duration = Math.max(40, items.length * 5);

  return (
    <div className="ticker-bar">
      <div className="ticker-label">LIVE</div>
      <div className="ticker-scroll-wrap">
        <div className="ticker-track" style={{ "--ticker-duration": `${duration}s` } as React.CSSProperties}>
          {doubled.map((item, i) => (
            <span key={i} className={`ticker-item ${item.cls ?? ""}`}>
              {item.text}<span className="ticker-sep">◆</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccountWidget({ unreadCount = 0, collapsed = false }: { unreadCount?: number; collapsed?: boolean }) {
  // No `loading` gate here on purpose — `user` is seeded from a cached copy
  // of the last confirmed session (see context/auth.tsx) so this renders
  // its real content on the very first paint instead of blanking out and
  // popping in a moment later once /api/auth/me resolves. If the session
  // actually changed since the cache was written, refresh() corrects
  // `user` and this re-renders — same as any other optimistic UI.
  const { user } = useAuth();
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      {user ? (
        <Link href="/account"
          className={`flex items-center gap-2.5 mx-2 my-1.5 px-3 py-2 rounded-xl transition-colors hover:bg-white/5 ${collapsed ? "justify-center px-2" : ""}`}
          style={{ background: "rgba(255,0,92,0.06)", border: "1px solid rgba(255,0,92,0.12)" }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 relative"
            style={{ background: "rgba(255,0,92,0.18)", border: "1px solid rgba(255,0,92,0.3)" }}>
            <UserCircle className="w-4 h-4" style={{ color: "#ff005c" }} />
            {unreadCount > 0 && (
              <div className={`absolute rounded-full flex items-center justify-center text-white font-black ${collapsed ? "-top-0.5 -right-0.5 w-2.5 h-2.5" : "-top-1 -right-1 w-4 h-4"}`}
                style={{ background: "#ff005c", fontSize: "0.45rem", fontFamily: "Oswald, sans-serif", border: "1.5px solid #0a0612", zIndex: 10 }}>
                {!collapsed && (unreadCount > 9 ? "9+" : unreadCount)}
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.75rem", fontWeight: 700, color: "#fff", letterSpacing: "0.04em", lineHeight: 1.2 }} className="truncate">
                {user.playerName}
              </div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em" }} className="truncate">
                @{user.username}{user.isAdmin ? " · Admin" : ""}
              </div>
            </div>
          )}
          {!collapsed && unreadCount > 0 && (
            <Bell className="w-3.5 h-3.5 shrink-0 animate-pulse" style={{ color: "#ff005c" }} />
          )}
        </Link>
      ) : (
        <Link href="/login"
          className={`flex items-center gap-2 mx-2 my-1.5 px-3 py-2 rounded-xl transition-opacity hover:opacity-70 ${collapsed ? "justify-center px-2" : ""}`}
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <LogIn className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
          {!collapsed && (
            <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" }}>
              Sign In
            </span>
          )}
        </Link>
      )}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location]                  = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: summary }           = useGetStatsSummary();
  const { data: leaderboard }       = useGetLeaderboard();
  const eliminated                  = (summary as any)?.eliminatedCount ?? 0;

  const now         = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft    = daysInMonth - now.getDate();
  const monthPct    = Math.round((now.getDate() / daysInMonth) * 100);
  const leader      = leaderboard?.filter(e => e.status !== "ELIMINATED")[0] ?? null;

  useEffect(() => { setDrawerOpen(false); }, [location]);

  const { user: authUser }              = useAuth();
  const { data: appSettings }           = useSettings();
  const liveScorer       = appSettings?.live_scorer_enabled ?? false;
  const communityEnabled = appSettings?.community_enabled   ?? false;
  const cardClashEnabled = appSettings?.card_clash_enabled  ?? false;
  const bossBattleEnabled = appSettings?.boss_battle_enabled ?? false;
  const boardCurseEnabled = appSettings?.board_curse_enabled ?? false;
  const tkdlLiveEnabled  = appSettings?.tkdl_live_enabled   ?? false;
  const [unreadCount, setUnreadCount]   = useState(0);
  useEffect(() => {
    if (!authUser) return;
    const load = () => {
      fetch("/api/notifications/unread-count", { credentials: "include" })
        .then(r => r.ok ? r.json() : { count: 0 })
        .then((d: { count: number }) => setUnreadCount(d.count))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [authUser]);

  // Community nav badge — unread count scoped to community-flavoured
  // notification types only (post_approved/post_liked/post_commented/
  // auto_post_fired), separate from the account widget's all-types count above.
  const [communityUnread, setCommunityUnread] = useState(0);
  useEffect(() => {
    if (!authUser) return;
    const load = () => {
      fetch("/api/notifications/unread-count?types=post_approved,post_liked,post_commented,auto_post_fired", { credentials: "include" })
        .then(r => r.ok ? r.json() : { count: 0 })
        .then((d: { count: number }) => setCommunityUnread(d.count))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [authUser]);

  // TKDL LIVE nav badge — lights up when a broadcast edition has published
  // since this player last opened /tkdl-live (see GET /broadcast/live-status
  // and the mark-seen call in pages/tkdl-live.tsx).
  const [hasNewEdition, setHasNewEdition] = useState(false);
  useEffect(() => {
    if (!authUser || !(tkdlLiveEnabled || authUser?.isAdmin)) return;
    const load = () => {
      fetch("/api/broadcast/live-status", { credentials: "include" })
        .then(r => r.ok ? r.json() : { hasNewEdition: false })
        .then((d: { hasNewEdition: boolean }) => setHasNewEdition(d.hasNewEdition))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [authUser, tkdlLiveEnabled]);

  // Desktop-only rail collapse — remembered per browser, never applies to
  // the mobile drawer (see .sidebar-rail.collapsed's min-width guard).
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("tkdl-sidebar-collapsed") === "1"); } catch { /* ignore */ }
  }, []);
  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("tkdl-sidebar-collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  // Single shared tooltip for collapsed-mode nav items — a fixed-position
  // element positioned via getBoundingClientRect on hover/focus, rather than
  // one per item, so it isn't clipped by <nav>'s own overflow-y:auto (which
  // also clips the x-axis — see the .nav-edge-fade comment in index.css).
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);

  type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> };
  const dynamicPlayNav: NavItem[] = liveScorer
    ? [...playNav, { href: "/play", label: "Match Scorer", icon: Swords }]
    : playNav;
  const dynamicBotNav: NavItem[] = botNav;
  const dynamicCardClashNav: NavItem[] = cardClashEnabled ? cardClashNav : [];
  const dynamicBossBattleNav: NavItem[] = bossBattleEnabled ? bossBattleNav : [];
  const dynamicBoardCurseNav: NavItem[] = boardCurseEnabled ? boardCurseNav : [];
  // Visible once live for everyone, or always to an admin session (so they
  // can reach the preview screen while it's still being built) — same
  // "enabled OR admin" shape as the Community section just above.
  const dynamicTkdlLiveNav: NavItem[] = (tkdlLiveEnabled || authUser?.isAdmin) ? tkdlLiveNav : [];

  // One accent colour per nav section, reused for its label dot, its items'
  // active-icon chip, and any badge on those items — the colour pass the
  // desktop sidebar preview was approved on. Card Clash keeps its own
  // established brand orange like every other section; it's not muted here
  // — Card Clash itself is on hold, but colouring its nav row the same way
  // as the rest isn't a change to the feature, just to this row's paint.
  const NAV_SECTIONS: Array<{ key: string; label: string; items: NavItem[]; color: string; show: boolean }> = [
    { key: "hub",          label: "Hub",          items: hubNav,               color: "#0066ff", show: true },
    { key: "community",    label: "Community",    items: communityNav,         color: "#22c55e", show: communityEnabled || !!authUser?.isAdmin },
    { key: "play",         label: "Play",         items: dynamicPlayNav,       color: "#ff005c", show: dynamicPlayNav.length > 0 },
    { key: "practice",     label: "Practice",     items: practiceNav,          color: "#00e5a0", show: true },
    { key: "tour",         label: "Tour Mode",    items: tourModeNav,          color: "#6366f1", show: true },
    { key: "master501",    label: "Master 501",   items: master501Nav,         color: "#00c8a0", show: true },
    { key: "bot",          label: "Bot",          items: dynamicBotNav,        color: "#22d3ee", show: dynamicBotNav.length > 0 },
    { key: "cardclash",    label: "Card Clash",   items: dynamicCardClashNav,  color: "#f97316", show: dynamicCardClashNav.length > 0 },
    { key: "bossbattle",   label: "Boss Battle",  items: dynamicBossBattleNav, color: "#ef4444", show: dynamicBossBattleNav.length > 0 },
    { key: "boardcurse",   label: "Board Curse",  items: dynamicBoardCurseNav, color: "#eab308", show: dynamicBoardCurseNav.length > 0 },
    { key: "tkdllive",     label: "TKDL LIVE",    items: dynamicTkdlLiveNav,   color: "#ffd24a", show: dynamicTkdlLiveNav.length > 0 },
    { key: "league",       label: "League",       items: leagueNav,            color: "#38bdf8", show: true },
    { key: "achievements", label: "Achievements", items: achievementsNav,      color: "#8b5cf6", show: true },
    { key: "admin",        label: "Admin",        items: configNav,            color: "#8a8a94", show: !!authUser?.isAdmin },
  ];

  function NavLink({ item, color, sectionIndex, itemIndex }: { item: NavItem; color: string; sectionIndex: number; itemIndex: number }) {
    const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
    const badge: "dot" | number | undefined =
      item.href === "/tkdl-live" ? (hasNewEdition ? "dot" : undefined) :
      item.href === "/community" ? (communityUnread > 0 ? communityUnread : undefined) :
      undefined;
    const delayMs = 150 + sectionIndex * 45 + 20 + itemIndex * 14;

    const showTip = (e: React.FocusEvent | React.MouseEvent) => {
      if (!collapsed) return;
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setTooltip({ label: item.label, x: r.right + 10, y: r.top + r.height / 2 });
    };
    const hideTip = () => setTooltip(null);

    return (
      <Link href={item.href}
        className={`nav-item sidebar-fade-in flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-200 text-sm relative ${
          isActive ? "active text-white" : "text-white/60 hover:text-white"
        } ${collapsed ? "justify-center px-2" : ""}`}
        style={{ "--c": color, animationDelay: `${delayMs}ms` } as React.CSSProperties}
        onMouseEnter={showTip} onMouseLeave={hideTip} onFocus={showTip} onBlur={hideTip}>
        <div className="nav-item-icon shrink-0 relative flex items-center justify-center rounded-lg" style={{ width: "1.65rem", height: "1.65rem" }}>
          <item.icon className="h-4 w-4 relative z-10" style={{ color: isActive ? "#0a0a10" : color, opacity: isActive ? 1 : 0.68 }} />
          {badge === "dot" && <span className="nav-item-badge-dot absolute" style={{ "--c": color, top: -2, right: -2 } as React.CSSProperties} />}
        </div>
        {!collapsed && (
          <span style={{ fontFamily: "Oswald, sans-serif", letterSpacing: isActive ? "0.06em" : "0.03em", fontSize: "0.82rem", fontWeight: isActive ? 700 : 400 }}>
            {item.label}
          </span>
        )}
        {!collapsed && typeof badge === "number" && (
          <span className="ml-auto shrink-0 rounded-full flex items-center justify-center font-black"
            style={{ minWidth: 16, height: 16, padding: "0 4.5px", fontSize: "0.5rem", color: "#0a0a10", background: color, boxShadow: `0 0 7px color-mix(in srgb, ${color} 55%, transparent)` }}>
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </Link>
    );
  }

  function NavSection({ label, items, color, sectionIndex }: { label: string; items: NavItem[]; color: string; sectionIndex: number }) {
    return (
      <div>
        <div className={`px-3 mb-1 flex items-center gap-1.5 sidebar-fade-in ${collapsed ? "justify-center px-0" : ""}`}
          style={{ animationDelay: `${150 + sectionIndex * 45}ms` } as React.CSSProperties}>
          <span className="nav-section-dot shrink-0" style={{ "--c": color, width: 5, height: 5, borderRadius: "50%" } as React.CSSProperties} />
          {!collapsed && (
            <span className="nav-section-label" style={{ "--c": color, fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.15em", fontWeight: 700, textTransform: "uppercase" } as React.CSSProperties}>
              {label}
            </span>
          )}
        </div>
        <div className="space-y-0.5">
          {items.map((item, i) => <NavLink key={item.href} item={item} color={color} sectionIndex={sectionIndex} itemIndex={i} />)}
        </div>
      </div>
    );
  }

  const visibleNavSections = NAV_SECTIONS.filter(s => s.show && s.items.length > 0);

  const SidebarInner = () => (
    <>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{ position: "absolute", top: -80, left: -80, width: 300, height: 300, background: "radial-gradient(circle, rgba(255,0,92,0.22) 0%, transparent 60%)" }} />
        <div style={{ position: "absolute", bottom: 60, right: -60, width: 200, height: 200, background: "radial-gradient(circle, rgba(0,102,255,0.07) 0%, transparent 60%)" }} />
      </div>

      {/* Logo */}
      <div className={`relative sidebar-fade-in ${collapsed ? "flex flex-col items-center px-2 pt-6 pb-4" : "px-5 pt-6 pb-4"}`}
        style={{ borderBottom: "1px solid rgba(255,0,92,0.2)" }}>
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg, #ff005c 0%, rgba(255,0,92,0.5) 55%, transparent 100%)" }} />
        <div className={`flex items-center gap-3 ${collapsed ? "mb-2" : "mb-1.5"}`}>
          <div className="relative shrink-0 cursor-default">
            <div className="absolute" style={{ inset: -4, background: "rgba(255,0,92,0.3)", filter: "blur(12px)", borderRadius: "0.7rem" }} />
            <img src="/icon-192.png" alt="TKDL" className="relative z-10" style={{ width: "3.2rem", height: "3.2rem", borderRadius: "0.6rem", objectFit: "cover" }} />
          </div>
          {!collapsed && (
            <p style={{ fontFamily: "'Montserrat', sans-serif", textTransform: "uppercase", lineHeight: 1.2, marginBottom: 0, letterSpacing: "0.04em" }}>
              <span style={{ display: "block", fontSize: "1rem", fontWeight: 900, color: "#00539F", fontFamily: "'Nunito', sans-serif", letterSpacing: "-0.01em" }}>Tesco</span>
              <span style={{ display: "block", fontSize: "0.85rem", fontWeight: 900, color: "#EE1C25" }}>Kilbirnie</span>
              <span style={{ display: "block", fontSize: "0.7rem", fontWeight: 800, color: "rgba(255,255,255,0.9)", letterSpacing: "0.1em" }}>Darts League</span>
            </p>
          )}
        </div>
        <div className={`flex items-center gap-2.5 ${collapsed ? "" : "pl-1"}`}>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: "rgba(255,0,92,0.12)", border: "1px solid rgba(255,0,92,0.25)" }}>
            <span className="live-dot" style={{ width: 5, height: 5 }} />
            {!collapsed && <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", color: "#ff005c", fontWeight: 800, letterSpacing: "0.12em" }}>LIVE</span>}
          </div>
          {!collapsed && summary && <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>{summary.activePlayers ?? summary.totalPlayers} active</span>}
          {!collapsed && eliminated > 0 && <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", color: "#ff005c", fontWeight: 700 }}>☠ {eliminated}</span>}
        </div>
      </div>

      {/* Season leader mini-card */}
      {leader && (
        <Link href={`/players/${leader.playerId}`}>
          <div className={`sidebar-fade-in mt-3 rounded-xl cursor-pointer transition-opacity hover:opacity-80 ${collapsed ? "mx-2 px-2 py-2 flex flex-col items-center" : "mx-3 px-3 py-2.5"}`}
            style={{ animationDelay: "70ms", background: "linear-gradient(135deg, rgba(255,210,74,0.12) 0%, rgba(255,210,74,0.03) 100%)", border: "1px solid rgba(255,210,74,0.22)", boxShadow: "0 4px 16px rgba(255,210,74,0.04)" } as React.CSSProperties}>
            {collapsed ? (
              <>
                <div style={{ fontSize: "0.8rem" }}>🏆</div>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", fontWeight: 900, color: "#ff005c", lineHeight: 1, textShadow: "0 0 12px rgba(255,0,92,0.55)" }}>
                  {leader.points}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.47rem", letterSpacing: "0.2em", color: "rgba(255,210,74,0.45)", textTransform: "uppercase", marginBottom: "0.3rem" }}>
                    🏆 Season Leader
                  </div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.88rem", fontWeight: 800, color: "#ffd24a", letterSpacing: "0.04em", lineHeight: 1.1 }} className="truncate">
                    {leader.playerName}
                  </div>
                  <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.28)", marginTop: 2 }}>
                    {leader.wins}W–{leader.losses}L · ELO {leader.elo}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.55rem", fontWeight: 900, color: "#ff005c", lineHeight: 1, textShadow: "0 0 14px rgba(255,0,92,0.6)" }}>
                    {leader.points}
                  </div>
                  <div style={{ fontSize: "0.5rem", color: "rgba(255,255,255,0.22)", lineHeight: 1 }}>pts</div>
                </div>
              </div>
            )}
          </div>
        </Link>
      )}

      {/* Navigation — one accent colour per section, see NAV_SECTIONS above */}
      <nav className="nav-edge-fade flex-1 overflow-y-auto py-3 px-2 space-y-2">
        {visibleNavSections.map((section, si) => (
          <div key={section.key}>
            <NavSection label={section.label} items={section.items} color={section.color} sectionIndex={si} />
            {si < visibleNavSections.length - 1 && (
              <div className="h-px mx-2 mt-2" style={{ background: "rgba(255,255,255,0.05)" }} />
            )}
          </div>
        ))}
      </nav>

      {/* Account widget */}
      <AccountWidget unreadCount={unreadCount} collapsed={collapsed} />

      {/* Footer — season countdown. Skipped entirely when collapsed: nothing
          here is essential to icon-only navigation, and there isn't room to
          show it meaningfully at 66px. */}
      {!collapsed && (
        <div className="relative px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center justify-between mb-1.5">
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", color: "rgba(255,0,92,0.65)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {summary?.currentSeasonName ?? "Season"}
            </div>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", color: "rgba(255,255,255,0.28)" }}>{daysLeft}d left</div>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${monthPct}%`, background: "linear-gradient(90deg, #ff005c, rgba(255,0,92,0.45))", borderRadius: 2 }} />
          </div>
          <div style={{ color: "rgba(255,255,255,0.1)", fontSize: "0.47rem", marginTop: "0.3rem", fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em" }}>
            PDC-STYLE WAGER LEAGUE
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-dvh text-foreground overflow-hidden" style={{ position: "relative" }}>
      <div className="ambient-blob-red" />
      <div className="ambient-blob-blue" />

      {/* Overlay — tablet/mobile drawer backdrop */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setDrawerOpen(false)}
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
      )}

      {/* Sidebar — hidden off-screen on tablet/mobile, permanent on desktop (≥1024px) */}
      <aside className={`
        sidebar-rail ${collapsed ? "collapsed" : ""}
        fixed lg:relative inset-y-0 left-0 z-50
        w-64 lg:w-56 flex flex-col shrink-0
        transition-transform duration-300 ease-in-out
        ${drawerOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
        style={{ background: "rgba(3,3,8,0.99)", borderRight: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(24px)" }}>
        <button className="absolute top-4 right-4 lg:hidden z-10 p-1 rounded-lg"
          style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)" }}
          onClick={() => setDrawerOpen(false)}>
          <X className="w-4 h-4" />
        </button>
        {/* Collapse toggle — desktop only; the mobile drawer is a full-width
            overlay where an icon-only mode doesn't make sense. */}
        <button className="sidebar-collapse-btn hidden lg:flex"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleCollapsed}>
          <ChevronLeft className="w-3 h-3" />
        </button>
        <SidebarInner />
      </aside>

      {/* Shared tooltip for collapsed-mode nav items (see NavLink's showTip) */}
      {tooltip && (
        <div className="sidebar-tooltip show" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.label}
        </div>
      )}

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Top bar — visible on tablet/mobile (<1024px) */}
        <header className="lg:hidden flex items-center justify-between px-4 shrink-0"
          style={{ height: "3.25rem", background: "rgba(4,4,10,0.95)", borderBottom: "1px solid rgba(255,255,255,0.07)", zIndex: 20 }}>
          <button onClick={() => setDrawerOpen(true)} className="p-2 rounded-lg transition-colors"
            style={{ color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.04)" }}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/icon-192.png" alt="TKDL" style={{ width: "2rem", height: "2rem", borderRadius: "0.4rem", objectFit: "cover" }} />
            <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.3rem", fontWeight: 800, letterSpacing: "0.2em", color: "#fff", textShadow: "0 0 20px rgba(255,0,60,0.5)" }}>
              TKDL
            </span>
          </div>
          <div style={{ width: "2.5rem" }} />
        </header>

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-10" style={{ position: "relative", zIndex: 1 }}>
          <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      <LiveTicker />

      <NotificationOptInPrompt />

      {/* Bottom nav — tablet/mobile only (<1024px) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex"
        style={{ background: "rgba(4,4,10,0.97)", borderTop: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {mobileNavItems.map(item => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          const col = item.color;
          return (
            <Link key={item.href} href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors duration-150 relative"
              style={{ WebkitTapHighlightColor: "transparent", outline: "none" }}>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full" style={{ background: col, boxShadow: `0 0 8px ${col}` }} />
              )}
              <item.icon className="w-5 h-5" style={{ color: isActive ? col : "rgba(255,255,255,0.5)", filter: isActive ? `drop-shadow(0 0 6px ${col})` : "none", transition: "color 0.15s, filter 0.15s" }} />
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.08em", fontWeight: isActive ? 700 : 400, color: isActive ? col : "rgba(255,255,255,0.5)", transition: "color 0.15s" }}>
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors duration-150 relative"
          style={{ WebkitTapHighlightColor: "transparent", outline: "none", background: "none", border: "none" }}
          onClick={() => setDrawerOpen(true)}>
          {drawerOpen && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full" style={{ background: "#ffffff", boxShadow: "0 0 8px rgba(255,255,255,0.6)" }} />
          )}
          <Menu className="w-5 h-5" style={{ color: drawerOpen ? "#ffffff" : "rgba(255,255,255,0.5)", filter: drawerOpen ? "drop-shadow(0 0 6px rgba(255,255,255,0.7))" : "none", transition: "color 0.15s" }} />
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.08em", fontWeight: drawerOpen ? 700 : 400, color: drawerOpen ? "#ffffff" : "rgba(255,255,255,0.5)", transition: "color 0.15s" }}>
            More
          </span>
        </button>
      </nav>
    </div>
  );
}
