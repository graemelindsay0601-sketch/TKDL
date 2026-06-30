/**
 * CardClashPracticeContainer
 * Manages state for Card Clash Practice tab
 */

import React, { useState } from "react";
import { CardClashPracticeUI } from "./CardClashPracticeUI";
import { CardClashPracticeGame } from "./CardClashPracticeGame";

interface Props {
  playerId: number;
  playerName: string;
}

export function CardClashPracticeContainer({ playerId, playerName }: Props) {
  const [practiceMatchId, setPracticeMatchId] = useState<number | null>(null);
  const [launching, setLaunching] = useState(false);

  // Game is launching - show the game player
  if (launching && practiceMatchId) {
    return (
      <CardClashPracticeGame
        playerId={playerId}
        playerName={playerName}
        practiceMatchId={practiceMatchId}
        onDone={() => {
          setLaunching(false);
          setPracticeMatchId(null);
        }}
      />
    );
  }

  // Show the practice setup UI
  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <CardClashPracticeUI
        playerId={playerId}
        playerName={playerName}
        onMatchCreated={(matchId) => {
          setPracticeMatchId(matchId);
          setLaunching(true);
        }}
      />
    </div>
  );
}
