/**
 * CardClashMatchScorer
 * Wraps X01/Cricket scorers and adds card activation during gameplay
 * Cards are selected BEFORE darts are thrown
 */

import React, { useState, useEffect } from "react";
import { X01Scorer, CricketScorer } from "@/lib/scorers";
import type { GameResult } from "./game-scorer";

interface EquippedCard {
  id: string;
  name: string;
  description: string;
  effect: string;
  cardType: "GOOD" | "BAD";
  rarity: "COMMON" | "RARE" | "LEGENDARY";
  gameMode: string;
  used: boolean;
}

interface CardClashMatchScorerProps {
  player1Id: number;
  player1Name: string;
  player2Id: number;
  player2Name: string;
  gameMode: "X01" | "CRICKET";
  player1EquippedCards: EquippedCard[];
  player2EquippedCards: EquippedCard[];
  onMatchComplete: (result: GameResult, cardsUsed: string[]) => void;
  isBot: boolean;
}

export function CardClashMatchScorer({
  player1Id,
  player1Name,
  player2Id,
  player2Name,
  gameMode,
  player1EquippedCards,
  player2EquippedCards,
  onMatchComplete,
  isBot,
}: CardClashMatchScorerProps) {
  const [activeCardEffect, setActiveCardEffect] = useState<{
    card: EquippedCard;
    playerIndex: 0 | 1;
  } | null>(null);
  const [cardsUsed, setCardsUsed] = useState<string[]>([]);
  const [player1Cards, setPlayer1Cards] = useState(player1EquippedCards);
  const [player2Cards, setPlayer2Cards] = useState(player2EquippedCards);

  // Handle card activation - show visual effect
  const handleCardClick = (card: EquippedCard, playerIndex: 0 | 1) => {
    if (card.used) return;

    // Show activation effect
    setActiveCardEffect({ card, playerIndex });
    
    // Mark card as used
    if (playerIndex === 0) {
      setPlayer1Cards(prev =>
        prev.map(c => (c.id === card.id ? { ...c, used: true } : c))
      );
    } else {
      setPlayer2Cards(prev =>
        prev.map(c => (c.id === card.id ? { ...c, used: true } : c))
      );
    }

    // Track card usage
    setCardsUsed(prev => [...prev, `${card.id}:p${playerIndex}`]);

    // Fade effect after 2 seconds
    setTimeout(() => setActiveCardEffect(null), 2000);
  };

  // Render the appropriate scorer with card UI overlay
  return (
    <div style={{ position: "relative" }}>
      {/* Base Scorer */}
      {gameMode === "X01" ? (
        <X01Scorer
          player1Idx={0}
          player1Name={player1Name}
          player2Idx={1}
          player2Name={player2Name}
          isBot={isBot}
          onComplete={(result: GameResult) => {
            onMatchComplete(result, cardsUsed);
          }}
        />
      ) : (
        <CricketScorer
          player1Idx={0}
          player1Name={player1Name}
          player2Idx={1}
          player2Name={player2Name}
          isBot={isBot}
          onComplete={(result: GameResult) => {
            onMatchComplete(result, cardsUsed);
          }}
        />
      )}

      {/* Card Panel Overlay - Left Side (Player 1) */}
      <div
        style={{
          position: "fixed",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 100,
          padding: "1rem",
          maxWidth: "200px",
        }}
      >
        <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "0.5rem", color: "#666" }}>
          {player1Name} Cards
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {player1Cards.map(card => (
            <button
              key={card.id}
              onClick={() => handleCardClick(card, 0)}
              disabled={card.used}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: card.used ? "1px solid #ccc" : "1px solid #0066ff",
                background: card.used ? "#f0f0f0" : "linear-gradient(135deg, rgba(0, 102, 255, 0.1) 0%, rgba(0, 102, 255, 0.05) 100%)",
                color: card.used ? "#999" : "#000",
                cursor: card.used ? "not-allowed" : "pointer",
                fontSize: "11px",
                fontWeight: "500",
                opacity: card.used ? 0.5 : 1,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!card.used) {
                  (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)";
                }
              }}
              onMouseLeave={(e) => {
                if (!card.used) {
                  (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                }
              }}
              title={card.effect}
            >
              <div style={{ fontWeight: "600" }}>{card.name}</div>
              <div style={{ fontSize: "10px", opacity: 0.7 }}>{card.cardType === "GOOD" ? "✓" : "✗"}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Card Panel Overlay - Right Side (Player 2) */}
      <div
        style={{
          position: "fixed",
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 100,
          padding: "1rem",
          maxWidth: "200px",
        }}
      >
        <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "0.5rem", color: "#666", textAlign: "right" }}>
          {player2Name} Cards
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {player2Cards.map(card => (
            <button
              key={card.id}
              onClick={() => handleCardClick(card, 1)}
              disabled={card.used}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: card.used ? "1px solid #ccc" : "1px solid #ff6b6b",
                background: card.used ? "#f0f0f0" : "linear-gradient(135deg, rgba(255, 107, 107, 0.1) 0%, rgba(255, 107, 107, 0.05) 100%)",
                color: card.used ? "#999" : "#000",
                cursor: card.used ? "not-allowed" : "pointer",
                fontSize: "11px",
                fontWeight: "500",
                opacity: card.used ? 0.5 : 1,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (!card.used) {
                  (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)";
                }
              }}
              onMouseLeave={(e) => {
                if (!card.used) {
                  (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                }
              }}
              title={card.effect}
            >
              <div style={{ fontWeight: "600" }}>{card.name}</div>
              <div style={{ fontSize: "10px", opacity: 0.7 }}>{card.cardType === "GOOD" ? "✓" : "✗"}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Card Activation Effect - Center */}
      {activeCardEffect && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1000,
            animation: "fadeInOut 2s ease-in-out",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "2rem",
              borderRadius: "12px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
              textAlign: "center",
              maxWidth: "400px",
              border: `3px solid ${activeCardEffect.card.cardType === "GOOD" ? "#22C55E" : "#EF4444"}`,
            }}
          >
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "24px", fontWeight: "900" }}>
              {activeCardEffect.card.name}
            </h3>
            <p style={{ margin: "0 0 0.5rem 0", fontSize: "14px", color: "#666" }}>
              {activeCardEffect.card.cardType === "GOOD" ? "BOOST" : "CURSE"}
            </p>
            <p style={{ margin: "0", fontSize: "13px", lineHeight: "1.6", color: "#333" }}>
              {activeCardEffect.card.effect}
            </p>
          </div>
        </div>
      )}

      {/* CSS Animation */}
      <style>{`
        @keyframes fadeInOut {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
        }
      `}</style>
    </div>
  );
}
