/**
 * CardClashMatchScorer - REWRITTEN
 * Clean architecture for oche use:
 * - Compact layout (no scrolling)
 * - Collapsible Cards section (2×2 grid of real card visuals)
 * - Modal popup on card tap
 * - Auto-continue after confirmation
 */

import React, { useState, useCallback } from "react";
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
  // Game state
  const [currentTurn, setCurrentTurn] = useState<0 | 1>(0);
  const [activeCardEffects, setActiveCardEffects] = useState<CCEffect[]>([]);
  const [cardsUsed, setCardsUsed] = useState<string[]>([]);

  // Card UI state
  const [cardsExpanded, setCardsExpanded] = useState(false);
  const [selectedCard, setSelectedCard] = useState<{ card: EquippedCard; playerIndex: 0 | 1 } | null>(null);
  const [p1Cards, setP1Cards] = useState<EquippedCard[]>(player1EquippedCards);
  const [p2Cards, setP2Cards] = useState<EquippedCard[]>(player2EquippedCards);

  // Handle card tap - show modal
  const handleCardTap = (card: EquippedCard, playerIndex: 0 | 1) => {
    if (card.used) return;
    setSelectedCard({ card, playerIndex });
  };

  // Handle card confirmation
  const handleConfirmCard = useCallback(() => {
    if (!selectedCard) return;
    const { card, playerIndex } = selectedCard;

    // Create card effects - MUST pass byPlayer so effects know who played them
    const effects = ccActivateCard(card, playerIndex);
    console.log(`🎴 Card "${card.name}" confirmed by player ${playerIndex}:`, effects);

    if (effects && effects.length > 0) {
      // Add effects to active effects
      setActiveCardEffects((prev) => [...prev, ...effects.filter((e) => !e.instant)]);
    }

    // Mark card as used
    if (playerIndex === 0) {
      setP1Cards((prev) => prev.map((c) => (c.id === card.id ? { ...c, used: true } : c)));
    } else {
      setP2Cards((prev) => prev.map((c) => (c.id === card.id ? { ...c, used: true } : c)));
    }

    // Track used card
    setCardsUsed((prev) => [...prev, `${card.id}:p${playerIndex}`]);

    // DON'T switch turn - card affects current turn, not next turn
    // Turn switches only when scorer says game is over or next player starts

    // Close modal
    setSelectedCard(null);
  }, [selectedCard]);

  const handleMatchComplete = (result: GameResult) => {
    onMatchComplete(result, cardsUsed);
  };

  const currentPlayerCards = currentTurn === 0 ? p1Cards : p2Cards;
  const currentPlayerName = currentTurn === 0 ? player1Name : player2Name;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100%", background: "linear-gradient(135deg, #0a0e18, #1a1f2e)", overflow: "hidden" }}>
      {/* ━━━━━ HEADER: Player Names + Bonus Display ━━━━━ */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>{player1Name}</div>
          <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>{player2Name}</div>
        </div>
      </div>

      {/* ━━━━━ SCORER (X01 or Cricket) ━━━━━ */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {gameMode === "X01" ? (
          <X01Scorer
            p1Name={player1Name}
            p2Name={player2Name}
            config={{ startingScore: 501, doubleOut: true }}
            botConfig={isBot ? { avg: 62, sd: 12, checkoutPct: 0.34, hitAcc: 0.45 } : undefined}
            onWin={(winnerIdx: 0 | 1, detail?: string) => handleMatchComplete({ winnerIdx, detail })}
            onAbandon={() => {}}
            onPracticeStats={undefined}
            cardEffects={activeCardEffects}
          />
        ) : (
          <CricketScorer
            p1Name={player1Name}
            p2Name={player2Name}
            botConfig={isBot ? { avg: 62, sd: 12, checkoutPct: 0.34, hitAcc: 0.45 } : undefined}
            onWin={(winnerIdx: 0 | 1, detail?: string) => handleMatchComplete({ winnerIdx, detail })}
            onAbandon={() => {}}
            onPracticeStats={undefined}
            cardEffects={activeCardEffects}
          />
        )}
      </div>

      {/* ━━━━━ CARDS SECTION (Collapsible) ━━━━━ */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.4)" }}>
        {/* Collapse/Expand Button */}
        <button
          onClick={() => setCardsExpanded(!cardsExpanded)}
          style={{
            width: "100%",
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
          }}
        >
          <span>🎴 Cards - Both Players</span>
          <span>{cardsExpanded ? "▼" : "▶"}</span>
        </button>

        {/* Cards Grid (shown when expanded) - 2x2 P1 + 2x2 P2 */}
        {cardsExpanded && (
          <div
            style={{
              padding: "12px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              maxHeight: "300px",
              overflowY: "auto",
            }}
          >
            {/* Player 1 Cards (4) */}
            {p1Cards.map((card) => (
              <button
                key={`p1-${card.id}`}
                onClick={() => handleCardTap(card, 0)}
                disabled={card.used}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: card.used ? "not-allowed" : "pointer",
                  opacity: card.used ? 0.5 : 1,
                  padding: "0",
                }}
              >
                <div style={{ transform: "scale(0.65)", transformOrigin: "top center", pointerEvents: "none" }}>
                  <TKDLCard card={card} size="sm" locked={card.used} />
                </div>
              </button>
            ))}
            {/* Player 2 Cards (4) */}
            {p2Cards.map((card) => (
              <button
                key={`p2-${card.id}`}
                onClick={() => handleCardTap(card, 1)}
                disabled={card.used}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: card.used ? "not-allowed" : "pointer",
                  opacity: card.used ? 0.5 : 1,
                  padding: "0",
                }}
              >
                <div style={{ transform: "scale(0.65)", transformOrigin: "top center", pointerEvents: "none" }}>
                  <TKDLCard card={card} size="sm" locked={card.used} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ━━━━━ CARD DETAILS MODAL ━━━━━ */}
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
            {/* Full Card Visual */}
            <div style={{ transform: "scale(0.9)" }}>
              <TKDLCard card={selectedCard.card} size="md" />
            </div>

            {/* Card Details */}
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

            {/* Cancel Text */}
            <div
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer",
              }}
              onClick={() => setSelectedCard(null)}
            >
              Tap outside or press back to cancel
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
