import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export function PlayerChallenges({ playerId }: { playerId: number }) {
  const [daily, setDaily] = useState<any[]>([]);
  const [weekly, setWeekly] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/card-clash/challenges/daily/${playerId}`)
        .then((r) => r.json())
        .then((d) => {
          console.log("Daily challenges response:", d);
          // Handle both direct array and nested structure
          return Array.isArray(d) ? d : (d?.challenges || []);
        })
        .catch((e) => {
          console.error("Daily challenges error:", e);
          return [];
        }),
      fetch(`/api/card-clash/challenges/weekly/${playerId}`)
        .then((r) => r.json())
        .then((d) => {
          console.log("Weekly challenges response:", d);
          // Handle both direct array and nested structure
          return Array.isArray(d) ? d : (d?.challenges || []);
        })
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

  const renderChallenge = (c: any, type: "daily" | "weekly", index: number) => {
    const id = `${type}-${index}`;
    const isExpanded = expandedId === id;
    
    return (
      <div key={id}>
        <div
          onClick={() => setExpandedId(isExpanded ? null : id)}
          style={{
            padding: "10px",
            background: c.is_completed ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${c.is_completed ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: "6px",
            fontSize: "12px",
            color: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = c.is_completed ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = c.is_completed ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)";
          }}
        >
          <div style={{ flex: 1 }}>
            <div>{c.title || c.name || `Challenge ${index + 1}`}</div>
          </div>
          <span style={{ color: c.is_completed ? "#22c55e" : "rgba(255,255,255,0.5)", fontWeight: "500", marginRight: "8px" }}>
            {c.is_completed ? "✓" : `${c.progress || 0}/${c.requirement_value || 1}`}
          </span>
          <ChevronDown
            size={14}
            style={{
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              opacity: 0.7,
            }}
          />
        </div>
        
        {isExpanded && (
          <div style={{ padding: "12px", background: "rgba(255,255,255,0.02)", borderLeft: "2px solid rgba(255,212,74,0.3)", marginTop: "4px", borderRadius: "0 6px 6px 0", fontSize: "12px", color: "rgba(255,255,255,0.8)", lineHeight: "1.5" }}>
            {c.description && (
              <div style={{ marginBottom: "8px" }}>
                <strong>Objective:</strong> {c.description}
              </div>
            )}
            <div style={{ marginBottom: "8px" }}>
              <strong>Type:</strong> {c.requirement_type || "Unknown"}
            </div>
            <div style={{ marginBottom: "8px" }}>
              <strong>Target:</strong> {c.requirement_value} {c.requirement_type}
            </div>
            {c.reward_coins > 0 && (
              <div style={{ marginBottom: "8px", color: "#ffd24a" }}>
                <strong>🪙 Reward:</strong> {c.reward_coins} coins
              </div>
            )}
            {c.reward_pack_tokens > 0 && (
              <div style={{ marginBottom: "8px", color: "#a78bfa" }}>
                <strong>🎁 Bonus:</strong> {c.reward_pack_tokens} pack tokens
              </div>
            )}
            {c.is_completed && (
              <div style={{ color: "#22c55e" }}>
                <strong>✓ Completed!</strong> {c.completed_at && ` on ${new Date(c.completed_at).toLocaleDateString()}`}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        🎯 Challenges
      </h3>

      {daily.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <h4 style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", marginBottom: "8px", textTransform: "uppercase" }}>Daily</h4>
          <div style={{ display: "grid", gap: "8px" }}>
            {daily.map((c, i) => renderChallenge(c, "daily", i))}
          </div>
        </div>
      )}

      {weekly.length > 0 && (
        <div>
          <h4 style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", marginBottom: "8px", textTransform: "uppercase" }}>Weekly</h4>
          <div style={{ display: "grid", gap: "8px" }}>
            {weekly.map((c, i) => renderChallenge(c, "weekly", i))}
          </div>
        </div>
      )}
    </div>
  );
}
