// ── TV / Kiosk Display Mode ─────────────────────────────────────────────────
// A dedicated full-screen, no-interaction route built for a shared screen at
// the venue rather than someone's phone: live standings + recent results,
// auto-refreshing on a timer so nobody needs to touch it once it's up.
// Deliberately reuses the existing GET /leaderboard and GET /matches
// endpoints (same data the normal Leaderboard/Dashboard pages already show)
// rather than adding new backend surface — this page is purely a different
// *presentation* of data the app already serves. Sits outside <Layout> in
// App.tsx, same as /broadcast and /tkdl-live, so it renders with no sidebar
// or nav chrome — just this page, edge to edge.
import { useState, useEffect } from "react";
import { TierBadge } from "@/components/tier-badge";
import { Trophy, Flame, Skull } from "lucide-react";
import { format } from "date-fns";

type LeaderboardEntry = {
  playerId: number; playerName: string; position: number;
  wins: number; losses: number; points: number; elo: number;
  tier: string; currentStreak: number; status: string;
};
type RecentMatch = {
  id: number; winnerName: string; loserName: string; stake: number;
  eloChange: number; gameType: string; playedAt: string; wasUpsetWin: boolean;
};

const REFRESH_MS = 30_000;

function useKioskData() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [matches, setMatches] = useState<RecentMatch[] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      Promise.all([
        fetch("/api/leaderboard").then(r => r.json()),
        fetch("/api/matches?limit=12").then(r => r.json()),
      ]).then(([lb, m]) => {
        if (cancelled) return;
        setLeaderboard(Array.isArray(lb) ? lb : null);
        setMatches(Array.isArray(m) ? m : null);
        setLastUpdated(new Date());
      }).catch(() => {});
    };
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return { leaderboard, matches, lastUpdated };
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function Kiosk() {
  const { leaderboard, matches, lastUpdated } = useKioskData();
  const now = useClock();
  const active = (leaderboard ?? []).filter(e => e.status !== "ELIMINATED").slice(0, 10);

  return (
    <div style={{ minHeight: "100vh", background: "#050608", color: "#fff", padding: "2.5rem 3rem", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Trophy className="w-8 h-8" style={{ color: "#ffd24a" }} />
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "2rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Tesco Kilbirnie Darts League
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff005c", boxShadow: "0 0 10px #ff005c", display: "inline-block", animation: "kiosk-pulse 1.6s ease-in-out infinite" }} />
          <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, letterSpacing: "0.1em", fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Live</span>
          <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.6rem", color: "rgba(255,255,255,0.85)", fontVariantNumeric: "tabular-nums", marginLeft: "0.75rem" }}>
            {format(now, "HH:mm:ss")}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "2rem" }}>
        {/* Standings */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "1rem", padding: "1.75rem", overflow: "hidden" }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 800, fontSize: "1rem", letterSpacing: "0.14em", color: "#ffd24a", textTransform: "uppercase", marginBottom: "1.25rem" }}>
            Standings
          </div>
          {active.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "1.1rem", padding: "2rem 0" }}>Waiting for matches…</div>
          )}
          {active.map((e, i) => (
            <div key={e.playerId} style={{
              display: "grid", gridTemplateColumns: "3rem 1fr auto auto auto", alignItems: "center", gap: "1.25rem",
              padding: "0.85rem 0", borderBottom: i < active.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1.4rem", color: i === 0 ? "#ffd24a" : i === 1 ? "#c0c8d8" : i === 2 ? "#cd7f32" : "rgba(255,255,255,0.35)" }}>
                {i + 1}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.35rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {e.playerName}
                </span>
                {e.currentStreak >= 3 && <Flame className="w-4 h-4 shrink-0" style={{ color: "#ff005c" }} />}
                <TierBadge tier={e.tier} />
              </div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>
                {e.wins}-{e.losses}
              </div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "#0066ff", fontVariantNumeric: "tabular-nums" }}>
                {e.elo}
              </div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1.5rem", color: "#ff005c", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                {e.points}
              </div>
            </div>
          ))}
        </div>

        {/* Recent results */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "1rem", padding: "1.75rem", overflow: "hidden" }}>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 800, fontSize: "1rem", letterSpacing: "0.14em", color: "#00e5a0", textTransform: "uppercase", marginBottom: "1.25rem" }}>
            Recent Results
          </div>
          {(matches ?? []).length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "1.1rem", padding: "2rem 0" }}>No matches yet</div>
          )}
          {(matches ?? []).map(m => (
            <div key={m.id} style={{ padding: "0.7rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: "1rem" }}>
                <span style={{ fontWeight: 700, color: "#fff" }}>{m.winnerName}</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}> def. </span>
                <span style={{ color: "rgba(255,255,255,0.55)" }}>{m.loserName}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.15rem" }}>
                <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)" }}>{format(new Date(m.playedAt), "d MMM, HH:mm")}</span>
                {m.stake > 0 && <span style={{ fontSize: "0.7rem", color: "#ffd24a" }}>{m.stake} pts</span>}
                {m.wasUpsetWin && (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem", color: "#a855f7" }}>
                    <Skull className="w-3 h-3" /> upset
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {lastUpdated && (
        <div style={{ marginTop: "1.5rem", textAlign: "right", fontSize: "0.75rem", color: "rgba(255,255,255,0.2)" }}>
          Updated {format(lastUpdated, "HH:mm:ss")} · refreshes every 30s
        </div>
      )}

      <style>{`
        @keyframes kiosk-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}
