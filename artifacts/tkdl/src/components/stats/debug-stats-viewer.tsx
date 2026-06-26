import React, { useState, useEffect } from "react";

/**
 * DEBUG COMPONENT: Shows raw stats data for troubleshooting
 * Usage: Import and render in account.tsx for temporary debugging
 * Remove before production!
 */
export function DebugStatsViewer({ playerId }: { playerId: number }) {
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchDebugData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/players/${playerId}/stats/debug`);
      const data = await response.json();
      setDebugData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugData();
  }, [playerId]);

  return (
    <div style={{
      margin: "16px 0",
      padding: "12px",
      background: "rgba(255,100,100,0.1)",
      border: "2px solid rgba(255,100,100,0.3)",
      borderRadius: "8px",
      fontFamily: "monospace",
      fontSize: "11px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#ff6464", fontWeight: "bold" }}>🔴 DEBUG: Stats API Test</span>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: "rgba(255,100,100,0.2)",
            border: "1px solid rgba(255,100,100,0.4)",
            color: "#ff6464",
            padding: "4px 8px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "10px",
          }}
        >
          {expanded ? "Hide" : "Show"}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: "12px" }}>
          {loading && <div style={{ color: "#ffa500" }}>⏳ Loading...</div>}
          {error && <div style={{ color: "#ff6464" }}>❌ Error: {error}</div>}
          {debugData && (
            <div>
              <div style={{ color: "#00ff00", marginBottom: "8px" }}>✅ API Response:</div>
              <pre style={{
                background: "rgba(0,0,0,0.3)",
                padding: "8px",
                borderRadius: "4px",
                overflow: "auto",
                maxHeight: "300px",
                color: "#00ff00",
              }}>
                {JSON.stringify(debugData, null, 2)}
              </pre>

              {/* Quick analysis */}
              <div style={{ marginTop: "12px", color: "#ffaa00" }}>
                <div><strong>Analysis:</strong></div>
                <div>- Breakdown count: {debugData.breakdown?.count ?? 0}</div>
                <div>- League matches: {debugData.leagueStats?.matches ?? 0}</div>
                <div>- Breakdown data exists: {debugData.breakdown?.data?.length > 0 ? "✅ YES" : "❌ NO"}</div>
                <div>- League stats object exists: {debugData.leagueStats?.exists ? "✅ YES" : "❌ NO"}</div>
              </div>

              <button
                onClick={fetchDebugData}
                style={{
                  marginTop: "12px",
                  background: "rgba(0,255,0,0.2)",
                  border: "1px solid rgba(0,255,0,0.4)",
                  color: "#00ff00",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "10px",
                }}
              >
                🔄 Refresh
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: "8px", fontSize: "9px", color: "rgba(255,100,100,0.7)" }}>
        ⚠️ This is a debug component. Remove before production!
      </div>
    </div>
  );
}
