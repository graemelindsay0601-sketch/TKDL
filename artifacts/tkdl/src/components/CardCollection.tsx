import { useState, useEffect } from "react";

// Map card names to their visual representations
const CARD_VISUAL_MAP: Record<string, { image: string; color: string }> = {
  // X01 GOOD
  "Big Game Player": { image: "/cards/x01-good-grid.png", color: "#00e5ff" },
  "Power Surge": { image: "/cards/x01-good-grid.png", color: "#00e5ff" },
  "Treble Hunter": { image: "/cards/x01-good-grid.png", color: "#00e5ff" },
  "Unstoppable Checkout": { image: "/cards/x01-good-grid.png", color: "#00e5ff" },
  "Banking Strategy": { image: "/cards/x01-good-grid.png", color: "#00e5ff" },
  "Checkout Confidence": { image: "/cards/x01-good-grid.png", color: "#00e5ff" },
  "Exact Finish": { image: "/cards/x01-good-grid.png", color: "#00e5ff" },
  "High Pressure": { image: "/cards/x01-good-grid.png", color: "#00e5ff" },
  "Perfect Rhythm": { image: "/cards/x01-good-grid.png", color: "#00e5ff" },
  "High Roller": { image: "/cards/x01-good-grid.png", color: "#00e5ff" },
  
  // CRICKET GOOD
  "Number Revival": { image: "/cards/cricket-good-grid.png", color: "#00ff88" },
  "Precision Focus": { image: "/cards/cricket-good-grid.png", color: "#00ff88" },
  "Bullseye Master": { image: "/cards/cricket-good-grid.png", color: "#00ff88" },
  "Fearless Finisher": { image: "/cards/cricket-good-grid.png", color: "#00ff88" },
  "Opening Spree": { image: "/cards/cricket-good-grid.png", color: "#00ff88" },
  "Consistent Striker": { image: "/cards/cricket-good-grid.png", color: "#00ff88" },
  "Fail-Safe": { image: "/cards/cricket-good-grid.png", color: "#00ff88" },
  "Target Acquisition": { image: "/cards/cricket-good-grid.png", color: "#00ff88" },
  "Closing Streak": { image: "/cards/cricket-good-grid.png", color: "#00ff88" },
  "Bull Control": { image: "/cards/cricket-good-grid.png", color: "#00ff88" },
};

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px" }}>
        {collection.map((card) => {
          const visual = CARD_VISUAL_MAP[card.cardName] || { 
            image: card.gameMode === "Cricket" ? "/cards/cricket-good-grid.png" : "/cards/x01-good-grid.png",
            color: "#ffd24a"
          };
          
          const rarityColors: Record<string, string> = {
            "Common": "#9ca3af",
            "Rare": "#3b82f6",
            "Legendary": "#ffd24a",
          };

          return (
            <div
              key={`${card.cardId}-${card.quantity}`}
              style={{
                position: "relative",
                padding: "12px",
                background: `linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.1)), url('${visual.image}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                border: `2px solid ${visual.color}`,
                borderRadius: "8px",
                textAlign: "center",
                cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
                minHeight: "160px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                color: "#fff",
                boxShadow: `0 0 15px ${visual.color}33`,
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "scale(1.05)";
                el.style.boxShadow = `0 0 25px ${visual.color}66`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "scale(1)";
                el.style.boxShadow = `0 0 15px ${visual.color}33`;
              }}
            >
              {/* Card name */}
              <div style={{
                fontSize: "11px",
                fontWeight: "700",
                textShadow: "0 2px 4px rgba(0,0,0,0.8)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                {card.cardName || `Card ${card.cardId}`}
              </div>

              {/* Rarity badge */}
              <div style={{
                display: "inline-block",
                padding: "4px 8px",
                background: `${rarityColors[card.rarity] || "#9ca3af"}33`,
                border: `1px solid ${rarityColors[card.rarity] || "#9ca3af"}`,
                borderRadius: "4px",
                fontSize: "9px",
                fontWeight: "600",
                color: rarityColors[card.rarity] || "#9ca3af",
                textTransform: "uppercase",
                alignSelf: "center",
              }}>
                {card.rarity || "Unknown"}
              </div>

              {/* Quantity */}
              <div style={{
                fontSize: "16px",
                fontWeight: "700",
                color: visual.color,
                textShadow: "0 2px 4px rgba(0,0,0,0.8)",
              }}>
                ×{card.quantity}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
