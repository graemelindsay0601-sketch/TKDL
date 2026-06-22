import { useState, useEffect } from "react";
import { X, TrendingUp, TrendingDown, Zap, Brain } from "lucide-react";

interface PostMatchAnalysisProps {
  matchId: number;
  playerId: number;
  onClose: () => void;
  onCoachDrill?: (drillId: string) => void;
}

export interface MatchAnalysis {
  matchId: number;
  playerId: number;
  won: boolean;
  opponent: {
    name: string;
    playerId: number;
    tier: string;
  };
  playerStats: {
    darts: number;
    checkout: number;
    checkoutAttempts: number;
    checkoutRate: number;
    _180s: number;
    eloChange: number;
  };
  opponentStats: {
    darts: number;
    checkout: number;
    checkoutAttempts: number;
    checkoutRate: number;
    _180s: number;
  };
  keyInsights: {
    strength: string;
    weakness: string;
    recommendation: string;
  };
  comparisonToYourAverage: {
    metric: string;
    yours: number;
    average: number;
    difference: number;
  }[];
}

export function PostMatchAnalysisModal({ matchId, playerId, onClose, onCoachDrill }: PostMatchAnalysisProps) {
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const response = await fetch(`/api/matches/${matchId}/analysis?playerId=${playerId}`);
        const data = await response.json();
        setAnalysis(data);
      } catch (err) {
        console.error("Failed to load match analysis:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [matchId, playerId]);

  if (loading) {
    return (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}>
        <div style={{ color: "rgba(255,255,255,0.5)" }}>Loading analysis...</div>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const StatComparison = ({ metric, yours, average, difference }: any) => (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px",
      background: "rgba(255,255,255,0.02)",
      borderRadius: "6px",
      marginBottom: "8px",
    }}>
      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>{metric}</span>
      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#fff" }}>{yours}</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>yours</div>
        </div>
        <div style={{
          fontSize: "12px",
          fontWeight: "600",
          color: difference > 0 ? "#00e5a0" : "#ff005c",
          minWidth: "50px",
          textAlign: "right",
        }}>
          {difference > 0 ? "+" : ""}{difference.toFixed(1)}%
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "rgba(8,6,18,0.98)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "16px",
          width: "90%",
          maxWidth: "550px",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h2 style={{
              fontSize: "18px",
              fontWeight: "700",
              color: analysis.won ? "#00e5a0" : "#ff005c",
              margin: 0,
            }}>
              {analysis.won ? "✓ Victory!" : "⚔️ Loss"} vs {analysis.opponent.name}
            </h2>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>
              {analysis.opponent.tier} • ELO {analysis.playerStats.eloChange >= 0 ? "+" : ""}{analysis.playerStats.eloChange}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Match Stats Comparison */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "10px",
          padding: "14px",
          marginBottom: "16px",
        }}>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "rgba(255,255,255,0.6)", marginBottom: "10px", textTransform: "uppercase" }}>
            Match Statistics
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "12px" }}>
            <div>
              <div style={{ color: "rgba(255,255,255,0.4)", marginBottom: "4px" }}>You</div>
              <div style={{ fontWeight: "600", fontSize: "13px", marginBottom: "8px" }}>
                Darts: {analysis.playerStats.darts}
              </div>
              <div style={{ fontWeight: "600", fontSize: "13px", marginBottom: "8px" }}>
                Checkout: {(analysis.playerStats.checkoutRate * 100).toFixed(0)}%
              </div>
              <div style={{ fontWeight: "600", fontSize: "13px" }}>
                180s: {analysis.playerStats._180s}
              </div>
            </div>
            <div>
              <div style={{ color: "rgba(255,255,255,0.4)", marginBottom: "4px" }}>{analysis.opponent.name}</div>
              <div style={{ fontWeight: "600", fontSize: "13px", marginBottom: "8px", color: "rgba(255,255,255,0.6)" }}>
                Darts: {analysis.opponentStats.darts}
              </div>
              <div style={{ fontWeight: "600", fontSize: "13px", marginBottom: "8px", color: "rgba(255,255,255,0.6)" }}>
                Checkout: {(analysis.opponentStats.checkoutRate * 100).toFixed(0)}%
              </div>
              <div style={{ fontWeight: "600", fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
                180s: {analysis.opponentStats._180s}
              </div>
            </div>
          </div>
        </div>

        {/* Key Insights */}
        <div style={{
          background: "rgba(255,210,74,0.08)",
          border: "1px solid rgba(255,210,74,0.2)",
          borderRadius: "10px",
          padding: "14px",
          marginBottom: "16px",
        }}>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "rgba(255,255,255,0.8)", marginBottom: "10px" }}>
            📊 Key Insights
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
            <div>
              <div style={{ color: "#00e5a0", fontWeight: "600", marginBottom: "4px" }}>✓ Strength</div>
              <div style={{ color: "rgba(255,255,255,0.7)" }}>{analysis.keyInsights.strength}</div>
            </div>
            
            <div>
              <div style={{ color: "#ff005c", fontWeight: "600", marginBottom: "4px" }}>⚠️ Weakness</div>
              <div style={{ color: "rgba(255,255,255,0.7)" }}>{analysis.keyInsights.weakness}</div>
            </div>
          </div>
        </div>

        {/* Coach Recommendation */}
        <div style={{
          background: "rgba(168,85,247,0.08)",
          border: "1px solid rgba(168,85,247,0.2)",
          borderRadius: "10px",
          padding: "14px",
          marginBottom: "16px",
        }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
            <Brain size={16} style={{ color: "#a855f7", marginTop: "2px", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#a855f7", marginBottom: "6px" }}>
                Coach Recommendation
              </div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
                {analysis.keyInsights.recommendation}
              </div>
            </div>
          </div>
        </div>

        {/* Comparison to Your Average */}
        <div style={{
          marginBottom: "16px",
          padding: "10px 0",
        }}>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "rgba(255,255,255,0.8)", marginBottom: "10px" }}>
            vs Your Average
          </div>
          {analysis.comparisonToYourAverage.map((comp, idx) => (
            <StatComparison key={idx} {...comp} />
          ))}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "12px",
            background: "rgba(255,0,92,0.15)",
            border: "1px solid rgba(255,0,92,0.3)",
            color: "#ff005c",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,0,92,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,0,92,0.15)";
          }}
        >
          Close Analysis
        </button>
      </div>
    </div>
  );
}
