import { Link, useLocation } from "wouter";
import { Trophy, Users, History, Medal, Shield, Plus, Target, LayoutDashboard } from "lucide-react";
import { ReactNode } from "react";
import { useGetStatsSummary } from "@workspace/api-client-react";

const navItems = [
  { href: "/",             label: "Dashboard",    icon: LayoutDashboard },
  { href: "/leaderboard",  label: "Leaderboard",  icon: Trophy          },
  { href: "/submit",       label: "Submit Match", icon: Plus            },
  { href: "/players",      label: "Players",      icon: Users           },
  { href: "/seasons",      label: "Seasons",      icon: History         },
  { href: "/achievements", label: "Achievements", icon: Medal           },
  { href: "/admin",        label: "Admin",        icon: Shield          },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: summary } = useGetStatsSummary();
  const eliminated = (summary as any)?.eliminatedCount ?? 0;

  return (
    <div className="flex h-screen text-foreground overflow-hidden" style={{ position: "relative" }}>
      {/* Animated ambient blobs */}
      <div className="ambient-blob-red" />
      <div className="ambient-blob-blue" />

      {/* Sidebar */}
      <aside
        className="w-56 flex flex-col shrink-0 relative overflow-hidden"
        style={{
          background: "rgba(4,4,10,0.88)",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(20px)",
          zIndex: 10,
        }}
      >
        {/* Red ambient glow top-left */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 200px 280px at -30px 20px, rgba(255,0,92,0.15) 0%, transparent 70%)",
        }} />

        {/* Logo block */}
        <div className="relative px-5 pt-7 pb-5" style={{ borderBottom: "2px solid rgba(255,0,92,0.5)" }}>
          {/* Bright red top stripe */}
          <div className="absolute top-0 left-0 right-0 h-0.5"
            style={{ background: "linear-gradient(90deg, #ff005c 0%, rgba(255,0,92,0.4) 70%, transparent 100%)" }}
          />

          <div className="flex items-center gap-2.5 mb-1">
            <div className="relative shrink-0">
              <Target className="h-5 w-5 relative z-10" style={{ color: "#ff005c" }} />
              <div className="absolute inset-0 blur-lg" style={{ background: "rgba(255,0,92,0.6)" }} />
            </div>
            <span
              style={{
                fontFamily: "Oswald, sans-serif",
                fontSize: "34px",
                fontWeight: 800,
                letterSpacing: "0.2em",
                color: "#ffffff",
                textShadow: "0 0 24px rgba(255,0,60,0.6), 0 0 60px rgba(255,0,60,0.2)",
                lineHeight: 1,
              }}
            >
              TKDL
            </span>
          </div>
          <p style={{
            color: "rgba(255,255,255,0.25)",
            letterSpacing: "0.16em",
            fontSize: "0.5rem",
            fontFamily: "Oswald, sans-serif",
            textTransform: "uppercase",
            marginTop: "4px",
          }}>
            Tesco Kilbirnie Darts League
          </p>

          {summary && (
            <div className="mt-3 flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                <span className="live-dot" />
                {summary.activePlayers ?? summary.totalPlayers} active
              </span>
              {eliminated > 0 && (
                <span className="font-black text-xs" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif", textShadow: "0 0 8px rgba(255,0,92,0.6)" }}>
                  ☠ {eliminated}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map(item => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium relative overflow-hidden ${
                  isActive ? "text-white" : "text-white/30 hover:text-white/65 hover:bg-white/[0.04]"
                }`}
                style={isActive ? {
                  background: "linear-gradient(90deg, rgba(255,0,92,0.22) 0%, rgba(255,0,92,0.05) 100%)",
                  borderLeft: "3px solid #ff005c",
                  paddingLeft: "9px",
                  color: "#fff",
                  boxShadow: "0 4px 20px rgba(255,0,92,0.12), inset 0 0 20px rgba(255,0,92,0.06)",
                } : { borderLeft: "3px solid transparent" }}
              >
                {isActive && (
                  <div className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none"
                    style={{ background: "linear-gradient(270deg, rgba(255,0,92,0.07), transparent)" }}
                  />
                )}
                <item.icon
                  className="h-3.5 w-3.5 shrink-0"
                  style={isActive ? { color: "#ff005c", filter: "drop-shadow(0 0 6px rgba(255,0,92,0.8))" } : {}}
                />
                <span style={{
                  fontFamily: "Oswald, sans-serif",
                  letterSpacing: isActive ? "0.1em" : "0.06em",
                  fontSize: "0.8rem",
                  fontWeight: isActive ? 600 : 400,
                }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="relative px-5 py-3 text-xs" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="font-bold uppercase tracking-widest" style={{ color: "rgba(255,0,92,0.65)", fontFamily: "Oswald, sans-serif", fontSize: "0.65rem" }}>
            {summary?.currentSeasonName ?? "—"}
          </div>
          <div className="mt-0.5" style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.58rem" }}>
            PDC-Style Wager League
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto" style={{ position: "relative", zIndex: 1 }}>
        <div className="max-w-5xl mx-auto p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
