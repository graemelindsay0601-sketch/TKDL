/**
 * CardClashMatchScorer - Simple wrapper
 * Enables Card Clash mode in existing X01Scorer/CricketScorer
 * Card effects and UI already built into those scorers
 */

import React, { useEffect } from "react";
import { X01Scorer, CricketScorer } from "@/lib/scorers";
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
  
  // Enable Card Clash mode in scorers via sessionStorage
  useEffect(() => {
    sessionStorage.setItem("card_clash_mode", "true");
    sessionStorage.setItem("card_clash_p1_cards", JSON.stringify(player1EquippedCards));
    sessionStorage.setItem("card_clash_p2_cards", JSON.stringify(player2EquippedCards));
    
    return () => {
      sessionStorage.removeItem("card_clash_mode");
      sessionStorage.removeItem("card_clash_p1_cards");
      sessionStorage.removeItem("card_clash_p2_cards");
    };
  }, [player1EquippedCards, player2EquippedCards]);

  const handleMatchComplete = (result: GameResult) => {
    onMatchComplete(result, []);
  };

  return gameMode === "X01" ? (
    <X01Scorer
      p1Name={player1Name}
      p2Name={player2Name}
      config={{ startingScore: 501, doubleOut: true }}
      botConfig={isBot ? { avg: 62, sd: 12, checkoutPct: 0.34, hitAcc: 0.45 } : undefined}
      onWin={handleMatchComplete}
      onAbandon={() => {}}
    />
  ) : (
    <CricketScorer
      p1Name={player1Name}
      p2Name={player2Name}
      botConfig={isBot ? { avg: 62, sd: 12, checkoutPct: 0.34, hitAcc: 0.45 } : undefined}
      onWin={handleMatchComplete}
      onAbandon={() => {}}
    />
  );
}
