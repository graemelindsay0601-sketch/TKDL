import React, { useState, useEffect } from "react";

export function CardTrading({ playerId }: { playerId: number }) {
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    fetch(`/api/card-clash/inventory/${playerId}`)
      .then((r) => r.json())
      .then((d) => {
        // Find cards with quantity > 1
        const dups = (Array.isArray(d) ? d : []).filter((c) => (c.quantity || 1) > 1);
        setDuplicates(dups);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [playerId]);

  const handleSellCard = async (card: any) => {
    const coinsPerCard = 10;
    const coinsEarned = coinsPerCard;

    try {
      const res = await fetch(`/api/card-clash/admin/card/remove`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-admin-pin": "0601",
        },
        body: JSON.stringify({
          playerId,
          cardId: card.cardId,
          quantity: 1,
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: `Sold ${card.cardName} for ${coinsEarned} coins!` });
        setDuplicates(duplicates.filter((c) => c.cardId !== card.cardId || (c.quantity || 1) > 2));
        setSelectedCard(null);
      } else {
        setMessage({ type: "error", text: "Failed to sell card" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error selling card" });
    }
  };

  if (loading) return <div style={{ color: "rgba(255,255,255,0.5)" }}>Loading duplicates...</div>;
  if (duplicates.length === 0)
    return <div style={{ color: "rgba(255,255,255,0.5)" }}>No duplicate cards to trade</div>;

  return (
    <div>
      {message && (
        <div
          style={{
            padding: "12px",
            background: message.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(255,107,107,0.1)",
            border: `1px solid ${message.type === "success" ? "#22c55e" : "#ff6b6b"}`,
            borderRadius: "6px",
            color: message.type === "success" ? "#22c55e" : "#ff6b6b",
            marginBottom: "12px",
            fontSize: "12px",
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ display: "grid", gap: "8px" }}>
        {duplicates.map((card) => (
          <div
            key={card.cardId}
            style={{
              padding: "12px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "rgba(255,255,255,0.08)";
              el.style.borderColor = "rgba(255,255,255,0.2)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "rgba(255,255,255,0.05)";
              el.style.borderColor = "rgba(255,255,255,0.1)";
            }}
          >
            <div>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#fff" }}>{card.cardName}</div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>Quantity: ×{card.quantity}</div>
            </div>
            <button
              onClick={() => handleSellCard(card)}
              style={{
                padding: "8px 16px",
                background: "rgba(255,212,74,0.2)",
                border: "1px solid rgba(255,212,74,0.5)",
                color: "#ffd24a",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: "600",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(255,212,74,0.3)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(255,212,74,0.2)";
              }}
            >
              Sell for 10 coins
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
