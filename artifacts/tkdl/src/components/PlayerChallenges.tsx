import { useState, useEffect } from "react";

export function PlayerChallenges({ playerId }: { playerId: number }) {
  const [daily, setDaily] = useState<any[]>([]);
  const [weekly, setWeekly] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/card-clash/challenges/daily/${playerId}`)
        .then((r) => r.json())
        .catch((e) => {
          console.error("Daily challenges error:", e);
          return [];
        }),
      fetch(`/api/card-clash/challenges/weekly/${playerId}`)
        .then((r) => r.json())
        .catch((e) => {
          console.error("Weekly challenges error:", e);
          return [];
        }),
    ])
      .then(([d, w]) => {
        setDaily(Array.isArray(d) ? d : []);
        setWeekly(Array.isArray(w) ? w : []);
        setLoading(false);
      })
      .catch((e) => {
        console.error("Challenges error:", e);
        setError(e.message);
        setLoading(false);
      });
  }, [playerId]);

  if (loading) return <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>Loading challenges...</div>;
  if (error) return <div style={{ color: "#ff6b6b", fontSize: "14px" }}>Error: {error}</div>;

  const hasContent = daily.length > 0 || weekly.length > 0;
  if (!hasContent) return <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>No challenges this cycle</div>;

  return (
    <div>
      <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        🎯 Challenges
      </h3>

      {daily.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <h4 style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", marginBottom: "8px", textTransform: "uppercase" }}>Daily</h4>
          <div style={{ display: "grid", gap: "8px" }}>
            {daily.map((c, i) => (
              <div
                key={i}
                style={{
                  padding: "10px",
                  background: c.isCompleted ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${c.isCompleted ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#fff",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{c.name || c.title || `Challenge ${i + 1}`}</span>
                <span style={{ color: c.isCompleted ? "#22c55e" : "rgba(255,255,255,0.5)", fontWeight: "500" }}>
                  {c.isCompleted ? "✓" : `${c.progress || 0}/${c.target || 1}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {weekly.length > 0 && (
        <div>
          <h4 style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", marginBottom: "8px", textTransform: "uppercase" }}>Weekly</h4>
          <div style={{ display: "grid", gap: "8px" }}>
            {weekly.map((c, i) => (
              <div
                key={i}
                style={{
                  padding: "10px",
                  background: c.isCompleted ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${c.isCompleted ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#fff",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{c.name || c.title || `Challenge ${i + 1}`}</span>
                <span style={{ color: c.isCompleted ? "#22c55e" : "rgba(255,255,255,0.5)", fontWeight: "500" }}>
                  {c.isCompleted ? "✓" : `${c.progress || 0}/${c.target || 1}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
