import { useState, useEffect } from "react";

export function PlayerChallenges({ playerId }: { playerId: number }) {
  const [daily, setDaily] = useState<any[]>([]);
  const [weekly, setWeekly] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/card-clash/challenges/daily/${playerId}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/card-clash/challenges/weekly/${playerId}`).then((r) => r.json()).catch(() => []),
    ])
      .then(([d, w]) => {
        setDaily(Array.isArray(d) ? d : []);
        setWeekly(Array.isArray(w) ? w : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [playerId]);

  if (loading) return <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>Loading challenges...</div>;

  const hasContent = daily.length > 0 || weekly.length > 0;
  if (!hasContent) return null;

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
                  padding: "8px",
                  background: c.isCompleted ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${c.isCompleted ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: "4px",
                  fontSize: "12px",
                  color: "#fff",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{c.name}</span>
                <span style={{ color: c.isCompleted ? "#22c55e" : "rgba(255,255,255,0.5)" }}>
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
                  padding: "8px",
                  background: c.isCompleted ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${c.isCompleted ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: "4px",
                  fontSize: "12px",
                  color: "#fff",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{c.name}</span>
                <span style={{ color: c.isCompleted ? "#22c55e" : "rgba(255,255,255,0.5)" }}>
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
