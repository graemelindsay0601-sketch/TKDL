/**
 * CardClashMatchLauncher
 * Handles: opponent selection → game mode → equipment → launch match
 */

import React, { useState, useEffect } from "react";
import { CardClashMatchScorer } from "./CardClashMatchScorer";
import { CardEquipmentSelector } from "./CardEquipmentSelector";
import type { GameResult } from "./game-scorer";

interface Player {
  id: number;
  name: string;
}

interface CardClashMatchLauncherProps {
  currentPlayerId: number;
  currentPlayerName: string;
  onMatchComplete: () => void;
}

type Step = "opponent" | "gamemode" | "equipment" | "match";

export function CardClashMatchLauncher({
  currentPlayerId,
  currentPlayerName,
  onMatchComplete,
}: CardClashMatchLauncherProps) {
  const [step, setStep] = useState<Step>("opponent");
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<Player | null>(null);
  const [gameMode, setGameMode] = useState<"X01" | "CRICKET" | null>(null);
  const [player1Cards, setPlayer1Cards] = useState<any[]>([]);
  const [player2Cards, setPlayer2Cards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch available opponents
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch("/api/players");
        const data = await res.json();
        setPlayers(data.filter((p: Player) => p.id !== currentPlayerId));
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch players:", err);
        setLoading(false);
      }
    };
    fetchPlayers();
  }, [currentPlayerId]);

  const handleOpponentSelect = (opponent: Player) => {
    setSelectedOpponent(opponent);
    setStep("gamemode");
  };

  const handleGameModeSelect = (mode: "X01" | "CRICKET") => {
    setGameMode(mode);
    setStep("equipment");
  };

  const handleEquipmentConfirm = (p1Cards: any[], p2Cards: any[]) => {
    setPlayer1Cards(p1Cards);
    setPlayer2Cards(p2Cards);
    setStep("match");
  };

  const handleMatchComplete = async (result: GameResult, cardsUsed: string[]) => {
    try {
      // Calculate if card effects changed the outcome
      // (In a full implementation, card effects would modify live scoring)
      // For now, we record the cards used and the base result
      
      const winnerId = result.winnerIdx === 0 ? currentPlayerId : selectedOpponent!.id;
      
      // Record match result to backend
      const matchRes = await fetch("/api/card-clash/match/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerId,
          cardsUsedInMatch: cardsUsed,
          finalScores: result.detail ? { player1: 0, player2: 0 } : undefined,
        }),
      });

      if (!matchRes.ok) {
        throw new Error("Failed to record match");
      }

      onMatchComplete();
    } catch (err) {
      console.error("Failed to record match:", err);
      // Still notify completion even on error
      onMatchComplete();
    }
  };

  // STEP 1: Opponent Selection
  if (step === "opponent") {
    return (
      <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
        <h2>Card Clash - Select Opponent</h2>
        {loading ? (
          <p>Loading players...</p>
        ) : players.length === 0 ? (
          <p>No other players available</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            {players.map(player => (
              <button
                key={player.id}
                onClick={() => handleOpponentSelect(player)}
                style={{
                  padding: "1.5rem",
                  borderRadius: "8px",
                  border: "2px solid #0066ff",
                  background: "linear-gradient(135deg, #f0f4ff 0%, #e6f0ff 100%)",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: "600",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)";
                  (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(135deg, #e6f0ff 0%, #d6e8ff 100%)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                  (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(135deg, #f0f4ff 0%, #e6f0ff 100%)";
                }}
              >
                {player.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // STEP 2: Game Mode Selection
  if (step === "gamemode") {
    return (
      <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
        <h2>Card Clash - Select Game Mode</h2>
        <p>Playing against: <strong>{selectedOpponent?.name}</strong></p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <button
            onClick={() => handleGameModeSelect("X01")}
            style={{
              padding: "2rem",
              borderRadius: "8px",
              border: "2px solid #0066ff",
              background: "linear-gradient(135deg, #f0f4ff 0%, #e6f0ff 100%)",
              cursor: "pointer",
              fontSize: "18px",
              fontWeight: "700",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            }}
          >
            X01<br /><span style={{ fontSize: "14px", opacity: 0.7 }}>501/301</span>
          </button>
          <button
            onClick={() => handleGameModeSelect("CRICKET")}
            style={{
              padding: "2rem",
              borderRadius: "8px",
              border: "2px solid #ff6b6b",
              background: "linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)",
              cursor: "pointer",
              fontSize: "18px",
              fontWeight: "700",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
            }}
          >
            Cricket<br /><span style={{ fontSize: "14px", opacity: 0.7 }}>Marks & Close</span>
          </button>
        </div>
        <button
          onClick={() => setStep("opponent")}
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1.5rem",
            background: "#f0f0f0",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          ← Back
        </button>
      </div>
    );
  }

  // STEP 3: Equipment Selection
  if (step === "equipment") {
    return (
      <CardEquipmentSelector
        currentPlayerId={currentPlayerId}
        currentPlayerName={currentPlayerName}
        opponentId={selectedOpponent!.id}
        opponentName={selectedOpponent!.name}
        gameMode={gameMode!}
        onConfirm={handleEquipmentConfirm}
        onBack={() => setStep("gamemode")}
      />
    );
  }

  // STEP 4: Match in Progress
  if (step === "match") {
    return (
      <CardClashMatchScorer
        player1Id={currentPlayerId}
        player1Name={currentPlayerName}
        player2Id={selectedOpponent!.id}
        player2Name={selectedOpponent!.name}
        gameMode={gameMode!}
        player1EquippedCards={player1Cards}
        player2EquippedCards={player2Cards}
        onMatchComplete={handleMatchComplete}
        isBot={false}
      />
    );
  }

  return null;
}
