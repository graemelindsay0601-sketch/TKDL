import { useState, useEffect } from "react";
import { BarChart3 } from "lucide-react";
import { CollapsibleAdminSection } from "./collapsible-section";

export function PracticeAnalytics() {
  const [stats, setStats] = useState<{ byGame: any[]; byPlayer: any[]; recent: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/practice/stats")
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <CollapsibleAdminSection title="Practice Analytics" icon={BarChart3} accent="#a78bfa" borderColor="rgba(167,139,250,0.15)" background="rgba(167,139,250,0.02)">
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#a78bfa" }} />
        </div>
      ) : !stats || (stats.byGame.length === 0 && stats.byPlayer.length === 0) ? (
        <div className="px-5 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>
          No practice sessions recorded yet.
          <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>Sessions save automatically when players finish a game in Practice mode.</div>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {stats.byGame.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>Most Played Games</div>
              <div className="space-y-1.5">
                {stats.byGame.slice(0, 6).map((g: any) => (
                  <div key={g.game_type_key} className="flex items-center justify-between py-1.5 px-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Oswald, sans-serif" }}>{g.game_type_name}</div>
                    <div className="flex gap-3 text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                      <span style={{ color: "#a78bfa" }}>{g.total_sessions} sessions</span>
                      {g.avg_duration_secs && <span>{Math.round(g.avg_duration_secs / 60)}m avg</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {stats.byPlayer.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>Most Active Players</div>
              <div className="space-y-1.5">
                {stats.byPlayer.slice(0, 5).map((p: any) => (
                  <div key={p.player_name} className="flex items-center justify-between py-1.5 px-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Oswald, sans-serif" }}>{p.player_name}</div>
                    <div className="flex gap-3 text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                      <span style={{ color: "#a78bfa" }}>{p.total_sessions} sessions</span>
                      <span>{p.wins}W</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {stats.recent.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>Recent Sessions</div>
              <div className="space-y-1">
                {stats.recent.slice(0, 5).map((s: any, i: number) => (
                  <div key={i} className="text-xs py-1 px-2 rounded" style={{ background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
                    <span style={{ color: "rgba(255,255,255,0.6)" }}>{s.game_type_name}</span>
                    {s.player1_name && <span className="ml-2">· {s.player1_name}{s.player2_name ? ` vs ${s.player2_name}` : ""}</span>}
                    {s.detail && <span className="ml-2" style={{ color: "#a78bfa" }}>· {s.detail}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </CollapsibleAdminSection>
  );
}
