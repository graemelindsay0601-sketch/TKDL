/**
 * CardClashMatchScorer
 *
 * Thin wrapper around the standard X01/Cricket scorers that activates Card Clash mode.
 * Writes each player's equipped cards to sessionStorage before the scorer mounts.
 * The scorer reads those cards, shows the card panel ONLY to the current player on their
 * turn, and applies effects to the live score/marks the instant a card is played.
 *
 * Normal X01/Cricket matches never touch sessionStorage 'card_clash_mode', so they never
 * show a card panel. Card Clash is a completely separate flow.
 */

import { useEffect } from "react";
import { X01Scorer, CricketScorer } from "@/lib/scorers";
import type { GameResult } from "./game-scorer";

interface CardClashMatchScorerProps {
  player1Id: number;
  player1Name: string;
  player2Id: number;
  player2Name: string;
  gameMode: "X01" | "CRICKET";
  player1EquippedCards: any[];
  player2EquippedCards: any[];
  onMatchComplete: (result: GameResult, cardsUsed: string[]) => void;
  isBot?: boolean;
}

export function CardClashMatchScorer({
  player1Name,
  player2Name,
  gameMode,
  player1EquippedCards,
  player2EquippedCards,
  onMatchComplete,
}: CardClashMatchScorerProps) {

  // Activate Card Clash mode in sessionStorage before the scorer mounts.
  // The scorer reads these keys on mount and enables the per-player card panel.
  // Cleanup runs when the match ends (component unmounts).
  useEffect(() => {
    sessionStorage.setItem("card_clash_mode", "true");
    sessionStorage.setItem("card_clash_p1_cards", JSON.stringify(player1EquippedCards));
    sessionStorage.setItem("card_clash_p2_cards", JSON.stringify(player2EquippedCards));
    return () => {
      sessionStorage.removeItem("card_clash_mode");
      sessionStorage.removeItem("card_clash_p1_cards");
      sessionStorage.removeItem("card_clash_p2_cards");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWin = (winnerIdx: 0 | 1, detail?: string) => {
    onMatchComplete({ winnerIdx, detail }, []);
  };

  const handleAbandon = () => {
    onMatchComplete({ winnerIdx: 0, detail: "abandoned" }, []);
  };

  if (gameMode === "X01") {
    return (
      <X01Scorer
        p1Name={player1Name}
        p2Name={player2Name}
        config={{ startingScore: 501, doubleOut: true }}
        onWin={handleWin}
        onAbandon={handleAbandon}
      />
    );
  }

  return (
    <CricketScorer
      p1Name={player1Name}
      p2Name={player2Name}
      onWin={handleWin}
      onAbandon={handleAbandon}
    />
  );
}
