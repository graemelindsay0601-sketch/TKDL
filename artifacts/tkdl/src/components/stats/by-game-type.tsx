import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface GameTypeStats {
  gameType: string;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  totalDarts: number;
  total180s: number;
}

interface ByGameTypeProps {
  playerId: number;
}

export function ByGameType({ playerId }: ByGameTypeProps) {
  const [stats, setStats] = useState<GameTypeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [typeDetails, setTypeDetails] = useState<Record<string, any>>({});
  const [window, setWindow] = useState<"7days" | "30days" | "90days" | "all">("all");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/players/${playerId}/stats/by-game-type?window=${window}`);
        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error("Failed to load game type stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [playerId, window]);

  const handleExpand = async (gameType: string) => {
    if (expandedType === gameType) {
      setExpandedType(null);
      return;
    }

    setExpandedType(gameType);

    if (typeDetails[gameType]) return;

    try {
      const response = await fetch(
        `/api/players/${playerId}/stats/game-type/${gameType}/detail?window=${window}`
      );
      const data = await response.json();
      setTypeDetails(prev => ({ ...prev, [gameType]: data }));
    } catch (err) {
      console.error(`Failed to load ${gameType} details:`, err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)" }}>
        Loading stats...
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
        No games played yet
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Window selector */}
      <div style={{ display: "flex", gap: "8px", justifyContent: "center", paddingBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
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

      {stats.map(gt => (
        <div key={gt.gameType}>
          {/* Game Type Header */}
          <button
            onClick={() => handleExpand(gt.gameType)}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              padding: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "white",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
              {expandedType === gt.gameType ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: "600", fontSize: "14px" }}>{gt.gameType}</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                  {gt.wins}W - {gt.losses}L ({(gt.winRate * 100).toFixed(0)}%)
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
              <span>{gt.totalDarts} darts</span>
              <span>{gt.total180s} 180s</span>
              <span>{gt.matches} games</span>
            </div>
          </button>

          {/* Expanded Details */}
          {expandedType === gt.gameType && typeDetails[gt.gameType] && (
            <div style={{ padding: "12px", background: "rgba(255,255,255,0.01)", marginTop: "4px", borderRadius: "4px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {(typeDetails[gt.gameType] as any[]).slice(0, 10).map(match => (
                  <div key={match.id} style={{
                    padding: "8px",
                    background: "rgba(255,255,255,0.03)",
                    borderLeft: match.won ? "3px solid #00e5a0" : "3px solid #ff005c",
                    fontSize: "12px",
                  }}>
                    <div style={{ color: match.won ? "#00e5a0" : "#ff005c", fontWeight: "600", marginBottom: "2px" }}>
                      {match.won ? "✓" : "✗"} vs {match.opponent}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px" }}>
                      {match.dartsUsed} darts • {new Date(match.playedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                {(typeDetails[gt.gameType] as any[]).length > 10 && (
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", textAlign: "center", paddingTop: "4px" }}>
                    +{(typeDetails[gt.gameType] as any[]).length - 10} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
