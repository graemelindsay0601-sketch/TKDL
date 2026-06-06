import { Link, useLocation } from "wouter";
import { Trophy, Users, History, Medal, Shield, Plus, Target, LayoutDashboard, BookOpen, Menu, X } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { useGetStatsSummary, useGetRecentActivity, useGetLeaderboard } from "@workspace/api-client-react";

const navItems = [
  { href: "/",             label: "Dashboard",    icon: LayoutDashboard },
  { href: "/leaderboard",  label: "Leaderboard",  icon: Trophy          },
  { href: "/submit",       label: "Submit Match", icon: Plus            },
  { href: "/players",      label: "Players",      icon: Users           },
  { href: "/seasons",      label: "Seasons",      icon: History         },
  { href: "/achievements", label: "Achievements", icon: Medal           },
  { href: "/rules",        label: "Rules",        icon: BookOpen        },
  { href: "/admin",        label: "Admin",        icon: Shield          },
];

const mobileNavItems = [
  { href: "/",             label: "Home",     icon: LayoutDashboard },
  { href: "/leaderboard",  label: "Standings",icon: Trophy          },
  { href: "/submit",       label: "Submit",   icon: Plus            },
  { href: "/players",      label: "Players",  icon: Users           },
  { href: "/achievements", label: "Awards",   icon: Medal           },
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
    <div className="ticker-bar hidden md:flex">
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
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: summary } = useGetStatsSummary();
  const eliminated = (summary as any)?.eliminatedCount ?? 0;

  useEffect(() => { setDrawerOpen(false); }, [location]);

  function NavLink({ item }: { item: typeof navItems[0] }) {
    const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
    return (
      <Link href={item.href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium relative overflow-hidden ${
          isActive ? "text-white" : "text-white/30 hover:text-white/65 hover:bg-white/[0.04]"
        }`}
        style={isActive ? {
          background: "linear-gradient(90deg, rgba(255,0,92,0.22) 0%, rgba(255,0,92,0.05) 100%)",
          borderLeft: "3px solid #ff005c", paddingLeft: "9px",
          boxShadow: "0 4px 20px rgba(255,0,92,0.12)",
        } : { borderLeft: "3px solid transparent" }}>
        {isActive && <div className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none" style={{ background: "linear-gradient(270deg, rgba(255,0,92,0.07), transparent)" }} />}
        <item.icon className="h-3.5 w-3.5 shrink-0" style={isActive ? { color: "#ff005c", filter: "drop-shadow(0 0 6px rgba(255,0,92,0.8))" } : {}} />
        <span style={{ fontFamily: "Oswald, sans-serif", letterSpacing: isActive ? "0.1em" : "0.06em", fontSize: "0.8rem", fontWeight: isActive ? 600 : 400 }}>
          {item.label}
        </span>
      </Link>
    );
  }

  const SidebarInner = () => (
    <>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 200px 280px at -30px 20px, rgba(255,0,92,0.15) 0%, transparent 70%)" }} />
      <div className="relative px-5 pt-7 pb-5" style={{ borderBottom: "2px solid rgba(255,0,92,0.5)" }}>
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg, #ff005c 0%, rgba(255,0,92,0.4) 70%, transparent 100%)" }} />
        <div className="flex items-center gap-2.5 mb-1">
          <div className="relative shrink-0">
            <Target className="h-5 w-5 relative z-10" style={{ color: "#ff005c" }} />
            <div className="absolute inset-0 blur-lg" style={{ background: "rgba(255,0,92,0.6)" }} />
          </div>
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "34px", fontWeight: 800, letterSpacing: "0.2em", color: "#ffffff", textShadow: "0 0 24px rgba(255,0,60,0.6)", lineHeight: 1 }}>
            TKDL
          </span>
        </div>
        <p style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "0.16em", fontSize: "0.5rem", fontFamily: "Oswald, sans-serif", textTransform: "uppercase", marginTop: "4px" }}>
          Tesco Kilbirnie Darts League
        </p>
        {summary && (
          <div className="mt-3 flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              <span className="live-dot" />{summary.activePlayers ?? summary.totalPlayers} active
            </span>
            {eliminated > 0 && (
              <span className="font-black text-xs" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                ☠ {eliminated}
              </span>
            )}
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(item => <NavLink key={item.href} item={item} />)}
      </nav>
      <div className="relative px-5 py-3 text-xs" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="font-bold uppercase tracking-widest" style={{ color: "rgba(255,0,92,0.65)", fontFamily: "Oswald, sans-serif", fontSize: "0.65rem" }}>
          {summary?.currentSeasonName ?? "—"}
        </div>
        <div className="mt-0.5" style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.58rem" }}>PDC-Style Wager League</div>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh text-foreground overflow-hidden" style={{ position: "relative" }}>
      <div className="ambient-blob-red" />
      <div className="ambient-blob-blue" />

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setDrawerOpen(false)}
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
      )}

      {/* Sidebar — desktop always, mobile as drawer */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 z-50
        w-64 md:w-56 flex flex-col shrink-0
        transition-transform duration-300 ease-in-out
        ${drawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}
        style={{ background: "rgba(4,4,10,0.97)", borderRight: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(20px)" }}>
        {/* Mobile close button */}
        <button className="absolute top-4 right-4 md:hidden z-10 p-1 rounded-lg"
          style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.05)" }}
          onClick={() => setDrawerOpen(false)}>
          <X className="w-4 h-4" />
        </button>
        <SidebarInner />
      </aside>

      {/* Main content column */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 shrink-0"
          style={{ height: "3.25rem", background: "rgba(4,4,10,0.95)", borderBottom: "1px solid rgba(255,255,255,0.07)", zIndex: 20 }}>
          <button onClick={() => setDrawerOpen(true)} className="p-2 rounded-lg transition-colors"
            style={{ color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.04)" }}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" style={{ color: "#ff005c" }} />
            <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.3rem", fontWeight: 800, letterSpacing: "0.2em", color: "#fff", textShadow: "0 0 20px rgba(255,0,60,0.5)" }}>
              TKDL
            </span>
          </div>
          <div style={{ width: "2.5rem" }} />
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-10" style={{ position: "relative", zIndex: 1 }}>
          <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      {/* Desktop ticker */}
      <LiveTicker />

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex"
        style={{ background: "rgba(4,4,10,0.97)", borderTop: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>
        {mobileNavItems.map(item => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all"
              style={{ color: isActive ? "#ff005c" : "rgba(255,255,255,0.3)" }}>
              <item.icon className="w-5 h-5" style={isActive ? { filter: "drop-shadow(0 0 6px rgba(255,0,92,0.8))" } : {}} />
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.08em", fontWeight: isActive ? 700 : 400 }}>
                {item.label}
              </span>
              {isActive && <div className="absolute bottom-0 w-8 h-0.5 rounded-full" style={{ background: "#ff005c" }} />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
