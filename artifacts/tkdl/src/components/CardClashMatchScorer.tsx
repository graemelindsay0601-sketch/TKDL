/**
 * CardClashMatchScorer - Simple wrapper
 * Enables Card Clash mode in existing X01Scorer/CricketScorer
 * Card effects and UI already built into those scorers
 */

import React, { useEffect, useMemo } from "react";
import { X01Scorer, CricketScorer } from "@/lib/scorers";
import { ccActivateCard } from "@/lib/card-effect-engine";
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
  onAbandon?: () => void;
  isBot: boolean;
  legs?: number;
  setsToWin?: number;
  legsToWinSet?: number;
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
  onAbandon,
  isBot,
  legs,
  setsToWin = 0,
  legsToWinSet = 3,
}: CardClashMatchScorerProps) {
  
  // Set sessionStorage BEFORE rendering scorers (not in useEffect)
  // This ensures scorers see the flag when they mount
  if (typeof window !== "undefined") {
    sessionStorage.setItem("card_clash_mode", "true");
    sessionStorage.setItem("card_clash_p1_cards", JSON.stringify(player1EquippedCards));
    sessionStorage.setItem("card_clash_p2_cards", JSON.stringify(player2EquippedCards));
    // Reset the cards-used log for this match; scorers append to it as cards are activated.
    sessionStorage.setItem("card_clash_cards_used", "[]");
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sessionStorage.removeItem("card_clash_mode");
      sessionStorage.removeItem("card_clash_p1_cards");
      sessionStorage.removeItem("card_clash_p2_cards");
      sessionStorage.removeItem("card_clash_cards_used");
    };
  }, []);

  // Don't pre-activate cards - wait for player to confirm activation in CardActivationOverlay
  // Cards should only activate when player clicks "Confirm"
  const cardEffects: any[] = [];

  const handleMatchComplete = (w: 0 | 1, detail?: string) => {
    let cardsUsed: string[] = [];
    try {
      const raw = sessionStorage.getItem("card_clash_cards_used") || "[]";
      const used: Array<{ cardId: string; turn: 0 | 1 }> = JSON.parse(raw);
      cardsUsed = used.map(u => `${u.cardId}:p${u.turn === 0 ? player1Id : player2Id}`);
    } catch {
      cardsUsed = [];
    }
    onMatchComplete({ winnerIdx: w, detail }, cardsUsed);
  };

  const handleAbandon = () => {
    onAbandon?.();
  };

  // Render scorer directly - no wrapper, just like GameScorer/Practice mode
  if (gameMode === "X01") {
    return (
      <X01Scorer
        p1Name={player1Name}
        p2Name={player2Name}
        config={{ startingScore: 501, doubleOut: true }}
        botConfig={isBot ? { avg: 62, sd: 12, checkoutPct: 0.34, hitAcc: 0.45 } : undefined}
        onWin={handleMatchComplete}
        onAbandon={handleAbandon}
        cardEffects={cardEffects}
        legs={legs}
        setsToWin={setsToWin}
        legsToWinSet={legsToWinSet}
      />
    );
  } else {
    return (
      <CricketScorer
        p1Name={player1Name}
        p2Name={player2Name}
        botConfig={isBot ? { avg: 62, sd: 12, checkoutPct: 0.34, hitAcc: 0.45 } : undefined}
        onWin={handleMatchComplete}
        onAbandon={handleAbandon}
        cardEffects={cardEffects}
        legs={legs}
        setsToWin={setsToWin}
        legsToWinSet={legsToWinSet}
      />
    );
  }
}
