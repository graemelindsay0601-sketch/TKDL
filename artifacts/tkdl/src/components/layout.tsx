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
    <div className="flex h-screen pdc-ambient text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside
        className="w-56 flex flex-col shrink-0 relative overflow-hidden"
        style={{ background: "#07070e", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Red ambient glow top */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 200px 300px at -40px 0px, rgba(255,0,92,0.12) 0%, transparent 70%)",
        }} />

        {/* Logo block */}
        <div className="relative px-5 pt-6 pb-5" style={{ borderBottom: "2px solid rgba(255,0,92,0.4)" }}>
          {/* Red top stripe */}
          <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, #ff005c 0%, rgba(255,0,92,0.3) 70%, transparent 100%)" }} />

          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="relative shrink-0">
              <Target className="h-4 w-4 relative z-10" style={{ color: "#ff005c" }} />
              <div className="absolute inset-0 blur-md" style={{ background: "rgba(255,0,92,0.5)" }} />
            </div>
            <span
              className="text-2xl font-black tracking-widest uppercase leading-none"
              style={{
                fontFamily: "Oswald, sans-serif",
                color: "#fff",
                letterSpacing: "0.22em",
                textShadow: "0 0 30px rgba(255,0,92,0.5), 0 2px 4px rgba(0,0,0,0.8)",
              }}
            >
              TKDL
            </span>
          </div>
          <p className="text-xs uppercase" style={{ color: "rgba(255,255,255,0.22)", letterSpacing: "0.18em", fontSize: "0.52rem", fontFamily: "Oswald, sans-serif" }}>
            Tesco Kilbirnie Darts League
          </p>

          {summary && (
            <div className="mt-3 flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                <span className="live-dot" />
                {summary.activePlayers ?? summary.totalPlayers} active
              </span>
              {eliminated > 0 && (
                <span className="font-black text-xs" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif", textShadow: "0 0 8px rgba(255,0,92,0.5)" }}>
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
                className={`flex items-center gap-3 px-3 py-2.5 transition-all text-sm font-medium relative overflow-hidden ${
                  isActive ? "text-white" : "text-white/30 hover:text-white/65 hover:bg-white/[0.03]"
                }`}
                style={isActive ? {
                  background: "linear-gradient(90deg, rgba(255,0,92,0.18) 0%, rgba(255,0,92,0.04) 100%)",
                  borderLeft: "3px solid #ff005c",
                  paddingLeft: "9px",
                  color: "#fff",
                  boxShadow: "inset 0 0 24px rgba(255,0,92,0.07)",
                } : { borderLeft: "3px solid transparent" }}
              >
                {isActive && (
                  <div className="absolute right-0 top-0 bottom-0 w-10 pointer-events-none"
                    style={{ background: "linear-gradient(270deg, rgba(255,0,92,0.08), transparent)" }} />
                )}
                <item.icon
                  className="h-3.5 w-3.5 shrink-0"
                  style={isActive ? { color: "#ff005c", filter: "drop-shadow(0 0 5px rgba(255,0,92,0.7))" } : {}}
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
          <div className="font-bold uppercase tracking-widest" style={{ color: "rgba(255,0,92,0.6)", fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", letterSpacing: "0.1em" }}>
            {summary?.currentSeasonName ?? "—"}
          </div>
          <div className="mt-0.5" style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.6rem" }}>
            PDC-Style Wager League
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
