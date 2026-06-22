import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface OverallStatsProps {
  playerId: number;
}

interface StatsData {
  competitive: {
    matches: number;
    wins: number;
    losses: number;
    winRate: number;
    totalDarts: number;
    total180s: number;
    checkoutHits: number;
    checkoutAttempts: number;
    checkoutRate: number;
    avgDartsPerMatch: number;
  };
  practice: {
    sessions: number;
    totalDarts: number;
    total180s: number;
    checkoutHits: number;
  };
}

export function OverallStats({ playerId }: OverallStatsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [window, setWindow] = useState<"7days" | "30days" | "90days" | "all">("all");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/players/${playerId}/stats/overview?window=${window}`);
        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error("Failed to load stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [playerId, window]);

  if (loading || !stats) {
    return (
      <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)" }}>
        Loading stats...
      </div>
    );
  }

  const StatCard = ({ label, value, secondary, trend }: any) => (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "8px",
      padding: "12px",
      flex: "1 1 calc(50% - 8px)",
      minWidth: "140px",
    }}>
      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "6px" }}>
        {label}
      </div>
      <div style={{ fontSize: "20px", fontWeight: "600", color: "#fff", marginBottom: "4px" }}>
        {typeof value === "number" && !Number.isInteger(value) ? value.toFixed(2) : value}
      </div>
      {secondary && (
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
          {secondary}
        </div>
      )}
      {trend !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", color: trend > 0 ? "#00e5a0" : "#ff005c" }}>
          {trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span style={{ fontSize: "11px" }}>{Math.abs(trend).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );

  const comp = stats.competitive;
  const prac = stats.practice;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Window selector */}
      <div style={{ display: "flex", gap: "8px", justifyContent: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "12px" }}>
        {(["7days", "30days", "90days", "all"] as const).map(w => (
          <button
            key={w}
            onClick={() => setWindow(w)}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              background: window === w ? "rgba(255,0,92,0.2)" : "transparent",
              border: window === w ? "1px solid rgba(255,0,92,0.5)" : "1px solid rgba(255,255,255,0.1)",
              color: window === w ? "#ff005c" : "rgba(255,255,255,0.5)",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {w === "7days" ? "7d" : w === "30days" ? "30d" : w === "90days" ? "90d" : "All"}
          </button>
        ))}
      </div>

      {/* Competitive Section */}
      <div>
        <h3 style={{ fontSize: "12px", fontWeight: "600", color: "rgba(255,255,255,0.6)", marginBottom: "12px", textTransform: "uppercase" }}>
          Competitive
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <StatCard label="Matches" value={comp.matches} secondary={`${comp.wins}W-${comp.losses}L`} />
          <StatCard label="Win Rate" value={`${(comp.winRate * 100).toFixed(1)}%`} />
          <StatCard label="Total Darts" value={comp.totalDarts} secondary={`${comp.avgDartsPerMatch.toFixed(1)} per match`} />
          <StatCard label="180s" value={comp.total180s} />
          <StatCard label="Checkout Rate" value={`${(comp.checkoutRate * 100).toFixed(1)}%`} secondary={`${comp.checkoutHits}/${comp.checkoutAttempts}`} />
        </div>
      </div>

      {/* Practice Section */}
      <div>
        <h3 style={{ fontSize: "12px", fontWeight: "600", color: "rgba(255,255,255,0.6)", marginBottom: "12px", textTransform: "uppercase" }}>
          Practice
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <StatCard label="Sessions" value={prac.sessions} />
          <StatCard label="Darts Thrown" value={prac.totalDarts} />
          <StatCard label="180s" value={prac.total180s} />
          <StatCard label="Checkout Hits" value={prac.checkoutHits} />
        </div>
      </div>
    </div>
  );
}
