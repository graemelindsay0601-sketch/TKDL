import { Link, useLocation } from "wouter";
import { Trophy, Users, History, Medal, Shield, Activity, Plus, Target } from "lucide-react";
import { ReactNode } from "react";
import { useGetStatsSummary } from "@workspace/api-client-react";

const navItems = [
  { href: "/",             label: "Dashboard",    icon: Activity },
  { href: "/leaderboard",  label: "Leaderboard",  icon: Trophy   },
  { href: "/submit",       label: "Submit Match", icon: Plus     },
  { href: "/players",      label: "Players",      icon: Users    },
  { href: "/seasons",      label: "Seasons",      icon: History  },
  { href: "/achievements", label: "Achievements", icon: Medal    },
  { href: "/admin",        label: "Admin",        icon: Shield   },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { data: summary } = useGetStatsSummary();
  const eliminated = (summary as any)?.eliminatedCount ?? 0;

  return (
    <div className="flex h-screen pdc-ambient text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside
        className="w-60 flex flex-col border-r shrink-0 relative"
        style={{ background: "hsl(240 24% 5.5%)", borderColor: "rgba(255,255,255,0.07)" }}
      >
        {/* Subtle red glow top-left */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 120px 200px at -20px 60px, rgba(255,0,92,0.08) 0%, transparent 70%)",
          }}
        />

        {/* Logo */}
        <div className="px-5 py-5 border-b relative" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="relative">
              <Target className="h-5 w-5 relative z-10" style={{ color: "#ff005c" }} />
              <div
                className="absolute inset-0 rounded-full blur-sm"
                style={{ background: "rgba(255,0,92,0.35)" }}
              />
            </div>
            <span
              className="text-xl font-bold tracking-widest uppercase"
              style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", letterSpacing: "0.2em", textShadow: "0 0 20px rgba(255,0,92,0.5)" }}
            >
              TKDL
            </span>
          </div>
          <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.28)", fontSize: "0.58rem" }}>
            Tesco Kilbirnie Darts League
          </p>
          {summary && (
            <div className="mt-2.5 flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                <span className="live-dot" />
                {summary.activePlayers ?? summary.totalPlayers} active
              </span>
              {eliminated > 0 && (
                <span className="font-bold" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif", fontSize: "0.75rem" }}>
                  ☠ {eliminated}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
          {navItems.map(item => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all text-sm font-medium relative overflow-hidden ${
                  isActive ? "text-white" : "text-white/35 hover:text-white/70 hover:bg-white/[0.04]"
                }`}
                style={isActive ? {
                  background: "linear-gradient(90deg, rgba(255,0,92,0.15) 0%, rgba(255,0,92,0.05) 100%)",
                  borderLeft: "2px solid #ff005c",
                  paddingLeft: "10px",
                  color: "rgba(255,255,255,0.95)",
                  boxShadow: "inset 0 0 20px rgba(255,0,92,0.06)",
                } : {}}
              >
                {isActive && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none"
                    style={{ background: "linear-gradient(270deg, rgba(255,0,92,0.06), transparent)" }}
                  />
                )}
                <item.icon
                  className="h-4 w-4 shrink-0"
                  style={isActive ? { color: "#ff005c", filter: "drop-shadow(0 0 4px rgba(255,0,92,0.6))" } : {}}
                />
                <span style={{ fontFamily: isActive ? "Oswald, sans-serif" : undefined, letterSpacing: isActive ? "0.06em" : undefined }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t text-xs" style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.2)" }}>
          <div>PDC-Style Wager League</div>
          <div className="mt-0.5 font-bold" style={{ color: "rgba(255,0,92,0.55)", fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", letterSpacing: "0.06em" }}>
            Season {summary?.currentSeasonName ?? "—"}
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
