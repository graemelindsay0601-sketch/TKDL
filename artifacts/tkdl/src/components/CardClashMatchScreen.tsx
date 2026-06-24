import React, { useState, useEffect } from "react";
import { ChevronLeft, Zap, Trophy, AlertCircle } from "lucide-react";

interface CardClashMatchProps {
  matchId: number;
  player1Id: number;
  player2Id: number;
  gameMode: "X01" | "CRICKET";
  equippedCards: any[];
  currentPlayerId: number;
  onBack: () => void;
}

interface CardInstance {
  id: string;
  name: string;
  cardType: "GOOD" | "BAD";
  rarity: "COMMON" | "RARE" | "LEGENDARY";
  effect: string;
  used: boolean;
  quantity: number;
}

interface GameState {
  player1Score: number;
  player2Score: number;
  currentTurn: 0 | 1; // 0 = player1, 1 = player2
  round: number;
  finished: boolean;
  winner?: number;
  appliedCards: string[];
}

export function CardClashMatchScreen({
  matchId,
  player1Id,
  player2Id,
  gameMode,
  equippedCards,
  currentPlayerId,
  onBack,
}: CardClashMatchProps) {
  const [gameState, setGameState] = useState<GameState>({
    player1Score: gameMode === "X01" ? 501 : 0,
    player2Score: gameMode === "X01" ? 501 : 0,
    currentTurn: 0,
    round: 1,
    finished: false,
    appliedCards: [],
  });

  const [cards, setCards] = useState<CardInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const isYourTurn = gameState.currentTurn === (currentPlayerId === player1Id ? 0 : 1);

  const handleCardUse = (cardIndex: number) => {
    if (!isYourTurn || gameState.finished || cards[cardIndex].used) return;

    const card = cards[cardIndex];
    const scoreChange = calculateCardEffect(card, gameMode, gameState.currentTurn);

    // Apply effect
    const newState = { ...gameState };
    if (gameState.currentTurn === 0) {
      newState.player1Score = Math.max(0, newState.player1Score + scoreChange);
    } else {
      newState.player2Score = Math.max(0, newState.player2Score + scoreChange);
    }

    // Mark card as used
    const newCards = [...cards];
    newCards[cardIndex] = { ...card, used: true, quantity: card.quantity - 1 };
    setCards(newCards);

    // Switch turn
    newState.currentTurn = newState.currentTurn === 0 ? 1 : 0;
    newState.appliedCards.push(card.id);

    // Check win condition
    if (gameMode === "X01" && newState.player1Score === 0) {
      newState.finished = true;
      newState.winner = player1Id;
      setMessage("Player 1 wins!");
    } else if (gameMode === "X01" && newState.player2Score === 0) {
      newState.finished = true;
      newState.winner = player2Id;
      setMessage("Player 2 wins!");
    } else if (gameMode === "CRICKET" && newState.round > 20) {
      const winner = newState.player1Score > newState.player2Score ? player1Id : player2Id;
      newState.finished = true;
      newState.winner = winner;
      setMessage(winner === player1Id ? "Player 1 wins!" : "Player 2 wins!");
    }

    setGameState(newState);
  };

  const handleEndMatch = async () => {
    if (!gameState.finished || !gameState.winner) return;

    setLoading(true);
    try {
      const res = await fetch("/api/card-clash/match/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          winnerId: gameState.winner,
          cardsUsedInMatch: gameState.appliedCards,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setMessage(`Match finished! ${result.message}`);
        setTimeout(() => onBack(), 2000);
      } else {
        setMessage("Failed to finish match");
      }
    } catch (error) {
      setMessage("Error finishing match");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        color: "white",
        padding: "1rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2rem",
          padding: "1rem",
          borderBottom: "2px solid rgba(0, 102, 255, 0.2)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "transparent",
            border: "none",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          <ChevronLeft size={20} />
          Back
        </button>
        <h1
          style={{
            margin: 0,
            fontSize: "24px",
            fontWeight: 900,
            fontFamily: "Oswald, sans-serif",
          }}
        >
          {gameMode === "X01" ? "🎯 X01" : "🦗 CRICKET"}
        </h1>
        <div style={{ width: "60px" }} />
      </div>

      {/* Game Board */}
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "2rem",
          marginBottom: "2rem",
        }}
      >
        {/* Player 1 */}
        <div
          style={{
            background: "rgba(0, 102, 255, 0.1)",
            padding: "2rem",
            borderRadius: "12px",
            border: `3px solid ${gameState.currentTurn === 0 ? "#0066ff" : "rgba(0, 102, 255, 0.3)"}`,
            transition: "all 0.3s ease",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <p style={{ margin: "0 0 0.5rem 0", fontSize: "12px", color: "#999" }}>
              PLAYER 1
            </p>
            <p style={{ margin: 0, fontSize: "48px", fontWeight: 900, fontFamily: "Oswald, sans-serif" }}>
              {gameState.player1Score}
            </p>
            {gameState.currentTurn === 0 && (
              <p style={{ margin: "0.5rem 0 0 0", fontSize: "12px", color: "#0066ff", fontWeight: 600 }}>
                YOUR TURN
              </p>
            )}
          </div>
        </div>

        {/* Player 2 */}
        <div
          style={{
            background: "rgba(255, 107, 107, 0.1)",
            padding: "2rem",
            borderRadius: "12px",
            border: `3px solid ${gameState.currentTurn === 1 ? "#ff6b6b" : "rgba(255, 107, 107, 0.3)"}`,
            transition: "all 0.3s ease",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <p style={{ margin: "0 0 0.5rem 0", fontSize: "12px", color: "#999" }}>
              PLAYER 2
            </p>
            <p style={{ margin: 0, fontSize: "48px", fontWeight: 900, fontFamily: "Oswald, sans-serif" }}>
              {gameState.player2Score}
            </p>
            {gameState.currentTurn === 1 && (
              <p style={{ margin: "0.5rem 0 0 0", fontSize: "12px", color: "#ff6b6b", fontWeight: 600 }}>
                YOUR TURN
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Cards Section */}
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          marginBottom: "2rem",
        }}
      >
        <h2
          style={{
            margin: "0 0 1rem 0",
            fontSize: "18px",
            fontWeight: 700,
            fontFamily: "Oswald, sans-serif",
            letterSpacing: "0.05em",
          }}
        >
          {isYourTurn ? "📍 YOUR EQUIPPED CARDS - CLICK TO USE" : "Waiting for opponent..."}
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
          }}
        >
          {cards.map((card, idx) => (
            <button
              key={idx}
              onClick={() => handleCardUse(idx)}
              disabled={!isYourTurn || gameState.finished || card.used}
              style={{
                padding: "16px",
                borderRadius: "12px",
                border: card.used ? "2px solid #666" : "2px solid #0066ff",
                background: card.used ? "rgba(100, 100, 100, 0.2)" : "linear-gradient(135deg, rgba(0, 102, 255, 0.2) 0%, rgba(0, 102, 255, 0.05) 100%)",
                color: "white",
                cursor: card.used || !isYourTurn || gameState.finished ? "not-allowed" : "pointer",
                opacity: card.used ? 0.5 : 1,
                transition: "all 0.3s ease",
                textAlign: "left",
                transform: card.used ? "scale(0.95)" : "scale(1)",
              }}
              onMouseEnter={(e) => {
                if (!card.used && isYourTurn && !gameState.finished) {
                  (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.02)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 20px rgba(0, 102, 255, 0.4)";
                }
              }}
              onMouseLeave={(e) => {
                if (!card.used && isYourTurn && !gameState.finished) {
                  (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                }
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <Zap size={16} color={card.cardType === "GOOD" ? "#22C55E" : "#EF4444"} />
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: card.cardType === "GOOD" ? "#22C55E" : "#EF4444",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {card.cardType === "GOOD" ? "BOOST" : "CURSE"}
                </span>
              </div>
              <p style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: 700 }}>
                {card.name}
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#aaa", lineHeight: 1.4 }}>
                {card.effect}
              </p>
              {card.used && (
                <p style={{ margin: "8px 0 0 0", fontSize: "10px", color: "#999", fontWeight: 600 }}>
                  USED
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Message Section */}
      {message && (
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto 2rem",
            padding: "1rem",
            background: gameState.finished ? "rgba(34, 197, 94, 0.1)" : "rgba(0, 102, 255, 0.1)",
            borderRadius: "8px",
            border: `1px solid ${gameState.finished ? "#22C55E" : "#0066ff"}`,
            color: gameState.finished ? "#22C55E" : "#0066ff",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {gameState.finished ? <Trophy size={18} /> : <AlertCircle size={18} />}
          {message}
        </div>
      )}

      {/* Action Button */}
      {gameState.finished && (
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            gap: "12px",
          }}
        >
          <button
            onClick={handleEndMatch}
            disabled={loading}
            style={{
              flex: 1,
              padding: "14px",
              background: "linear-gradient(135deg, #0066ff 0%, #0052cc 100%)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.3s ease",
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).transform = "translateY(-2px)";
              }
            }}
          >
            {loading ? "Finishing match..." : "Finish Match & Claim Rewards"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Calculate the effect of a card on the score
 */
function calculateCardEffect(
  card: CardInstance,
  gameMode: "X01" | "CRICKET",
  currentPlayerIndex: number
): number {
  // Good cards help your score
  if (card.cardType === "GOOD") {
    if (gameMode === "X01") {
      // X01: Good cards reduce your remaining score
      return -20; // Closer to 0 is good
    } else {
      // Cricket: Good cards increase your score
      return 15;
    }
  }

  // Bad cards hurt your score / help opponent
  if (card.cardType === "BAD") {
    if (gameMode === "X01") {
      // X01: Bad cards increase opponent's score (opponent needs lower)
      return 20;
    } else {
      // Cricket: Bad cards decrease opponent's score
      return -15;
    }
  }

  return 0;
}
