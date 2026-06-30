/**
 * CardClashPracticeUI
 * Clean, standalone Card Clash practice interface
 * No mixed UI, no confusion - just practice
 */

import React, { useState } from "react";
import { CardEquipmentSelector } from "./CardEquipmentSelector";

interface Props {
  playerId: number;
  playerName: string;
  onMatchCreated: (matchId: number) => void;
}

type Step = "difficulty" | "gamemode" | "equipment" | "launching";

const DIFFICULTIES = [
  { id: "beginner", label: "Beginner", desc: "Easy warmup", emoji: "🟢" },
  { id: "intermediate", label: "Intermediate", desc: "Fair challenge", emoji: "🟡" },
  { id: "advanced", label: "Advanced", desc: "Punishing opponent", emoji: "🔴" },
];

const GAMEMODES = [
  { id: "x01", label: "X01", desc: "Standard darts format" },
  { id: "cricket", label: "Cricket", desc: "Strategic scoring" },
];

export function CardClashPracticeUI({ playerId, playerName, onMatchCreated }: Props) {
  const [step, setStep] = useState<Step>("difficulty");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedGameMode, setSelectedGameMode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDifficultySelect = (id: string) => {
    setSelectedDifficulty(id);
    setStep("gamemode");
  };

  const handleGameModeSelect = (id: string) => {
    setSelectedGameMode(id);
    setStep("equipment");
  };

  const handleEquipmentConfirm = async (equipment: any) => {
    try {
      setStep("launching");
      setError(null);

      // Get bot equipment (random selection filtered by game mode)
      const allCards = Array.from({ length: 100 }, (_, i) => i + 1);
      const goodCards = allCards.filter(id => {
        if (selectedGameMode === "cricket") return (id >= 301 && id <= 320) || (id >= 101 && id <= 120);
        return (id >= 101 && id <= 140) || (id >= 201 && id <= 240);
      });
      const badCards = allCards.filter(id => {
        if (selectedGameMode === "cricket") return (id >= 401 && id <= 420);
        return (id >= 401 && id <= 440);
      });

      const botGood = [];
      const botBad = [];
      for (let i = 0; i < 2; i++) {
        botGood.push(goodCards[Math.floor(Math.random() * goodCards.length)]);
        botBad.push(badCards[Math.floor(Math.random() * badCards.length)]);
      }

      // Create practice match
      const res = await fetch("/api/card-clash/practice/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          difficulty: selectedDifficulty,
          gameMode: selectedGameMode,
          playerEquippedCards: [...equipment.goodCards, ...equipment.badCards],
          botEquippedCards: [...botGood, ...botBad],
        }),
      });

      if (!res.ok) throw new Error("Failed to create practice match");
      const { matchId } = await res.json();
      onMatchCreated(matchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create match");
      setStep("equipment");
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: SELECT DIFFICULTY
  // ═══════════════════════════════════════════════════════════════════════
  if (step === "difficulty") {
    return (
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <div style={{
          borderRadius: "16px",
          background: "linear-gradient(135deg,rgba(0,200,150,0.1),rgba(0,150,120,0.05))",
          border: "1px solid rgba(0,200,150,0.2)",
          padding: "32px 24px",
          marginBottom: "24px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎯</div>
          <h2 style={{ margin: "0 0 8px", fontSize: "28px", fontWeight: 900, color: "#fff" }}>
            Card Clash Practice
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>
            Test your deck against AI opponents
          </p>
        </div>

        <div style={{ display: "grid", gap: "12px", marginBottom: "20px" }}>
          {DIFFICULTIES.map(diff => (
            <button
              key={diff.id}
              onClick={() => handleDifficultySelect(diff.id)}
              style={{
                all: "unset",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "16px 20px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(0,200,150,0.12)";
                el.style.borderColor = "rgba(0,200,150,0.3)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(255,255,255,0.04)";
                el.style.borderColor = "rgba(255,255,255,0.08)";
              }}
            >
              <div style={{ fontSize: "28px" }}>{diff.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff", marginBottom: "2px" }}>
                  {diff.label}
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>{diff.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: SELECT GAME MODE
  // ═══════════════════════════════════════════════════════════════════════
  if (step === "gamemode") {
    return (
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <button
          onClick={() => setStep("difficulty")}
          style={{
            all: "unset",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.6)",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: "20px",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "rgba(255,255,255,0.1)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "rgba(255,255,255,0.06)";
          }}
        >
          ← BACK
        </button>

        <div style={{
          borderRadius: "16px",
          background: "linear-gradient(135deg,rgba(0,200,150,0.1),rgba(0,150,120,0.05))",
          border: "1px solid rgba(0,200,150,0.2)",
          padding: "28px 24px",
          marginBottom: "24px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎮</div>
          <h2 style={{ margin: "0 0 8px", fontSize: "24px", fontWeight: 900, color: "#fff" }}>
            Select Game Mode
          </h2>
          <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
            {DIFFICULTIES.find(d => d.id === selectedDifficulty)?.label} difficulty
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          {GAMEMODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => handleGameModeSelect(mode.id)}
              style={{
                all: "unset",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "20px 16px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "center",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(0,200,150,0.12)";
                el.style.borderColor = "rgba(0,200,150,0.3)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(255,255,255,0.04)";
                el.style.borderColor = "rgba(255,255,255,0.08)";
              }}
            >
              <div style={{ fontSize: "28px" }}>
                {mode.id === "x01" ? "🎯" : "🏏"}
              </div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>
                {mode.label}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                {mode.desc}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: EQUIPMENT SELECTION
  // ═══════════════════════════════════════════════════════════════════════
  if (step === "equipment") {
    return (
      <div>
        <button
          onClick={() => setStep("gamemode")}
          style={{
            all: "unset",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.6)",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: "20px",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "rgba(255,255,255,0.1)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "rgba(255,255,255,0.06)";
          }}
        >
          ← BACK
        </button>

        {error && (
          <div style={{
            borderRadius: "12px",
            background: "rgba(255,100,100,0.1)",
            border: "1px solid rgba(255,100,100,0.3)",
            padding: "12px 16px",
            marginBottom: "20px",
            fontSize: "13px",
            color: "#ff6464",
          }}>
            ⚠ {error}
          </div>
        )}

        <CardEquipmentSelector
          currentPlayerId={playerId}
          currentPlayerName={playerName}
          gameMode={selectedGameMode === "cricket" ? "cricket" : "x01"}
          testMode={true}
          onCancel={() => setStep("gamemode")}
          onSelect={(equipment) => handleEquipmentConfirm(equipment)}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: LAUNCHING
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      padding: "60px 20px",
      textAlign: "center",
      color: "rgba(255,255,255,0.5)",
    }}>
      <div style={{ fontSize: "32px", marginBottom: "16px", animation: "spin 2s linear infinite" }}>
        🎮
      </div>
      <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px", color: "#fff" }}>
        Loading Practice Match
      </div>
      <div style={{ fontSize: "12px" }}>Preparing opponent...</div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
