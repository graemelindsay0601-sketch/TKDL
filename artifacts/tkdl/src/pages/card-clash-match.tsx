import React, { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { CardClashMatchScreen } from "@/components/CardClashMatchScreen";
import { useCurrentPlayer } from "@/context/auth";

export default function CardClashMatchPage() {
  const [, params] = useRoute("/card-clash/match/:matchId");
  const currentPlayer = useCurrentPlayer();
  const matchId = params?.matchId ? parseInt(params.matchId) : null;

  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId || !currentPlayer?.id) {
      setError("Invalid match or player");
      setLoading(false);
      return;
    }

    loadMatch();
  }, [matchId, currentPlayer?.id]);

  const loadMatch = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/card-clash/match/${matchId}`);
      if (!res.ok) {
        throw new Error("Failed to load match");
      }
      const data = await res.json();
      setMatch(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Loading match...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
        <p>Error: {error || "Match not found"}</p>
      </div>
    );
  }

  return (
    <CardClashMatchScreen
      matchId={match.id}
      player1Id={match.player1Id}
      player2Id={match.player2Id}
      gameMode={match.gameMode}
      equippedCards={match.equippedCards || []}
      currentPlayerId={currentPlayer?.id || 0}
      onBack={() => {
        window.history.back();
      }}
    />
  );
}
