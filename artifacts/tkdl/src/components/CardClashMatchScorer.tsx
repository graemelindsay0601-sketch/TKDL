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
import type { BotConfig } from "@/lib/bot-engine";

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
  /** The chosen bot's actual stats (Level Bot / Play a Pro / Player Clone).
   *  Falls back to a fixed mid-tier bot if isBot is true but this isn't set. */
  botConfig?: BotConfig;
  legs?: number;
  setsToWin?: number;
  legsToWinSet?: number;
  /** Chaos Mode: no pre-match equipping — 3 face-down mystery cards are
   *  dealt every visit instead. When true, equipped cards are ignored. */
  chaosMode?: boolean;
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
  botConfig,
  legs,
  setsToWin = 0,
  legsToWinSet = 3,
  chaosMode = false,
}: CardClashMatchScorerProps) {
  
  // Set sessionStorage BEFORE rendering scorers (not in useEffect)
  // This ensures scorers see the flag when they mount
  if (typeof window !== "undefined") {
    sessionStorage.setItem("card_clash_mode", "true");
    if (chaosMode) {
      sessionStorage.setItem("card_clash_chaos_mode", "true");
      sessionStorage.setItem("card_clash_p1_cards", "[]");
      sessionStorage.setItem("card_clash_p2_cards", "[]");
    } else {
      sessionStorage.removeItem("card_clash_chaos_mode");
      sessionStorage.setItem("card_clash_p1_cards", JSON.stringify(player1EquippedCards));
      sessionStorage.setItem("card_clash_p2_cards", JSON.stringify(player2EquippedCards));
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sessionStorage.removeItem("card_clash_mode");
      sessionStorage.removeItem("card_clash_chaos_mode");
      sessionStorage.removeItem("card_clash_p1_cards");
      sessionStorage.removeItem("card_clash_p2_cards");
    };
  }, []);

  // Don't pre-activate cards - wait for player to confirm activation in CardActivationOverlay
  // Cards should only activate when player clicks "Confirm"
  const cardEffects: any[] = [];

  const handleMatchComplete = (result: GameResult) => {
    onMatchComplete(result, []);
  };

  const handleAbandon = () => {
    onAbandon?.();
  };

  const resolvedBotConfig = isBot ? (botConfig ?? { avg: 62, sd: 12, checkoutPct: 0.34, hitAcc: 0.45 }) : undefined;

  // Render scorer directly - no wrapper, just like GameScorer/Practice mode
  if (gameMode === "X01") {
    return (
      <X01Scorer
        p1Name={player1Name}
        p2Name={player2Name}
        config={{ startingScore: 501, doubleOut: true }}
        botConfig={resolvedBotConfig}
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
        botConfig={resolvedBotConfig}
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
