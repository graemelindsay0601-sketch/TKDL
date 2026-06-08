import { Link, useLocation } from "wouter";
import { Trophy, Users, History, Medal, Shield, Plus, Target, LayoutDashboard, BookOpen, Menu, X, Swords, Dumbbell, CircuitBoard, Star, MoreHorizontal } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { useGetStatsSummary, useGetRecentActivity, useGetLeaderboard } from "@workspace/api-client-react";

const mainNav = [
  { href: "/",             label: "Hub",          icon: LayoutDashboard },
  { href: "/submit",       label: "Submit Match", icon: Plus            },
  { href: "/practice",     label: "Practice",     icon: Dumbbell        },
];
const tourNav = [
  { href: "/tour",         label: "Tour Mode",    icon: Star            },
];
const botNav = [
  { href: "/shadow-bot",   label: "Shadow Bot",   icon: CircuitBoard    },
];
const leagueNav = [
  { href: "/leaderboard",  label: "Standings",    icon: Trophy          },
  { href: "/players",      label: "Players",      icon: Users           },
  { href: "/seasons",      label: "Seasons",      icon: History         },
  { href: "/achievements", label: "Achievements", icon: Medal           },
  { href: "/rules",        label: "Rules",        icon: BookOpen        },
];
const configNav = [
  { href: "/admin",        label: "Admin",        icon: Shield          },
];

const mobileNavItems = [
  { href: "/",             label: "Hub",       icon: LayoutDashboard, color: "#0066ff"  },
  { href: "/leaderboard",  label: "Standings", icon: Trophy,          color: "#ffd24a"  },
  { href: "/play",         label: "Scorer",    icon: Swords,          color: "#ff005c"  },
  { href: "/practice",     label: "Practice",  icon: Dumbbell,        color: "#00e5a0"  },
  { href: "/tour",         label: "Tour",      icon: Star,            color: "#a855f7"  },
];

type TickerEntry = { text: string; cls?: string };

function LiveTicker() {
  const { data: summary }     = useGetStatsSummary();
  const { data: leaderboard } = useGetLeaderboard();
  const { data: recent }      = useGetRecentActivity();
  const [items, setItems]     = useState<TickerEntry[]>([]);

  useEffect(() => {
    const entries: TickerEntry[] = [];
    if (summary?.currentSeasonName) {
      entries.push({ text: `⚡ ${summary.currentSeasonName.toUpperCase()}`, cls: "accent-red" });
      entries.push({ text: `● SEASON LIVE`, cls: "accent-red" });
    }
    const top3 = leaderboard?.filter(e => e.status !== "ELIMINATED").slice(0, 3) ?? [];
    const medals = ["🥇", "🥈", "🥉"];
    top3.forEach((p, i) => {
      entries.push({ text: `${medals[i]} ${p.playerName.toUpperCase()} · ${p.points}pts`, cls: i === 0 ? "accent-gold" : undefined });
    });
    if (summary?.activePlayers) {
      entries.push({ text: `${summary.activePlayers} ACTIVE PLAYERS`, cls: "accent-blue" });
    }
    recent?.slice(0, 8).forEach((m: any) => {
      const stake = m.stake ? ` ±${m.stake}pts` : "";
      entries.push({ text: `${m.winnerName.toUpperCase()} def. ${m.loserName}${stake}` });
    });
    if (entries.length > 0) setItems(entries);
  }, [summary, leaderboard, recent]);

  if (items.length === 0) return null;
  const doubled  = [...items, ...items];
  const duration = Math.max(30, items.length * 4);

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

  const [liveScorer, setLiveScorer] = useState(false);
  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.ok ? r.json() : {})
      .then((s: Record<string, unknown>) => { if (s.live_scorer_enabled === true) setLiveScorer(true); })
      .catch(() => {});
  }, []);

  type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> };
  const dynamicMainNav: NavItem[] = liveScorer
    ? [...mainNav, { href: "/play", label: "Live Scorer", icon: Swords }]
    : mainNav;

  function NavLink({ item }: { item: NavItem }) {
    const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
    return (
      <Link href={item.href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm relative overflow-hidden ${
          isActive ? "text-white" : "text-white/30 hover:text-white/65"
        }`}
        style={isActive ? {
          background: "linear-gradient(90deg, rgba(255,0,92,0.22) 0%, rgba(255,0,92,0.04) 100%)",
          border: "1px solid rgba(255,0,92,0.2)",
          boxShadow: "0 4px 18px rgba(255,0,92,0.12), inset 0 1px 0 rgba(255,255,255,0.04)",
        } : { border: "1px solid transparent" }}>
        {isActive && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
            <div className="absolute right-0 top-0 bottom-0 w-12" style={{ background: "linear-gradient(270deg, rgba(255,0,92,0.06), transparent)" }} />
          </div>
        )}
        <div className="shrink-0 relative">
          {isActive && <div className="absolute" style={{ inset: -3, background: "rgba(255,0,92,0.45)", filter: "blur(8px)", borderRadius: "50%" }} />}
          <item.icon className="h-4 w-4 relative z-10" style={isActive ? { color: "#ff005c", filter: "drop-shadow(0 0 5px rgba(255,0,92,0.9))" } : { color: "rgba(255,255,255,0.25)" }} />
        </div>
        <span style={{ fontFamily: "Oswald, sans-serif", letterSpacing: isActive ? "0.1em" : "0.06em", fontSize: "0.82rem", fontWeight: isActive ? 700 : 400 }}>
          {item.label}
        </span>
        {isActive && (
          <div className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#ff005c", boxShadow: "0 0 6px rgba(255,0,92,1)" }} />
        )}
      </Link>
    );
  }

  function NavSection({ label, items }: { label: string; items: NavItem[] }) {
    return (
      <div>
        <div className="px-3 mb-1">
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.47rem", letterSpacing: "0.22em", color: "rgba(255,255,255,0.15)", textTransform: "uppercase" }}>
            {label}
          </span>
        </div>
        <div className="space-y-0.5">
          {items.map(item => <NavLink key={item.href} item={item} />)}
        </div>
      </div>
    );
  }

  const SidebarInner = () => (
    <>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{ position: "absolute", top: -80, left: -80, width: 300, height: 300, background: "radial-gradient(circle, rgba(255,0,92,0.22) 0%, transparent 60%)" }} />
        <div style={{ position: "absolute", bottom: 60, right: -60, width: 200, height: 200, background: "radial-gradient(circle, rgba(0,102,255,0.07) 0%, transparent 60%)" }} />
      </div>

      {/* Logo */}
      <div className="relative px-5 pt-6 pb-4" style={{ borderBottom: "1px solid rgba(255,0,92,0.2)" }}>
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg, #ff005c 0%, rgba(255,0,92,0.5) 55%, transparent 100%)" }} />
        <div className="flex items-center gap-2.5 mb-0.5">
          <div className="relative shrink-0 target-icon-wrap cursor-default">
            <div className="absolute" style={{ inset: -6, background: "rgba(255,0,92,0.55)", filter: "blur(12px)", borderRadius: "50%" }} />
            <div className="absolute" style={{ inset: -2, background: "rgba(255,0,92,0.2)", filter: "blur(4px)", borderRadius: "50%" }} />
            <Target className="h-6 w-6 relative z-10 target-icon" style={{ color: "#ff005c", filter: "drop-shadow(0 0 4px rgba(255,0,92,1))" }} />
          </div>
          <div className="flex flex-col" style={{ lineHeight: 1 }}>
            <span className="tkdl-logo" style={{ fontFamily: "Oswald, sans-serif", fontSize: "2.2rem", fontWeight: 900, letterSpacing: "0.25em", color: "#fff" }}>
              TKDL
            </span>
          </div>
        </div>
        <p style={{ color: "rgba(255,255,255,0.18)", letterSpacing: "0.15em", fontSize: "0.47rem", fontFamily: "Oswald, sans-serif", textTransform: "uppercase", paddingLeft: "1.85rem", marginBottom: "0.8rem" }}>
          Tesco Kilbirnie Darts League
        </p>
        <div className="flex items-center gap-2.5 pl-1">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{ background: "rgba(255,0,92,0.12)", border: "1px solid rgba(255,0,92,0.25)" }}>
            <span className="live-dot" style={{ width: 5, height: 5 }} />
            <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", color: "#ff005c", fontWeight: 800, letterSpacing: "0.12em" }}>LIVE</span>
          </div>
          {summary && <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>{summary.activePlayers ?? summary.totalPlayers} active</span>}
          {eliminated > 0 && <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", color: "#ff005c", fontWeight: 700 }}>☠ {eliminated}</span>}
        </div>
      </div>

      {/* Season leader mini-card */}
      {leader && (
        <Link href={`/players/${leader.playerId}`}>
          <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl cursor-pointer transition-opacity hover:opacity-80"
            style={{ background: "linear-gradient(135deg, rgba(255,210,74,0.12) 0%, rgba(255,210,74,0.03) 100%)", border: "1px solid rgba(255,210,74,0.22)", boxShadow: "0 4px 16px rgba(255,210,74,0.04)" }}>
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.47rem", letterSpacing: "0.2em", color: "rgba(255,210,74,0.45)", textTransform: "uppercase", marginBottom: "0.3rem" }}>
              🏆 Season Leader
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
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
          </div>
        </Link>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3">
        <NavSection label="Main"   items={dynamicMainNav}   />
        <div className="h-px mx-2" style={{ background: "rgba(255,255,255,0.05)" }} />
        <NavSection label="Tour"   items={tourNav} />
        <div className="h-px mx-2" style={{ background: "rgba(255,255,255,0.05)" }} />
        <NavSection label="Bot"    items={botNav} />
        <div className="h-px mx-2" style={{ background: "rgba(255,255,255,0.05)" }} />
        <NavSection label="League" items={leagueNav} />
        <div className="h-px mx-2" style={{ background: "rgba(255,255,255,0.05)" }} />
        <NavSection label="Config" items={configNav} />
      </nav>

      {/* Footer — season countdown */}
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
    </>
  );

  return (
    <div className="flex h-dvh text-foreground overflow-hidden" style={{ position: "relative" }}>
      <div className="ambient-blob-red" />
      <div className="ambient-blob-blue" />

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setDrawerOpen(false)}
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
      )}

      <aside className={`
        fixed md:relative inset-y-0 left-0 z-50
        w-64 md:w-56 flex flex-col shrink-0
        transition-transform duration-300 ease-in-out
        ${drawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}
        style={{ background: "rgba(3,3,8,0.99)", borderRight: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(24px)" }}>
        <button className="absolute top-4 right-4 md:hidden z-10 p-1 rounded-lg"
          style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)" }}
          onClick={() => setDrawerOpen(false)}>
          <X className="w-4 h-4" />
        </button>
        <SidebarInner />
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 shrink-0"
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

        <main className="flex-1 overflow-y-auto pb-20 md:pb-10" style={{ position: "relative", zIndex: 1 }}>
          <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      <LiveTicker />

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex"
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
              <item.icon className="w-5 h-5" style={{ color: isActive ? col : "rgba(255,255,255,0.28)", filter: isActive ? `drop-shadow(0 0 6px ${col})` : "none", transition: "color 0.15s, filter 0.15s" }} />
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.08em", fontWeight: isActive ? 700 : 400, color: isActive ? col : "rgba(255,255,255,0.28)", transition: "color 0.15s" }}>
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
          <Menu className="w-5 h-5" style={{ color: drawerOpen ? "#ffffff" : "rgba(255,255,255,0.28)", filter: drawerOpen ? "drop-shadow(0 0 6px rgba(255,255,255,0.7))" : "none", transition: "color 0.15s" }} />
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.08em", fontWeight: drawerOpen ? 700 : 400, color: drawerOpen ? "#ffffff" : "rgba(255,255,255,0.28)", transition: "color 0.15s" }}>
            More
          </span>
        </button>
      </nav>
    </div>
  );
}
