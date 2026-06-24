import React, { useEffect, useState } from "react";
import { Package, ChevronDown, ChevronUp } from "lucide-react";

interface Card {
  id: number;
  cardId: string;
  name: string;
  description: string;
  gameMode: string;
  cardType: string;
  rarity: string;
  quantity: number;
  imageUrl?: string;
}

interface CardInventoryDashboardProps {
  playerId: number;
}

export function CardInventoryDashboard({ playerId }: CardInventoryDashboardProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCards();
  }, [playerId]);

  const loadCards = async () => {
    try {
      const res = await fetch(`/api/card-clash/inventory/${playerId}`);
      if (res.ok) {
        const data = await res.json();
        setCards(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    } catch (error) {
      console.error("Failed to load cards:", error);
      setLoading(false);
    }
  };

  const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0);
  const x01Cards = cards.filter((c) => c.gameMode === "X01");
  const cricketCards = cards.filter((c) => c.gameMode === "Cricket");

  const rarityColor = {
    Common: "#888",
    Rare: "#4f99ff",
    Legendary: "#ffd24a",
  };

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.4)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "0.75rem",
        padding: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "none",
          border: "none",
          color: "#fff",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
          padding: 0,
          marginBottom: "0.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "0.95rem",
          fontWeight: 600,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Package size={18} style={{ color: "#ff6b9d" }} />
          <span>Card Collection</span>
          <span
            style={{
              fontSize: "0.85rem",
              color: "rgba(255,107,157,0.7)",
              marginLeft: "0.5rem",
            }}
          >
            {totalCards} cards
          </span>
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div>
          {loading ? (
            <div style={{ color: "#999", fontSize: "0.9rem" }}>Loading cards...</div>
          ) : cards.length === 0 ? (
            <div style={{ color: "#999", fontSize: "0.9rem" }}>No cards yet. Visit Card Shop to purchase!</div>
          ) : (
            <>
              {x01Cards.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "rgba(255,107,157,0.8)",
                      marginBottom: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    X01 Cards ({x01Cards.length})
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem" }}>
                    {x01Cards.map((card) => (
                      <CardItemCompact key={card.cardId} card={card} rarityColor={rarityColor} />
                    ))}
                  </div>
                </div>
              )}

              {cricketCards.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      color: "rgba(0,102,255,0.8)",
                      marginBottom: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    Cricket Cards ({cricketCards.length})
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem" }}>
                    {cricketCards.map((card) => (
                      <CardItemCompact key={card.cardId} card={card} rarityColor={rarityColor} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CardItemCompact({
  card,
  rarityColor,
}: {
  card: Card;
  rarityColor: Record<string, string>;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        border: `2px solid ${rarityColor[card.rarity] || "#888"}`,
        borderRadius: "0.5rem",
        padding: "0.75rem",
        textAlign: "center",
        fontSize: "0.8rem",
      }}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: "0.3rem",
          color: "#fff",
          minHeight: "2.4em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {card.name}
      </div>
      <div
        style={{
          fontSize: "0.7rem",
          color: rarityColor[card.rarity] || "#888",
          fontWeight: 600,
          marginBottom: "0.3rem",
        }}
      >
        {card.rarity}
      </div>
      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem" }}>
        Qty: {card.quantity}
      </div>
    </div>
  );
}
