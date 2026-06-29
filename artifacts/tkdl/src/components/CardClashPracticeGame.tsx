/**
 * CardClashPracticeGame
 * Plays a practice Card Clash match
 */

import React, { useState, useEffect } from "react";
import { CardClashMatchScorer } from "./CardClashMatchScorer";

interface Props {
  playerId: number;
  playerName: string;
  practiceMatchId: number;
  onDone: () => void;
}

export function CardClashPracticeGame({ playerId, playerName, practiceMatchId, onDone }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchData, setMatchData] = useState<any>(null);

  useEffect(() => {
    const loadMatch = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/card-clash/practice/${practiceMatchId}`);
        if (!res.ok) throw new Error("Failed to load practice match");
        const data = await res.json();
        setMatchData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load match");
      } finally {
        setLoading(false);
      }
    };
    loadMatch();
  }, [practiceMatchId]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
        Loading practice match...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div style={{ color: "#ff6b6b", marginBottom: "16px" }}>⚠ {error}</div>
        <button
          onClick={onDone}
          style={{
            padding: "10px 20px",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "8px",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Back to Practice
        </button>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
        Preparing match...
      </div>
    );
  }

  // Render the match using CardClashMatchScorer
  return (
    <CardClashMatchScorer
      matchId={practiceMatchId}
      gameMode={matchData.gameMode}
      player1={{
        id: playerId,
        name: playerName,
      }}
      player2={{
        id: 9999,
        name: "🤖 Bot",
      }}
      matchCards={matchData.cards || {}}
      onComplete={() => onDone()}
      isPractice={true}
    />
  );
}
