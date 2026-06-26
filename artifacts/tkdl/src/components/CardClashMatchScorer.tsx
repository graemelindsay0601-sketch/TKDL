/**
 * CardClashMatchScorer
 * Wraps X01/Cricket scorers and applies real card effects during gameplay.
 * Cards are played during the match — GOOD cards boost the activating player,
 * BAD cards curse the opponent. Bonuses are tracked and shown at match end.
 */

import React, { useState } from "react";
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

interface EffectEntry {
  card: EquippedCard;
  playerIndex: 0 | 1;
  bonus: number;
  timestamp: number;
}

interface ActiveEffect {
  card: EquippedCard;
  playerIndex: 0 | 1;
  bonus: number;
}

interface MatchSummary {
  result: GameResult;
  player1Bonus: number;
  player2Bonus: number;
  effectHistory: EffectEntry[];
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

/**
 * Parse and apply card effects based on game mode, card type, and game state
 * Returns the bonus/penalty to apply to opponent's or player's score
 */
function applyCardEffect(
  card: EquippedCard,
  gameMode: "X01" | "CRICKET",
  currentScore?: number,  // Current player's remaining score in X01, or marks in Cricket
  opponentScore?: number  // Opponent's score
): number {
  const effect = card.effect.toLowerCase();
  
  // X01-specific GOOD cards
  if (gameMode === "X01" && card.cardType === "GOOD") {
    // "High Roller": +25 if scored over 100
    if (effect.includes("score over 100")) return 25;
    
    // "Banking Strategy": +20 if scored 50+
    if (effect.includes("50+")) return 20;
    
    // "Finishing Bonus": +50 if finished
    if (effect.includes("finish")) return 50;
    
    // "Checkout Specialist": +20 on double checkout
    if (effect.includes("checkout") && effect.includes("double")) return 20;
    
    // Fallback for other X01 GOOD cards
    if (effect.includes("bonus")) {
      const match = effect.match(/\+?(\d+)/);
      return match ? Math.min(parseInt(match[1]), 50) : 20;
    }
  }
  
  // X01-specific BAD cards (penalty to opponent)
  if (gameMode === "X01" && card.cardType === "BAD") {
    // "Wild Throw": -20 penalty
    if (effect.includes("miss")) return -20;
    
    // "Doubles Don't Count": -30 penalty (affects scoring)
    if (effect.includes("double") && effect.includes("count")) return -30;
    
    // "Low Blow": -25 penalty (singles don't count)
    if (effect.includes("single") && effect.includes("count")) return -25;
    
    // Default BAD card penalty
    return -15;
  }
  
  // Cricket-specific GOOD cards
  if (gameMode === "CRICKET" && card.cardType === "GOOD") {
    // "Double Strike": marks count as 2x
    if (effect.includes("mark") && effect.includes("2x")) return 25;
    
    // "Mark Flood": all darts automatically mark
    if (effect.includes("mark") && effect.includes("automatic")) return 30;
    
    // Fallback for other Cricket GOOD cards
    return 20;
  }
  
  // Cricket-specific BAD cards
  if (gameMode === "CRICKET" && card.cardType === "BAD") {
    // "Sluggish Marks": marks count as 1
    if (effect.includes("mark") && effect.includes("count") && effect.includes("1")) return -25;
    
    // Default Cricket BAD card penalty
    return -15;
  }
  
  // Wildcard cards - apply universal effects
  if (card.gameMode === "WILDCARD") {
    if (card.cardType === "GOOD") return 25;
    if (card.cardType === "BAD") return -20;
  }
  
  // Fallback: extract number from effect
  const numMatch = effect.match(/(\d+)/);
  if (numMatch) {
    const value = parseInt(numMatch[1], 10);
    return card.cardType === "GOOD" ? Math.min(value, 50) : -Math.min(value, 50);
  }
  
  // Final fallback by rarity
  const rarityBonus = card.rarity === "LEGENDARY" ? 30 : card.rarity === "RARE" ? 20 : 10;
  return card.cardType === "GOOD" ? rarityBonus : -rarityBonus;
}

/**
 * Build a human-readable sentence for what a card just did.
 */
function buildEffectSentence(
  card: EquippedCard,
  playerName: string,
  opponentName: string,
  bonus: number
): string {
  if (card.cardType === "GOOD") {
    return `${playerName} played ${card.name} — +${bonus} point bonus!`;
  } else {
    return `${playerName} cursed ${opponentName} with ${card.name} — ${opponentName} loses ${bonus} points!`;
  }
}

const RARITY_GLOW: Record<string, string> = {
  LEGENDARY: "#ffd700",
  RARE:      "#4169e1",
  COMMON:    "#c0c0c0",
};

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
  const [player1Cards, setPlayer1Cards] = useState(player1EquippedCards);
  const [player2Cards, setPlayer2Cards] = useState(player2EquippedCards);

  const [player1Bonus, setPlayer1Bonus] = useState(0);
  const [player2Bonus, setPlayer2Bonus] = useState(0);

  const [cardsUsed, setCardsUsed] = useState<string[]>([]);
  const [effectHistory, setEffectHistory] = useState<EffectEntry[]>([]);
  const [activeEffect, setActiveEffect] = useState<ActiveEffect | null>(null);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);

  const handleCardClick = (card: EquippedCard, playerIndex: 0 | 1) => {
    if (card.used) return;

    const bonus = applyCardEffect(card, gameMode);

    // Apply the bonus: GOOD helps you, BAD hurts the opponent
    // For GOOD cards: bonus is positive, apply to self
    // For BAD cards: bonus is negative, apply to opponent
    if (card.cardType === "GOOD") {
      if (playerIndex === 0) setPlayer1Bonus((p) => p + bonus);
      else setPlayer2Bonus((p) => p + bonus);
    } else {
      // BAD card: bonus is negative, apply to opponent (which adds the negative, reducing their bonus)
      if (playerIndex === 0) setPlayer2Bonus((p) => p + bonus);
      else setPlayer1Bonus((p) => p + bonus);
    }

    // Mark card as used
    if (playerIndex === 0) {
      setPlayer1Cards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, used: true } : c))
      );
    } else {
      setPlayer2Cards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, used: true } : c))
      );
    }

    const entry: EffectEntry = { card, playerIndex, bonus, timestamp: Date.now() };
    setCardsUsed((prev) => [...prev, `${card.id}:p${playerIndex}`]);
    setEffectHistory((prev) => [...prev, entry]);

    // Show animated overlay
    setActiveEffect({ card, playerIndex, bonus });
    setTimeout(() => setActiveEffect(null), 3000);
  };

  const handleMatchComplete = (result: GameResult) => {
    setMatchSummary({ result, player1Bonus, player2Bonus, effectHistory });
  };

  const handleDismissSummary = () => {
    if (!matchSummary) return;
    onMatchComplete(matchSummary.result, cardsUsed);
  };

  // ─── Match Summary Overlay ───────────────────────────────────────────────────
  if (matchSummary) {
    const winnerName = matchSummary.result.winnerIdx === 0 ? player1Name : player2Name;
    const p1Net = matchSummary.player1Bonus;
    const p2Net = matchSummary.player2Bonus;

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.85)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #1a1a2e, #16213e)",
            border: "2px solid #ffd24a",
            borderRadius: "16px",
            padding: "2.5rem",
            maxWidth: "520px",
            width: "90%",
            textAlign: "center",
            color: "#fff",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "0.5rem" }}>🎴</div>
          <h2 style={{ color: "#ffd24a", fontSize: "24px", margin: "0 0 0.25rem 0" }}>
            Match Over!
          </h2>
          <p style={{ color: "rgba(255,255,255,0.7)", margin: "0 0 1.5rem 0", fontSize: "14px" }}>
            {winnerName} wins
          </p>

          {/* Card Effect Totals */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              marginBottom: "1.5rem",
            }}
          >
            <BonusBox
              name={player1Name}
              net={p1Net}
              highlight={matchSummary.result.winnerIdx === 0}
            />
            <BonusBox
              name={player2Name}
              net={p2Net}
              highlight={matchSummary.result.winnerIdx === 1}
            />
          </div>

          {/* Effect History */}
          {matchSummary.effectHistory.length > 0 && (
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: "10px",
                padding: "1rem",
                marginBottom: "1.5rem",
                textAlign: "left",
                maxHeight: "180px",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  letterSpacing: "1px",
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                }}
              >
                Cards Played
              </div>
              {matchSummary.effectHistory.map((entry, i) => {
                const pName = entry.playerIndex === 0 ? player1Name : player2Name;
                const oppName = entry.playerIndex === 0 ? player2Name : player1Name;
                return (
                  <div
                    key={i}
                    style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.8)",
                      padding: "4px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {buildEffectSentence(entry.card, pName, oppName, entry.bonus)}
                  </div>
                );
              })}
            </div>
          )}

          {matchSummary.effectHistory.length === 0 && (
            <p
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: "13px",
                marginBottom: "1.5rem",
              }}
            >
              No cards were played this match.
            </p>
          )}

          <button
            onClick={handleDismissSummary}
            style={{
              padding: "12px 32px",
              background: "#ffd24a",
              color: "#000",
              border: "none",
              borderRadius: "8px",
              fontWeight: "700",
              fontSize: "15px",
              cursor: "pointer",
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Match View ─────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative" }}>

      {/* Base Scorer */}
      {gameMode === "X01" ? (
        <X01Scorer
          p1Name={player1Name}
          p2Name={player2Name}
          config={{ startingScore: 501, doubleOut: true }}
          botConfig={isBot ? { avg: 62, sd: 12, checkoutPct: 0.34, hitAcc: 0.45 } : undefined}
          onWin={(winnerIdx: 0 | 1, detail?: string) => handleMatchComplete({ winnerIdx, detail })}
          onAbandon={() => {}}
          onPracticeStats={undefined}
        />
      ) : (
        <CricketScorer
          p1Name={player1Name}
          p2Name={player2Name}
          botConfig={isBot ? { avg: 62, sd: 12, checkoutPct: 0.34, hitAcc: 0.45 } : undefined}
          onWin={(winnerIdx: 0 | 1, detail?: string) => handleMatchComplete({ winnerIdx, detail })}
          onAbandon={() => {}}
          onPracticeStats={undefined}
        />
      )}

      {/* Player 1 Card Panel — Left */}
      <CardPanel
        playerName={player1Name}
        cards={player1Cards}
        bonus={player1Bonus}
        side="left"
        onCardClick={(card) => handleCardClick(card, 0)}
      />

      {/* Player 2 Card Panel — Right */}
      <CardPanel
        playerName={player2Name}
        cards={player2Cards}
        bonus={player2Bonus}
        side="right"
        onCardClick={(card) => handleCardClick(card, 1)}
      />

      {/* Card Activation Effect Overlay */}
      {activeEffect && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1000,
            pointerEvents: "none",
            animation: "cardEffectPop 3s ease-in-out forwards",
          }}
        >
          <div
            style={{
              background: activeEffect.card.cardType === "GOOD"
                ? "linear-gradient(135deg, #1a3a1a, #0a2a0a)"
                : "linear-gradient(135deg, #3a1a1a, #2a0a0a)",
              border: `3px solid ${RARITY_GLOW[activeEffect.card.rarity]}`,
              borderRadius: "14px",
              padding: "1.5rem 2rem",
              textAlign: "center",
              minWidth: "300px",
              boxShadow: `0 0 40px ${RARITY_GLOW[activeEffect.card.rarity]}80`,
            }}
          >
            <div style={{ fontSize: "28px", marginBottom: "6px" }}>
              {activeEffect.card.cardType === "GOOD" ? "⚡" : "💀"}
            </div>
            <div
              style={{
                color: "#fff",
                fontWeight: "900",
                fontSize: "20px",
                marginBottom: "4px",
              }}
            >
              {activeEffect.card.name}
            </div>
            <div
              style={{
                color: activeEffect.card.cardType === "GOOD" ? "#00ff88" : "#ff6b6b",
                fontSize: "28px",
                fontWeight: "900",
                marginBottom: "6px",
              }}
            >
              {activeEffect.card.cardType === "GOOD" ? "+" : "−"}{activeEffect.bonus}
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: "13px",
                fontStyle: "italic",
              }}
            >
              {activeEffect.card.effect}
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes cardEffectPop {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
          15%  { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
          25%  { transform: translate(-50%, -50%) scale(1); }
          75%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CardPanel({
  playerName,
  cards,
  bonus,
  side,
  onCardClick,
}: {
  playerName: string;
  cards: EquippedCard[];
  bonus: number;
  side: "left" | "right";
  onCardClick: (card: EquippedCard) => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        [side]: 0,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 100,
        padding: "12px 8px",
        maxWidth: "190px",
        background: "rgba(0,0,0,0.6)",
        borderRadius: side === "left" ? "0 12px 12px 0" : "12px 0 0 12px",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {/* Player label + running bonus */}
      <div
        style={{
          fontSize: "11px",
          fontWeight: "700",
          marginBottom: "6px",
          color: "rgba(255,255,255,0.6)",
          textAlign: side === "right" ? "right" : "left",
        }}
      >
        {playerName}
      </div>
      {bonus !== 0 && (
        <div
          style={{
            fontSize: "16px",
            fontWeight: "900",
            color: bonus > 0 ? "#00ff88" : "#ff6b6b",
            marginBottom: "8px",
            textAlign: side === "right" ? "right" : "left",
          }}
        >
          {bonus > 0 ? `+${bonus}` : bonus} pts
        </div>
      )}

      {/* Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {cards.map((card) => (
          <CardButton
            key={card.id}
            card={card}
            onClick={() => onCardClick(card)}
          />
        ))}
      </div>
    </div>
  );
}

function CardButton({
  card,
  onClick,
}: {
  card: EquippedCard;
  onClick: () => void;
}) {
  const isGood = card.cardType === "GOOD";
  const rarityColor = RARITY_GLOW[card.rarity];

  return (
    <button
      onClick={onClick}
      disabled={card.used}
      title={card.used ? "Already used" : card.effect}
      style={{
        padding: "7px 10px",
        borderRadius: "8px",
        border: card.used
          ? "1px solid rgba(255,255,255,0.1)"
          : `1px solid ${rarityColor}`,
        background: card.used
          ? "rgba(255,255,255,0.05)"
          : isGood
          ? "linear-gradient(135deg, rgba(0,255,136,0.12), rgba(0,200,100,0.06))"
          : "linear-gradient(135deg, rgba(255,107,107,0.12), rgba(200,50,50,0.06))",
        color: card.used ? "rgba(255,255,255,0.25)" : "#fff",
        cursor: card.used ? "not-allowed" : "pointer",
        fontSize: "11px",
        fontWeight: "600",
        opacity: card.used ? 0.4 : 1,
        transition: "all 0.15s",
        textAlign: "left",
        width: "100%",
        boxShadow: card.used ? "none" : `0 0 6px ${rarityColor}40`,
      }}
      onMouseEnter={(e) => {
        if (!card.used) {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.04)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <span>{isGood ? "⚡" : "💀"}</span>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "120px",
          }}
        >
          {card.name}
        </span>
      </div>
      <div
        style={{
          fontSize: "9px",
          color: rarityColor,
          marginTop: "2px",
          letterSpacing: "0.5px",
        }}
      >
        {card.rarity}
      </div>
    </button>
  );
}

function BonusBox({
  name,
  net,
  highlight,
}: {
  name: string;
  net: number;
  highlight: boolean;
}) {
  return (
    <div
      style={{
        background: highlight ? "rgba(255,212,74,0.1)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${highlight ? "#ffd24a" : "rgba(255,255,255,0.1)"}`,
        borderRadius: "10px",
        padding: "12px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.6)",
          marginBottom: "6px",
          fontWeight: "600",
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontSize: "26px",
          fontWeight: "900",
          color: net > 0 ? "#00ff88" : net < 0 ? "#ff6b6b" : "rgba(255,255,255,0.4)",
        }}
      >
        {net > 0 ? `+${net}` : net === 0 ? "±0" : net}
      </div>
      <div
        style={{
          fontSize: "10px",
          color: "rgba(255,255,255,0.4)",
          marginTop: "4px",
        }}
      >
        card bonus
      </div>
    </div>
  );
}
