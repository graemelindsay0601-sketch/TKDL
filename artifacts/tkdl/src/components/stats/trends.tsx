import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TrendData {
  month: string;
  matches: number;
  wins: number;
  winRate: number;
}

interface TrendsProps {
  playerId: number;
}

export function Trends({ playerId }: TrendsProps) {
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/players/${playerId}/stats/trends`);
        const data = await response.json();
        setTrends(data);
      } catch (err) {
        console.error("Failed to load trends:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrends();
  }, [playerId]);

  if (loading) {
    return (
      <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)" }}>
        Loading trends...
      </div>
    );
  }

  if (trends.length === 0) {
    return (
      <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
        No data available
      </div>
    );
  }

  const maxMatches = Math.max(...trends.map(t => t.matches), 1);
  const avgWinRate = trends.reduce((sum, t) => sum + t.winRate, 0) / trends.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Summary */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "8px",
        padding: "12px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "4px" }}>Average Win Rate</div>
          <div style={{ fontSize: "20px", fontWeight: "600", color: "#fff" }}>
            {(avgWinRate * 100).toFixed(1)}%
          </div>
        </div>
        <div style={{
          fontSize: "32px",
          fontWeight: "600",
          color: avgWinRate >= 0.5 ? "#00e5a0" : "#ff005c",
        }}>
          {avgWinRate >= 0.5 ? "↑" : "↓"}
        </div>
      </div>

      {/* Chart */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "8px",
        padding: "16px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "200px", justifyContent: "space-between" }}>
          {trends.map((trend, idx) => {
            const heightPercent = (trend.matches / maxMatches) * 100;
            const isWinning = trend.winRate >= 0.5;
            return (
              <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: "8px" }}>
                <div
                  style={{
                    width: "100%",
                    height: `${Math.max(heightPercent, 5)}%`,
                    background: isWinning ? "rgba(0,229,160,0.3)" : "rgba(255,0,92,0.3)",
                    borderTop: `3px solid ${isWinning ? "#00e5a0" : "#ff005c"}`,
                    borderRadius: "4px 4px 0 0",
                    transition: "all 0.2s",
                  }}
                  title={`${trend.matches} games, ${(trend.winRate * 100).toFixed(0)}%`}
                />
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", textAlign: "center", whiteSpace: "nowrap" }}>
                  <div>{trend.month}</div>
                  <div>{trend.wins}W</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <h3 style={{ fontSize: "12px", fontWeight: "600", color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>
          Monthly Breakdown
        </h3>
        {trends.map((trend, idx) => (
          <div key={idx} style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "6px",
            padding: "10px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div>
              <div style={{ fontWeight: "600", fontSize: "13px" }}>{trend.month}</div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                {trend.wins}W - {trend.matches - trend.wins}L
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "13px", fontWeight: "600" }}>{trend.matches} games</div>
                <div style={{
                  fontSize: "12px",
                  color: trend.winRate >= 0.5 ? "#00e5a0" : "#ff005c",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  justifyContent: "flex-end",
                }}>
                  {trend.winRate >= 0.5 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {(trend.winRate * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
