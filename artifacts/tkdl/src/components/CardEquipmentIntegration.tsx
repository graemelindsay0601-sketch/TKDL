import React, { useState, useEffect } from "react";
import { Zap, Info } from "lucide-react";

export function CardEquipmentGuide() {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div style={{
      padding: "16px",
      background: "linear-gradient(135deg, rgba(255,212,74,0.1), rgba(0,229,255,0.1))",
      border: "1px solid rgba(255,212,74,0.3)",
      borderRadius: "8px",
      marginBottom: "16px",
    }}>
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        cursor: "pointer",
      }}
      onClick={() => setShowDetail(!showDetail)}>
        <Zap size={20} style={{ color: "#ffd24a", marginTop: "2px", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: "14px",
            fontWeight: "600",
            color: "#fff",
            marginBottom: "4px",
          }}>
            How to Use Cards in Matches
          </div>
          <div style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.6)",
          }}>
            Cards must be equipped before a match starts
          </div>
        </div>
      </div>

      {showDetail && (
        <div style={{
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "1px solid rgba(255,212,74,0.2)",
        }}>
          <div style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.8)",
            lineHeight: "1.6",
          }}>
            <div style={{ marginBottom: "8px" }}>
              <strong style={{ color: "#ffd24a" }}>Step 1:</strong> Before starting a match, the equipment screen will show
            </div>
            <div style={{ marginBottom: "8px" }}>
              <strong style={{ color: "#ffd24a" }}>Step 2:</strong> Select up to 4 cards (2 good + 2 bad) from your collection
            </div>
            <div style={{ marginBottom: "8px" }}>
              <strong style={{ color: "#ffd24a" }}>Step 3:</strong> Cards are consumed during the match when their effects activate
            </div>
            <div style={{
              marginTop: "12px",
              padding: "8px",
              background: "rgba(0,0,0,0.2)",
              borderRadius: "4px",
              borderLeft: "3px solid #ffd24a",
            }}>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>
                💡 <strong>Pro Tip:</strong> Equip good cards early in the match, bad cards as a counter when needed
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CardEquipmentIntegrationProps {
  playerId: number;
  onEquipmentReady?: (equipped: any[]) => void;
}

export function CardEquipmentIntegration({ playerId, onEquipmentReady }: CardEquipmentIntegrationProps) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [equipped, setEquipped] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load player inventory
    fetch(`/api/card-clash/inventory/${playerId}`)
      .then((r) => r.json())
      .then((data) => {
        setInventory(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [playerId]);

  const toggleCard = (card: any) => {
    const isEquipped = equipped.some((c) => c.cardId === card.cardId);
    let newEquipped = isEquipped ? equipped.filter((c) => c.cardId !== card.cardId) : [...equipped, card];

    // Enforce 4 card limit
    if (newEquipped.length > 4) {
      newEquipped = newEquipped.slice(0, 4);
    }

    setEquipped(newEquipped);
    onEquipmentReady?.(newEquipped);
  };

  const goodCards = equipped.filter((c) => !c.type?.includes("BAD"));
  const badCards = equipped.filter((c) => c.type?.includes("BAD"));

  const isValid = goodCards.length <= 2 && badCards.length <= 2 && equipped.length <= 4;

  if (loading) return <div style={{ color: "rgba(255,255,255,0.5)" }}>Loading cards...</div>;

  return (
    <div>
      <CardEquipmentGuide />

      {/* Status */}
      <div style={{
        padding: "12px",
        background: isValid ? "rgba(34,197,94,0.1)" : "rgba(255,107,107,0.1)",
        border: `1px solid ${isValid ? "#22c55e" : "#ff6b6b"}`,
        borderRadius: "6px",
        marginBottom: "16px",
        fontSize: "12px",
        color: isValid ? "#22c55e" : "#ff6b6b",
      }}>
        <div style={{ fontWeight: "600", marginBottom: "4px" }}>
          {equipped.length === 0 ? "No cards equipped" : `${equipped.length}/4 cards equipped`}
        </div>
        <div style={{ fontSize: "11px", opacity: 0.8 }}>
          {goodCards.length}/2 good cards · {badCards.length}/2 bad cards
        </div>
      </div>

      {/* Equipped Cards */}
      {equipped.length > 0 && (
        <div style={{
          padding: "12px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "6px",
          marginBottom: "16px",
        }}>
          <div style={{
            fontSize: "12px",
            fontWeight: "600",
            color: "rgba(255,255,255,0.6)",
            marginBottom: "8px",
          }}>
            EQUIPPED CARDS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
            {equipped.map((card) => (
              <div
                key={card.cardId}
                style={{
                  padding: "8px",
                  background: "rgba(255,212,74,0.1)",
                  border: "1px solid rgba(255,212,74,0.3)",
                  borderRadius: "4px",
                  fontSize: "11px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onClick={() => toggleCard(card)}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "rgba(255,212,74,0.15)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "rgba(255,212,74,0.1)";
                }}
              >
                <div style={{ color: "#ffd24a", fontWeight: "600" }}>{card.cardName}</div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px" }}>×{card.quantity}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Cards */}
      <div>
        <div style={{
          fontSize: "12px",
          fontWeight: "600",
          color: "rgba(255,255,255,0.6)",
          marginBottom: "8px",
        }}>
          AVAILABLE CARDS ({inventory.filter((c) => (c.quantity || 0) > 0).length})
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
          {inventory
            .filter((c) => (c.quantity || 0) > 0 && !equipped.some((e) => e.cardId === c.cardId))
            .slice(0, 8)
            .map((card) => (
              <div
                key={card.cardId}
                onClick={() => toggleCard(card)}
                style={{
                  padding: "8px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "4px",
                  fontSize: "11px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "rgba(255,255,255,0.1)";
                  el.style.borderColor = "rgba(255,255,255,0.2)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "rgba(255,255,255,0.05)";
                  el.style.borderColor = "rgba(255,255,255,0.1)";
                }}
              >
                <div style={{ fontWeight: "600", color: "#fff" }}>{card.cardName}</div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px" }}>×{card.quantity}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
