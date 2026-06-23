import React, { useState, useEffect } from "react";
import { Trash2, Plus, Minus } from "lucide-react";

const getAdminHeaders = () => {
  const pin = sessionStorage.getItem("tkdl_admin_pin");
  return {
    "Content-Type": "application/json",
    ...(pin ? { "x-admin-pin": pin } : {}),
  };
};

// Light mode compatible colors
const colors = {
  bg: "#ffffff",
  bgSecondary: "#f5f5f5",
  bgTertiary: "#eeeeee",
  text: "#1a1a1a",
  textSecondary: "#555555",
  border: "#d0d0d0",
  success: "#10b981",
  danger: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
  successBg: "#ecfdf5",
  dangerBg: "#fef2f2",
  warningBg: "#fffbeb",
  infoBg: "#eff6ff",
};

export default function AdminCardClashPanel() {
  // Data state
  const [cards, setCards] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [coinAmount, setCoinAmount] = useState("50");
  const [cardQuantity, setCardQuantity] = useState("1");
  const [matchId, setMatchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");

  // Load data on mount
  useEffect(() => {
    loadAllCards();
    loadPlayers();
  }, []);

  const loadAllCards = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/card-clash/admin/cards", {
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      setCards(data);
    } catch (error) {
      console.error("Failed to load cards:", error);
      showMessage("Failed to load cards", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async () => {
    try {
      const res = await fetch("/api/admin/players-list", {
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      setPlayers(data);
    } catch (error) {
      console.error("Failed to load players:", error);
      showMessage("Failed to load players", "error");
    }
  };

  const showMessage = (msg: string, type: "success" | "error" | "info" = "info") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 5000);
  };

  const getSelectedPlayerName = () => {
    const player = players.find(p => p.id.toString() === selectedPlayerId);
    return player ? player.name : "Unknown";
  };

  const seedCards = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/card-clash/admin/seed-cards", { method: "POST" });
      if (res.ok) {
        showMessage("✅ Cards seeded successfully! (100 cards)", "success");
        await new Promise(r => setTimeout(r, 500));
        loadAllCards();
      } else {
        showMessage("Failed to seed cards", "error");
      }
    } catch (error) {
      console.error("Seed error:", error);
      showMessage("Failed to seed cards", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleCard = async (cardId: string, currentEnabled: boolean) => {
    try {
      const res = await fetch("/api/card-clash/admin/card/toggle", {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ cardId, enabled: !currentEnabled }),
      });

      if (res.ok) {
        showMessage(`Card ${!currentEnabled ? "enabled" : "disabled"}`, "success");
        loadAllCards();
      } else {
        showMessage("Failed to toggle card", "error");
      }
    } catch (error) {
      showMessage("Failed to toggle card", "error");
    }
  };

  const giveCoins = async () => {
    if (!selectedPlayerId) {
      showMessage("Select a player", "error");
      return;
    }

    try {
      const res = await fetch("/api/card-clash/admin/coins/give", {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ playerId: parseInt(selectedPlayerId), amount: parseInt(coinAmount) }),
      });

      if (res.ok) {
        const data = await res.json();
        showMessage(`✅ Gave ${coinAmount} coins to ${getSelectedPlayerName()} (Balance: ${data.coinBalance})`, "success");
        setCoinAmount("50");
      } else {
        showMessage("Failed to give coins", "error");
      }
    } catch (error) {
      showMessage("Failed to give coins", "error");
    }
  };

  const removeCoins = async () => {
    if (!selectedPlayerId) {
      showMessage("Select a player", "error");
      return;
    }

    try {
      const res = await fetch("/api/card-clash/admin/coins/remove", {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ playerId: parseInt(selectedPlayerId), amount: parseInt(coinAmount) }),
      });

      if (res.ok) {
        const data = await res.json();
        showMessage(`✅ Removed ${coinAmount} coins from ${getSelectedPlayerName()} (Balance: ${data.coinBalance})`, "success");
        setCoinAmount("50");
      } else {
        showMessage("Failed to remove coins", "error");
      }
    } catch (error) {
      showMessage("Failed to remove coins", "error");
    }
  };

  const giveCard = async () => {
    if (!selectedPlayerId || !selectedCard) {
      showMessage("Select player and card", "error");
      return;
    }

    try {
      const card = cards.find(c => c.cardId === selectedCard);
      const res = await fetch("/api/card-clash/admin/card/give", {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({
          playerId: parseInt(selectedPlayerId),
          cardId: selectedCard,
          quantity: parseInt(cardQuantity),
        }),
      });

      if (res.ok) {
        showMessage(`✅ Gave ${cardQuantity}x "${card?.name}" to ${getSelectedPlayerName()}`, "success");
        setCardQuantity("1");
      } else {
        showMessage("Failed to give card", "error");
      }
    } catch (error) {
      showMessage("Failed to give card", "error");
    }
  };

  const removeCard = async () => {
    if (!selectedPlayerId || !selectedCard) {
      showMessage("Select player and card", "error");
      return;
    }

    try {
      const card = cards.find(c => c.cardId === selectedCard);
      const res = await fetch("/api/card-clash/admin/card/remove", {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({
          playerId: parseInt(selectedPlayerId),
          cardId: selectedCard,
          quantity: parseInt(cardQuantity),
        }),
      });

      if (res.ok) {
        showMessage(`✅ Removed ${cardQuantity}x "${card?.name}" from ${getSelectedPlayerName()}`, "success");
        setCardQuantity("1");
      } else {
        showMessage("Failed to remove card", "error");
      }
    } catch (error) {
      showMessage("Failed to remove card", "error");
    }
  };

  const deleteMatch = async () => {
    if (!matchId) {
      showMessage("Enter match ID", "error");
      return;
    }

    if (!window.confirm("Delete match and revert points/cards?")) return;

    try {
      const res = await fetch("/api/card-clash/admin/match/delete", {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ matchId: parseInt(matchId) }),
      });

      if (res.ok) {
        showMessage("✅ Match deleted and data reverted", "success");
        setMatchId("");
      } else {
        showMessage("Failed to delete match", "error");
      }
    } catch (error) {
      showMessage("Failed to delete match", "error");
    }
  };

  const resetPlayer = async () => {
    if (!selectedPlayerId) {
      showMessage("Select a player", "error");
      return;
    }

    if (!window.confirm(`Reset all Card Clash data for ${getSelectedPlayerName()}?`)) return;

    try {
      const res = await fetch("/api/card-clash/admin/player/reset", {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ playerId: parseInt(selectedPlayerId) }),
      });

      if (res.ok) {
        showMessage(`✅ Reset ${getSelectedPlayerName()} to 0 coins and 0 cards`, "success");
        setSelectedPlayerId("");
      } else {
        showMessage("Failed to reset player", "error");
      }
    } catch (error) {
      showMessage("Failed to reset player", "error");
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1200px", margin: "0 auto", backgroundColor: colors.bg, color: colors.text }}>
      <h2 style={{ fontSize: "24px", fontWeight: "600", marginBottom: "1.5rem", color: colors.text }}>
        🎴 Card Clash Admin Panel
      </h2>

      {/* Message Display */}
      {message && (
        <div
          style={{
            background: messageType === "success" ? colors.successBg : messageType === "error" ? colors.dangerBg : colors.infoBg,
            color: messageType === "success" ? colors.success : messageType === "error" ? colors.danger : colors.info,
            padding: "12px 16px",
            borderRadius: "6px",
            marginBottom: "1.5rem",
            fontSize: "14px",
            border: `1px solid ${messageType === "success" ? colors.success : messageType === "error" ? colors.danger : colors.info}`,
          }}
        >
          {message}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Left Column */}
        <div>
          {/* Card Management Section */}
          <Section title="📋 Card Management">
            <Button onClick={seedCards} disabled={loading} style={{ background: colors.success }}>
              🌱 Seed All 100 Cards
            </Button>

            {cards.length === 0 ? (
              <div style={{ marginTop: "1rem", padding: "1rem", background: colors.bgSecondary, borderRadius: "6px", textAlign: "center", color: colors.textSecondary, fontSize: "13px" }}>
                {loading ? "Loading cards..." : "No cards loaded. Click seed button first."}
              </div>
            ) : (
              <div style={{ marginTop: "1rem" }}>
                <h4 style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px", color: colors.text }}>
                  Toggle Card Availability ({cards.length} cards)
                </h4>
                <div style={{ maxHeight: "400px", overflowY: "auto", border: `1px solid ${colors.border}`, borderRadius: "6px", padding: "8px" }}>
                  {cards.map((card) => (
                    <div
                      key={card.cardId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px",
                        borderBottom: `1px solid ${colors.bgTertiary}`,
                        fontSize: "12px",
                      }}
                    >
                      <span style={{ color: colors.text }}>
                        {card.name} <span style={{ color: colors.textSecondary, fontSize: "11px" }}>({card.gameMode})</span>
                      </span>
                      <button
                        onClick={() => toggleCard(card.cardId, card.enabled)}
                        style={{
                          padding: "4px 8px",
                          fontSize: "11px",
                          background: card.enabled ? colors.success : colors.danger,
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontWeight: "500",
                        }}
                      >
                        {card.enabled ? "✓" : "✗"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Player Selection Section */}
          <Section title="👤 Select Player">
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: `1px solid ${colors.border}`,
                fontSize: "14px",
                backgroundColor: colors.bg,
                color: colors.text,
              }}
            >
              <option value="">-- Choose a player --</option>
              {players.map((p) => (
                <option key={p.id} value={p.id.toString()}>
                  {p.name} (ID: {p.id})
                </option>
              ))}
            </select>
          </Section>
        </div>

        {/* Right Column */}
        <div>
          {/* Coin Management */}
          <Section title="💰 Coin Management">
            <input
              type="number"
              placeholder="Amount"
              value={coinAmount}
              onChange={(e) => setCoinAmount(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: `1px solid ${colors.border}`,
                fontSize: "14px",
                marginBottom: "8px",
                backgroundColor: colors.bg,
                color: colors.text,
              }}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <Button onClick={giveCoins} style={{ background: colors.success }}>
                <Plus size={16} /> Give
              </Button>
              <Button onClick={removeCoins} style={{ background: colors.danger }}>
                <Minus size={16} /> Remove
              </Button>
            </div>
          </Section>

          {/* Card Distribution */}
          <Section title="🎴 Card Distribution">
            <select
              value={selectedCard || ""}
              onChange={(e) => setSelectedCard(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: `1px solid ${colors.border}`,
                fontSize: "14px",
                marginBottom: "8px",
                backgroundColor: colors.bg,
                color: colors.text,
              }}
            >
              <option value="">-- Select a card --</option>
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
                padding: "10px",
                borderRadius: "6px",
                border: `1px solid ${colors.border}`,
                fontSize: "14px",
                marginBottom: "8px",
                backgroundColor: colors.bg,
                color: colors.text,
              }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <Button onClick={giveCard} style={{ background: colors.success }}>
                <Plus size={16} /> Give Card
              </Button>
              <Button onClick={removeCard} style={{ background: colors.danger }}>
                <Trash2 size={16} /> Remove
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
                padding: "10px",
                borderRadius: "6px",
                border: `1px solid ${colors.border}`,
                fontSize: "14px",
                marginBottom: "8px",
                backgroundColor: colors.bg,
                color: colors.text,
              }}
            />
            <Button onClick={deleteMatch} style={{ background: colors.danger, width: "100%" }}>
              <Trash2 size={16} /> Delete Match & Revert
            </Button>
          </Section>

          {/* Reset Player */}
          <Section title="⚠️ Danger Zone">
            <Button onClick={resetPlayer} style={{ background: colors.danger, width: "100%" }}>
              Reset Player Data
            </Button>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1.5rem", padding: "1.5rem", background: colors.bgSecondary, borderRadius: "8px", border: `1px solid ${colors.border}` }}>
      <h3 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "1rem", color: colors.text }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Button({
  onClick,
  disabled = false,
  children,
  style = {},
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        fontSize: "13px",
        fontWeight: "500",
        border: "none",
        borderRadius: "6px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        color: "white",
        transition: "opacity 0.2s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
