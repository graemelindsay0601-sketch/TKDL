import React, { useState, useEffect } from "react";
import { Trash2, Plus, Minus } from "lucide-react";

export default function AdminCardClashPanel() {
  const [cards, setCards] = useState<any[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [coinAmount, setCoinAmount] = useState("50");
  const [cardQuantity, setCardQuantity] = useState("1");
  const [matchId, setMatchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAllCards();
  }, []);

  const loadAllCards = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/card-clash/admin/cards");
      const data = await res.json();
      setCards(data);
    } catch (error) {
      console.error("Failed to load cards:", error);
      setMessage("Failed to load cards");
    } finally {
      setLoading(false);
    }
  };

  const seedCards = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/card-clash/admin/seed-cards", { method: "POST" });
      if (res.ok) {
        setMessage("Cards seeded successfully!");
        loadAllCards();
      }
    } catch (error) {
      setMessage("Failed to seed cards");
    } finally {
      setLoading(false);
    }
  };

  const toggleCard = async (cardId: string, currentEnabled: boolean) => {
    try {
      const res = await fetch("/api/card-clash/admin/card/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, enabled: !currentEnabled }),
      });

      if (res.ok) {
        setMessage(`Card ${!currentEnabled ? "enabled" : "disabled"}`);
        loadAllCards();
      }
    } catch (error) {
      setMessage("Failed to toggle card");
    }
  };

  const giveCoins = async () => {
    if (!playerId) {
      setMessage("Enter player ID");
      return;
    }

    try {
      const res = await fetch("/api/card-clash/admin/coins/give", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: parseInt(playerId), amount: parseInt(coinAmount) }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage(`Given ${coinAmount} coins. New balance: ${data.coinBalance}`);
        setCoinAmount("50");
      }
    } catch (error) {
      setMessage("Failed to give coins");
    }
  };

  const removeCoins = async () => {
    if (!playerId) {
      setMessage("Enter player ID");
      return;
    }

    try {
      const res = await fetch("/api/card-clash/admin/coins/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: parseInt(playerId), amount: parseInt(coinAmount) }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage(`Removed ${coinAmount} coins. New balance: ${data.coinBalance}`);
      }
    } catch (error) {
      setMessage("Failed to remove coins");
    }
  };

  const giveCard = async () => {
    if (!playerId || !selectedCard) {
      setMessage("Select player and card");
      return;
    }

    try {
      const res = await fetch("/api/card-clash/admin/card/give", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: parseInt(playerId),
          cardId: selectedCard,
          quantity: parseInt(cardQuantity),
        }),
      });

      if (res.ok) {
        setMessage(`Given ${cardQuantity}x card to player ${playerId}`);
        setCardQuantity("1");
      }
    } catch (error) {
      setMessage("Failed to give card");
    }
  };

  const removeCard = async () => {
    if (!playerId || !selectedCard) {
      setMessage("Select player and card");
      return;
    }

    try {
      const res = await fetch("/api/card-clash/admin/card/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: parseInt(playerId),
          cardId: selectedCard,
          quantity: parseInt(cardQuantity),
        }),
      });

      if (res.ok) {
        setMessage(`Removed ${cardQuantity}x card from player ${playerId}`);
        setCardQuantity("1");
      }
    } catch (error) {
      setMessage("Failed to remove card");
    }
  };

  const deleteMatch = async () => {
    if (!matchId) {
      setMessage("Enter match ID");
      return;
    }

    if (!confirm("Delete match and revert points/cards?")) return;

    try {
      const res = await fetch("/api/card-clash/admin/match/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: parseInt(matchId) }),
      });

      if (res.ok) {
        setMessage("Match deleted and data reverted");
        setMatchId("");
      }
    } catch (error) {
      setMessage("Failed to delete match");
    }
  };

  const resetPlayer = async () => {
    if (!playerId) {
      setMessage("Enter player ID");
      return;
    }

    if (!confirm(`Reset all Card Clash data for player ${playerId}?`)) return;

    try {
      const res = await fetch("/api/card-clash/admin/player/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: parseInt(playerId) }),
      });

      if (res.ok) {
        setMessage(`Player ${playerId} reset to 0 coins and 0 cards`);
        setPlayerId("");
      }
    } catch (error) {
      setMessage("Failed to reset player");
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1000px" }}>
      <h2 style={{ fontSize: "20px", fontWeight: 500, marginBottom: "1.5rem" }}>
        🛠️ Card Clash Admin Panel
      </h2>

      {/* Message Display */}
      {message && (
        <div
          style={{
            background: "var(--color-background-info)",
            color: "var(--color-text-info)",
            padding: "12px",
            borderRadius: "var(--border-radius-md)",
            marginBottom: "1rem",
            fontSize: "13px",
          }}
        >
          {message}
        </div>
      )}

      {/* Card Management */}
      <Section title="📋 Card Management">
        <Button onClick={seedCards} disabled={loading}>
          Seed All 100 Cards
        </Button>

        <div style={{ marginTop: "1rem" }}>
          <h4 style={{ fontSize: "13px", marginBottom: "8px" }}>Toggle Card Availability</h4>
          <div style={{ maxHeight: "300px", overflowY: "auto", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "8px" }}>
            {cards.map((card) => (
              <div
                key={card.cardId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px",
                  borderBottom: "0.5px solid var(--color-border-tertiary)",
                  fontSize: "12px",
                }}
              >
                <span>{card.name}</span>
                <button
                  onClick={() => toggleCard(card.cardId, card.enabled)}
                  style={{
                    padding: "4px 8px",
                    fontSize: "11px",
                    background: card.enabled ? "var(--color-background-success)" : "var(--color-background-danger)",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  {card.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Player Selection */}
      <Section title="👤 Select Player">
        <input
          type="number"
          placeholder="Player ID"
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: "var(--border-radius-md)",
            border: "0.5px solid var(--color-border-tertiary)",
            fontSize: "13px",
            marginBottom: "8px",
          }}
        />
      </Section>

      {/* Coin Management */}
      <Section title="💰 Coin Management">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <input
            type="number"
            placeholder="Amount"
            value={coinAmount}
            onChange={(e) => setCoinAmount(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "var(--border-radius-md)",
              border: "0.5px solid var(--color-border-tertiary)",
              fontSize: "13px",
              gridColumn: "1 / -1",
            }}
          />
          <Button onClick={giveCoins}>+ Give Coins</Button>
          <Button onClick={removeCoins} variant="danger">
            - Remove Coins
          </Button>
        </div>
      </Section>

      {/* Card Management */}
      <Section title="🎴 Card Management">
        <select
          value={selectedCard}
          onChange={(e) => setSelectedCard(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: "var(--border-radius-md)",
            border: "0.5px solid var(--color-border-tertiary)",
            fontSize: "13px",
            marginBottom: "8px",
            background: "var(--color-background-primary)",
          }}
        >
          <option value="">Select Card</option>
          {cards.map((card) => (
            <option key={card.cardId} value={card.cardId}>
              {card.name} ({card.gameMode} - {card.rarity})
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Quantity"
          value={cardQuantity}
          onChange={(e) => setCardQuantity(e.target.value)}
          min="1"
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: "var(--border-radius-md)",
            border: "0.5px solid var(--color-border-tertiary)",
            fontSize: "13px",
            marginBottom: "8px",
          }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <Button onClick={giveCard}>+ Give Card</Button>
          <Button onClick={removeCard} variant="danger">
            - Remove Card
          </Button>
        </div>
      </Section>

      {/* Match Management */}
      <Section title="🎯 Match Management">
        <input
          type="number"
          placeholder="Match ID"
          value={matchId}
          onChange={(e) => setMatchId(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: "var(--border-radius-md)",
            border: "0.5px solid var(--color-border-tertiary)",
            fontSize: "13px",
            marginBottom: "8px",
          }}
        />
        <Button onClick={deleteMatch} variant="danger">
          <Trash2 size={14} style={{ marginRight: "4px" }} />
          Delete Match & Revert
        </Button>
      </Section>

      {/* Player Reset */}
      <Section title="⚠️ Dangerous Operations">
        <Button onClick={resetPlayer} variant="danger">
          Reset Player (Clear coins & cards)
        </Button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--color-background-secondary)",
        padding: "1rem",
        borderRadius: "var(--border-radius-lg)",
        border: "0.5px solid var(--color-border-tertiary)",
        marginBottom: "1.5rem",
      }}
    >
      <h3 style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 1rem 0" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}) {
  const bgColor =
    variant === "danger"
      ? "var(--color-background-danger)"
      : "var(--color-background-info)";
  const textColor =
    variant === "danger"
      ? "var(--color-text-danger)"
      : "var(--color-text-info)";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "10px",
        background: bgColor,
        color: textColor,
        border: `0.5px solid ${variant === "danger" ? "var(--color-border-danger)" : "var(--color-border-info)"}`,
        borderRadius: "var(--border-radius-md)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "13px",
        fontWeight: 500,
        opacity: disabled ? 0.5 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}
