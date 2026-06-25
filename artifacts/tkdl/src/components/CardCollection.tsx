import { useState, useEffect } from "react";

export function CardCollection({ playerId }: { playerId: number }) {
  const [collection, setCollection] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/card-clash/inventory/${playerId}`)
      .then((r) => r.json())
      .then((d) => {
        console.log("Inventory response:", d);
        setCollection(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load inventory:", err);
        setError(err.message);
        setCollection([]);
        setLoading(false);
      });
  }, [playerId]);

  if (loading) return <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>Loading collection...</div>;
  if (error) return <div style={{ color: "#ff6b6b", fontSize: "14px" }}>Error: {error}</div>;
  if (collection.length === 0) return <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>No cards yet</div>;

  return (
    <div>
      <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        📚 Card Collection ({collection.length} unique)
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "12px" }}>
        {collection.map((card) => (
          <div
            key={`${card.cardId}-${card.quantity}`}
            style={{
              padding: "12px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              textAlign: "center",
              fontSize: "12px",
              color: "#fff",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px", color: "rgba(255,255,255,0.7)" }}>
              {card.cardName || `Card ${card.cardId}`}
            </div>
            <div style={{ fontSize: "10px", marginBottom: "4px", color: "rgba(255,255,255,0.5)" }}>
              {card.rarity} {card.gameMode && `• ${card.gameMode}`}
            </div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#ffd24a" }}>
              ×{card.quantity}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
