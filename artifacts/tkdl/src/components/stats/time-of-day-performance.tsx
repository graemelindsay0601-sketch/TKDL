import { useState, useEffect } from "react";
import { Clock, TrendingUp } from "lucide-react";

interface TimeOfDayStats {
  hour: string;
  matches: number;
  wins: number;
  winRate: number;
  avgDarts: number;
  avgCheckout: number;
}

interface TimeOfDayPerformanceProps {
  playerId: number;
}

export function TimeOfDayPerformance({ playerId }: TimeOfDayPerformanceProps) {
  const [stats, setStats] = useState<TimeOfDayStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [bestTime, setBestTime] = useState<string>("");

  useEffect(() => {
    const fetchTimeStats = async () => {
      try {
        const response = await fetch(`/api/players/${playerId}/stats/time-of-day`);
        const data = await response.json();
        setStats(data);

        // Find best time
        const best = data.reduce((acc: any, current: any) => 
          current.winRate > acc.winRate ? current : acc
        );
        setBestTime(best.hour);
      } catch (err) {
        console.error("Failed to load time of day stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeStats();
  }, [playerId]);

  if (loading) {
    return <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)" }}>Loading time analysis...</div>;
  }

  if (stats.length === 0) {
    return <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)" }}>No time data available</div>;
  }

  const maxWinRate = Math.max(...stats.map(s => s.winRate));

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "12px",
      padding: "16px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <Clock size={16} style={{ color: "#ffd24a" }} />
        <span style={{ fontSize: "13px", fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>
          When You Play Best
        </span>
      </div>

      {/* Chart */}
      <div style={{ marginBottom: "16px" }}>
        {stats.map((stat) => (
          <div key={stat.hour} style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "12px" }}>
              <span style={{ color: "rgba(255,255,255,0.6)" }}>{stat.hour}</span>
              <span style={{
                fontWeight: "600",
                color: stat.hour === bestTime ? "#ffd24a" : "rgba(255,255,255,0.7)",
              }}>
                {(stat.winRate * 100).toFixed(0)}% ({stat.wins}W-{stat.matches - stat.wins}L)
              </span>
            </div>
            
            {/* Bar */}
            <div style={{
              height: "24px",
              background: "rgba(255,255,255,0.05)",
              borderRadius: "4px",
              overflow: "hidden",
              border: `1px solid ${stat.hour === bestTime ? "rgba(255,210,74,0.3)" : "rgba(255,255,255,0.1)"}`,
            }}>
              <div style={{
                height: "100%",
                width: `${(stat.winRate / maxWinRate) * 100}%`,
                background: stat.hour === bestTime 
                  ? "linear-gradient(90deg, #ffd24a 0%, #ff005c 100%)"
                  : `linear-gradient(90deg, #a855f7 0%, #00e5a0 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: "8px",
                fontSize: "11px",
                fontWeight: "600",
                color: "#000",
              }}>
                {stat.winRate > 0.3 && `${(stat.winRate * 100).toFixed(0)}%`}
              </div>
            </div>

            {/* Sub-stats */}
            <div style={{
              display: "flex",
              gap: "12px",
              fontSize: "10px",
              color: "rgba(255,255,255,0.4)",
              marginTop: "4px",
            }}>
              <span>Avg: {stat.avgDarts.toFixed(0)} darts</span>
              <span>CO: {(stat.avgCheckout * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recommendation */}
      <div style={{
        background: "rgba(0,229,160,0.08)",
        border: "1px solid rgba(0,229,160,0.2)",
        borderRadius: "8px",
        padding: "12px",
        display: "flex",
        gap: "8px",
      }}>
        <TrendingUp size={14} style={{ color: "#00e5a0", marginTop: "2px", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: "11px", fontWeight: "600", color: "#00e5a0", marginBottom: "2px" }}>
            Optimal Practice Time
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>
            Your best performance is around <strong>{bestTime}</strong>. Schedule drills & important matches during this window.
          </div>
        </div>
      </div>
    </div>
  );
}
