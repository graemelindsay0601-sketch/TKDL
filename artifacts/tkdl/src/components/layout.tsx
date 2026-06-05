import { Link, useLocation } from "wouter";
import { Trophy, Users, History, Medal, Tv, Shield, Activity, Plus } from "lucide-react";
import { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/submit", label: "Submit Match", icon: Plus },
    { href: "/players", label: "Players", icon: Users },
    { href: "/seasons", label: "Seasons", icon: History },
    { href: "/achievements", label: "Achievements", icon: Medal },
    { href: "/broadcast", label: "Broadcast", icon: Tv },
    { href: "/admin", label: "Admin", icon: Shield },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-black text-primary tracking-tight">TKDL</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mt-1">Kitchen Darts</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6 md:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
