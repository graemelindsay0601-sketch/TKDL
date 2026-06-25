import { useState, useEffect } from "react";

export function CardCollection({ playerId }: { playerId: number }) {
  const [collection, setCollection] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    fetch(`/api/card-clash/collection/${playerId}`)
      .then((r) => r.json())
      .then((d) => {
        setCollection(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => {
        setCollection([]);
        setLoading(false);
      });
  }, [playerId]);

  if (loading) return <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>Loading collection...</div>;
  if (collection.length === 0) return <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>No cards yet</div>;

  return (
    <div>
      <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        📚 Card Collection ({collection.length})
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "8px" }}>
        {collection.map((card) => (
          <div
            key={card.cardId}
            style={{
              padding: "8px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
              textAlign: "center",
              fontSize: "12px",
              color: "#fff",
            }}
          >
            <div style={{ fontSize: "18px", marginBottom: "4px" }}>{card.icon || "🃏"}</div>
            <div style={{ fontWeight: "500", marginBottom: "2px" }}>{card.name}</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px" }}>
              ×{card.quantity || 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
