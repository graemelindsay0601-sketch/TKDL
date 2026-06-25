import { useState, useEffect } from "react";
import { CardDetailModal } from "./CardDetailModal";

const ALL_CARD_TYPES = [
  { id: "x01g", name: "X01 GOOD", color: "#00e5ff", count: 20 },
  { id: "x01b", name: "X01 BAD", color: "#ff6b6b", count: 20 },
  { id: "cg", name: "CRICKET GOOD", color: "#00ff88", count: 20 },
  { id: "cb", name: "CRICKET BAD", color: "#ff00ff", count: 20 },
  { id: "wg", name: "WILDCARD GOOD", color: "#ffd24a", count: 10 },
  { id: "wb", name: "WILDCARD BAD", color: "#ff8844", count: 10 },
];

export function CardCollectionBook({ playerId }: { playerId: number }) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedType, setExpandedType] = useState<string>("x01g");
  const [selectedCard, setSelectedCard] = useState<any>(null);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    fetch(`/api/card-clash/inventory/${playerId}`)
      .then((r) => r.json())
      .then((d) => {
        setInventory(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load inventory:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [playerId]);

  if (loading) return <div style={{ color: "rgba(255,255,255,0.5)" }}>Loading collection...</div>;
  if (error) return <div style={{ color: "#ff6b6b" }}>Error: {error}</div>;

  const ownedCards = new Map(inventory.map((c) => [c.cardId, c]));
  const totalOwned = inventory.length;
  const completionPercent = Math.round((totalOwned / 100) * 100);

  // Get all possible card IDs for each type
  const getCardIdsForType = (typeId: string) => {
    const cardType = ALL_CARD_TYPES.find(t => t.id === typeId);
    if (!cardType) return [];
    
    if (typeId === "x01g") return Array.from({ length: 20 }, (_, i) => `x01g${String(i + 1).padStart(2, "0")}`);
    if (typeId === "x01b") return Array.from({ length: 20 }, (_, i) => `x01b${String(i + 1).padStart(2, "0")}`);
    if (typeId === "cg") return Array.from({ length: 20 }, (_, i) => `cg${String(i + 1).padStart(2, "0")}`);
    if (typeId === "cb") return Array.from({ length: 20 }, (_, i) => `cb${String(i + 1).padStart(2, "0")}`);
    if (typeId === "wg") return Array.from({ length: 10 }, (_, i) => `wg${String(i + 1).padStart(2, "0")}`);
    if (typeId === "wb") return Array.from({ length: 10 }, (_, i) => `wb${String(i + 1).padStart(2, "0")}`);
    return [];
  };

  return (
    <div style={{ width: "100%" }}>
      <CardDetailModal 
        card={selectedCard} 
        isOpen={!!selectedCard} 
        onClose={() => setSelectedCard(null)} 
      />
      {/* Overall Progress */}
      <div style={{
        padding: "16px",
        background: "linear-gradient(135deg, rgba(255,212,74,0.1), rgba(0,229,255,0.1))",
        border: "2px solid rgba(255,212,74,0.3)",
        borderRadius: "12px",
        marginBottom: "20px",
      }}>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", marginBottom: "8px" }}>
          Collection Progress
        </div>
        <div style={{ fontSize: "28px", fontWeight: "700", color: "#ffd24a", marginBottom: "12px" }}>
          {totalOwned} / 100 Cards
        </div>
        <div style={{ width: "100%", height: "12px", background: "rgba(0,0,0,0.3)", borderRadius: "6px", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${completionPercent}%`,
            background: `linear-gradient(90deg, #00e5ff, #ffd24a)`,
            transition: "width 0.3s",
          }} />
        </div>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginTop: "8px" }}>
          {completionPercent}% Complete
        </div>
      </div>

      {/* Card Type Sections */}
      <div style={{ display: "grid", gap: "16px" }}>
        {ALL_CARD_TYPES.map((typeInfo) => {
          const cardIds = getCardIdsForType(typeInfo.id);
          const ownedCount = cardIds.filter(id => ownedCards.has(id)).length;
          const isExpanded = expandedType === typeInfo.id;

          return (
            <div key={typeInfo.id}>
              {/* Type Header */}
              <div
                style={{
                  padding: "12px 16px",
                  background: `linear-gradient(135deg, ${typeInfo.color}15, ${typeInfo.color}05)`,
                  border: `2px solid ${typeInfo.color}`,
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "all 0.2s",
                }}
                onClick={() => setExpandedType(isExpanded ? "" : typeInfo.id)}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = `linear-gradient(135deg, ${typeInfo.color}25, ${typeInfo.color}10)`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = `linear-gradient(135deg, ${typeInfo.color}15, ${typeInfo.color}05)`;
                }}
              >
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: typeInfo.color, textTransform: "uppercase" }}>
                    {typeInfo.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
                    {ownedCount} / {typeInfo.count} Cards
                  </div>
                </div>
                <div style={{
                  fontSize: "20px",
                  transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                  color: typeInfo.color,
                }}>
                  ▼
                </div>
              </div>

              {/* Cards Grid */}
              {isExpanded && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                  gap: "8px",
                  marginTop: "8px",
                  padding: "12px",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "8px",
                }}>
                  {cardIds.map((cardId, idx) => {
                    const isOwned = ownedCards.has(cardId);
                    const card = isOwned ? ownedCards.get(cardId) : null;

                    return (
                      <div
                        key={cardId}
                        onClick={() => {
                          if (isOwned) {
                            setSelectedCard({
                              ...card,
                              cardId,
                              gameMode: typeInfo.id.includes("x01") ? "X01" : typeInfo.id.includes("cg") || typeInfo.id.includes("cb") ? "Cricket" : "Wildcard",
                            });
                          }
                        }}
                        style={{
                          position: "relative",
                          aspectRatio: "2/3",
                          background: isOwned
                            ? `linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.1)), url('${card?.image || "/cards/x01-good-grid.png"}')`
                            : "rgba(0,0,0,0.3)",
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          border: isOwned ? `2px solid ${typeInfo.color}` : "2px solid rgba(255,255,255,0.1)",
                          borderRadius: "6px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          padding: "8px",
                          cursor: isOwned ? "pointer" : "not-allowed",
                          transition: "all 0.2s",
                          opacity: isOwned ? 1 : 0.4,
                          filter: isOwned ? "none" : "grayscale(100%)",
                          boxShadow: isOwned ? `0 0 12px ${typeInfo.color}33` : "none",
                        }}
                        onMouseEnter={(e) => {
                          if (isOwned) {
                            const el = e.currentTarget as HTMLElement;
                            el.style.transform = "scale(1.05)";
                            el.style.boxShadow = `0 0 20px ${typeInfo.color}66`;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (isOwned) {
                            const el = e.currentTarget as HTMLElement;
                            el.style.transform = "scale(1)";
                            el.style.boxShadow = `0 0 12px ${typeInfo.color}33`;
                          }
                        }}
                      >
                        {/* Card Number */}
                        <div style={{
                          fontSize: "10px",
                          fontWeight: "700",
                          color: isOwned ? typeInfo.color : "rgba(255,255,255,0.3)",
                          textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                        }}>
                          #{idx + 1}
                        </div>

                        {/* Center content */}
                        <div style={{ textAlign: "center" }}>
                          {!isOwned && (
                            <div style={{
                              fontSize: "24px",
                              opacity: 0.5,
                            }}>
                              🔒
                            </div>
                          )}
                        </div>

                        {/* Quantity if owned */}
                        {isOwned && (
                          <div style={{
                            fontSize: "14px",
                            fontWeight: "700",
                            color: typeInfo.color,
                            textShadow: "0 2px 4px rgba(0,0,0,0.8)",
                            textAlign: "right",
                          }}>
                            ×{card?.quantity}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
