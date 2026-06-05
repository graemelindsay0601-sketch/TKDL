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

  return (
    <div className="flex h-screen pdc-ambient text-foreground overflow-hidden">
      <aside
        className="w-60 flex flex-col border-r shrink-0"
        style={{ background: "hsl(240 22% 6%)", borderColor: "rgba(255,255,255,0.07)" }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-5 w-5" style={{ color: "#ff005c" }} />
            <span
              className="text-xl font-bold tracking-widest uppercase"
              style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", letterSpacing: "0.18em" }}
            >
              TKDL
            </span>
          </div>
          <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.6rem" }}>
            Tesco Kilbirnie Darts League
          </p>
          {summary && (
            <div className="mt-2 flex items-center gap-3 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              <span>{summary.activePlayers ?? summary.totalPlayers} active</span>
              {(summary.eliminatedCount ?? 0) > 0 && (
                <span style={{ color: "#ff005c" }}>☠ {summary.eliminatedCount}</span>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map(item => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded transition-all text-sm font-medium ${
                  isActive ? "text-white" : "text-white/40 hover:text-white/75 hover:bg-white/5"
                }`}
                style={isActive ? {
                  background: "rgba(255,0,92,0.12)",
                  borderLeft: "2px solid #ff005c",
                  paddingLeft: "10px",
                  color: "rgba(255,255,255,0.95)",
                } : {}}
              >
                <item.icon className="h-4 w-4 shrink-0" style={isActive ? { color: "#ff005c" } : {}} />
                <span style={{ fontFamily: isActive ? "Oswald, sans-serif" : undefined, letterSpacing: isActive ? "0.05em" : undefined }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t text-xs" style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.2)" }}>
          <div>PDC-Style Wager League</div>
          <div className="mt-0.5" style={{ color: "rgba(255,0,92,0.5)" }}>Season {summary?.currentSeasonName ?? "—"}</div>
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
