import { useEffect, useState } from "react";

interface DartFrequency {
  target: number;
  hits: number;
  frequency: number;
}

interface DartProfileData {
  mostFrequentTargets: DartFrequency[];
  allTargetFrequencies: DartFrequency[];
}

interface DartAnalysisProps {
  playerId: number;
}

export function DartAnalysis({ playerId }: DartAnalysisProps) {
  const [profile, setProfile] = useState<DartProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/players/${playerId}/stats/dart-profile`);
        const data = await response.json();
        setProfile(data);
      } catch (err) {
        console.error("Failed to load dart profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [playerId]);

  if (loading) {
    return (
      <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)" }}>
        Loading dart analysis...
      </div>
    );
  }

  if (!profile || profile.allTargetFrequencies.length === 0) {
    return (
      <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
        No practice session data available
      </div>
    );
  }

  const maxHits = Math.max(...profile.allTargetFrequencies.map(d => d.hits), 1);
  const displayData = showAll ? profile.allTargetFrequencies : profile.mostFrequentTargets;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Top Targets */}
      <div>
        <h3 style={{ fontSize: "12px", fontWeight: "600", color: "rgba(255,255,255,0.6)", marginBottom: "12px", textTransform: "uppercase" }}>
          Top Dart Targets
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
          {profile.mostFrequentTargets.map(dart => (
            <div key={dart.target} style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              padding: "12px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "24px", fontWeight: "700", color: "#ff005c", marginBottom: "4px" }}>
                {dart.target}
              </div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "4px" }}>
                {dart.hits} hits
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                {dart.frequency.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Frequency Chart */}
      <div>
        <h3 style={{ fontSize: "12px", fontWeight: "600", color: "rgba(255,255,255,0.6)", marginBottom: "12px", textTransform: "uppercase" }}>
          Hit Distribution
        </h3>
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "8px",
          padding: "16px",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {displayData.map(dart => (
              <div key={dart.target} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ minWidth: "30px", fontWeight: "600", fontSize: "14px", color: "#ff005c" }}>
                  {dart.target}
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", height: "24px", background: "rgba(255,255,255,0.03)", borderRadius: "4px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      background: "linear-gradient(90deg, rgba(255,0,92,0.4), rgba(255,0,92,0.8))",
                      width: `${(dart.hits / maxHits) * 100}%`,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <div style={{ minWidth: "60px", textAlign: "right", fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
                  {dart.hits} ({dart.frequency.toFixed(1)}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toggle all targets */}
      {profile.allTargetFrequencies.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            padding: "8px 12px",
            background: "rgba(255,0,92,0.1)",
            border: "1px solid rgba(255,0,92,0.3)",
            color: "#ff005c",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "500",
          }}
        >
          {showAll ? "Show Top 5" : `Show All (${profile.allTargetFrequencies.length})`}
        </button>
      )}

      {/* Insights */}
      <div style={{
        background: "rgba(0,229,160,0.1)",
        border: "1px solid rgba(0,229,160,0.2)",
        borderRadius: "8px",
        padding: "12px",
      }}>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
          <strong style={{ color: "#00e5a0" }}>📊 Insight:</strong> Your most-thrown dart is {profile.mostFrequentTargets[0]?.target}, accounting for {profile.mostFrequentTargets[0]?.frequency.toFixed(1)}% of all darts in practice.
        </div>
      </div>
    </div>
  );
}
