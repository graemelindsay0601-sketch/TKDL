/**
 * CardClashPractice
 * Clean, single implementation of Card Clash practice mode
 * 
 * Flow: Opponent → Game Type → Equipment Selection → Bot Assignment → Game
 */

import React, { useState, useEffect } from "react";
import { CardEquipmentSelector } from "./CardEquipmentSelector";
import { ALL_CARDS } from "@/lib/cards-data";

interface Props {
  playerId: number;
  playerName: string;
  onMatchCreated: (matchId: number, playerEquipment: any, botEquipment: any) => void;
}

type Step = "opponent" | "gametype" | "equipment" | "confirm";

export function CardClashPractice({ playerId, playerName, onMatchCreated }: Props) {
  const [step, setStep] = useState<Step>("opponent");
  const [selectedGameType, setSelectedGameType] = useState<"X01" | "CRICKET" | null>(null);
  const [equippedCards, setEquippedCards] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ────────────────────────────────────────────────────────────────────
  // STEP 1: OPPONENT SELECTION
  // ────────────────────────────────────────────────────────────────────
  if (step === "opponent") {
    return (
      <div style={{ maxWidth: "600px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: 900, marginBottom: "8px" }}>
          Choose Your Opponent
        </h2>
        <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: "24px", fontSize: "14px" }}>
          Practice against a bot. No coins consumed, no cards lost from inventory.
        </p>

        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", 
          gap: "12px" 
        }}>
          {[
            { id: 1, name: "🤖 Beginner Bot", emoji: "🥉", desc: "Very Easy" },
            { id: 2, name: "🤖 Intermediate Bot", emoji: "🥈", desc: "Easy" },
            { id: 3, name: "🤖 Advanced Bot", emoji: "🥇", desc: "Hard" },
          ].map(bot => (
            <button
              key={bot.id}
              onClick={() => setStep("gametype")}
              style={{
                padding: "16px 12px",
                background: "rgba(52,211,153,0.08)",
                border: "1px solid rgba(52,211,153,0.3)",
                borderRadius: "10px",
                color: "#fff",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(52,211,153,0.15)";
                e.currentTarget.style.borderColor = "rgba(52,211,153,0.6)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(52,211,153,0.08)";
                e.currentTarget.style.borderColor = "rgba(52,211,153,0.3)";
              }}
            >
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>{bot.emoji}</div>
              <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>
                {bot.name}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                {bot.desc}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // STEP 2: GAME TYPE SELECTION
  // ────────────────────────────────────────────────────────────────────
  if (step === "gametype") {
    return (
      <div style={{ maxWidth: "600px" }}>
        <button
          onClick={() => setStep("opponent")}
          style={{
            all: "unset",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 16px",
            marginBottom: "1.5rem",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.45)",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ← BACK
        </button>

        <h2 style={{ fontSize: "24px", fontWeight: 900, marginBottom: "8px" }}>
          Select Game Type
        </h2>
        <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: "24px", fontSize: "14px" }}>
          Choose how to play.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {[
            { type: "X01" as const, name: "X01", emoji: "🎯", desc: "Finish on double" },
            { type: "CRICKET" as const, name: "Cricket", emoji: "🏏", desc: "Mark 15-20 & bulls" },
          ].map(game => (
            <button
              key={game.type}
              onClick={() => {
                setSelectedGameType(game.type);
                setStep("equipment");
              }}
              style={{
                padding: "20px 16px",
                background: "rgba(59,130,246,0.08)",
                border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: "10px",
                color: "#fff",
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(59,130,246,0.15)";
                e.currentTarget.style.borderColor = "rgba(59,130,246,0.6)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(59,130,246,0.08)";
                e.currentTarget.style.borderColor = "rgba(59,130,246,0.3)";
              }}
            >
              <div style={{ fontSize: "40px", marginBottom: "8px" }}>{game.emoji}</div>
              <div style={{ fontWeight: 900, fontSize: "18px", marginBottom: "4px" }}>
                {game.name}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                {game.desc}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // STEP 3: EQUIPMENT SELECTION
  // ────────────────────────────────────────────────────────────────────
  if (step === "equipment" && selectedGameType) {
    return (
      <div>
        <button
          onClick={() => {
            setSelectedGameType(null);
            setStep("gametype");
          }}
          style={{
            all: "unset",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 16px",
            marginBottom: "1.5rem",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.45)",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ← BACK
        </button>

        <CardEquipmentSelector
          currentPlayerId={playerId}
          currentPlayerName={playerName}
          gameMode={selectedGameType}
          testMode={true}
          onSelect={(equipment) => {
            setEquippedCards(equipment);
            setStep("confirm");
          }}
          onCancel={() => {
            setSelectedGameType(null);
            setStep("gametype");
          }}
        />
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // STEP 4: CONFIRM & LAUNCH
  // ────────────────────────────────────────────────────────────────────
  if (step === "confirm" && equippedCards && selectedGameType) {
    const goodCards = equippedCards.goodCards || [];
    const badCards = equippedCards.badCards || [];

    const handleLaunchPractice = async () => {
      if (goodCards.length !== 2 || badCards.length !== 2) {
        setError("Must equip exactly 2 GOOD and 2 BAD cards");
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Generate random bot equipment
        const gameTypeKey = selectedGameType === "X01" ? "X01" : "CRICKET";
        const botGoodCards = ALL_CARDS.filter(
          (c) => c.cardType === "GOOD" && (c.gameMode === gameTypeKey || c.gameMode === "WILDCARD")
        );
        const botBadCards = ALL_CARDS.filter(
          (c) => c.cardType === "BAD" && (c.gameMode === gameTypeKey || c.gameMode === "WILDCARD")
        );

        const shuffle = (arr: any[]) => [...arr].sort(() => Math.random() - 0.5);
        const botEquipped = [
          ...shuffle(botGoodCards).slice(0, 2),
          ...shuffle(botBadCards).slice(0, 2),
        ];

        // Create practice match
        const response = await fetch("/api/card-clash/practice/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            gameMode: selectedGameType,
            playerEquippedCards: [...goodCards, ...badCards].map((c: any) => ({
              cardId: c.id,
              name: c.name,
              cardType: c.cardType,
            })),
            botEquippedCards: botEquipped.map((c: any) => ({
              cardId: c.id,
              name: c.name,
              cardType: c.cardType,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create practice match");
        }

        const data = await response.json();
        onMatchCreated(data.matchId, equippedCards, botEquipped);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to launch practice match");
      } finally {
        setLoading(false);
      }
    };

    return (
      <div style={{ maxWidth: "600px" }}>
        <button
          onClick={() => setStep("equipment")}
          style={{
            all: "unset",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "9px 16px",
            marginBottom: "1.5rem",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.45)",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ← BACK
        </button>

        <h2 style={{ fontSize: "24px", fontWeight: 900, marginBottom: "8px" }}>
          ✓ Ready to Practice?
        </h2>

        <div style={{
          padding: "16px",
          background: "rgba(52,211,153,0.08)",
          border: "1px solid rgba(52,211,153,0.2)",
          borderRadius: "10px",
          marginBottom: "20px",
        }}>
          <div style={{ marginBottom: "16px" }}>
            <div style={{
              fontSize: "12px",
              color: "rgba(255,255,255,0.5)",
              marginBottom: "8px",
              fontWeight: 700,
            }}>
              ⚡ GOOD CARDS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {goodCards.map((c: any, i: number) => (
                <div
                  key={i}
                  style={{
                    fontSize: "12px",
                    padding: "8px",
                    background: "rgba(34,197,94,0.1)",
                    border: "1px solid rgba(34,197,94,0.3)",
                    borderRadius: "6px",
                    color: "#22c55e",
                  }}
                >
                  {c.name}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{
              fontSize: "12px",
              color: "rgba(255,255,255,0.5)",
              marginBottom: "8px",
              fontWeight: 700,
            }}>
              ✗ BAD CARDS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {badCards.map((c: any, i: number) => (
                <div
                  key={i}
                  style={{
                    fontSize: "12px",
                    padding: "8px",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "6px",
                    color: "#ef4444",
                  }}
                >
                  {c.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            padding: "12px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "8px",
            color: "#fca5a5",
            fontSize: "12px",
            marginBottom: "16px",
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLaunchPractice}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            background: loading ? "rgba(255,255,255,0.1)" : "rgba(52,211,153,0.3)",
            border: "1px solid rgba(52,211,153,0.5)",
            borderRadius: "10px",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? "Launching..." : "▶ START PRACTICE"}
        </button>
      </div>
    );
  }

  return <div>Loading...</div>;
}
