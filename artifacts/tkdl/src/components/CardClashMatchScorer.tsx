/**
 * CardClashMatchScorer
 * 
 * Uses the real X01Scorer/CricketScorer engines with Card Clash features:
 * - Cards panel showing current player's 4 equipped cards (2×2)
 * - Card details modal on tap
 * - Effects applied via activeCardEffects prop to scorer
 * - Cards UI only visible during Card Clash matches
 */

import React, { useState, useCallback, useEffect } from "react";
import { X01Scorer, CricketScorer } from "@/lib/scorers";
import { TKDLCard } from "./TKDLCard";
import { ccActivateCard, type CCEffect } from "@/lib/card-effect-engine";
import type { GameResult } from "./game-scorer";
import type { CardData } from "@/lib/cards-data";

interface EquippedCard extends CardData {
  used?: boolean;
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
  // Card effects that will be passed to the scorer
  const [activeCardEffects, setActiveCardEffects] = useState<CCEffect[]>([]);
  const [cardsUsed, setCardsUsed] = useState<string[]>([]);

  // Track which player's cards to show (default to player 1)
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState<0 | 1>(0);
  const [p1Cards, setP1Cards] = useState<EquippedCard[]>(
    player1EquippedCards.map(c => ({ ...c, used: false }))
  );
  const [p2Cards, setP2Cards] = useState<EquippedCard[]>(
    player2EquippedCards.map(c => ({ ...c, used: false }))
  );

  // Card UI state
  const [cardsExpanded, setCardsExpanded] = useState(false);
  const [selectedCard, setSelectedCard] = useState<{ card: EquippedCard; playerIdx: 0 | 1 } | null>(null);

  // Track last confirmed scores to detect turn changes
  const [lastScores, setLastScores] = useState<[number, number]>([
    gameMode === "X01" ? 501 : 0,
    gameMode === "X01" ? 501 : 0,
  ]);

  // Detect turn changes by monitoring score display
  const detectTurnChange = useCallback((p1Score: number, p2Score: number) => {
    // If player 1's score changed (decreased in X01, increased in Cricket), it was their turn
    if (gameMode === "X01") {
      if (p1Score < lastScores[0]) {
        setCurrentPlayerIdx(1); // P1 just played, now P2's turn
      } else if (p2Score < lastScores[1]) {
        setCurrentPlayerIdx(0); // P2 just played, now P1's turn
      }
    } else {
      // Cricket - marks increase
      if (p1Score > lastScores[0]) {
        setCurrentPlayerIdx(1);
      } else if (p2Score > lastScores[1]) {
        setCurrentPlayerIdx(0);
      }
    }
    setLastScores([p1Score, p2Score]);
  }, [lastScores, gameMode]);

  // Handle card tap - show modal
  const handleCardTap = (card: EquippedCard, playerIdx: 0 | 1) => {
    if (card.used) return;
    setSelectedCard({ card, playerIdx });
  };

  // Handle card confirmation
  const handleConfirmCard = useCallback(() => {
    if (!selectedCard) return;
    const { card, playerIdx } = selectedCard;

    // Create and apply card effects
    const effects = ccActivateCard(card, playerIdx);
    if (effects && effects.length > 0) {
      setActiveCardEffects((prev) => [...prev, ...effects]);
      console.log(`🎴 Card "${card.name}" played by player ${playerIdx}:`, effects);
    }

    // Mark card as used
    if (playerIdx === 0) {
      setP1Cards((prev) => prev.map((c) => (c.id === card.id ? { ...c, used: true } : c)));
    } else {
      setP2Cards((prev) => prev.map((c) => (c.id === card.id ? { ...c, used: true } : c)));
    }

    // Track card usage
    setCardsUsed((prev) => [...prev, `${card.id}:p${playerIdx}`]);

    // Close modal
    setSelectedCard(null);
  }, [selectedCard]);

  const handleMatchComplete = (result: GameResult) => {
    onMatchComplete(result, cardsUsed);
  };

  const currentPlayerCards =
    currentPlayerIdx === 0 ? p1Cards : p2Cards;
  const currentPlayerName =
    currentPlayerIdx === 0 ? player1Name : player2Name;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", gap: 0 }}>
      {/* Main Scorer - Full height, flexible */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative", minHeight: 0 }}>
        {gameMode === "X01" ? (
          <X01Scorer
            p1Name={player1Name}
            p2Name={player2Name}
            config={{ startingScore: 501, doubleOut: true }}
            botConfig={isBot ? { avg: 62, sd: 12, checkoutPct: 0.34, hitAcc: 0.45 } : undefined}
            onWin={handleMatchComplete}
            onAbandon={() => {}}
            cardEffects={activeCardEffects}
          />
        ) : (
          <CricketScorer
            p1Name={player1Name}
            p2Name={player2Name}
            botConfig={isBot ? { avg: 62, sd: 12, checkoutPct: 0.34, hitAcc: 0.45 } : undefined}
            onWin={handleMatchComplete}
            onAbandon={() => {}}
            cardEffects={activeCardEffects}
          />
        )}
      </div>

      {/* Cards Section - Fixed at bottom, collapsible */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(0,0,0,0.5)",
          maxHeight: "35%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setCardsExpanded(!cardsExpanded)}
          style={{
            padding: "12px 16px",
            background: "transparent",
            border: "none",
            color: "#ffd24a",
            fontWeight: "700",
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "1px",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <span>🎴 {currentPlayerName}'s Cards</span>
          <span>{cardsExpanded ? "▼" : "▶"}</span>
        </button>

        {/* Cards Grid */}
        {cardsExpanded && (
          <div
            style={{
              padding: "12px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              overflow: "auto",
              flex: 1,
            }}
          >
            {currentPlayerCards.map((card) => (
              <button
                key={card.id}
                onClick={() => handleCardTap(card, currentPlayerIdx)}
                disabled={card.used}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: card.used ? "not-allowed" : "pointer",
                  opacity: card.used ? 0.5 : 1,
                  padding: 0,
                  margin: 0,
                  transform: "scale(0.7)",
                  transformOrigin: "top center",
                }}
              >
                <TKDLCard card={card} size="sm" locked={card.used} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Card Details Modal */}
      {selectedCard && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "16px",
          }}
          onClick={() => setSelectedCard(null)}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #1a1a2e, #16213e)",
              border: "2px solid #ffd24a",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "90%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Card Visual */}
            <div style={{ transform: "scale(0.9)" }}>
              <TKDLCard card={selectedCard.card} size="md" />
            </div>

            {/* Card Info */}
            <div style={{ textAlign: "center", color: "#fff" }}>
              <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", marginBottom: "8px" }}>
                {selectedCard.card.category} • {selectedCard.card.rarity}
              </div>
              <div style={{ fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>
                {selectedCard.card.name}
              </div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.8)", lineHeight: "1.5" }}>
                {selectedCard.card.effect}
              </div>
            </div>

            {/* Confirm Button */}
            <button
              onClick={handleConfirmCard}
              style={{
                padding: "12px 32px",
                background: "#ffd24a",
                color: "#000",
                border: "none",
                borderRadius: "8px",
                fontWeight: "700",
                fontSize: "14px",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              ✓ Confirm Use
            </button>

            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
              Tap outside to cancel
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
