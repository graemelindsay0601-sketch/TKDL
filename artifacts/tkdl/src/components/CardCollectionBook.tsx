import { useState, useEffect } from "react";
import { CardDetailModal } from "./CardDetailModal";

export function CardCollectionBook({ playerId }: { playerId: number }) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [allCards, setAllCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedType, setExpandedType] = useState<string>("x01-good");
  const [selectedCard, setSelectedCard] = useState<any>(null);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    
    Promise.all([
      fetch(`/api/card-clash/inventory/${playerId}`).then((r) => r.json()),
      fetch(`/api/card-clash/cards/all`).then((r) => r.json()),
    ])
      .then(([inv, cards]) => {
        setInventory(Array.isArray(inv) ? inv : []);
        setAllCards(Array.isArray(cards) ? cards : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load data:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [playerId]);

  if (loading) return <div style={{ color: "rgba(255,255,255,0.5)" }}>Loading collection...</div>;
  if (error) return <div style={{ color: "#ff6b6b" }}>Error: {error}</div>;

  const ownedCardMap = new Map(inventory.map((c) => [c.cardId, c]));
  const totalOwned = inventory.length;
  const completionPercent = Math.round((totalOwned / 100) * 100);

  // Define card types with colors
  const typeGroups = [
    { id: "x01-good", name: "X01 GOOD", gameMode: "X01", cardType: "GOOD", color: "#00e5ff" },
    { id: "x01-bad", name: "X01 BAD", gameMode: "X01", cardType: "BAD", color: "#ff6b6b" },
    { id: "cricket-good", name: "CRICKET GOOD", gameMode: "CRICKET", cardType: "GOOD", color: "#00ff88" },
    { id: "cricket-bad", name: "CRICKET BAD", gameMode: "CRICKET", cardType: "BAD", color: "#ff00ff" },
    { id: "wildcard-good", name: "WILDCARD GOOD", gameMode: "WILDCARD", cardType: "GOOD", color: "#ffd24a" },
    { id: "wildcard-bad", name: "WILDCARD BAD", gameMode: "WILDCARD", cardType: "BAD", color: "#ff8844" },
  ];

  const getCardsByType = (gameMode: string, cardType: string) => {
    return allCards.filter((c) => c.gameMode === gameMode && c.cardType === cardType);
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
        {typeGroups.map((typeInfo) => {
          const cardsOfType = getCardsByType(typeInfo.gameMode, typeInfo.cardType);
          const ownedCount = cardsOfType.filter((c) => ownedCardMap.has(c.cardId)).length;
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
                    {ownedCount} / {cardsOfType.length} Cards
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
                  {cardsOfType.map((card, idx) => {
                    const isOwned = ownedCardMap.has(card.cardId);
                    const ownedData = isOwned ? ownedCardMap.get(card.cardId) : null;

                    return (
                      <div
                        key={card.cardId}
                        onClick={() => {
                          if (isOwned) {
                            setSelectedCard({
                              cardId: card.cardId,
                              cardName: card.name,
                              gameMode: typeInfo.gameMode,
                              rarity: card.rarity,
                              quantity: ownedData?.quantity || 0,
                              image: card.imageUrl || "/cards/default-card.png",
                              effect: card.description || card.effect,
                            });
                          }
                        }}
                        style={{
                          position: "relative",
                          aspectRatio: "2/3",
                          background: isOwned ? "rgba(0,150,255,0.2)" : "rgba(0,0,0,0.3)",
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
                        {/* Card Name */}
                        <div style={{
                          fontSize: "9px",
                          fontWeight: "700",
                          color: isOwned ? typeInfo.color : "rgba(255,255,255,0.3)",
                          textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {card.name}
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
                            ×{ownedData?.quantity || 1}
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
