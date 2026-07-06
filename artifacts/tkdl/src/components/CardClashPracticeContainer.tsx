/**
 * CardClashPracticeContainer
 * Manages state for Card Clash Practice - fully client-side, no DB persistence
 * (no stakes, no coins, no leaderboard impact - purely for deck testing/reps)
 */

import React, { useState } from "react";
import { CardClashPracticeUI } from "./CardClashPracticeUI";
import { CardClashMatchScorer } from "./CardClashMatchScorer";
import type { CardData } from "@/lib/cards-data";

interface Props {
  playerId: number;
  playerName: string;
}

interface ReadyState {
  bot: { id: string; name: string; avatar: string; skillLevel: number };
  gameMode: "X01" | "CRICKET";
  playerCards: CardData[];
  botCards: CardData[];
}

export function CardClashPracticeContainer({ playerId, playerName }: Props) {
  const [match, setMatch] = useState<ReadyState | null>(null);

  if (match) {
    return (
      <CardClashMatchScorer
        player1Id={playerId}
        player1Name={playerName}
        player2Id={-1}
        player2Name={match.bot.name}
        gameMode={match.gameMode}
        player1EquippedCards={match.playerCards.map(c => ({ ...c, used: false }))}
        player2EquippedCards={match.botCards.map(c => ({ ...c, used: false }))}
        onMatchComplete={() => setMatch(null)}
        onAbandon={() => setMatch(null)}
        isBot={true}
        legs={1}
      />
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <CardClashPracticeUI
        playerId={playerId}
        playerName={playerName}
        onMatchReady={(opts) => setMatch(opts)}
      />
    </div>
  );
}
